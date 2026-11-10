"""
Minimal embedding server for BGE-M3 — returns both dense and sparse vectors
in the shape the NestJS ingestion pipeline and Qdrant expect.

Run with: uvicorn embedding_server:app --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from pydantic import BaseModel, Field
import torch
from FlagEmbedding import BGEM3FlagModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# ── CPU thread configuration (leaves cores for NestJS API & OCR) ─
CPU_THREADS = int(os.getenv("MODEL_CPU_THREADS", "6"))
torch.set_num_threads(CPU_THREADS)
torch.set_num_interop_threads(1)

@asynccontextmanager
async def lifespan(app: FastAPI):
    _precompute_category_embeddings()
    yield

app = FastAPI(lifespan=lifespan)

# ── Embedding model (BGE-M3 on CPU) ───────────────────────────────
model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=False, devices=["cpu"])

# ── Re-ranker model via Native Transformers (V5 Compatible) ──────
# Loaded on CPU because GPU is not available on this server
reranker_model_name = "BAAI/bge-reranker-v2-m3"
reranker_tokenizer = AutoTokenizer.from_pretrained(reranker_model_name)
reranker_model = AutoModelForSequenceClassification.from_pretrained(reranker_model_name)
reranker_model.eval()


# ── Embedding types ──────────────────────────────────────────────
class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


class SparseVector(BaseModel):
    indices: list[int]
    values: list[float]


class EmbedResponse(BaseModel):
    dense: list[list[float]]
    sparse: list[SparseVector]


# ── Token counting types ──────────────────────────────────────────
class TokenCountRequest(BaseModel):
    texts: list[str]


class TokenCountResponse(BaseModel):
    counts: list[int]


# ── Re-ranking types ─────────────────────────────────────────────
class RerankRequest(BaseModel):
    query: str
    documents: list[str]


class RerankResponse(BaseModel):
    scores: list[float]


# ── Endpoints ────────────────────────────────────────────────────
@app.post("/count-tokens", response_model=TokenCountResponse)
def count_tokens(req: TokenCountRequest):
    """Accurately count tokens using the BGE-M3 model's native tokenizer."""
    if not req.texts:
        return TokenCountResponse(counts=[])

    encodings = model.tokenizer(req.texts, add_special_tokens=False, padding=False, truncation=False)
    counts = [len(ids) for ids in encodings["input_ids"]]
    return TokenCountResponse(counts=counts)


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    if not req.texts:
        return EmbedResponse(dense=[], sparse=[])

    with torch.inference_mode():
        output = model.encode(
            req.texts,
            batch_size=4,
            max_length=768,
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

    if len(dense) != len(req.texts) or len(sparse) != len(req.texts):
        raise RuntimeError("Embedding count mismatch between input and output vectors")

    return EmbedResponse(dense=dense, sparse=sparse)


@app.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest):
    """Re-rank documents using native transformers (optimized for CPU with max_length=512)."""
    if not req.documents:
        return RerankResponse(scores=[])

    # Cap to top 12 candidates to prevent CPU saturation
    docs = req.documents[:12]
    pairs = [[req.query, doc] for doc in docs]

    with torch.inference_mode():
        inputs = reranker_tokenizer(
            pairs,
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=512,
        )
        outputs = reranker_model(**inputs)
        scores = outputs.logits.view(-1).float().cpu().tolist()

    return RerankResponse(scores=scores)


# ── Document Classification via Embedding Similarity ─────────────
# Precompute category description embeddings once at startup.
# At classify time, embed the document text and pick highest cosine similarity.

import numpy as np

DOC_TYPE_DESCRIPTIONS = {
    "court_judgment": (
        "Final court judgment deciding a legal dispute on merits issued by the Supreme Court of India or High Court. "
        "Contains case title, parties (appellant vs respondent), coram, bench, legal reasoning, holding, and disposition."
    ),
    "court_order": (
        "Interim order, procedural order, daily order, or directions issued by a Court in pending proceedings."
    ),
    "tribunal_order": (
        "Order or judgment issued by an administrative or quasi-judicial tribunal such as "
        "NCLT, NCLAT, ITAT, DRT, DRAT, NGT, RERA, Competition Commission of India (CCI), CESTAT, APTEL, or TDSAT."
    ),
    "central_act": (
        "Central statutory bare act, code, statute, or ordinance enacted by the Indian Parliament, such as "
        "Indian Penal Code, Criminal Procedure Code, Bharatiya Nyaya Sanhita, Companies Act, Arbitration Act."
    ),
    "state_act": (
        "Statutory Act enacted by a State Legislature governing state-specific subjects and amendments."
    ),
    "rules_regulations": (
        "Subordinate or delegated legislation, statutory rules, regulations, guidelines, or bylaws framed under an Act."
    ),
    "circular": (
        "Administrative or regulatory circular, master circular, or advisory issued by authorities like RBI, SEBI, or Ministry."
    ),
    "notification": (
        "Official government notification, statutory notification, or gazetted order issued by a ministry or department."
    ),
    "gazette": (
        "The Gazette of India or State Official Gazette publication publishing statutes, rules, and government orders."
    ),
    "petition": (
        "Writ petition, Special Leave Petition (SLP), criminal appeal, civil appeal, or review petition filed by advocates."
    ),
    "application": (
        "Bail application, anticipatory bail application, complaint under Section 138 NI Act or Section 156(3) CrPC."
    ),
    "legal_contract": (
        "Commercial contract, agreement, memorandum of understanding (MoU), non-disclosure agreement (NDA), lease deed, or service agreement."
    ),
    "legal_notice": (
        "Statutory legal notice, reply to legal notice, advocate demand notice, or legal notice under Section 138."
    ),
    "legal_opinion": (
        "Legal opinion, formal advice on law, or legal memorandum prepared by senior advocate or legal counsel."
    ),
}

# Precompute embeddings for each category description at startup
_category_embeddings: dict[str, np.ndarray] = {}


def _precompute_category_embeddings():
    """Run once at startup — embed all category descriptions."""
    global _category_embeddings
    descriptions = list(DOC_TYPE_DESCRIPTIONS.values())
    keys = list(DOC_TYPE_DESCRIPTIONS.keys())

    with torch.inference_mode():
        output = model.encode(
            descriptions,
            batch_size=4,
            max_length=768,
            return_dense=True,
            return_sparse=False,
            return_colbert_vecs=False,
        )
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
    with torch.inference_mode():
        output = model.encode(
            [req.text],
            batch_size=1,
            max_length=768,
            return_dense=True,
            return_sparse=False,
            return_colbert_vecs=False,
        )
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