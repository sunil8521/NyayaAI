"""
GPU-Accelerated Embedding & Re-ranking Microservice for Rocky Legal.

Models:
  - BGE-M3 (BAAI/bge-m3): Dense (1024-dim) + Sparse (lexical weights) vectors
  - BGE-Reranker-v2-m3 (BAAI/bge-reranker-v2-m3): Cross-encoder re-ranking

Optimized for NVIDIA GPUs (T4, L4, A100, RTX series) with FP16 precision.
"""

from contextlib import asynccontextmanager
import os
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import torch
import numpy as np
from FlagEmbedding import BGEM3FlagModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# ── Hardware & Model Configuration ────────────────────────────────
DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"
USE_FP16 = torch.cuda.is_available()
DEFAULT_BATCH_SIZE = int(os.getenv("BATCH_SIZE", "32"))
API_KEY = os.getenv("API_KEY", "").strip()

print(f"🚀 Initializing Embedding Microservice on device: {DEVICE} (FP16: {USE_FP16})")

# ── Document Type Category Descriptions for Auto-Classification ──
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

_category_embeddings: dict[str, np.ndarray] = {}

# ── Load Models ───────────────────────────────────────────────────
print("⏳ Loading BGE-M3 model...")
model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=USE_FP16, device=DEVICE)
print("✅ BGE-M3 model loaded.")

print("⏳ Loading BGE-Reranker-v2-m3...")
reranker_model_name = "BAAI/bge-reranker-v2-m3"
reranker_tokenizer = AutoTokenizer.from_pretrained(reranker_model_name)
reranker_dtype = torch.float16 if USE_FP16 else torch.float32
reranker_model = AutoModelForSequenceClassification.from_pretrained(
    reranker_model_name,
    torch_dtype=reranker_dtype,
).to(DEVICE)
reranker_model.eval()
print("✅ BGE-Reranker-v2-m3 loaded.")


