/**
 * Generator service — grounded answer generation via Gemini Flash.
 *
 * Design principles (from PRD / implementation plan):
 *  - Answer ONLY from retrieved context — never hallucinate beyond it
 *  - If context is empty or question is out-of-scope, explicitly say so
 *  - Return both the answer text and the raw sources so the UI can display them
 *  - Stay within Gemini free-tier (Flash-Lite / Flash) — no paid models
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Config ──────────────────────────────────────────────────────────────────

// gemini-2.0-flash-lite is the most generous on the free tier for generation
const GENERATION_MODEL = 'gemini-2.0-flash-lite';

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Prompt template ─────────────────────────────────────────────────────────

/**
 * Build the grounded prompt.
 * The model is instructed to answer ONLY from the provided context excerpts.
 *
 * @param {string} question
 * @param {Array<{text: string, metadata: object, score: number}>} chunks
 * @returns {string}
 */
function buildPrompt(question, chunks) {
  const contextBlocks = chunks
    .map((c, i) => {
      const label = c.metadata?.sectionLabel || `Chunk ${i + 1}`;
      const score = (c.score * 100).toFixed(1);
      return `--- Source ${i + 1}: ${label} (relevance: ${score}%) ---\n${c.text}`;
    })
    .join('\n\n');

  return `You are a precise document assistant. Your job is to answer the user's question using ONLY the document excerpts provided below.

Rules you must follow:
1. Base your answer exclusively on the provided excerpts. Do not use any external knowledge.
2. If the excerpts do not contain enough information to answer the question, respond with exactly: "This question is not addressed in the uploaded document."
3. If the answer is only partially covered, answer what you can and note what is missing.
4. Quote directly from the document when it adds clarity — keep quotes concise.
5. Be specific and direct. Avoid filler phrases like "Based on the document..." — just answer.
6. Do not invent, guess, or extrapolate beyond what the excerpts state.

--- Document Excerpts ---

${contextBlocks}

--- End of Excerpts ---

Question: ${question}

Answer:`;
}

// ─── Conversation history helpers ─────────────────────────────────────────────

/**
 * Build a Gemini-compatible conversation history array from prior messages.
 * This enables multi-turn context without re-embedding old questions.
 *
 * @param {Array<{role: 'user'|'assistant', text: string}>} history
 * @returns {Array<{role: string, parts: Array<{text: string}>}>}
 */
function buildHistory(history = []) {
  return history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));
}

// ─── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate a grounded answer from retrieved chunks.
 *
 * @param {string} question                  - user's question
 * @param {Array}  chunks                    - top-k retrieved chunks (with text + metadata + score)
 * @param {Array}  [conversationHistory=[]]  - prior turns for multi-turn context
 * @returns {Promise<string>}                - generated answer text
 */
async function generateAnswer(question, chunks, conversationHistory = []) {
  const model = genAI.getGenerativeModel({
    model: GENERATION_MODEL,
    generationConfig: {
      temperature: 0.1,       // low temp = more faithful, less creative
      topP: 0.8,
      maxOutputTokens: 1024,
    },
  });

  const prompt = buildPrompt(question, chunks);

  // Use chat with history for multi-turn support
  const history = buildHistory(conversationHistory);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let result;

      if (history.length > 0) {
        // Multi-turn: start a chat session with prior context
        const chat = model.startChat({ history });
        result = await chat.sendMessage(prompt);
      } else {
        // First turn: simple content generation
        result = await model.generateContent(prompt);
      }

      const text = result.response.text().trim();

      if (!text) {
        throw new Error('Empty response from generation model.');
      }

      return text;

    } catch (err) {
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[generator] Rate limit hit. Retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }

      throw new Error(`[generator] Generation failed after ${attempt} attempt(s): ${err.message}`);
    }
  }
}

module.exports = { generateAnswer };
