# Distil — Document Q&A (RAG)

> Upload a Terms & Conditions, privacy policy, or research paper. Ask natural-language questions. Get grounded answers with visible source citations — no hallucinations.

**Stack:** React + Vite (frontend) · Node/Express (backend) · Gemini API (embeddings + generation) · In-memory vector store

---

## Project Structure

```
Distil/
├── frontend/         # React + Vite app (port 5173)
│   └── src/
│       ├── components/
│       │   ├── UploadPanel.jsx      # PDF dropzone + paste toggle
│       │   ├── IngestionStatus.jsx  # Loading screen during embedding
│       │   ├── ChatInterface.jsx    # Multi-turn Q&A chat
│       │   └── SourcesPanel.jsx     # Collapsible source chunks per answer
│       ├── App.jsx                  # Root shell (landing → ingesting → chat)
│       └── index.css                # Design system / global tokens
├── backend/          # Node/Express API (port 3001)
│   ├── routes/
│   │   ├── upload.js    # POST /api/upload, POST /api/ingest-text
│   │   └── query.js     # POST /api/query
│   ├── services/
│   │   ├── chunker.js   # Legal + academic domain-aware chunkers
│   │   ├── embedder.js  # Throttled Gemini embedding with retry
│   │   └── retriever.js # Cosine similarity retrieval + top-k
│   ├── store/
│   │   └── vectorStore.js  # In-memory session-scoped vector store
│   └── server.js        # Express entry point
└── docs/
    ├── prd-document-qa-rag.md
    └── rag-implementation-plan.md
```

---

## Quick Start

### 1. Get a Gemini API key
Free at [Google AI Studio](https://aistudio.google.com) — no credit card required.

### 2. Configure backend

```bash
cd backend
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here
```

### 3. Start backend

```bash
cd backend
npm start
# → http://localhost:3001
# → http://localhost:3001/api/health
```

### 4. Start frontend

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

---

## Implementation Progress

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Scaffold (Vite + Express) | ✅ Done |
| 1 | Ingestion + Domain-Aware Chunking | ✅ Done |
| 2 | Throttled Embeddings (Gemini) | ✅ Done |
| 3 | Cosine Similarity Retrieval | ✅ Done |
| 4 | Grounded Generation | 🔜 Next |
| 5 | Frontend Polish | 🔜 Next |
| 6 | Deploy (Vercel + Render) | 🔜 Next |

---

## API Reference

### `POST /api/upload`
Upload a PDF for ingestion.
- **Body:** `multipart/form-data` — `file` (PDF), `docType` (`legal` | `academic` | `auto`)
- **Response:** `{ success, sessionId, chunkCount, docType, sourceDoc }`

### `POST /api/ingest-text`
Ingest raw pasted text.
- **Body:** `{ text, docType?, sourceDoc? }`
- **Response:** `{ success, sessionId, chunkCount, docType, sourceDoc }`

### `POST /api/query`
Query the ingested document.
- **Body:** `{ sessionId, question, k? }`
- **Response:** `{ answer, sources: [{ chunkId, text, score, metadata }], noMatch }`

### `GET /api/health`
Health check — confirms API key is set.