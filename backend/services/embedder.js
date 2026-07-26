/**
 * Embedder service — wraps the Gemini Embedding API.
 *
 * Key design constraints from PRD / implementation plan:
 *  - Free-tier RPM limit: 5–15 req/min depending on model
 *  - Must throttle from Day 1, not as a patch
 *
 * Strategy:
 *  - Process chunks in batches of BATCH_SIZE
 *  - Wait BATCH_DELAY_MS between batches
 *  - Retry on 429 (rate limit) with exponential backoff
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Config ──────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'gemini-embedding-001'; // confirmed available on free tier
const BATCH_SIZE = 5;           // chunks per batch (stay under RPM ceiling)
const BATCH_DELAY_MS = 1200;    // ~1.2s between batches → safe for 5 RPM floor
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get embedding vector for a single text string.
 * Retries on rate-limit (429) errors with exponential backoff.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[embedder] Rate limit hit. Retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      throw new Error(`[embedder] Failed to embed text after ${attempt} attempt(s): ${err.message}`);
    }
  }
}

/**
 * Embed an array of chunk objects in throttled batches.
 * Returns an array of vector entries ready for the vector store.
 *
 * @param {Array<{id, text, sourceDoc, chunkIndex, sectionLabel, ...rest}>} chunks
 * @param {function(number, number): void} [onProgress] - called with (completed, total)
 * @returns {Promise<Array<{chunkId, embedding, text, metadata}>>}
 */
async function embedChunks(chunks, onProgress = null) {
  const results = [];
  const total = chunks.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    console.log(`[embedder] Processing chunks ${i + 1}–${Math.min(i + BATCH_SIZE, total)} of ${total}`);

    // Process batch sequentially (not in parallel) to avoid burst rate limits
    for (const chunk of batch) {
      const embedding = await getEmbedding(chunk.text);
      results.push({
        chunkId: chunk.id,
        embedding,
        text: chunk.text,
        metadata: {
          sourceDoc: chunk.sourceDoc,
          chunkIndex: chunk.chunkIndex,
          sectionLabel: chunk.sectionLabel,
          pageNumber: chunk.pageNumber || null,
          isReferences: chunk.isReferences || false,
        },
      });

      if (onProgress) {
        onProgress(results.length, total);
      }
    }

    // Throttle: wait between batches (skip delay after last batch)
    if (i + BATCH_SIZE < total) {
      console.log(`[embedder] Batch complete. Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`[embedder] Done. Embedded ${results.length} chunks.`);
  return results;
}

module.exports = { getEmbedding, embedChunks };
