# Rocky Legal (NyayaAI) — Project Overview & Handoff Guide

## 1. Executive Summary
**Rocky Legal** (formerly NyayaAI) is an AI-powered legal research platform tailored for Indian jurisprudence. It provides advocates, law firms, and legal researchers with citation-grounded answers across Supreme Court & High Court judgments, constitutional articles, and the new Indian criminal codes (Bharatiya Nyaya Sanhita - BNS, BNSS, BSA).

---

## 2. System Architecture & Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend (Vercel)                     │
│               https://www.rocky.legal                       │
│           Next.js 16.3 (Turbopack, React 19)                │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / WSS
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend Server 2 VPS (82.41.67.195)         │
│               https://api.rocky.legal                       │
│    - Nginx Reverse Proxy (SSL via Let's Encrypt)            │
│    - NestJS 11 Application (Port 4000)                      │
│    - Redis Stack (Port 6379, 8001)                          │
│    - Local CPU Embedding Service (embeding-model :8000)     │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               │ Internal / Tunneled          │ Cloud DB / APIs
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   Server 1 (82.41.67.7)      │ │   External Cloud Services  │
│ - Qdrant Vector DB (:6333)   │ │ - MongoDB Atlas            │
│   (Reverse SSH tunneled to   │ │ - Hostinger SMTP           │
│    Server 2 localhost:6333)  │ │ - Better Auth (Google OAuth│
└──────────────────────────────┘ └────────────────────────────┘
```

### Components Breakdown:
* **Client / Frontend (`/client`)**:
  * **Framework**: Next.js 16.3 (App Router, Turbopack, Tailwind CSS v4, Zustand).
  * **Hosting**: Vercel (`https://rocky.legal` and `https://www.rocky.legal`).
  * **Routing**:
    * `/`: Landing page (Hero, Why Rocky Legal, Grounded About section, Footer).
    * `/ask` & `/ask/c/[threadId]`: AI Legal chat & research workspace with streaming responses.
    * `/internal/ingestion`: Admin dashboard for uploading & indexing legal PDFs and bare acts.
    * `/privacy`: Comprehensive DPDP Act 2023 & IT Act 2000 Privacy Policy with Zero-Training Guarantee.
    * `/terms`: Legal AI Terms of Use with mandatory advocate independent verification clause.
* **Backend (`/backend`)**:
  * **Framework**: NestJS 11 (TypeScript, LangGraph, Axios, Nodemailer).
  * **Hosting**: Server 2 VPS (`82.41.67.195`), container `nyayaai-backend` running on port 4000.
  * **Public Gateway**: Nginx reverse proxy routing `https://api.rocky.legal` to `localhost:4000` with WebSocket & SSE streaming support (`proxy_buffering off`).
* **Vector Database (Qdrant)**:
  * Running on Server 1 (`82.41.67.7:6333`), connected to Server 2 via persistent reverse SSH tunnel service (`localhost:6333`).
  * Stores hybrid collections: **Dense vectors** (1024-dim) + **Sparse vectors** (lexical tokens).
* **Primary Database**:
  * **MongoDB Atlas**: Stores user accounts, sessions, chat threads, messages, and document ingestion metadata.
* **Cache & Message Broker**:
  * **Redis Stack**: Running on Server 2 (`:6379`), handles BullMQ job queues for document parsing and caching.

---

## 3. Core Application Flows

### A. Authentication & Session Flow
1. User logs in via Google OAuth or Email OTP (Hostinger SMTP).
2. **Better Auth** issues secure cryptographic session cookies.
3. Next.js middleware ([`client/proxy.ts`](file:///home/sunil/_codding/HTML/genAi/fiver/client/proxy.ts)) inspects `getSessionCookie` and queries `https://api.rocky.legal/api/auth/get-session` to authorize access to `/ask` and check the admin email allowlist for `/internal/ingestion`.

### B. Document Ingestion Pipeline (`/internal/ingestion`)
1. Admin uploads legal documents (PDFs, court orders, gazettes, bare acts).
2. NestJS processes files using BullMQ background workers:
   * Extracts text / OCR.
   * Splits into semantic chunks.
   * Sends chunks to the embedding microservice (`/embed`) to generate **Dense (1024-dim)** and **Sparse (BGE-M3 lexical weights)** vectors.
   * Classifies document type into 14 Indian legal categories (`/classify`).
   * Upserts payload and vectors into Qdrant.

### C. Search & Legal RAG Pipeline (`/ask`)
1. User submits a legal query (e.g., *"Anticipatory bail conditions under BNSS"*).
2. The query is converted into dense and sparse embeddings via BGE-M3.
3. Qdrant performs a **Hybrid Search** (combining semantic meaning + keyword matches).
4. Top candidates are passed to the **BGE-Reranker-v2-m3** cross-encoder (`/rerank`) to score relevance.
5. LangGraph synthesizes the final response using retrieved statutory sections and court judgments, enforcing strict citation references with no hallucinated case law.

---

## 4. Key Code Changes Completed

1. **Footer & Navigation Cleanup**:
   - Removed the obsolete "Product" column from [`client/components/Footer.tsx`](file:///home/sunil/_codding/HTML/genAi/fiver/client/components/Footer.tsx).
   - Re-aligned the footer grid into 12 responsive columns (Brand: 6 cols, Company: 3 cols, Legal: 3 cols).
   - Updated desktop and mobile navigation links in [`client/components/Navbar.tsx`](file:///home/sunil/_codding/HTML/genAi/fiver/client/components/Navbar.tsx) to `/#about` and `/#features`.
2. **Grounded Legal About Section**:
   - Rewrote [`client/components/HowItWorksSection.tsx`](file:///home/sunil/_codding/HTML/genAi/fiver/client/components/HowItWorksSection.tsx) (`#about`) to focus on verifiable jurisprudence, RAG retrieval over hallucination, and advocate augmentation rather than marketing hype.
3. **Legal AI Compliance & Governance**:
   - Created [`client/app/privacy/page.tsx`](file:///home/sunil/_codding/HTML/genAi/fiver/client/app/privacy/page.tsx): Tailored for DPDP Act 2023, featuring a prominent **Zero-Training Guarantee** for legal queries.
   - Created [`client/app/terms/page.tsx`](file:///home/sunil/_codding/HTML/genAi/fiver/client/app/terms/page.tsx): Outlines professional advocate verification obligations and disclaims formal attorney-client relationships.
   - Updated [`client/app/sitemap.ts`](file:///home/sunil/_codding/HTML/genAi/fiver/client/app/sitemap.ts) with `/privacy` and `/terms`.
4. **Backend & Hostinger SMTP Fixes**:
   - Stripped literal quotes from `.env.backend` variables (`SMTP_HOST`, `EMAIL_USER`) and added regex sanitizers in [`backend/src/auth.ts`](file:///home/sunil/_codding/HTML/genAi/fiver/backend/src/auth.ts), resolving OTP delivery failures.
   - Configured Google OAuth `prompt: 'select_account'` for cleaner account switching.
5. **Standalone GPU Embedding Microservice**:
   - Built [`embeding-gpu-model/`](file:///home/sunil/_codding/HTML/genAi/fiver/embeding-gpu-model) containing a standalone, CUDA-accelerated BGE-M3 + Reranker service with Dockerfile, docker-compose, and a 1-click bootstrap script (`setup-gcp-gpu.sh`).

---

## 5. Current Task & Next Steps

* **Current Goal**: Provisioning a cloud GPU instance (Google Cloud, RunPod, or Lambda) to run [`embeding-gpu-model/`](file:///home/sunil/_codding/HTML/genAi/fiver/embeding-gpu-model) for high-speed document ingestion.
* **Handoff Action**:
  1. Launch a GPU instance with an NVIDIA GPU (T4, L4, RTX 4090, or A100).
  2. Clone the repository and execute:
     ```bash
     cd embeding-gpu-model && sudo bash setup-gcp-gpu.sh
     ```
  3. In Server 2 `/root/.env.backend`, update:
     ```env
     EMBEDDING_SERVER_URL=http://<GPU_EXTERNAL_IP>:8000
     ```
  4. Perform bulk document ingestion via `https://www.rocky.legal/internal/ingestion`.
  5. When bulk ingestion is finished, the backend can be pointed back to the local CPU service (`http://localhost:8000`) for cost-effective daily queries.
