/**
 * Retriever service — cosine similarity search over in-memory vectors.
 *
 * No external vector DB needed; brute-force cosine is instant for
 * 80–150 chunks (single 40-page document). See implementation plan.
 */

const { getEmbedding } = require('./embedder');
const { getVectors } = require('../store/vectorStore');

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_K = 4;
const SIMILARITY_THRESHOLD = 0.55; // Below this score, results are likely irrelevant

// ─── Cosine Similarity ───────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1] where 1 = identical direction.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vectors must have the same dimension');

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieve the top-k most relevant chunks for a given query.
 *
 * Returns:
 *   - chunks above SIMILARITY_THRESHOLD, sorted by score descending
 *   - empty array if nothing clears the threshold (→ "not in document" response)
 *
 * @param {string} sessionId
 * @param {string} query        - user's natural-language question
 * @param {number} [k=4]        - max results to return
 * @returns {Promise<Array<{chunkId, text, score, metadata}>>}
 */
async function retrieveTopK(sessionId, query, k = DEFAULT_K) {
  const vectors = getVectors(sessionId);

  if (!vectors || vectors.length === 0) {
    throw new Error('No document has been ingested for this session.');
  }

  // Embed the query using the same model
  const queryEmbedding = await getEmbedding(query);

  // Score every stored chunk against the query
  const scored = vectors
    .filter((v) => !v.metadata.isReferences) // skip references section (academic docs)
    .map((v) => ({
      chunkId: v.chunkId,
      text: v.text,
      score: cosineSimilarity(queryEmbedding, v.embedding),
      metadata: v.metadata,
    }));

  // Sort descending by similarity score
  scored.sort((a, b) => b.score - a.score);

  // Return top-k results that clear the relevance threshold
  const topK = scored.slice(0, k).filter((r) => r.score >= SIMILARITY_THRESHOLD);

  return topK;
}

module.exports = { retrieveTopK, cosineSimilarity, SIMILARITY_THRESHOLD };