def _precompute_category_embeddings():
    """Run once at startup — embed all category descriptions on GPU."""
    global _category_embeddings
    descriptions = list(DOC_TYPE_DESCRIPTIONS.values())
    keys = list(DOC_TYPE_DESCRIPTIONS.keys())

    with torch.inference_mode():
        output = model.encode(
            descriptions,
            batch_size=len(descriptions),
            max_length=1024,
            return_dense=True,
            return_sparse=False,
            return_colbert_vecs=False,
        )
    vecs = output["dense_vecs"]  # numpy array (N, 1024)

    for i, key in enumerate(keys):
        _category_embeddings[key] = vecs[i] / np.linalg.norm(vecs[i])  # L2 normalize

    print(f"✅ Precomputed {len(_category_embeddings)} category embeddings for classification on {DEVICE}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _precompute_category_embeddings()
    yield
    # Clean up GPU memory on shutdown
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


app = FastAPI(
    title="Rocky Legal GPU Embedding Service",
    description="High-throughput GPU inference for BGE-M3 and BGE-Reranker-v2",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Optional API Key Authentication ──────────────────────────────
async def verify_api_key(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
):
    if not API_KEY:
        return  # Open access if API_KEY is not configured in .env

    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif x_api_key:
        token = x_api_key.strip()

    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Key")


# ── Pydantic Request & Response Schemas ───────────────────────────
class SparseVector(BaseModel):
    indices: list[int]
    values: list[float]


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=256)


class EmbedResponse(BaseModel):
    dense: list[list[float]]
    sparse: list[SparseVector]


class TokenCountRequest(BaseModel):
    texts: list[str]


class TokenCountResponse(BaseModel):
    counts: list[int]


class RerankRequest(BaseModel):
    query: str
    documents: list[str]


class RerankResponse(BaseModel):
    scores: list[float]


class ClassifyRequest(BaseModel):
    text: str


class ClassifyResponse(BaseModel):
    docType: str
    confidence: float
    scores: dict[str, float]


# ── Endpoints ─────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Healthcheck endpoint returning GPU device info and VRAM stats."""
    gpu_available = torch.cuda.is_available()
    gpu_info = None

    if gpu_available:
        gpu_info = {
            "name": torch.cuda.get_device_name(0),
            "allocated_mb": round(torch.cuda.memory_allocated(0) / (1024 * 1024), 2),
            "reserved_mb": round(torch.cuda.memory_reserved(0) / (1024 * 1024), 2),
            "total_mb": round(torch.cuda.get_device_properties(0).total_memory / (1024 * 1024), 2),
        }

    return {
        "status": "ok",
        "device": DEVICE,
        "fp16": USE_FP16,
        "gpu": gpu_info,
        "default_batch_size": DEFAULT_BATCH_SIZE,
    }


@app.post("/embed", response_model=EmbedResponse, dependencies=[Depends(verify_api_key)])
def embed(req: EmbedRequest):
    """
    Generate dense (1024-dim) and sparse lexical vectors using BGE-M3 on GPU.
    Supports parallel batching up to 256 chunks.
    """
    if not req.texts:
        return EmbedResponse(dense=[], sparse=[])

    start_time = time.time()
    batch_size = min(len(req.texts), DEFAULT_BATCH_SIZE)

    with torch.inference_mode():
        output = model.encode(
            req.texts,
            batch_size=batch_size,
            max_length=8192,
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
                token_id = model.tokenizer.convert_tokens_to_ids(k)
                indices.append(token_id)
            values.append(float(v))
        sparse.append(SparseVector(indices=indices, values=values))

    duration_ms = round((time.time() - start_time) * 1000, 2)
    print(f"⚡ [GPU Embed] Embedded {len(req.texts)} texts in {duration_ms}ms (batch_size={batch_size})")

    return EmbedResponse(dense=dense, sparse=sparse)


@app.post("/rerank", response_model=RerankResponse, dependencies=[Depends(verify_api_key)])
def rerank(req: RerankRequest):
    """
    Re-rank documents against a query using BGE-Reranker-v2-m3 in FP16 on GPU.
    Processes all candidates in parallel batches without CPU latency bottlenecks.
    """
    if not req.documents:
        return RerankResponse(scores=[])

    start_time = time.time()
    pairs = [[req.query, doc] for doc in req.documents]

    with torch.inference_mode():
        inputs = reranker_tokenizer(
            pairs,
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=2048,
        ).to(DEVICE)

        outputs = reranker_model(**inputs)
        scores = outputs.logits.view(-1).float().cpu().tolist()

    duration_ms = round((time.time() - start_time) * 1000, 2)
    print(f"⚡ [GPU Rerank] Re-ranked {len(req.documents)} docs in {duration_ms}ms")

    return RerankResponse(scores=scores)


@app.post("/classify", response_model=ClassifyResponse, dependencies=[Depends(verify_api_key)])
def classify(req: ClassifyRequest):
    """
    Classify legal documents by computing cosine similarity against precomputed category embeddings.
    """
    if not req.text or not req.text.strip():
        return ClassifyResponse(docType="general_legal", confidence=0.0, scores={})

    with torch.inference_mode():
        output = model.encode(
            [req.text],
            batch_size=1,
            max_length=1024,
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

    best_cat = max(scores, key=scores.get)
    best_score = scores[best_cat]

    if best_score < 0.5:
        return ClassifyResponse(docType="general_legal", confidence=best_score, scores=scores)

    return ClassifyResponse(docType=best_cat, confidence=best_score, scores=scores)


@app.post("/count-tokens", response_model=TokenCountResponse, dependencies=[Depends(verify_api_key)])
def count_tokens(req: TokenCountRequest):
    """Count actual tokens using the native BGE-M3 tokenizer."""
    if not req.texts:
        return TokenCountResponse(counts=[])

    encodings = model.tokenizer(req.texts, add_special_tokens=False, padding=False, truncation=False)
    counts = [len(ids) for ids in encodings["input_ids"]]
    return TokenCountResponse(counts=counts)
