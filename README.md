# Distil — Document Q&A (RAG)

> Upload a Terms & Conditions, privacy policy, or research paper. Ask natural-language questions. Get grounded answers with visible source citations — no hallucinations.

**Tech Stack:** React + Vite (Frontend) · Node/Express (Backend) · Gemini API (`gemini-embedding-001` Embeddings) · Groq LPU (`llama-3.3-70b-versatile` Generation) · In-memory Vector Store

---

## Key Features

- **Domain-Aware Chunkers**: Custom legal boundary chunker (splitting on section headers like `Section 8.2` or `ARTICLE III`) and academic paper chunker (splitting on Abstract, Methods, Results, Discussion).
- **Gemini Embeddings**: Generates high-density 3072-dimensional vector embeddings using Google AI's `gemini-embedding-001`.
- **Groq LPU Generation**: Sub-second grounded answer generation (~350ms) using `llama-3.3-70b-versatile` (with automatic fallback to `llama-3.1-8b-instant`).
- **Zero-Hallucination Grounding**: Answers exclusively from retrieved document chunks. Refuses out-of-document queries with explicit evidence citations.
- **Distil Knowledge Funnel**: Custom SVG loading screen with converging particle funnel and progress ring.
- **Minimalist Flat Design**: High-contrast, clean 2-column workspace layout using a flat color palette (Deep Navy-Ink `#1F4E79`, Background `#F7F8FA`, Hairline Borders `#E3E6EA`) with zero gradients.

---

## Project Structure

```
Distil/
├── frontend/                  # React + Vite client (port 5173)
│   └── src/
│       ├── components/
│       │   ├── UploadPanel.jsx       # PDF dropzone & paste text tab
│       │   ├── IngestionStatus.jsx   # SVG Distillation Funnel loading screen
│       │   ├── ChatInterface.jsx     # 2-column AI Knowledge Workspace & Claude-style messages
│       │   └── SourcesPanel.jsx      # Perplexity-style Evidence Citations cards
│       ├── App.jsx                   # View architecture shell (landing → upload → ingesting → chat)
│       ├── App.css                   # Landing page & shell layout
│       └── index.css                 # Flat design system tokens & typography
├── backend/                   # Node/Express API (port 3001)
│   ├── routes/
│   │   ├── upload.js         # POST /api/upload, POST /api/ingest-text
│   │   └── query.js          # POST /api/query
│   ├── services/
│   │   ├── chunker.js        # Domain-aware legal & academic chunkers
│   │   ├── embedder.js       # Throttled Gemini embedding service
│   │   ├── retriever.js      # Cosine similarity vector search
│   │   └── generator.js      # Groq LPU grounded generator service
│   ├── store/
│   │   └── vectorStore.js    # In-memory session-scoped vector index
│   └── server.js             # Express API entry point
└── docs/
    ├── prd-document-qa-rag.md
    └── rag-implementation-plan.md
```

---

## Quick Start

### 1. Prerequisites & API Keys
You will need two free API keys:
1. **Gemini API Key**: Free at [Google AI Studio](https://aistudio.google.com) (for vector embeddings).
2. **Groq API Key**: Free at [Groq Console](https://console.groq.com) (for ultra-fast LPU answer generation).

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set your keys:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Start Backend Server

```bash
cd backend
npm install
npm start
# Server running at http://localhost:3001
# Health check: http://localhost:3001/api/health
```

### 4. Start Frontend Application

```bash
cd frontend
npm install
npm run dev
# App running at http://localhost:5173
```

---

## Implementation Progress

| Phase | Description | Status |
|-------|-------------|--------|
| **0** | Scaffold (Vite + Express API) | ✅ Done |
| **1** | Ingestion & Domain-Aware Chunking (Legal & Academic) | ✅ Done |
| **2** | Throttled Vector Embeddings (`gemini-embedding-001`) | ✅ Done |
| **3** | Cosine Similarity Vector Retrieval & Top-K Indexing | ✅ Done |
| **4** | Sub-Second Grounded Generation via Groq LPU (`llama-3.3-70b`) | ✅ Done |
| **5** | Distil Knowledge Funnel Animation & Loading Screen | ✅ Done |
| **6** | 2-Column AI Knowledge Workspace & Perplexity Evidence Citations | ✅ Done |
| **7** | Minimalist Flat Color Palette & High-Contrast Typography | ✅ Done |

---

## API Reference

### `POST /api/upload`
Upload a PDF document for ingestion.
- **Body:** `multipart/form-data` (`file` PDF, `docType`: `legal` | `academic` | `auto`)
- **Response:** `{ success, sessionId, chunkCount, docType, sourceDoc }`

### `POST /api/ingest-text`
Ingest raw pasted text directly.
- **Body:** `{ text: string, docType?: string, sourceDoc?: string }`
- **Response:** `{ success, sessionId, chunkCount, docType, sourceDoc }`

### `POST /api/query`
Query an ingested document session.
- **Body:** `{ sessionId: string, question: string, k?: number, history?: Array }`
- **Response:** `{ answer, sources: [{ chunkId, text, score, metadata }], noMatch, model }`

### `GET /api/health`
Health check — returns backend status, Gemini API key presence, and Groq LPU key presence.