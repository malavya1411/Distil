import { useState, useRef } from 'react';
import './UploadPanel.css';

/**
 * UploadPanel — handles both PDF file upload and raw text paste.
 *
 * Props:
 *   onStartIngest({ mode, file, text, docType, sourceDoc }) — called to trigger ingestion in parent
 *   externalError — error passed back from parent ingestion handler
 */
export default function UploadPanel({ onStartIngest, onIngestComplete, onIngesting, externalError }) {
  const [mode, setMode] = useState('paste');         // 'pdf' | 'paste'
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

    if (mode === 'pdf') {
      if (!file) {
        setError('Please select a PDF file first.');
        return;
      }
      if (onStartIngest) {
        onStartIngest({ mode: 'pdf', file, docType, sourceDoc: file.name });
        return;
      }
    } else {
      if (!pastedText.trim() || pastedText.trim().length < 50) {
        setError('Please paste at least 50 characters of text.');
        return;
      }
      if (onStartIngest) {
        onStartIngest({ mode: 'paste', text: pastedText, docType, sourceDoc: 'pasted-document' });
        return;
      }
    }

    // Legacy fallback if onStartIngest is not passed
    if (onIngesting) onIngesting(true, mode === 'pdf' ? file?.name : 'pasted-document');
    try {
      let res;
      if (mode === 'pdf') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('docType', docType);
        res = await fetch('/api/upload', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/ingest-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pastedText, docType, sourceDoc: 'pasted-document' }),
        });
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ingestion failed. Please try again.');
      }
      if (onIngestComplete) onIngestComplete(data);
    } catch (err) {
      setError(err.message);
      if (onIngesting) onIngesting(false);
    }
  };

  const activeError = error || externalError;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="upload-panel">
      {/* Mode toggle — PDF vs Paste */}
      <div className="mode-toggle" role="tablist" aria-label="Input mode">
        <button
          role="tab"
          aria-selected={mode === 'paste'}
          className={`toggle-tab ${mode === 'paste' ? 'active' : ''}`}
          onClick={() => { setMode('paste'); setError(''); }}
        >
          Paste Text
        </button>
        <button
          role="tab"
          aria-selected={mode === 'pdf'}
          className={`toggle-tab ${mode === 'pdf' ? 'active' : ''}`}
          onClick={() => { setMode('pdf'); setError(''); }}
        >
          Upload PDF
        </button>
      </div>

      {/* Doc type hint selector */}
      <div className="doc-type-selector">
        <label htmlFor="doc-type-select" className="selector-label">Document type:</label>
        <select
          id="doc-type-select"
          className="doc-type-select"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          <option value="auto">Auto-detect</option>
          <option value="legal">Legal (Terms / Privacy / Contracts)</option>
          <option value="academic">Academic / Research Paper</option>
        </select>
      </div>

      {/* Mode 1: PDF File Drop Zone */}
      {mode === 'pdf' && (
        <div
          className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          role="region"
          aria-label="PDF drop zone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {file ? (
            <div className="file-selected-state">
              <span className="file-icon">📄</span>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <button
                type="button"
                className="change-file-btn"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="dropzone-prompt">
              <span className="upload-icon">📄</span>
              <p className="primary-prompt">
                <strong>Click to upload</strong> or drag and drop a PDF file
              </p>
              <p className="secondary-prompt">Terms &amp; Conditions, Privacy Policies, Research Papers (max 20 MB)</p>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Raw Text Area */}
      {mode === 'paste' && (
        <div className="paste-area-wrapper">
          <textarea
            className="paste-textarea"
            placeholder="Paste your Terms & Conditions, privacy policy, research paper, or any long document here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            aria-label="Paste document text"
          />
          <span className="char-count">{pastedText.length.toLocaleString()} characters</span>
        </div>
      )}

      {/* Error */}
      {activeError && (
        <div className="upload-error" role="alert" aria-live="assertive">
          <span>{activeError}</span>
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
        {mode === 'paste' ? 'Analyse Text' : 'Analyse Document'}
      </button>
    </div>
  );
}
