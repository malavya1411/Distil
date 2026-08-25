# Distil — Production Grade Document Intelligence & Grounded RAG Platform

> **Read Less. Understand More.**  
> Upload complex legal agreements,Terms & Conditions, privacy policies, or academic research papers. Ask natural language questions and receive sub second grounded answers backed by verbatim source passage citations with zero hallucinations.

---

## Key Working (How It Works)

1. **Upload & Domain-Aware Chunking**: Upload a PDF or paste text. Distil splits documents along legal section boundaries (e.g., `Section 8.2`) or paper headings instead of arbitrary character cuts.
2. **Vector Embedding**: Text chunks are embedded into 3072-dimensional vectors using Gemini API (`gemini-embedding-001`) and stored in a private, session-scoped in-memory vector index.
3. **Similarity Search & Retrieval**: When a question is asked, Distil performs cosine similarity search to retrieve the top-4 most relevant passage chunks clearing a strict `0.55` similarity threshold.
4. **Sub-Second Grounded Generation**: Retrieved chunks are passed to Groq LPU (`llama-3.3-70b-versatile`), producing a grounded answer with verbatim evidence citations in **~350ms** with zero hallucinations.

---

## Technical Overview & System Architecture

Distil is built on a high throughput Retrieval Augmented Generation(RAG) architecture engineered for privacy, mathematical precision, and sub-second end to end response latency.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     DISTIL SYSTEM ARCHITECTURE                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

 [ User PDF / Text ]
          │
          ▼
┌──────────────────┐
│ Upload & Ingest  │  (POST /api/upload | POST /api/ingest-text)
└─────────┬────────┘
          │
          ▼
┌──────────────────┐     Domain-Aware Regex Parsing
│ Chunking Engine  │ ──► Legal Boundary Chunker (SECTION, ARTICLE, CLAUSE)
└─────────┬────────┘     Academic Chunker (Abstract, Method, Results)
          │
          ▼
┌──────────────────┐     Throttled Batch Request (Rate-Limit Queue)
│ Gemini Embedder  │ ──► Model: gemini-embedding-001 (3072-dim vectors)
└─────────┬────────┘
          │
          ▼
┌──────────────────┐     In-Memory Session Store
│ Vector Index     │ ──► Session Isolation (Zero Disk Persistence)
└─────────┬────────┘
          │
  User Query (POST /api/query)
          │
          ▼
┌──────────────────┐     Cosine Similarity Ranking (dot product)
│ Vector Retriever │ ──► Score Thresholding (SIMILARITY_THRESHOLD = 0.55)
└─────────┬────────┘     Top-K Match Extraction (k=4)
          │
          ▼
┌──────────────────┐     Strict System Prompting (Zero Hallucination)
│ Groq LPU Gen     │ ──► Model: llama-3.3-70b-versatile (Inference ~350ms)
└─────────┬────────┘     Fallback: llama-3.1-8b-instant
          │
          ▼
