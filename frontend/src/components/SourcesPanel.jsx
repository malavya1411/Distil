import { useState } from 'react';
import './SourcesPanel.css';

/**
 * SourcesPanel — collapsible panel showing retrieved source chunks per answer.
 *
 * Makes retrieval VISIBLE rather than a black box — key demo feature.
 *
 * Props:
 *   sources  - array of { chunkId, text, score, metadata }
 *   noMatch  - bool: true if no relevant chunks were found
 */
export default function SourcesPanel({ sources, noMatch }) {
  const [open, setOpen] = useState(false);

  if (noMatch) {
    return (
      <div className="no-match-notice" role="note">
        <span>⚠️</span>
        <span>
          No relevant content was found in the document for this question.
          The answer above is based strictly on what's in the document.
        </span>
      </div>
    );
  }

  if (!sources || sources.length === 0) return null;

  const scoreClass = (score) => {
    if (score >= 0.75) return 'high';
    if (score >= 0.60) return 'medium';
    return 'low';
  };

  const scoreLabel = (score) => `${(score * 100).toFixed(1)}% match`;

  return (
    <div className="sources-panel">
      <button
        className={`sources-toggle${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="sources-list"
        id="sources-toggle-btn"
      >
        <span>📎 {sources.length} source{sources.length !== 1 ? 's' : ''} retrieved</span>
        <span className="toggle-chevron" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="sources-list" id="sources-list" role="list">
          {sources.map((src, idx) => (
            <div
              key={src.chunkId || idx}
              className="source-chunk"
              role="listitem"
              aria-label={`Source ${idx + 1}: ${src.metadata?.sectionLabel || 'chunk'}`}
            >
              <div className="source-chunk-header">
                <span className="source-chunk-label" title={src.metadata?.sectionLabel}>
                  {src.metadata?.sectionLabel || `Chunk ${idx + 1}`}
                </span>
                <span className={`source-score-badge ${scoreClass(src.score)}`}>
                  ● {scoreLabel(src.score)}
                </span>
              </div>

              {src.metadata?.pageNumber && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Page {src.metadata.pageNumber}
                </span>
              )}

              <p className="source-chunk-text">
                {src.text.length > 500 ? src.text.slice(0, 500) + '…' : src.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
