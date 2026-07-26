import { useState, useRef } from 'react';
import './UploadPanel.css';

/**
 * UploadPanel — handles both PDF file upload and raw text paste.
 *
 * Props:
 *   onIngestComplete(sessionInfo) — called after successful ingestion
 *   onIngesting(bool)             — called to show/hide ingestion spinner in parent
 */
export default function UploadPanel({ onIngestComplete, onIngesting }) {
  const [mode, setMode] = useState('pdf');           // 'pdf' | 'paste'
  const [docType, setDocType] = useState('auto');    // 'legal' | 'academic' | 'auto'
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // ─── File handling ─────────────────────────────────────────────────────────

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      setError('');
    } else {
      setError('Only PDF files are supported.');
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError('');
    onIngesting(true);

    try {
      let res;

      if (mode === 'pdf') {
        if (!file) {
          setError('Please select a PDF file first.');
          onIngesting(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);

        res = await fetch('/api/upload', { method: 'POST', body: formData });

      } else {
        if (!pastedText.trim() || pastedText.trim().length < 50) {
          setError('Please paste at least 50 characters of text.');
          onIngesting(false);
          return;
        }
        res = await fetch('/api/ingest-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: pastedText,
            docType,
            sourceDoc: 'pasted-document',
          }),
        });
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ingestion failed. Please try again.');
      }

      onIngestComplete(data);

    } catch (err) {
      setError(err.message);
    } finally {
      onIngesting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="upload-panel">
      {/* Mode toggle — PDF vs Paste */}
      <div className="mode-toggle" role="tablist" aria-label="Input mode">
        <button
          role="tab"
          aria-selected={mode === 'pdf'}
          className={mode === 'pdf' ? 'active' : ''}
          onClick={() => { setMode('pdf'); setError(''); }}
          id="tab-pdf"
        >
          Upload PDF
        </button>
        <button
          role="tab"
          aria-selected={mode === 'paste'}
          className={mode === 'paste' ? 'active' : ''}
          onClick={() => { setMode('paste'); setError(''); }}
          id="tab-paste"
        >
          Paste Text
        </button>
      </div>

      {/* Doc type toggle */}
      <div className="doctype-toggle">
        <label htmlFor="doctype-select">Document type:</label>
        <select
          id="doctype-select"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          <option value="auto">Auto-detect</option>
          <option value="legal">Legal / T&amp;C</option>
          <option value="academic">Research Paper</option>
        </select>
      </div>

      {/* Input area */}
      {mode === 'pdf' ? (
        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          role="button"
          aria-label="PDF upload dropzone"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            id="pdf-file-input"
            aria-label="Select PDF file"
          />

          {file ? (
            <div className="dropzone-file-selected" onClick={(e) => e.stopPropagation()}>
              <span>{file.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                aria-label="Remove selected file"
                title="Remove file"
              >✕</button>
            </div>
          ) : (
            <>
              <p className="dropzone-label">Drop your PDF here, or click to browse</p>
              <p className="dropzone-hint">PDF files only · Max 20 MB</p>
            </>
          )}
        </div>
      ) : (
        <div className="paste-area">
          <textarea
            id="paste-text-input"
            className="paste-textarea"
            placeholder="Paste your Terms & Conditions, privacy policy, research paper, or any long document here…"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            aria-label="Paste document text"
          />
          <span className="char-count">{pastedText.length.toLocaleString()} characters</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="upload-error" role="alert" aria-live="assertive">
          <span>{error}</span>
        </div>
      )}

      {/* Privacy note */}
      <p className="privacy-note">
        <span>Your document is never saved — it exists only for this session and is discarded when you close the tab.</span>
      </p>

      {/* Submit */}
      <button
        id="ingest-submit-btn"
        className="gradient-btn upload-submit"
        onClick={handleSubmit}
        disabled={mode === 'pdf' ? !file : pastedText.trim().length < 50}
        aria-label="Start document ingestion"
      >
        Analyse Document
      </button>
    </div>
  );
}
