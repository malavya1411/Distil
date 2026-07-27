import { useState, useEffect } from 'react';
import './ClausesPanel.css';

// ─── Clause Queries ───────────────────────────────────────────────────────────
const CLAUSE_QUERY_LEGAL =
  'List every key clause in this document. For each clause, state its section name and a one-sentence plain-English summary. Format as a numbered list.';

const CLAUSE_QUERY_ACADEMIC =
  'List the most important points in this document. For each, provide the section or heading and a one-sentence summary. Format as a numbered list.';

// ─── Parse numbered list from AI response ────────────────────────────────────
function parseClauses(text) {
  const lines = text.split('\n').filter(Boolean);
  const clauses = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\.\s+(.+)/);
    if (match) {
      let content = match[2].trim();
      const colonIdx = content.indexOf(':');
      if (colonIdx > 0 && colonIdx < 60) {
        const title = content.slice(0, colonIdx).replace(/\*\*/g, '').trim();
        const body = content.slice(colonIdx + 1).replace(/\*\*/g, '').trim();
        clauses.push({ num: match[1], title, body });
      } else {
        clauses.push({ num: match[1], title: `Clause ${match[1]}`, body: content.replace(/\*\*/g, '') });
      }
    }
  }

  if (clauses.length === 0) {
    const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 20);
    paragraphs.forEach((p, i) => {
      clauses.push({ num: String(i + 1), title: `Point ${i + 1}`, body: p.replace(/\*\*/g, '').trim() });
    });
  }

  return clauses;
}

// ─── Clause Card ─────────────────────────────────────────────────────────────
function ClauseCard({ clause, index }) {
  const colors = ['blue', 'violet', 'amber', 'green', 'rose', 'sky', 'indigo', 'orange'];
  const color = colors[index % colors.length];

  return (
    <div className={`clause-card clause-color-${color}`}>
      <div className="clause-num-badge">{clause.num}</div>
      <div className="clause-content">
        <h4 className="clause-title">{clause.title}</h4>
        <p className="clause-body">{clause.body}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClausesPanel({ sessionId, docType, onClose }) {
  const [clauses, setClauses] = useState([]);
  const [rawAnswer, setRawAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const question =
      docType === 'academic' ? CLAUSE_QUERY_ACADEMIC : CLAUSE_QUERY_LEGAL;

    async function fetchClauses() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, question, k: 6 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to extract clauses.');
        if (data.noMatch) {
          setError('No relevant clauses found in this document.');
        } else {
          setRawAnswer(data.answer);
          setClauses(parseClauses(data.answer));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchClauses();
  }, [sessionId, docType]);

  return (
    <div className="clauses-overlay" role="dialog" aria-modal="true" aria-label="Key Extracted Clauses">
      <div className="clauses-modal">
        <div className="clauses-modal-header">
          <div className="clauses-header-left">
            <div>
              <h2 className="clauses-modal-title">Key Extracted Clauses</h2>
              <p className="clauses-modal-sub">AI-extracted plain-English summary of every key clause</p>
            </div>
          </div>
          <button className="clauses-close-btn" onClick={onClose} aria-label="Close panel">✕</button>
        </div>

        <div className="clauses-modal-body">
          {loading && (
            <div className="clauses-loading">
              <div className="clauses-spinner" />
              <p>Scanning document for key clauses…</p>
            </div>
          )}

          {!loading && error && (
            <div className="clauses-error">{error}</div>
          )}

          {!loading && !error && clauses.length > 0 && (
            <div className="clauses-list">
              <div className="clauses-count-bar">
                <span>{clauses.length} clauses extracted</span>
              </div>
              {clauses.map((clause, i) => (
                <ClauseCard key={i} clause={clause} index={i} />
              ))}
            </div>
          )}

          {!loading && !error && clauses.length === 0 && rawAnswer && (
            <div className="clauses-fallback-answer">
              <p>{rawAnswer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
