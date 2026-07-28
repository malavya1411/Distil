/**
 * Upload route — handles PDF uploads and raw text paste.
 *
 * POST /api/upload     — PDF file via multipart/form-data
 * POST /api/ingest-text — raw text via JSON body
 */

const express = require('express');
const multer = require('multer');
const pdfModule = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');

const { chunkDocument, detectDocType } = require('../services/chunker');
const { embedChunks } = require('../services/embedder');
const { storeVectors } = require('../store/vectorStore');

const router = express.Router();

// ─── Multer Config ─────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'), false);
    }
  },
});

// ─── PDF Text Extractor Helper ─────────────────────────────────────────────

/**
 * Robustly extract text from PDF buffer using PDFParse v2 class,
 * falling back to classic function or raw PDF text stream parsing.
 */
async function extractPdfText(buffer) {
  let rawText = '';

  // 1. Try PDFParse class constructor (v2.x API)
  try {
    if (pdfModule && pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const res = await parser.getText();
      if (res && res.text) rawText = res.text;
    } else if (typeof pdfModule === 'function') {
      const res = await pdfModule(buffer);
      if (res && res.text) rawText = res.text;
    }
  } catch (err) {
    console.warn('[upload] Standard pdf-parse failed:', err.message);
  }

  // 2. Fallback stream extractor if parser failed or gave minimal text
  if (!rawText || rawText.trim().length < 30) {
    try {
      const str = buffer.toString('utf-8', 0, Math.min(buffer.length, 5000000));
      const textMatches = [];
      const regex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj|\[([^\]]+)\]\s*TJ/g;
      let m;
      while ((m = regex.exec(str)) !== null) {
        if (m[1]) textMatches.push(m[1]);
        if (m[2]) {
          const parts = m[2].match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
          if (parts) textMatches.push(parts.map((p) => p.slice(1, -1)).join(''));
        }
      }
      const rawExtracted = textMatches.join(' ').replace(/\\\(|\\\)|\\n|\\r/g, ' ').trim();
      if (rawExtracted.length > rawText.length) {
        rawText = rawExtracted;
      }
    } catch (fallbackErr) {
      console.warn('[upload] Raw stream fallback failed:', fallbackErr.message);
    }
  }

  return rawText;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Ingest text: chunk → embed → store. Returns { sessionId, chunkCount }.
 */
async function ingestText(rawText, sourceDoc, docType) {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Extracted text is too short to process. The document may be scanned/image-only.');
  }

  const resolvedType = docType === 'auto' || !docType ? detectDocType(rawText) : docType;
  const chunks = chunkDocument(rawText, sourceDoc, resolvedType);

  if (chunks.length === 0) {
    throw new Error('No usable chunks could be extracted from this document.');
  }

  console.log(`[upload] Chunked "${sourceDoc}" into ${chunks.length} chunks (docType: ${resolvedType})`);

  const vectors = await embedChunks(chunks);

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

    const docType = req.body.docType || 'auto';
    const sourceDoc = req.file.originalname;

    const rawText = await extractPdfText(req.file.buffer);

    if (!rawText || rawText.trim().length < 50) {
      return res.status(422).json({
        error: 'No readable text found in this PDF. It may be a scanned/image-only document. Please upload a text-based PDF or paste text directly into the "Paste Text" tab.',
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
 */
router.post('/ingest-text', express.json(), async (req, res) => {
  try {
    const { text, docType = 'auto', sourceDoc = 'pasted-text' } = req.body;
    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: 'Please enter at least 50 characters of text.' });
    }

    const result = await ingestText(text, sourceDoc, docType);
    return res.json({ success: true, ...result });

  } catch (err) {
    console.error('[ingest-text] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Text ingestion failed.' });
  }
});

module.exports = router;
