import './IngestionStatus.css';

/**
 * IngestionStatus — shown while the backend is chunking and embedding.
 * Communicates "this is working, not frozen" to prevent user anxiety.
 */
export default function IngestionStatus({ sourceDoc }) {
  return (
    <div className="ingestion-status" role="status" aria-live="polite" aria-label="Ingesting document">
      <div className="ingestion-spinner" aria-hidden="true" />

      <div>
        <p className="ingestion-title">Analysing your document…</p>
        {sourceDoc && (
          <p className="ingestion-subtitle" style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {sourceDoc}
          </p>
        )}
      </div>

      <p className="ingestion-subtitle">
        Splitting into sections, generating embeddings, and building your
        searchable index. This can take up to a minute for longer documents.
      </p>

      <div className="ingestion-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
