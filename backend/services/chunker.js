/**
 * Domain-aware document chunker.
 *
 * Two strategies:
 *  - chunkLegalDoc  : clause/section-boundary splitting for T&C / legal text
 *  - chunkAcademicDoc: section-header splitting for research papers
 *
 * Returns an array of chunk objects matching the schema:
 * { id, text, sourceDoc, pageNumber, sectionLabel }
 */

const { v4: uuidv4 } = require('uuid');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Add ~1–2 sentence overlap between consecutive chunks to preserve cross-boundary context.
 * @param {string[]} parts
 * @param {number} overlapSentences
 * @returns {string[]}
 */
function addOverlap(parts, overlapSentences = 2) {
  if (parts.length <= 1) return parts;
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      result.push(parts[i]);
    } else {
      // Take last N sentences from previous chunk as a prefix
      const prevSentences = parts[i - 1]
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
        .slice(-overlapSentences)
        .join(' ');
      result.push((prevSentences + ' ' + parts[i]).trim());
    }
  }
  return result;
}

/**
 * Build a chunk object from raw text.
 * @param {string} text
 * @param {string} sourceDoc
 * @param {number} index  - chunk position (0-based)
 * @param {string} sectionLabel
 * @returns {object}
 */
function makeChunk(text, sourceDoc, index, sectionLabel = '') {
  return {
    id: uuidv4(),
    text: text.trim(),
    sourceDoc,
    pageNumber: null,       // page number enrichment happens post-parsing where available
    chunkIndex: index,
    sectionLabel: sectionLabel || `Chunk ${index + 1}`,
  };
}

// ─── Legal Chunker ───────────────────────────────────────────────────────────

/**
 * Split a legal / T&C document into clause-aware chunks.
 *
 * Splitting triggers:
 *   - Numbered clauses:  "1.", "1.1", "2)", "Article 3", "Clause 4"
 *   - ALL-CAPS headers:  "PRIVACY POLICY", "LIMITATION OF LIABILITY"
 *   - "Section X" markers
 *
 * @param {string} text         - raw document text
 * @param {string} sourceDoc    - filename or label
 * @param {object} [options]
 * @param {number} [options.minChunkLength=100]   - discard chunks shorter than this
 * @param {number} [options.maxChunkLength=1500]  - hard-split very long clauses
 * @returns {object[]}
 */
function chunkLegalDoc(text, sourceDoc = 'document', options = {}) {
  const {
    minChunkLength = 100,
    maxChunkLength = 1500,
  } = options;

  // Clause/section boundary detection regex
  // Matches things like:  "1.", "1.2", "1.2.3", "Article 1", "Section 2", "CLAUSE 3", "2)"
  const boundaryRegex =
    /(?=(?:^|\n)\s*(?:(?:Article|Section|Clause|ARTICLE|SECTION|CLAUSE)\s+\d+[\.\d]*|(?:\d+[\.\d]*\s*[\.\)]\s)|(?:[A-Z][A-Z\s]{4,}(?:\n|$))))/gm;

  let parts = text.split(boundaryRegex).map((p) => p.trim()).filter(Boolean);

  // Fallback: if boundary detection yielded very few parts, do paragraph splitting
  if (parts.length < 3) {
    parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  }

  // Hard-split any chunk that's too long (crude sentence-boundary split)
  const normalized = [];
  for (const part of parts) {
    if (part.length > maxChunkLength) {
      // Split on sentence boundaries
      const sentences = part.split(/(?<=[.!?])\s+/);
      let current = '';
      for (const sentence of sentences) {
        if ((current + ' ' + sentence).length > maxChunkLength && current.length > 0) {
          normalized.push(current.trim());
          current = sentence;
        } else {
          current = current ? current + ' ' + sentence : sentence;
        }
      }
      if (current.trim()) normalized.push(current.trim());
    } else {
      normalized.push(part);
    }
  }

  // Add overlap between consecutive chunks
  const withOverlap = addOverlap(normalized);

  // Discard too-short chunks and build final objects
  return withOverlap
    .filter((p) => p.length >= minChunkLength)
    .map((text, idx) => {
      // Try to extract a section label from the first line of the chunk
      const firstLine = text.split('\n')[0].trim().slice(0, 80);
      return makeChunk(text, sourceDoc, idx, firstLine);
    });
}

// ─── Academic Chunker ────────────────────────────────────────────────────────

/**
 * Split an academic / research-paper document into section-aware chunks.
 *
 * Recognises common section headers:
 *   Abstract, Introduction, Background, Related Work, Methods / Methodology,
 *   Results, Discussion, Conclusion, References, Appendix
 *
 * References section is marked non-retrievable so it doesn't pollute results.
 *
 * @param {string} text
 * @param {string} sourceDoc
 * @param {object} [options]
 * @param {number} [options.minChunkLength=150]
 * @returns {object[]}
 */
function chunkAcademicDoc(text, sourceDoc = 'document', options = {}) {
  const { minChunkLength = 150 } = options;

  const sectionHeaderRegex =
    /(?=(?:^|\n)\s*(?:abstract|introduction|background|related work|literature review|methodology|methods|materials and methods|results|discussion|conclusion|conclusions|acknowledgements?|references|bibliography|appendix)\s*(?:\n|:))/im;

  let parts = text.split(sectionHeaderRegex).map((p) => p.trim()).filter(Boolean);

  // Fallback to paragraph splitting if headers not detected
  if (parts.length < 2) {
    parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  }

  return parts
    .filter((p) => p.length >= minChunkLength)
    .map((chunkText, idx) => {
      const firstLine = chunkText.split('\n')[0].trim().slice(0, 80);
      const isReferences = /^references|^bibliography/i.test(firstLine);
      const chunk = makeChunk(chunkText, sourceDoc, idx, firstLine);
      chunk.isReferences = isReferences; // mark so retriever can optionally skip
      return chunk;
    });
}

// ─── Auto-detect heuristic ───────────────────────────────────────────────────

/**
 * Simple heuristic to guess document type from text sample.
 * Returns 'legal' or 'academic'.
 * @param {string} text
 * @returns {'legal'|'academic'}
 */
function detectDocType(text) {
  const sample = text.slice(0, 3000).toLowerCase();
  const legalSignals = (sample.match(/\b(hereby|clause|agreement|liability|indemnif|warrant|licen[sc]e|governing law|arbitration)\b/g) || []).length;
  const academicSignals = (sample.match(/\b(abstract|introduction|methodology|references|citation|figure|table|hypothesis|experiment)\b/g) || []).length;
  return legalSignals >= academicSignals ? 'legal' : 'academic';
}

/**
 * Main entry point — choose chunker based on docType.
 * @param {string} text
 * @param {string} sourceDoc
 * @param {'legal'|'academic'|'auto'} docType
 * @returns {object[]}
 */
function chunkDocument(text, sourceDoc = 'document', docType = 'auto') {
  const resolved = docType === 'auto' ? detectDocType(text) : docType;
  if (resolved === 'academic') {
    return chunkAcademicDoc(text, sourceDoc);
  }
  return chunkLegalDoc(text, sourceDoc);
}

module.exports = { chunkDocument, chunkLegalDoc, chunkAcademicDoc, detectDocType };
