import { useState, useEffect } from 'react';
import './IngestionStatus.css';

/**
 * IngestionStatus — shown during backend chunking + embedding.
 *
 * Phase 5: animated stage tracker that cycles through stages to communicate
 * progress visually.
 *
 * Props:
 *   sourceDoc - filename or label
 */

const STAGES = [
  { id: 'extract',  label: 'Extracting text from document',    doneIcon: '✓', estimatedMs: 2000  },
  { id: 'chunk',    label: 'Splitting into sections & chunks',  doneIcon: '✓', estimatedMs: 3000  },
  { id: 'embed',    label: 'Generating embeddings',             doneIcon: '✓', estimatedMs: 99999 }, // stays active
  { id: 'index',    label: 'Building search index',            doneIcon: '✓', estimatedMs: 1000  },
];

export default function IngestionStatus({ sourceDoc }) {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    let elapsed = 0;
    const timers = [];

    for (let i = 0; i < STAGES.length - 1; i++) {
      elapsed += STAGES[i].estimatedMs;
      const capturedI = i;
      const t = setTimeout(() => {
        setActiveStage(capturedI + 1);
      }, elapsed);
      timers.push(t);
    }

    return () => timers.forEach(clearTimeout);
  }, []);

  const getStageState = (idx) => {
    if (idx < activeStage) return 'done';
    if (idx === activeStage) return 'active';
    return 'pending';
  };

  return (
    <div
      className="ingestion-status"
      role="status"
      aria-live="polite"
      aria-label="Ingesting document, please wait"
    >
      {/* Spinner */}
      <div className="ingestion-spinner-wrap" aria-hidden="true">
        <div className="ingestion-spinner" />
      </div>

      {/* Title + doc name */}
      <div>
        <p className="ingestion-title">Analysing your document…</p>
        {sourceDoc && (
          <p className="ingestion-doc-name" title={sourceDoc}>
            {sourceDoc}
          </p>
        )}
      </div>

      {/* Stage progress */}
      <div className="ingestion-stages" role="list" aria-label="Ingestion stages">
        {STAGES.map((stage, idx) => {
          const state = getStageState(idx);
          return (
            <div
              key={stage.id}
              className={`ingestion-stage ${state}`}
              role="listitem"
              aria-label={`${stage.label}: ${state}`}
            >
              <span className="stage-icon" aria-hidden="true">
                {state === 'done'   ? stage.doneIcon : null}
                {state === 'pending' ? '○' : null}
              </span>
              {state === 'active' && (
                <span className="stage-spinner" aria-hidden="true" />
              )}
              <span>{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* Tip note */}
      <p className="ingestion-note">
        Processing document contents. This may take up to a minute for larger files.
      </p>

      <div className="ingestion-dots" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  );
}
