/**
 * Embedder service — wraps the Gemini Embedding API with parallel batching and fallback safety.
 *
 * Strategy:
 *  - Process chunks in concurrent batches of BATCH_SIZE (using Promise.all)
 *  - Wait BATCH_DELAY_MS between batches to respect rate limits
 *  - Retry on 429 (rate limit) with exponential backoff
 *  - Fallback to lightweight L2-normalized trigram feature vectors if API fails or rate limits out
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

let _genAI = null;
const getGenAIClient = () => {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[embedder] GEMINI_API_KEY is not set.');
    }
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_KEY');
  }
  return _genAI;
};

const EMBEDDING_MODEL = 'gemini-embedding-001';
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 800;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a deterministic 768-dimensional normalized trigram feature vector.
 * Used as a zero-latency fallback if the remote embedding API fails or rate limits out.
 */
function createFallbackEmbedding(text, dim = 768) {
  const vec = new Float32Array(dim);
  const clean = (text || '').toLowerCase();
  for (let i = 0; i < clean.length - 2; i++) {
    const hash = clean.charCodeAt(i) + clean.charCodeAt(i + 1) * 31 + clean.charCodeAt(i + 2) * 997;
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1.0;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}

/**
 * Get embedding vector for a single text string from Gemini API.
 */
async function getEmbedding(text) {
  const model = getGenAIClient().getGenerativeModel({ model: EMBEDDING_MODEL });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // SDK ≥ 0.21 accepts a string directly; older versions needed a Content object.
      // Normalise to a plain string to be safe across SDK versions.
      const result = await model.embedContent(String(text));
      // Handle both { embedding: { values: [...] } } and flat { values: [...] }
      const values =
        result?.embedding?.values ??
        result?.embeddings?.[0]?.values ??
        null;

      if (values && values.length > 0) {
        return values;
      }
      throw new Error(`Unexpected embedding response shape: ${JSON.stringify(result).slice(0, 200)}`);
    } catch (err) {
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[embedder] Rate limit hit. Retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      // Log full error for debugging before re-throwing
      console.error(`[embedder] getEmbedding failed (attempt ${attempt}):`, err.message);
      throw err;
    }
  }
  throw new Error('Embedding failed after retries.');
}

/**
 * Embed an array of chunk objects in concurrent throttled batches.
 */
async function embedChunks(chunks, onProgress = null) {
  const results = [];
  const total = chunks.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    console.log(`[embedder] Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(total / BATCH_SIZE)} (chunks ${i + 1}–${Math.min(i + BATCH_SIZE, total)} of ${total})`);

    const batchEmbeddings = await Promise.all(
      batch.map(async (chunk) => {
        try {
          const embedding = await getEmbedding(chunk.text);
          return { chunk, embedding };
        } catch (err) {
          console.warn(`[embedder] Fallback embedding used for chunk ${chunk.id}: ${err.message}`);
          return { chunk, embedding: createFallbackEmbedding(chunk.text) };
        }
      })
    );

    for (const { chunk, embedding } of batchEmbeddings) {
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

    if (i + BATCH_SIZE < total) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`[embedder] Ingestion complete. Embedded ${results.length} chunks.`);
  return results;
}

module.exports = { getEmbedding, embedChunks, createFallbackEmbedding };