┌──────────────────┐     Warm Parchment 2-Column Workspace
│ UI Presentation  │ ──► In-Page View Switching: RAG Chat, Clauses & Risk Matrix
└──────────────────┘
```

---

## In-Depth Architectural Components

### 1. Domain-Aware Boundary Chunking (`backend/services/chunker.js`)
Standard fixed-length character chunking frequently chops sentences across clause boundaries, breaking the semantic context of legal and academic documents. Distil utilizes domain-aware regex parsing:
- **Legal Mode**: Splits on uppercase section headers (`SECTION`, `ARTICLE`, `CLAUSE`, `SCHEDULE`, `EXHIBIT`, or numbered clauses like `8.2.1`). Preserves legal definitions intact.
- **Academic Mode**: Identifies paper structural headings (`Abstract`, `Introduction`, `Methodology`, `Experimental Setup`, `Results`, `Discussion`, `Conclusion`).
- **Sliding Overlap**: Maintains a 15% sliding window overlap between consecutive chunks to ensure context continuity across chunk seams.

### 2. Throttled Vector Embedding Engine (`backend/services/embedder.js`)
- **Embedding Model**: Google AI `gemini-embedding-001` producing 3072-dimensional floating-point vector representations.
- **Concurrency & Throttling**: Implements a Promise-based queue worker to respect API rate limits (QPM).
- **Exponential Backoff**: Automatic retry handling for HTTP `429 Too Many Requests` with jittered exponential backoff (`2^retry * 1000ms`).

### 3. Session-Scoped Vector Index & Retrieval (`backend/services/retriever.js` & `backend/store/vectorStore.js`)
- **In-Memory Security**: Embeddings and raw text live strictly in volatile memory (`Map<sessionId, SessionData>`). No database persistence or disk storage. Discarded when session resets.
- **Cosine Distance Search**: Computes normalized dot-product cosine similarity:
  $$\text{Cosine Similarity} = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\| \|\mathbf{B}\|}$$
- **Threshold Guard (`SIMILARITY_THRESHOLD = 0.55`)**: Chunks below 55% similarity score are discarded. If zero chunks clear the threshold, the system flags `noMatch: true` and refuses to answer rather than allowing model hallucination.

### 4. Sub-Second Groq LPU Answer Generation (`backend/services/generator.js`)
- **LPU Speed Advantage**: Generates answers via Groq's Language Processing Unit (LPU) hardware, cutting generation time down to **~350ms**.
- **Primary Model**: `llama-3.3-70b-versatile` (70 Billion parameter model offering superior instruction compliance for strict grounding rules).
- **Fallback Model**: `llama-3.1-8b-instant` (automatically triggered if rate limits are reached).
- **Strict Grounding Rules**: The system prompt forces the model to answer *exclusively* from retrieved context and explicitly refuse outside knowledge.

---

## Workspace Features & In-Page Collections

Distil provides three integrated workspace view modes available from the sidebar collections menu:

1. **RAG Document Chat**:
   - Multi-turn grounded Q&A interface.
   - Perplexity-style Evidence Citations cards showing exact source passages, page numbers, section headers, and similarity score (e.g., `98% match`).
   - Integrated single-row answer toolbar with Copy SVG button and evidence pill toggle.
   - Export Summary button to download full markdown exports (`.md`).
2. **Key Extracted Clauses**:
   - In-page structured view scanning the document for key legal/academic clauses.
   - Renders color-coded clause cards with clause number badges and plain-English summaries.
3. **Risk & Compliance Matrix**:
   - In-page risk analysis view extracting risk factors across Data Privacy, Liability, Termination, Financial Terms, and Intellectual Property.
   - Includes a severity summary bar (`HIGH`, `MEDIUM`, `LOW`) and a structured interactive matrix table linking risks directly to document clauses.

---

## Design System & UX Architecture

Distil features a warm parchment design language built for long-form reading, readability, and legal trust:

- **Warm Parchment Color Palette** (`index.css`):
  - **Background (`--bg-base`)**: `#f5f1e6` (Warm Parchment)
  - **Surface (`--bg-surface`)**: `#fffcf5` (Cream Card Surface)
  - **Border (`--border`)**: `#dbd0ba` (Soft Tan Borders)
  - **Text Primary (`--text-primary`)**: `#4a3f35` (Deep Espresso Brown)
  - **Text Secondary (`--text-secondary`)**: `#7d6b56` (Warm Taupe)
  - **Accent (`--accent-flat`)**: `#a67c52` (Terracotta Wood)
  - **Success (`--success`)**: `#4a7c59`
  - **Error (`--error`)**: `#b54a35`
- **Typography System**:
  - **Headings**: `Libre Baskerville` (Classic Serif)
  - **Body**: `Lora` (Book Serif)
  - **Monospace / Code / Scores**: `IBM Plex Mono`
- **In-Page SPA View Switching**: No popups or modal overlays — selecting collections switches views smoothly within the main workspace canvas.

---

## Directory Structure

