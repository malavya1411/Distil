/**
 * Generator service — grounded answer generation via Groq.
 *
 * Why Groq for generation:
 *  - LPU (Language Processing Unit) inference is dramatically faster than GPU-based APIs
 *  - Total RAG latency = retrieval + generation; Groq cuts the generation slice to near-zero
 *  - Free tier is generous for demo/hackathon use
 *
 * Model: llama-3.3-70b-versatile
 *  - Best quality/speed balance on Groq free tier
 *  - 70B params → strong instruction-following for the strict grounding prompt
 *  - Falls back to llama-3.1-8b-instant if rate-limited
 *
 * Embeddings remain on Gemini (gemini-embedding-001) — Groq doesn't offer embeddings.
 */

require('dotenv').config();
const Groq = require('groq-sdk');

// Lazy-initialize so GROQ_API_KEY is read after dotenv.config() has run
let _groq = null;
const getGroqClient = () => {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set. Add it to backend/.env');
    }
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
};

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIMARY_MODEL   = 'llama-3.3-70b-versatile';  // high quality, still fast on LPU
const FALLBACK_MODEL  = 'llama-3.1-8b-instant';     // fastest possible if rate limited

const MAX_RETRIES       = 3;
const RETRY_BASE_DELAY  = 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Prompt template ─────────────────────────────────────────────────────────

/**
 * Build the strict grounding prompt.
 * The model must answer ONLY from the provided document excerpts.
 *
 * @param {string} question
 * @param {Array<{text: string, metadata: object, score: number}>} chunks
 * @returns {string}
 */
function buildSystemPrompt() {
  return `You are a precise document assistant. Your only job is to answer questions about the document excerpts provided by the user.

Rules you must follow without exception:
1. Answer exclusively from the provided document excerpts. Do not draw on outside knowledge.
2. If the excerpts do not contain enough information to answer, respond with exactly: "This question is not addressed in the uploaded document."
3. If the answer is partially covered, answer what you can and clearly note what is missing from the document.
4. Quote directly from the document when it adds clarity — keep quotes short and relevant.
5. Be direct. Do not open with "Based on the document…" or similar filler — just give the answer.
6. Do not guess, extrapolate, or hallucinate beyond what is explicitly stated in the excerpts.
7. Format your answer clearly. Use short paragraphs. If listing multiple points, use a simple list.`;
}

function buildUserMessage(question, chunks) {
  const contextBlocks = chunks
    .map((c, i) => {
      const label = c.metadata?.sectionLabel || `Excerpt ${i + 1}`;
      const score = (c.score * 100).toFixed(1);
      return `[Excerpt ${i + 1}: ${label} — relevance ${score}%]\n${c.text}`;
    })
    .join('\n\n---\n\n');

  return `Here are the relevant excerpts from the uploaded document:\n\n${contextBlocks}\n\n---\n\nQuestion: ${question}`;
}

// ─── Conversation history helpers ─────────────────────────────────────────────

/**
 * Convert prior turns into Groq chat message format.
 * Groq uses the same OpenAI-compatible message format.
 *
 * @param {Array<{role: 'user'|'assistant', text: string}>} history
 * @returns {Array<{role: string, content: string}>}
 */
function buildHistory(history = []) {
  return history.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.text,
  }));
}

// ─── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate a grounded answer using Groq.
 *
 * @param {string} question
 * @param {Array}  chunks                    - top-k retrieved chunks
 * @param {Array}  [conversationHistory=[]]  - prior turns for multi-turn context
 * @returns {Promise<{ text: string, model: string }>}
 */
async function generateAnswer(question, chunks, conversationHistory = []) {
  const systemPrompt = buildSystemPrompt();
  const userMessage  = buildUserMessage(question, chunks);

  // Build message array: system → prior history → current question
  const messages = [
    { role: 'system', content: systemPrompt },
    ...buildHistory(conversationHistory),
    { role: 'user',   content: userMessage },
  ];

  let modelToUse = PRIMARY_MODEL;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[generator] Calling Groq (${modelToUse}), attempt ${attempt}/${MAX_RETRIES}`);

      const completion = await getGroqClient().chat.completions.create({
        model: modelToUse,
        messages,
        temperature: 0.15,      // low temperature = faithful, grounded answers
        max_completion_tokens: 1024,   // groq-sdk v1.x uses max_completion_tokens
        top_p: 0.85,
      });

      const text = completion.choices?.[0]?.message?.content?.trim();

      if (!text) {
        throw new Error('Empty response from Groq.');
      }

      console.log(`[generator] ✅ Generated ${text.length} chars via ${modelToUse}`);
      return { text, model: modelToUse };

    } catch (err) {
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('rate_limit') ||
        err?.message?.includes('Rate limit');

      // On rate limit: switch to faster/smaller fallback model first, then wait
      if (isRateLimit && attempt < MAX_RETRIES) {
        if (modelToUse === PRIMARY_MODEL) {
          console.warn(`[generator] Rate limit on ${PRIMARY_MODEL}. Switching to ${FALLBACK_MODEL}.`);
          modelToUse = FALLBACK_MODEL;
          continue;
        }
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
        console.warn(`[generator] Rate limit on ${FALLBACK_MODEL}. Waiting ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      throw new Error(`[generator] Generation failed after ${attempt} attempt(s): ${err.message}`);
    }
  }
}

module.exports = { generateAnswer };
