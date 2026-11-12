/**
 * Grounded answer generation via the Gemini API.
 * Embeddings and answer generation both use the configured GEMINI_API_KEY.
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

let _genAI = null;
const getGenAIClient = () => {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set. Add it to backend/.env');
    }
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genAI;
};

const GENERATION_MODEL = process.env.GEMINI_GENERATION_MODEL || 'gemini-2.5-flash';

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
  const contextBlocks = chunks.map((c, i) => {
    const label = c.metadata?.sectionLabel || `Excerpt ${i + 1}`;
    const score = (c.score * 100).toFixed(1);
    return `[Excerpt ${i + 1}: ${label} — relevance ${score}%]\n${c.text}`;
  }).join('\n\n---\n\n');

  return `Here are the relevant excerpts from the uploaded document:\n\n${contextBlocks}\n\n---\n\nQuestion: ${question}`;
}

function buildHistory(history = []) {
  return history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));
}

async function generateAnswer(question, chunks, conversationHistory = []) {
  const model = getGenAIClient().getGenerativeModel({
    model: GENERATION_MODEL,
    systemInstruction: buildSystemPrompt(),
    generationConfig: { temperature: 0.15, maxOutputTokens: 1024, topP: 0.85 },
  });

  const history = buildHistory(conversationHistory);
  const chat = model.startChat({ history });
  console.log(`[generator] Calling Gemini (${GENERATION_MODEL})`);

  try {
    const result = await chat.sendMessage(buildUserMessage(question, chunks));
    const text = result.response.text()?.trim();
    if (!text) throw new Error('Empty response from Gemini.');
    console.log(`[generator] Generated ${text.length} chars via ${GENERATION_MODEL}`);
    return { text, model: GENERATION_MODEL };
  } catch (err) {
    throw new Error(`[generator] Generation failed: ${err.message}`);
  }
}

module.exports = { generateAnswer };
