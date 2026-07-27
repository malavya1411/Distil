import { useState } from 'react';
import './SourcesPanel.css';

/**
 * SourcesPanel — Perplexity-style Evidence Citations Card.
 * Displays retrieved source passages with confidence score, page/section metadata,
 * and expandable text snippets.
 */
export default function SourcesPanel({ sources, noMatch, actions }) {
  const [open, setOpen] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState(new Set());

  if (noMatch) {
    return (
      <div className="perplexity-sources-panel">
        <div className="sources-toolbar-row">
          <div className="no-match-notice" role="note" aria-label="No matching content found">
            <span>
              No relevant content was found in the document for this question — the response reflects that absence rather than guessing.
            </span>
          </div>
          {actions && <div className="sources-toolbar-actions">{actions}</div>}
        </div>
      </div>
    );
  }

  if (!sources || sources.length === 0) {
    return actions ? (
      <div className="perplexity-sources-panel">
        <div className="sources-toolbar-row actions-only">
          <div className="sources-toolbar-actions">{actions}</div>
        </div>
      </div>
    ) : null;
  }

  const scoreClass = (score) => {
    if (score >= 0.75) return 'high';
    if (score >= 0.60) return 'medium';
    return 'low';
  };

  const scoreColor = (score) => {
    if (score >= 0.75) return '#16a34a';
    if (score >= 0.60) return '#d97706';
    return '#dc2626';
  };

  const topScore = sources[0]?.score || 0;

  const toggleExpand = (chunkId) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      next.has(chunkId) ? next.delete(chunkId) : next.add(chunkId);
      return next;
    });
  };

  return (
    <div className="perplexity-sources-panel">
      <div className="sources-toolbar-row">
        <button
          className={`sources-toggle-pill${open ? ' open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          id="sources-toggle-btn"
        >
          <div className="toggle-left">
            <span>
              {sources.length} Evidence Source{sources.length !== 1 ? 's' : ''}
            </span>
            <span className="confidence-pill" style={{ color: scoreColor(topScore) }}>
              {(topScore * 100).toFixed(0)}% match
            </span>
          </div>
          <span className="toggle-chevron" aria-hidden="true">▾</span>
        </button>

        {actions && <div className="sources-toolbar-actions">{actions}</div>}
      </div>

      {open && (
        <div className="sources-cards-grid" role="list">
          {sources.map((src, idx) => {
            const isExpanded = expandedChunks.has(src.chunkId || idx);
            const isLong = src.text.length > 360;

            return (
              <div
                key={src.chunkId || idx}
                className="evidence-card"
                role="listitem"
              >
                {/* Evidence Card Top Row */}
                <div className="evidence-card-header">
                  <div className="evidence-header-left">
                    <span className="evidence-num">{idx + 1}</span>
                    <span className="evidence-section-name">
                      {src.metadata?.sectionLabel || `Section Chunk ${idx + 1}`}
                    </span>
                  </div>

                  <div className="evidence-header-right">
                    <span className={`confidence-badge ${scoreClass(src.score)}`}>
                      {(src.score * 100).toFixed(1)}% match
                    </span>
                  </div>
                </div>

                {/* Evidence Card Snippet Body */}
                <div className="evidence-card-body">
                  {(src.metadata?.pageNumber || src.metadata?.sourceDoc) && (
                    <div className="evidence-meta-row">
                      {src.metadata.sourceDoc && (
                        <span className="meta-tag">{src.metadata.sourceDoc}</span>
                      )}
                      {src.metadata.pageNumber && (
                        <span className="meta-tag">Page {src.metadata.pageNumber}</span>
                      )}
                    </div>
                  )}

                  <p className={`evidence-text${isExpanded ? ' expanded' : ''}`}>
                    {isExpanded || !isLong ? src.text : src.text.slice(0, 360) + '…'}
                  </p>

                  {isLong && (
                    <button
                      className="evidence-expand-btn"
                      onClick={() => toggleExpand(src.chunkId || idx)}
                    >
                      {isExpanded ? 'Show less' : 'Read full passage'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
