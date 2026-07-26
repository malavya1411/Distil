/**
 * Upload route — handles PDF uploads and raw text paste.
 *
 * POST /api/upload     — PDF file via multipart/form-data
 * POST /api/ingest-text — raw text via JSON body
 *
 * Both paths:
 *  1. Extract / receive raw text
 *  2. Chunk using domain-aware chunker (docType from client)
 *  3. Embed chunks (throttled)
 *  4. Store vectors in session
 *  5. Return session ID + chunk count to client
 */

const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');

const { chunkDocument, detectDocType } = require('../services/chunker');
const { embedChunks } = require('../services/embedder');
const { storeVectors } = require('../store/vectorStore');

const router = express.Router();

// ─── Multer Config ─────────────────────────────────────────────────────────

// Store PDF in memory (no disk writes needed — we only care about the text)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'), false);
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Ingest text: chunk → embed → store. Returns { sessionId, chunkCount }.
 * Shared between the PDF and text-paste paths.
 */
async function ingestText(rawText, sourceDoc, docType) {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Extracted text is too short to process. The document may be scanned/image-only.');
  }

  // Resolve docType — client may send 'auto' to trigger heuristic
  const resolvedType = docType === 'auto' || !docType ? detectDocType(rawText) : docType;

  // Chunk the document
  const chunks = chunkDocument(rawText, sourceDoc, resolvedType);
  if (chunks.length === 0) {
    throw new Error('No usable chunks could be extracted from this document.');
  }

  console.log(`[upload] Chunked "${sourceDoc}" into ${chunks.length} chunks (docType: ${resolvedType})`);

  // Embed chunks (throttled — may take a while for large docs)
  const vectors = await embedChunks(chunks);

  // Generate a fresh session ID and store vectors
  const sessionId = uuidv4();
  storeVectors(sessionId, vectors);

  console.log(`[upload] Session ${sessionId} ready. ${vectors.length} vectors stored.`);

  return {
    sessionId,
    chunkCount: vectors.length,
    docType: resolvedType,
    sourceDoc,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/upload
 * Accepts a PDF file + optional docType field.
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please upload a PDF.' });
    }

    const docType = req.body.docType || 'auto'; // 'legal' | 'academic' | 'auto'
    const sourceDoc = req.file.originalname;

    // Extract text from PDF buffer
    let pdfData;
    try {
      pdfData = await pdfParse(req.file.buffer);
    } catch (parseErr) {
      return res.status(422).json({
        error: 'Could not parse this PDF. It may be corrupted or contain only images (scanned PDF). Please upload a text-based PDF.',
        detail: parseErr.message,
      });
    }

    const rawText = pdfData.text;

    if (!rawText || rawText.trim().length < 50) {
      return res.status(422).json({
        error: 'No readable text found in this PDF. It may be a scanned/image-only document. Please upload a text-based PDF.',
      });
    }

    const result = await ingestText(rawText, sourceDoc, docType);
    return res.json({ success: true, ...result });

  } catch (err) {
    console.error('[upload] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Ingestion failed.' });
  }
});

/**
 * POST /api/ingest-text
 * Accepts raw pasted text as JSON.
 * Body: { text: string, docType?: 'legal' | 'academic' | 'auto', sourceDoc?: string }
 */
router.post('/ingest-text', express.json(), async (req, res) => {
  try {
    const { text, docType = 'auto', sourceDoc = 'pasted-text' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Request body must include a "text" string field.' });
    }

    const result = await ingestText(text, sourceDoc, docType);
    return res.json({ success: true, ...result });

  } catch (err) {
    console.error('[ingest-text] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Ingestion failed.' });
  }
});

module.exports = router;
