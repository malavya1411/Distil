import { useState } from 'react';
import UploadPanel from './components/UploadPanel';
import IngestionStatus from './components/IngestionStatus';
import ChatInterface from './components/ChatInterface';
import './App.css';

/**
 * App — root shell managing the three main views:
 *   1. landing   — hero + upload panel
 *   2. ingesting — loading screen while backend embeds chunks
 *   3. chat      — multi-turn Q&A interface
 */
export default function App() {
  // 'landing' | 'ingesting' | 'chat'
  const [view, setView] = useState('landing');
  const [sessionId, setSessionId] = useState(null);
  const [sessionInfo, setSessionInfo] = useState({});
  const [ingestingDoc, setIngestingDoc] = useState('');

  // Called by UploadPanel when ingestion starts
  const handleIngesting = (active, docName = '') => {
    if (active) {
      setIngestingDoc(docName);
      setView('ingesting');
    }
  };

  // Called by UploadPanel when backend responds with session info
  const handleIngestComplete = (data) => {
    setSessionId(data.sessionId);
    setSessionInfo({
      sourceDoc: data.sourceDoc,
      chunkCount: data.chunkCount,
      docType: data.docType,
    });
    setView('chat');
  };

  // Reset back to landing
  const handleReset = () => {
    setView('landing');
    setSessionId(null);
    setSessionInfo({});
    setIngestingDoc('');
  };

  return (
    <div className="app">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="header" role="banner">
        <a className="header-logo" href="/" aria-label="Distil — home">
          <div className="header-logo-mark" aria-hidden="true">✦</div>
          <div>
            <div className="header-logo-name gradient-text">Distil</div>
          </div>
        </a>
        <span className="header-tagline">Document Q&amp;A · RAG-powered</span>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="main" id="main-content">

        {/* ── Landing ─────────────────────────────────────────────────────── */}
        {view === 'landing' && (
          <section className="landing" aria-label="Upload your document">
            {/* Background glow */}
            <div className="hero-glow" aria-hidden="true" />

            {/* Hero copy */}
            <div className="hero">
              <div className="hero-eyebrow">
                <span>✦</span>
                <span>Powered by Gemini · Free tier</span>
              </div>

              <h1>
                Ask anything about your{' '}
                <span className="gradient-text">document</span>
              </h1>

              <p className="hero-desc">
                Upload a Terms &amp; Conditions, privacy policy, EULA, or research
                paper. Ask natural-language questions. Get grounded answers with
                visible source citations — no hallucinations.
              </p>

              <div className="feature-pills">
                <span className="pill">📄 PDF upload</span>
                <span className="pill">📋 Paste text</span>
                <span className="pill">⚡ Clause-aware chunking</span>
                <span className="pill">🔍 Source citations</span>
                <span className="pill">🔒 Session-only</span>
              </div>
            </div>

            {/* Upload card */}
            <div className="card upload-card">
              <UploadPanel
                onIngestComplete={handleIngestComplete}
                onIngesting={(active, docName) => handleIngesting(active, docName)}
              />
            </div>
          </section>
        )}

        {/* ── Ingesting ───────────────────────────────────────────────────── */}
        {view === 'ingesting' && (
          <div className="ingestion-card" aria-live="polite">
            <div className="card" style={{ padding: 0 }}>
              <IngestionStatus sourceDoc={ingestingDoc} />
            </div>
          </div>
        )}

        {/* ── Chat ────────────────────────────────────────────────────────── */}
        {view === 'chat' && sessionId && (
          <div className="chat-view">
            <ChatInterface
              sessionId={sessionId}
              sessionInfo={sessionInfo}
              onReset={handleReset}
            />
          </div>
        )}

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="footer" role="contentinfo">
        <span>Distil · RAG Document Q&amp;A · Built with Gemini free tier · No document is ever stored</span>
      </footer>
    </div>
  );
}
