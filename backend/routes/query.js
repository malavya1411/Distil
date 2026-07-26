/**
 * Query route — retrieves top-k relevant chunks and returns them.
 *
 * Phase 3 only (retrieval) — generation is Phase 4.
 * The endpoint already returns the chunks + scores so the frontend
 * can display them. Generation will be added on top of this in Phase 4.
 *
 * POST /api/query
 * Body: { sessionId: string, question: string, k?: number }
 *
 * Response:
 * {
 *   answer: string,              // generated answer (stub for now)
 *   sources: [                   // retrieved chunks with scores + metadata
 *     { chunkId, text, score, metadata: { sourceDoc, sectionLabel, pageNumber } }
 *   ],
 *   noMatch: boolean             // true if no chunk cleared the threshold
 * }
 */

const express = require('express');
const { retrieveTopK, SIMILARITY_THRESHOLD } = require('../services/retriever');
const { hasSession } = require('../store/vectorStore');

const router = express.Router();

/**
 * POST /api/query
 */
router.post('/query', express.json(), async (req, res) => {
  try {
    const { sessionId, question, k = 4 } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "sessionId".' });
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or empty "question".' });
    }

    if (!hasSession(sessionId)) {
      return res.status(404).json({
        error: 'Session not found or has expired. Please re-upload your document.',
      });
    }

    const sources = await retrieveTopK(sessionId, question.trim(), k);

    // No-match case — retrieval found nothing above threshold
    if (sources.length === 0) {
      return res.json({
        answer: 'This question does not appear to be addressed in the uploaded document.',
        sources: [],
        noMatch: true,
        threshold: SIMILARITY_THRESHOLD,
      });
    }

    // ── Phase 4 placeholder ──────────────────────────────────────────────────
    // Generation will be wired in Phase 4. For now, return the top chunk text
    // as a stub answer so the pipeline can be validated end-to-end.
    const stubAnswer =
      `[Generation not yet implemented — Phase 4]\n\n` +
      `Top retrieved chunk (score: ${sources[0].score.toFixed(3)}):\n\n${sources[0].text}`;

    return res.json({
      answer: stubAnswer,
      sources,
      noMatch: false,
      threshold: SIMILARITY_THRESHOLD,
    });

  } catch (err) {
    console.error('[query] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Query failed.' });
  }
});

module.exports = router;
