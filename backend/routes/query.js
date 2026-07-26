/**
 * Query route — retrieves top-k chunks then generates a grounded answer.
 *
 * POST /api/query
 * Body: {
 *   sessionId: string,
 *   question: string,
 *   k?: number,                  // top-k chunks to retrieve (default 4)
 *   history?: Array<{            // prior turns for multi-turn context
 *     role: 'user' | 'assistant',
 *     text: string
 *   }>
 * }
 *
 * Response: {
 *   answer: string,
 *   sources: Array<{ chunkId, text, score, metadata }>,
 *   noMatch: boolean,
 *   model: string                // which Gemini model generated the answer
 * }
 */

const express = require('express');
const { retrieveTopK, SIMILARITY_THRESHOLD } = require('../services/retriever');
const { generateAnswer } = require('../services/generator');
const { hasSession } = require('../store/vectorStore');

const router = express.Router();

// No-match message — consistent across backend and frontend
const NO_MATCH_ANSWER =
  'This question does not appear to be addressed in the uploaded document. ' +
  'No relevant sections were found above the similarity threshold.';

/**
 * POST /api/query
 */
router.post('/query', express.json(), async (req, res) => {
  try {
    const { sessionId, question, k = 4, history = [] } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────

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

    // ── Retrieval ─────────────────────────────────────────────────────────────

    const sources = await retrieveTopK(sessionId, question.trim(), k);

    // No-match — nothing clears the similarity threshold
    if (sources.length === 0) {
      console.log(`[query] No relevant chunks found for: "${question.slice(0, 60)}"`);
      return res.json({
        answer: NO_MATCH_ANSWER,
        sources: [],
        noMatch: true,
        threshold: SIMILARITY_THRESHOLD,
        model: null,
      });
    }

    // ── Generation ────────────────────────────────────────────────────────────

    console.log(`[query] Retrieved ${sources.length} chunks. Generating answer...`);

    const answer = await generateAnswer(question.trim(), sources, history);

    // Safety net — if the model somehow returns empty, treat as no-match
    const effectiveAnswer = answer || NO_MATCH_ANSWER;
    const noMatch =
      !answer ||
      answer.toLowerCase().includes('not addressed in the uploaded document');

    return res.json({
      answer: effectiveAnswer,
      sources,
      noMatch,
      threshold: SIMILARITY_THRESHOLD,
      model: 'gemini-2.0-flash-lite',
    });

  } catch (err) {
    console.error('[query] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Query failed.' });
  }
});

module.exports = router;
