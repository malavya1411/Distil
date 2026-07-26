/**
 * In-memory vector store — session-scoped, no DB required.
 * Stores { chunkId, embedding, text, metadata } per upload session.
 * Cleared on server restart (by design — see PRD: session-scoped storage).
 */

// Map of sessionId → array of vector entries
const sessions = new Map();

/**
 * Store vectors for a given session.
 * @param {string} sessionId
 * @param {Array<{chunkId: string, embedding: number[], text: string, metadata: object}>} vectors
 */
function storeVectors(sessionId, vectors) {
  sessions.set(sessionId, vectors);
}

/**
 * Get all vectors for a session.
 * @param {string} sessionId
 * @returns {Array | undefined}
 */
function getVectors(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Clear all vectors for a session.
 * @param {string} sessionId
 */
function clearSession(sessionId) {
  sessions.delete(sessionId);
}

/**
 * Check if a session has vectors stored.
 * @param {string} sessionId
 * @returns {boolean}
 */
function hasSession(sessionId) {
  return sessions.has(sessionId) && sessions.get(sessionId).length > 0;
}

module.exports = { storeVectors, getVectors, clearSession, hasSession };
