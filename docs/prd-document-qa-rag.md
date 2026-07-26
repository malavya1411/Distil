# PRD: Document Q&A (RAG-based Terms & Conditions Assistant)

**Status:** Draft v1  
**Owner:** Malavya  
**Target:** Hackathon / portfolio build, 3–5 day window  
**Date:** 2026-07-26

---

## Table of Contents

1. [Defaults & Assumptions](#defaults--assumptions)
2. [Summary](#1-summary)
3. [Problem](#2-problem)
4. [Goals](#3-goals)
5. [Non-Goals](#4-non-goals)
6. [Target User](#5-target-user)
7. [Core User Flow](#6-core-user-flow)
8. [Functional Requirements](#7-functional-requirements)
9. [Non-Functional Requirements](#8-non-functional-requirements)
10. [Technical Approach](#9-technical-approach)
11. [Success Metrics](#10-success-metrics)
12. [Open Risks](#11-open-risks)
13. [Milestones](#12-milestones)

---

## Defaults & Assumptions

Three gaps in the original one-paragraph description needed resolving. The following defaults are applied below; flag any that are wrong before proceeding:

| Decision | Default | Rationale |
|----------|---------|-----------|
| **Upload vs. paste** | Both input methods work | Paste bypasses PDF parsing but feeds the same chunking/embedding pipeline downstream |
| **Session scope** | Ephemeral, single-session | In-memory JSON vector store = no persistence across server restarts by design, not oversight |
| **Single vs. multi-document** | One document per session | Multi-document comparison changes retrieval logic (source attribution, query scope) — belongs in v2 |

---

## 1. Summary

A web app where a user uploads or pastes a long document (starting with Terms & Conditions text) and asks natural-language questions about it, getting grounded answers with visible source citations — instead of reading the full document manually.

---

## 2. Problem

Long legal / policy documents (T&C, privacy policies, EULAs) are dense and rarely read in full. Users need specific answers (e.g., *"can they sell my data to third parties?"*) without reading 30–40 pages.

Generic LLM chat without retrieval either:
- **Hallucinates** answers that aren't in the document, or
- Requires pasting the whole document into every prompt — clumsy and doesn't scale to longer docs.

---

## 3. Goals

| ID | Goal | Description |
|----|------|-------------|
| G1 | Speed | User gets an accurate, grounded answer in under ~10 seconds |
| G2 | Traceability | Every answer is traceable to the specific part of the document it came from — builds trust and proves the RAG pipeline is real, not decorative |
| G3 | Zero cost | Works end-to-end on zero paid infrastructure |
| G4 | Demo-ready | Fast enough to set up and demo within the build window |

---

## 4. Non-Goals

> Explicitly out of scope for the MVP. These are real features, but they belong in v2.

- Multi-document comparison or cross-document Q&A
- User accounts, saved history across sessions, or document persistence after session ends
- Non-English document support
- Editing or annotating the source document
- Legal advice or interpretation beyond what's literally stated in the text  
  *(The product answers "what does this document say," not "is this clause enforceable")*

---

## 5. Target User

Someone about to accept a T&C / privacy policy (or, generalized later, a long paper) who wants a specific answer without reading the whole thing.

**For demo purposes:** judges / reviewers evaluating whether the RAG pipeline is real.

---

## 6. Core User Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  1. Land on app │────▶│ 2. Upload PDF or │────▶│ 3. Ingestion    │
│  (upload zone + │     │    paste raw text│     │    runs         │
│   paste toggle) │     │                  │     │    (spinner)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ 6. Ask follow-up│◀────│ 5. Get answer +  │◀────│ 4. Chat appears │
│    questions    │     │    source chunks │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Step-by-Step

1. **Landing** — User sees an upload zone + a "paste text" toggle.
2. **Input** — User uploads a PDF or pastes raw text.
3. **Ingestion** — Backend extracts text (if PDF), chunks it, generates embeddings, stores vectors in-memory for that session. UI shows an ingestion status indicator (this can take a few seconds for a large doc — must not look broken / frozen).
4. **Chat ready** — Once ingestion completes, a chat interface appears.
5. **Question** — User types a question in natural language.
6. **Retrieval + generation** — Backend embeds the query, retrieves top-k relevant chunks, generates a grounded answer.
7. **Display** — UI shows: the answer, plus a collapsible panel showing which chunk(s) the answer was drawn from, with a relevance score and location reference (clause / section number if extractable, otherwise approximate position).
8. **No-match handling** — If no relevant chunk is found above a similarity threshold, the app explicitly says the document doesn't address the question — it does **not** force an answer.
9. **Follow-up** — User can ask follow-up questions against the same document within the session.

---

## 7. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Accept PDF upload | P0 |
| FR-2 | Accept pasted raw text | P0 |
| FR-3 | Chunk document using clause/section-aware logic for legal text | P0 |
| FR-4 | Generate embeddings per chunk, store with metadata (chunk text, position/section label) | P0 |
| FR-5 | Accept natural-language question via chat UI | P0 |
| FR-6 | Retrieve top-k chunks by similarity for a given question | P0 |
| FR-7 | Generate answer grounded strictly in retrieved chunks; refuse to answer beyond context | P0 |
| FR-8 | Display source chunks + similarity scores alongside every answer | P0 |
| FR-9 | Handle "not covered in document" case gracefully, without hallucinating | P0 |
| FR-10 | Support multi-turn follow-up questions within one session | P1 |
| FR-11 | Show ingestion progress/status while chunking + embedding runs | P1 |
| FR-12 | Domain toggle for research-paper chunking (vs. legal) | P2 (post-MVP versatility feature) |
| FR-13 | Handle documents with no extractable text (scanned/image-only PDF) with a clear error, not a silent failure | P1 |

---

## 8. Non-Functional Requirements

### Cost
- **$0 infrastructure** — Gemini free-tier API for embeddings + generation, no paid vector DB, free hosting tiers (Vercel / Render).

### Performance
- Ingestion pipeline must respect Gemini's free-tier RPM limits via **throttled batching** — this is a hard constraint from the API, not a nice-to-have, and needs to be designed in from Phase 1, not patched later.

### Reliability
- No answer should be presented without at least one supporting chunk shown.
- If retrieval returns nothing above threshold, say so explicitly rather than falling back to ungrounded generation.

### Privacy
- **Session-scoped storage only** — documents are not persisted after the session ends.
- This should be stated in-product (a short line like *"your document isn't saved"*) since users pasting T&C text may reasonably care about that.

---

## 9. Technical Approach

> Full detail in the implementation plan already agreed. This is the summary.

| Layer | Choice |
|-------|--------|
| **Frontend** | React + Vite (JS) |
| **Backend** | Node / Express |
| **Chunking** | Custom clause-aware splitter for legal text (MVP scope; academic-paper splitter is FR-12, post-MVP) |
| **Embeddings + generation** | Gemini API free tier |
| **Vector store** | In-memory, session-scoped (no DB for MVP) |

---

## 10. Success Metrics

> For a demo / portfolio context, not production.

| # | Metric | Pass Criteria |
|---|--------|---------------|
| 1 | Grounded accuracy | Correctly answers a set of test questions with verifiable source citations (qualitative pass/fail against a manually prepared T&C test doc) |
| 2 | Hallucination resistance | Correctly declines to answer at least one out-of-scope test question (proves grounding isn't decorative) |
| 3 | End-to-end stability | Upload → ingest → ask → answer completes without manual intervention or crashes on a 30–40 page test document |

---

## 11. Open Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Free-tier RPM limits could make ingestion of a very long document slow or flaky | High | Throttle correctly; needs real testing with an actual 30–40 page doc, not just a short sample |
| Clause-based chunking quality on real-world T&C text (inconsistent formatting across companies) is unproven | Medium | Budget time for this in Day 1; don't assume it works from the first pass |
| Scanned / image PDFs will silently fail text extraction | Medium | FR-13 handles this with a clear error; OCR fallback is excluded for MVP given the timeline |

---

## 12. Milestones

| Day | Focus | Deliverable |
|-----|-------|-------------|
| Day 1 | Ingestion + chunking | Working upload/paste → text extraction → clause-aware chunking |
| Day 1–2 | Embeddings | Throttled embedding pipeline; chunks stored in-memory |
| Day 2 | Retrieval | Cosine similarity search; top-k chunk retrieval working |
| Day 2–3 | Grounded generation + citation UI | Prompt template with context injection; collapsible sources panel |
| Day 3 | Frontend | Upload zone, chat interface, ingestion spinner, sources panel |
| Day 3–4/5 | Deploy + edge-case testing | Live on Vercel + Render; tested against scanned PDFs, no-match queries, short docs |

---

*End of PRD.*
