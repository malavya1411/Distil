import { useState } from 'react';
import './SourcesPanel.css';

/**
 * SourcesPanel — collapsible panel showing retrieved source chunks per answer.
 * Phase 5: score progress bar, expandable chunk text, index badges, meta row.
 *
 * Props:
 *   sources  - array of { chunkId, text, score, metadata }
 *   noMatch  - bool: true if no relevant chunks were found
 */
export default function SourcesPanel({ sources, noMatch }) {
  const [open, setOpen] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState(new Set());

  if (noMatch) {
    return (
      <div className="no-match-notice" role="note" aria-label="No matching content found">
        <span aria-hidden="true">⚠️</span>
        <span>
          No relevant content was found in the document for this question —
          the answer reflects that absence rather than guessing.
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

  const scoreColor = (score) => {
    if (score >= 0.75) return '#4ade80';
    if (score >= 0.60) return '#fbbf24';
    return '#fca5a5';
  };

  const topScore = sources[0]?.score || 0;
  const qualityColor = scoreColor(topScore);

  const toggleExpand = (chunkId) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      next.has(chunkId) ? next.delete(chunkId) : next.add(chunkId);
      return next;
    });
  };

  return (
    <div className="sources-panel">
      <button
        className={`sources-toggle${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="sources-list"
        id="sources-toggle-btn"
      >
        <span className="sources-toggle-left">
          <span
            className="sources-quality-dot"
            style={{ background: qualityColor }}
            aria-hidden="true"
          />
          <span>
            {sources.length} source{sources.length !== 1 ? 's' : ''} · top match {(topScore * 100).toFixed(0)}%
          </span>
        </span>
        <span className="toggle-chevron" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="sources-list" id="sources-list" role="list">
          {sources.map((src, idx) => {
            const isExpanded = expandedChunks.has(src.chunkId || idx);
            const isLong = src.text.length > 400;

            return (
              <div
                key={src.chunkId || idx}
                className="source-chunk"
                role="listitem"
                aria-label={`Source ${idx + 1}: ${src.metadata?.sectionLabel || 'chunk'}`}
              >
                {/* Header */}
                <div className="source-chunk-header">
                  <div className="source-chunk-left">
                    <span className="source-index" aria-hidden="true">{idx + 1}</span>
                    <span
                      className="source-chunk-label"
                      title={src.metadata?.sectionLabel}
                    >
                      {src.metadata?.sectionLabel || `Chunk ${idx + 1}`}
                    </span>
                  </div>

                  <div className="source-chunk-right">
                    {/* Score bar */}
                    <div
                      className="score-bar-wrap"
                      aria-hidden="true"
                      title={`Similarity: ${(src.score * 100).toFixed(1)}%`}
                    >
                      <div
                        className="score-bar-fill"
                        style={{
                          width: `${Math.round(src.score * 100)}%`,
                          background: scoreColor(src.score),
                        }}
                      />
                    </div>
                    {/* Score badge */}
                    <span
                      className={`source-score-badge ${scoreClass(src.score)}`}
                      aria-label={`Relevance: ${(src.score * 100).toFixed(1)}%`}
                    >
                      {(src.score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="source-chunk-body">
                  {/* Meta row */}
                  {(src.metadata?.pageNumber || src.metadata?.sourceDoc) && (
                    <div className="source-meta">
                      {src.metadata.sourceDoc && (
                        <span className="source-meta-item">
                          <span aria-hidden="true">📄</span>
                          {src.metadata.sourceDoc}
                        </span>
                      )}
                      {src.metadata.pageNumber && (
                        <span className="source-meta-item">
                          <span aria-hidden="true">📍</span>
                          Page {src.metadata.pageNumber}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Chunk text */}
                  <p className={`source-chunk-text${isExpanded ? ' expanded' : ''}`}>
                    {isExpanded || !isLong
                      ? src.text
                      : src.text.slice(0, 400) + '…'}
                  </p>

                  {/* Expand / collapse long chunks */}
                  {isLong && (
                    <button
                      className="source-expand-btn"
                      onClick={() => toggleExpand(src.chunkId || idx)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Show less text' : 'Show full chunk text'}
                    >
                      {isExpanded ? '↑ Show less' : '↓ Show full excerpt'}
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
