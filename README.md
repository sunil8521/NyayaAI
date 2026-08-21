# NyayaAI ⚖️✦

> **India's Premier AI Legal Assistant for Advocates, Law Firms, and Legal Researchers**

NyayaAI is an AI-powered legal research and assistant platform tailored specifically for the Indian legal system. It provides real-time access to Supreme Court judgments, High Court precedents, Bharatiya Nyaya Sanhita (BNS / BNSS / BSA 2023) statutes, and intelligent legal drafting.

---

## 🏛️ Project Architecture

This repository is organized as a full-stack monorepo:

```text
NyayaAI/
├── client/          # Next.js 16 (Turbopack) frontend with Tailwind CSS v4
│   ├── app/         # App Router pages & SEO (robots, sitemap, manifest)
│   ├── components/  # Modern, responsive UI components
│   ├── hooks/       # Custom React hooks (scroll reveal, etc.)
│   └── lib/         # Better Auth client & TanStack Query store
└── backend/         # NestJS 11 backend
    ├── src/
    │   ├── auth/    # Better Auth server (MongoDB adapter + Google OAuth)
    │   ├── langgraph/ # LangGraph agentic workflow engine
    │   ├── ingestion/ # Legal document parser & embedding pipeline
    │   └── tools/   # Legal tools (citation search, statute lookup)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- MongoDB instance
- Qdrant Vector DB
- Redis (for BullMQ queues)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Variables
- In `backend/`: Copy `.env.example` to `.env` and fill in credentials:
```bash
cp backend/.env.example backend/.env
```

### 3. Run Development Servers
```bash
# Start backend (NestJS on port 4000)
pnpm --filter backend start:dev

# Start client (Next.js on port 3000)
pnpm --filter client dev
```

---

## 🛡️ License
Private & Proprietary. All rights reserved.
