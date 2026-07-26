# Document RAG Implementation Plan

> **Scope:** Domain-agnostic, size-agnostic document RAG  
> **Target:** Quick initialization, free-tier friendly, demonstrably RAG  
> **Date:** 2026-07-26

---

## Table of Contents

1. [Pre-Architecture Flags](#pre-architecture-flags)
2. [Architecture Decisions](#architecture-decisions)
3. [Implementation Plan](#implementation-plan)
   - Phase 0 — Scaffold
   - Phase 1 — Ingestion + Domain-Aware Chunking
   - Phase 2 — Embeddings
   - Phase 3 — Retrieval
   - Phase 4 — Grounded Generation
   - Phase 5 — Frontend
   - Phase 6 — Deploy + Polish
4. [Sequencing Advice](#sequencing-advice)

---

## Pre-Architecture Flags

### 1. "Free" Is a Real Constraint

Gemini's free tier requires **no credit card**, includes embeddings, and gives Flash-Lite roughly:
- **1,500 requests/day**
- **1 million tokens/minute**

**Caveats:**
- Rate limits: **5–15 requests/minute** depending on model
- Google may use prompts for model training (irrelevant for demos, but don't route real confidential T&C docs through it)
- **The RPM limit will bite you** — if you fire one embedding call per chunk in a tight loop, you'll hit 429s on any document with more than a handful of chunks

> **Design for throttling from Day 1**, not as a Day 4 patch.

### 2. Versatility Has a Real Cost: Chunking Strategy Is Domain-Dependent

| Document Type | Structure | Chunking Approach |
|---------------|-----------|-------------------|
| **T&C / Legal** | Clause/section boundaries, numbered clauses, ALL-CAPS headers | Split on clause/section markers |
| **Research Paper** | Abstract, Methods, Results, References, tables, citations | Split on section headers; isolate References |

A good chunker for one domain isn't automatically good for the other. Building one universal chunker is harder than building two decent domain-aware ones.

**Decision:** Build a chunker with a **document-type switch** — it's not much more code and it's the difference between "works" and "works well" in a demo.

---

## Architecture Decisions

| Layer | Choice | Reason |
|-------|--------|--------|
| **Frontend** | React + Vite (JS) | Fast scaffold, matches your stack, no TS overhead |
| **Backend** | Node/Express | Consistent with InboxOS / your existing stack |
| **PDF Parsing** | `pdf-parse` | Free, open-source, no API cost |
| **Chunking** | Custom, domain-aware | No good free library handles both T&C and academic papers well out of the box |
| **Embeddings** | Gemini Embedding API | Free, no card required, generous token limits |
| **Vector Store** | **In-memory (JSON file) for MVP** | Zero infra setup = faster init. A single 40-page doc is ~80–150 chunks — brute-force cosine similarity is instant. Upgrade to pgvector/Supabase later only if you need persistence across sessions or multiple documents. |
| **Generation** | Gemini Flash / Flash-Lite | Free tier, grounded prompting |
| **Hosting** | Vercel (frontend) + Render free tier (backend) | Matches your existing deployment pattern |

### Key Decision: In-Memory Vector Store

- Removes an entire infra step (DB provisioning, connection pooling, migrations) from Day 1
- You lose persistence between server restarts — fine for a demo/hackathon artifact
- Trivial to upgrade later if this becomes a real product

---

## Implementation Plan

### Phase 0 — Scaffold *(Target: under 1 hour)*

```bash
npm create vite@latest rag-doc-chat -- --template react
cd rag-doc-chat
npm install
mkdir server && cd server
npm init -y
npm install express multer pdf-parse cors dotenv @google/generative-ai
```

**Packages:**
- `multer` — file upload handling
- `pdf-parse` — text extraction from PDFs
- `@google/generative-ai` — Google's official SDK for embeddings + generation
- `cors`, `dotenv`, `express` — standard backend stack

**Setup:**
1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com)
2. Put it in `server/.env`
3. Two servers: Vite dev server (frontend) + Express (backend) on different ports
4. Proxy `/api` in `vite.config.js`

---

### Phase 1 — Ingestion + Domain-Aware Chunking *(Day 1)*

#### 1. Upload Endpoint
- `POST /api/upload` accepts PDF via `multer`
- Extracts raw text via `pdf-parse`

#### 2. Two Chunking Functions (Not One)

**`chunkLegalDoc(text)`**
- Split on clause/section markers
- Detect: numbered clauses, "Section X", ALL-CAPS headers
- Overlap ~1–2 sentences between chunks to preserve cross-clause context

**`chunkAcademicDoc(text)`**
- Split on section headers: Abstract, Introduction, Methods, Results, References
- Treat **References** as a separate non-retrievable chunk (prevent citation lists from polluting retrieval)

#### 3. Document-Type Selection
- Let the user pick which chunker runs via a manual toggle in the upload UI
- Simple heuristic fallback: presence of "Abstract"/"References" vs. "hereby"/"clause"/"agreement"
- Don't over-engineer auto-detection in MVP — be honest about its limits

#### 4. Chunk Metadata Schema
```json
{
  "id": "chunk-uuid",
  "text": "chunk content...",
  "sourceDoc": "filename.pdf",
  "pageNumber": 12,
  "sectionLabel": "Section 3.2 — Limitation of Liability"
}
```

> This metadata is what makes retrieval *demonstrable* later (Phase 4).

---

### Phase 2 — Embeddings *(Day 1–2)*

#### 1. Embedding Function
- Wrap the Gemini embedding endpoint in a `getEmbedding(text)` helper

#### 2. Throttling (Critical)
- **Batch chunks** and add delays
- Example: process 5 chunks, wait, repeat
- Stay under the free-tier RPM ceiling (5–15 req/min)

> This is the single most common failure point — skipping this causes ingestion pipelines to silently fail on document #1.

#### 3. Storage
- Store `{chunkId, embedding, text, metadata}` in a JSON file on disk: `vectors.json`
- This is your "database" for the MVP

---

### Phase 3 — Retrieval *(Day 2)*

#### 1. Query Embedding
- On user query, embed the query text using the same `getEmbedding()` function

#### 2. Similarity Search
- Compute **cosine similarity** against every stored chunk vector
- Trivial with a small in-memory array — no vector DB math library needed (~10 lines)

#### 3. Top-K Results
- Return top-k chunks, sorted by score
- Start with **k = 4**

#### 4. Quality Check (Don't Skip)
- Write a small test script that queries directly against `vectors.json` *before* touching the frontend
- Verify retrieval quality is decent before building UI on top of it
- Bad retrieval is invisible until you see raw chunks

---

### Phase 4 — Grounded Generation + "Demonstrably RAG" *(Day 2–3)*

#### 1. Prompt Template
```
You are a helpful assistant. Answer the user's question ONLY from the 
provided context below. If the answer is not in the context, say 
"not specified in this document." Do not guess or hallucinate.

Context:
{retrieved_chunk_1}
{retrieved_chunk_2}
...

Question: {user_query}
```

#### 2. Response Payload
The backend should return **both**:
- ✅ The generated answer
- ✅ The raw retrieved chunks with similarity scores and metadata (section / clause / page)

> This makes retrieval **visible rather than a black box** — it's the cheapest, highest-impact demo feature you can build.

#### 3. Hallucination Test
- Ask something the document doesn't cover
- Confirm the model correctly declines instead of guessing
- This becomes a **demo moment**, not just a QA step

---

### Phase 5 — Frontend *(Day 3)*

> Design comes later — build basic structure only for now.

**Components:**
1. **Upload component** — PDF dropzone + document-type toggle (Legal / Academic)
2. **Chat interface** — message thread with user queries and AI responses
3. **Collapsible "Sources" panel** — per answer, showing retrieved chunks + similarity scores + metadata

**State:**
- Keep state in React (`useState` / `useReducer`)
- No external state library needed at this scale

**Visuals:**
- No neubrutalism — design the actual visual system separately when you're ready

---

### Phase 6 — Deploy + Polish *(Day 3–4/5)*

#### Deployment
- **Backend** → Render free tier (same as existing deployments)
- **Frontend** → Vercel

#### Edge Cases to Test Before Calling It Done

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty / scanned PDF (no extractable text) | Graceful error message; prompt user to upload text-based PDF |
| Query with no relevant chunks | Decline gracefully: "not specified in this document" — don't force an answer from the nearest-but-irrelevant chunk |
| Very short document (fewer chunks than k) | Adjust k dynamically or pad with empty results; don't crash |

---

## Sequencing Advice

> **Don't build both chunkers and full generality on Day 1.**

1. Build the pipeline **end-to-end against ONE document type first** (pick **T&C**, since you already scoped it in detail)
2. Get retrieval and grounded generation working and demoed
3. **Then** add the second chunker and domain toggle

Building generic infrastructure before you have one working case is the most common way time-boxed RAG projects run out of days with nothing demoable — **validate the pipeline narrow, then widen it.**

---

*End of plan.*