```
Distil/
├── frontend/                      # React 18 + Vite client (port 5173)
│   └── src/
│       ├── components/
│       │   ├── UploadPanel.jsx       # PDF dropzone & paste text tab
│       │   ├── UploadPanel.css       # Dropzone & textarea styling
│       │   ├── IngestionStatus.jsx   # SVG Distillation Funnel loading screen
│       │   ├── IngestionStatus.css   # Loading screen CSS & keyframe animations
│       │   ├── ChatInterface.jsx     # 2-column RAG Workspace, header & floating composer
│       │   ├── ChatInterface.css     # Workspace layout grid & parchment styling
│       │   ├── SourcesPanel.jsx      # Perplexity-style Evidence Citations & toolbar
│       │   ├── SourcesPanel.css      # Citation cards & score badges styling
│       │   ├── ClausesPanel.jsx      # Key Extracted Clauses in-page view component
│       │   ├── ClausesPanel.css      # Clause cards & badge styling
│       │   ├── RiskMatrix.jsx        # Risk & Compliance Matrix in-page view component
│       │   └── RiskMatrix.css        # Risk matrix table & severity summary bar
│       ├── App.jsx                   # View state manager ('landing'|'upload'|'ingesting'|'chat')
│       ├── App.css                   # Landing page shell styling
│       └── index.css                 # Global CSS design tokens & warm parchment theme
├── backend/                       # Node.js + Express API server (port 3001)
│   ├── routes/
│   │   ├── upload.js         # POST /api/upload, POST /api/ingest-text
│   │   └── query.js          # POST /api/query
│   ├── services/
│   │   ├── chunker.js        # Domain-aware legal & academic boundary chunkers
│   │   ├── embedder.js       # Gemini API throttled embedding service (3072-dim)
│   │   ├── retriever.js      # Cosine similarity vector search & top-k ranker
│   │   └── generator.js      # Groq LPU generator service (llama-3.3-70b)
│   ├── store/
│   │   └── vectorStore.js    # Session-isolated in-memory vector store
│   └── server.js             # Express API entry point & health check
└── docs/
    ├── prd-document-qa-rag.md
    └── rag-implementation-plan.md
```

---

## Environment Setup & Quick Start

### 1. Requirements & API Credentials
- **Node.js** v18+ and **npm**
- **Gemini API Key**: Obtain for free at [Google AI Studio](https://aistudio.google.com)
- **Groq API Key**: Obtain for free at [Groq Console](https://console.groq.com)

### 2. Configure Backend Environment

Create a `.env` file inside the `backend/` directory:

```bash
cd backend
cp .env.example .env
```

Set your keys inside `backend/.env`:

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
```
- API Server: `http://localhost:3001`
- Health Endpoint: `http://localhost:3001/api/health`

### 4. Start Frontend Application

```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:5173`

---

## API Specification

### `POST /api/upload`
Uploads a PDF file for ingestion and vector embedding.
- **Content-Type**: `multipart/form-data`
- **Parameters**: `file` (PDF file binary), `docType` (`legal` | `academic` | `auto`)
- **Response**:
```json
{
  "success": true,
  "sessionId": "sess_1785071234567",
  "chunkCount": 42,
  "docType": "legal",
  "sourceDoc": "Terms_of_Service.pdf"
}
```

### `POST /api/ingest-text`
Ingests raw text directly into the vector store.
- **Content-Type**: `application/json`
- **Body**: `{ "text": "...", "docType": "legal", "sourceDoc": "pasted-document" }`
- **Response**: Same as `/api/upload`

### `POST /api/query`
Queries an ingested document session.
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "sessionId": "sess_1785071234567",
  "question": "What is the cancellation policy?",
  "k": 4,
  "history": [
    { "role": "user", "text": "Who is the provider?" },
    { "role": "assistant", "text": "The provider is Acme Corp." }
  ]
}
```
- **Response**:
```json
{
  "answer": "You can terminate the agreement within 30 days by providing written notice...",
  "sources": [
    {
      "chunkId": "chunk_3",
      "text": "Section 8.1 Termination. Either party may terminate with 30 days notice...",
      "score": 0.9842,
      "metadata": { "sectionLabel": "Section 8.1 Termination", "pageNumber": 14 }
    }
  ],
  "noMatch": false,
  "threshold": 0.55,
  "model": "llama-3.3-70b-versatile"
}
```

### `GET /api/health`
Confirms API status and environment configuration.
- **Response**: `{ "status": "ok", "geminiConfigured": true, "groqConfigured": true, "activeModel": "gemini-embedding-001 + llama-3.3-70b-versatile" }`

---

## License

MIT License — free for open-source exploration, hackathons, and research.
