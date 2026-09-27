"""
Minimal embedding server for BGE-M3 — returns both dense and sparse vectors
in the shape the NestJS ingestion pipeline and Qdrant expect.

Run with: uvicorn embedding_server:app --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel
from FlagEmbedding import BGEM3FlagModel
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

@asynccontextmanager
async def lifespan(app: FastAPI):
    _precompute_category_embeddings()
    yield

app = FastAPI(lifespan=lifespan)

# ── Embedding model (BGE-M3) ──────────────────────────────────────
model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=False)

# ── Re-ranker model via Native Transformers (V5 Compatible) ──────
# This removes the breaking FlagReranker wrapper entirely.
# NOTE: Loaded on CPU because GPU (3.6GB) is fully used by BGE-M3.
# Reranker is only called at search time, not bulk ingestion, so CPU is fine.
reranker_model_name = "BAAI/bge-reranker-v2-m3"
reranker_tokenizer = AutoTokenizer.from_pretrained(reranker_model_name)
reranker_model = AutoModelForSequenceClassification.from_pretrained(reranker_model_name)
# Force CPU for reranker to avoid OOM, as BGE-M3 takes most of the VRAM
# if torch.cuda.is_available():
#     reranker_model = reranker_model.cuda().half()
reranker_model.eval()


# ── Embedding types ──────────────────────────────────────────────
class EmbedRequest(BaseModel):
    texts: list[str]


class SparseVector(BaseModel):
    indices: list[int]
    values: list[float]


class EmbedResponse(BaseModel):
    dense: list[list[float]]
    sparse: list[SparseVector]


# ── Re-ranking types ─────────────────────────────────────────────
class RerankRequest(BaseModel):
    query: str
    documents: list[str]


class RerankResponse(BaseModel):
    scores: list[float]


# ── Endpoints ────────────────────────────────────────────────────
@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    if not req.texts:
        return EmbedResponse(dense=[], sparse=[])

    output = model.encode(
        req.texts,
        return_dense=True,
        return_sparse=True,
        return_colbert_vecs=False,
    )

    dense = output["dense_vecs"].tolist()

    sparse = []
    for weights in output["lexical_weights"]:
        indices = []
        values = []
        for k, v in weights.items():
            try:
                indices.append(int(k))
            except ValueError:
                # Fallback if key is a text token string rather than an integer ID
                token_id = model.tokenizer.convert_tokens_to_ids(k)
                indices.append(token_id)
            values.append(float(v))
        sparse.append(SparseVector(indices=indices, values=values))

    return EmbedResponse(dense=dense, sparse=sparse)


@app.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest):
    """Re-rank documents using native transformers, bypassing FlagReranker bugs."""
    if not req.documents:
        return RerankResponse(scores=[])

    pairs = [[req.query, doc] for doc in req.documents]

    with torch.no_grad():
        inputs = reranker_tokenizer(
            pairs,
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=8192,
        )
        # Reranker is on CPU, so we don't move inputs to CUDA
        # if torch.cuda.is_available():
        #     inputs = {k: v.cuda() for k, v in inputs.items()}

        outputs = reranker_model(**inputs)
        scores = outputs.logits.view(-1).float().cpu().tolist()

    return RerankResponse(scores=scores)


# ── Document Classification via Embedding Similarity ─────────────
# Precompute category description embeddings once at startup.
# At classify time, embed the document text and pick highest cosine similarity.

import numpy as np

DOC_TYPE_DESCRIPTIONS = {
    "court_judgment": (
        "Court judgment or order issued by a judge deciding a legal dispute. "
        "Contains case title, parties (appellant vs respondent), coram, bench, "
        "legal reasoning, holding, and disposition. Includes Supreme Court, "
        "High Court, and District Court judgments."
    ),
    "tribunal_order": (
        "Order issued by an administrative or quasi-judicial tribunal such as "
        "NCLT, NCLAT, ITAT, DRT, DRAT, NGT, RERA, Competition Commission of India (CCI), "
        "CESTAT, APTEL, or TDSAT. Contains tribunal name, case number, and ruling."
    ),
    "central_act": (
        "Statutory Act, bare act, code, rules, or regulations enacted by the Indian Parliament "
        "or State Legislature. Includes IPC, CrPC, BNS, CPC, Constitution of India, "
        "ordinances, and delegated legislation."
    ),
    "circular_notification": (
        "Government circular, notification, advisory, guideline, or gazette notification "
        "issued by a ministry, department, or regulatory authority such as RBI, SEBI, "
        "or the Gazette of India."
    ),
    "writ_petition": (
        "Writ petition, special leave petition (SLP), criminal appeal, civil appeal, "
        "bail application, anticipatory bail, quashing petition, revision petition, "
        "or review petition filed before a court."
    ),
    "commercial_contract": (
        "Commercial contract, agreement, memorandum of understanding (MoU), "
        "non-disclosure agreement (NDA), lease deed, sale deed, power of attorney, "
        "service agreement, employment agreement, or indemnity bond."
    ),
    "criminal_complaint": (
        "Criminal complaint, First Information Report (FIR), chargesheet, charge sheet, "
        "police report under Section 173, complaint under Section 138 or 156(3), "
        "CBI or Enforcement Directorate investigation report."
    ),
    "legal_draft": (
        "Legal notice, reply to legal notice, written statement, rejoinder, affidavit, "
        "legal opinion, or other legal draft prepared by an advocate or legal professional."
    ),
}

# Precompute embeddings for each category description at startup
_category_embeddings: dict[str, np.ndarray] = {}


def _precompute_category_embeddings():
    """Run once at startup — embed all category descriptions."""
    global _category_embeddings
    descriptions = list(DOC_TYPE_DESCRIPTIONS.values())
    keys = list(DOC_TYPE_DESCRIPTIONS.keys())

    output = model.encode(descriptions, return_dense=True, return_sparse=False, return_colbert_vecs=False)
    vecs = output["dense_vecs"]  # numpy array (N, 1024)

    for i, key in enumerate(keys):
        _category_embeddings[key] = vecs[i] / np.linalg.norm(vecs[i])  # L2 normalize

    print(f"✅ Precomputed {len(_category_embeddings)} category embeddings for document classification")


class ClassifyRequest(BaseModel):
    text: str


class ClassifyResponse(BaseModel):
    docType: str
    confidence: float
    scores: dict[str, float]


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    """Classify a document by comparing its embedding against precomputed category embeddings."""
    if not req.text or not req.text.strip():
        return ClassifyResponse(docType="general_legal", confidence=0.0, scores={})

    # Embed the input text (first 2-4k chars from the caller)
    output = model.encode([req.text], return_dense=True, return_sparse=False, return_colbert_vecs=False)
    doc_vec = output["dense_vecs"][0]
    doc_vec = doc_vec / np.linalg.norm(doc_vec)  # L2 normalize

    # Cosine similarity against each category
    scores = {}
    for cat, cat_vec in _category_embeddings.items():
        scores[cat] = float(np.dot(doc_vec, cat_vec))

    # Pick highest
    best_cat = max(scores, key=scores.get)
    best_score = scores[best_cat]

    # If confidence is too low, fall back to general_legal
    if best_score < 0.5:
        return ClassifyResponse(docType="general_legal", confidence=best_score, scores=scores)

    return ClassifyResponse(docType=best_cat, confidence=best_score, scores=scores)




@app.get("/health")
def health():
    return {"status": "ok"}