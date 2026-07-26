/**
 * Distil — Document Q&A RAG Backend
 * Entry point: Express server
 *
 * Routes:
 *   POST /api/upload        — PDF upload + ingestion
 *   POST /api/ingest-text   — Raw text paste + ingestion
 *   POST /api/query         — Retrieval (+ generation in Phase 4)
 *   GET  /api/health        — Health check
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const uploadRouter = require('./routes/upload');
const queryRouter = require('./routes/query');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// JSON body parser (large limit for text paste — raw T&C docs can be big)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', uploadRouter);
app.use('/api', queryRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      geminiKeySet: !!process.env.GEMINI_API_KEY,
    },
  });
});

// ─── Error Handler ────────────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Distil backend running on http://localhost:${PORT}`);
  console.log(`   Gemini API key: ${process.env.GEMINI_API_KEY ? '✅ set' : '❌ NOT SET — set GEMINI_API_KEY in .env'}`);
  console.log(`   Health check:   http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
