import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import './RiskMatrix.css';

// ─── Query templates ──────────────────────────────────────────────────────────
const RISK_QUERY_LEGAL =
  'Analyze this document and create a risk & compliance matrix. For each risk area (e.g., Data Privacy, Liability, Termination, Payments, Intellectual Property, Dispute Resolution), identify: (1) the risk level as HIGH, MEDIUM, or LOW, (2) a one-line description of the risk, and (3) the relevant clause or section. Format as a numbered list with each entry on its own line in this pattern: "[Risk Area]: [HIGH/MEDIUM/LOW] — [Description] (Clause: [section name])".';

const RISK_QUERY_ACADEMIC =
  'Analyze this research paper and create a risk matrix of limitations, methodological concerns, and reproducibility issues. For each area, rate it as HIGH, MEDIUM, or LOW concern and give a one-line description. Format as a numbered list: "[Risk Area]: [HIGH/MEDIUM/LOW] — [Description]".';

// ─── Parse matrix rows from AI response ──────────────────────────────────────
function parseRiskMatrix(text) {
  const lines = text.split('\n').filter(Boolean);
  const rows = [];

  for (const line of lines) {
    // Match: "1. Risk Area: HIGH — Description (Clause: X)"
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    const content = numMatch ? numMatch[1] : line;

    // Try to extract "Area: LEVEL — description"
    const riskMatch = content.match(/^(.+?):\s*(HIGH|MEDIUM|LOW)\s*[—–-]\s*(.+)/i);
    if (riskMatch) {
      const area = riskMatch[1].replace(/\*\*/g, '').trim();
      const level = riskMatch[2].toUpperCase();
      let desc = riskMatch[3].replace(/\*\*/g, '').trim();
      // Extract clause if present
      let clause = '';
      const clauseMatch = desc.match(/\(Clause:\s*(.+?)\)$/i);
      if (clauseMatch) {
        clause = clauseMatch[1].trim();
        desc = desc.replace(clauseMatch[0], '').trim();
      }
      rows.push({ area, level, desc, clause });
    }
  }

  // Fallback: try simpler patterns
  if (rows.length === 0) {
    for (const line of lines) {
      const numMatch = line.match(/^\d+\.\s+(.+)/);
      if (!numMatch) continue;
      const content = numMatch[1].replace(/\*\*/g, '').trim();
      const levelMatch = content.match(/\b(HIGH|MEDIUM|LOW)\b/i);
      if (levelMatch) {
        const level = levelMatch[1].toUpperCase();
        const parts = content.split(/\b(?:HIGH|MEDIUM|LOW)\b/i);
        const area = parts[0].replace(/[:\-–]/g, '').trim() || 'General Risk';
        const desc = (parts[1] || '').replace(/^[\s—–-]+/, '').trim();
        rows.push({ area, level, desc, clause: '' });
      }
    }
  }

  return rows;
}

// ─── Level badge ──────────────────────────────────────────────────────────────
function LevelBadge({ level }) {
  const map = {
    HIGH:   { label: 'HIGH',   cls: 'risk-high' },
    MEDIUM: { label: 'MEDIUM', cls: 'risk-medium' },
    LOW:    { label: 'LOW',    cls: 'risk-low' },
  };
  const info = map[level] || { label: level, cls: 'risk-low' };
  return <span className={`risk-badge ${info.cls}`}>{info.label}</span>;
}

// ─── Risk score summary ──────────────────────────────────────────────────────
function RiskSummaryBar({ rows }) {
  const high   = rows.filter(r => r.level === 'HIGH').length;
  const medium = rows.filter(r => r.level === 'MEDIUM').length;
  const low    = rows.filter(r => r.level === 'LOW').length;

  return (
    <div className="risk-summary-bar">
      <div className="risk-summary-item high">
        <span className="risk-summary-count">{high}</span>
        <span className="risk-summary-label">High</span>
      </div>
      <div className="risk-summary-item medium">
        <span className="risk-summary-count">{medium}</span>
        <span className="risk-summary-label">Medium</span>
      </div>
      <div className="risk-summary-item low">
        <span className="risk-summary-count">{low}</span>
        <span className="risk-summary-label">Low</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RiskMatrix({ sessionId, docType, vectors }) {
  const [rows, setRows]         = useState([]);
  const [rawAnswer, setRawAnswer] = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    const question = docType === 'academic' ? RISK_QUERY_ACADEMIC : RISK_QUERY_LEGAL;

    async function fetchMatrix() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE_URL}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, question, k: 6, vectors }),
        });
        let data;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          throw new Error(text || `Server error (${res.status})`);
        }
        if (!res.ok) throw new Error(data?.error || 'Failed to generate risk matrix.');
        if (data.noMatch) {
          setError('Could not find enough context to generate a risk matrix.');
        } else {
          setRawAnswer(data.answer);
          setRows(parseRiskMatrix(data.answer));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMatrix();
  }, [sessionId, docType]);

  return (
    <div className="collection-view-container">
      <div className="collection-view-header">
        <h2 className="collection-view-title">Risk &amp; Compliance Matrix</h2>
        <p className="collection-view-sub">AI-identified risk areas with severity ratings and clause citations</p>
      </div>

      <div className="collection-view-body">
        {loading && (
          <div className="risk-loading">
            <div className="risk-spinner" />
            <p>Analyzing document for risk factors…</p>
          </div>
        )}

        {!loading && error && (
          <div className="risk-error">{error}</div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <RiskSummaryBar rows={rows} />
            <div className="risk-table-wrap">
              <table className="risk-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Risk Area</th>
                    <th>Level</th>
                    <th>Description</th>
                    <th>Clause / Section</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={`risk-row risk-row-${row.level.toLowerCase()}`}>
                      <td className="risk-row-num">{i + 1}</td>
                      <td className="risk-row-area">{row.area}</td>
                      <td><LevelBadge level={row.level} /></td>
                      <td className="risk-row-desc">{row.desc}</td>
                      <td className="risk-row-clause">{row.clause || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !error && rows.length === 0 && rawAnswer && (
          <div className="risk-fallback-answer">
            <p>{rawAnswer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
