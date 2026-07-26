# Distil — Production-Grade Document Intelligence & Grounded RAG Platform

> **Read Less. Understand More.**  
> Upload complex legal agreements, Terms & Conditions, privacy policies, or academic research papers. Ask natural-language questions and receive sub-second grounded answers backed by verbatim source passage citations — with zero hallucinations.

---

## Key Working (How It Works)

1. **Upload & Domain-Aware Chunking**: Upload a PDF or paste text. Distil splits documents along legal section boundaries (e.g., `Section 8.2`) or paper headings instead of arbitrary character cuts.
2. **Vector Embedding**: Text chunks are embedded into 3072-dimensional vectors using Gemini API (`gemini-embedding-001`) and stored in a private, session-scoped in-memory vector index.
3. **Similarity Search & Retrieval**: When a question is asked, Distil performs cosine similarity search to retrieve the top-4 most relevant passage chunks clearing a strict `0.55` similarity threshold.
4. **Sub-Second Grounded Generation**: Retrieved chunks are passed to Groq LPU (`llama-3.3-70b-versatile`), producing a grounded answer with verbatim evidence citations in **~350ms** with zero hallucinations.

---

## Technical Overview & System Architecture

Distil is built on a high-throughput Retrieval-Augmented Generation (RAG) architecture engineered for privacy, mathematical precision, and sub-second end-to-end response latency.

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
┌──────────────────┐     Claude-style Sectioned Workspace
│ UI Presentation  │ ──► Perplexity-style Evidence Citations & Scores
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

## Verifying RAG Grounding vs Model Hallucination

Users can verify that answers originate from document context rather than parametric LLM memory:

1. **Perplexity-Style Evidence Cards**: Clicking *"Evidence Sources"* beneath any answer reveals exact source passages, page numbers, section headers, and the calculated similarity match percentage (e.g. `98.4% match`).
2. **The Refusal Test**: Asking a question out of scope (e.g., *"What is the capital of Japan?"*) returns an explicit notice:
   > *"No relevant content was found in the document for this question — the response reflects that absence rather than guessing."*
3. **Direct Quotations**: Grounded responses quote specific clause numbers and legal terms word-for-word from the original document.

---

## Design System & UX Architecture

Distil features a flat, high-contrast design language built for focus, readability, and trust:

- **Flat Palette Token System** (`index.css` & `ChatInterface.css`):
  - **Background**: `#F7F8FA`
  - **Surface**: `#FFFFFF`
  - **Border**: `#E3E6EA` (1px solid hairline borders across all cards)
  - **Text Primary**: `#14181F`
  - **Text Secondary**: `#5B6472`
  - **Accent**: `#1F4E79` *(Deep Navy-Ink — reserved strictly for interactive controls)*
  - **Success**: `#2F855A`
  - **Warning**: `#B7791F`
  - **Danger**: `#B23A34`
- **Zero Gradients**: No decorative gradient washes or background glow meshes.
- **Distil Knowledge Funnel Loading Screen**: SVG clockwise fill ring, converging particle keyframes, live rotating status messages, and self-drawing SVG completion checkmark.
- **2-Column AI Workspace Layout**: Collapsible desktop sidebar, top header status indicators (`● Indexed`, `42 chunks`), Claude-style sectioned answers, recommended query cards, and floating AI composer.

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
│       │   ├── ChatInterface.jsx     # 2-column AI Knowledge Workspace & Claude messages
│       │   ├── ChatInterface.css     # Workspace layout grid & composer styling
│       │   ├── SourcesPanel.jsx      # Perplexity-style Evidence Citations cards
│       │   └── SourcesPanel.css      # Citation cards & score badges styling
│       ├── App.jsx                   # View state manager ('landing'|'upload'|'ingesting'|'chat')
│       ├── App.css                   # Landing page shell styling
│       └── index.css                 # Global CSS tokens & flat design system
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