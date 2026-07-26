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
  const [view, setView] = useState('landing');
  const [sessionId, setSessionId] = useState(null);
  const [sessionInfo, setSessionInfo] = useState({});
  const [ingestingDoc, setIngestingDoc] = useState('');

  const handleIngesting = (active, docName = '') => {
    if (active) {
      setIngestingDoc(docName);
      setView('ingesting');
    }
  };

  const handleIngestComplete = (data) => {
    setSessionId(data.sessionId);
    setSessionInfo({
      sourceDoc: data.sourceDoc,
      chunkCount: data.chunkCount,
      docType: data.docType,
    });
    setView('chat');
  };

  const handleReset = () => {
    setView('landing');
    setSessionId(null);
    setSessionInfo({});
    setIngestingDoc('');
  };

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="header" role="banner">
        <a
          className="header-logo"
          href="/"
          onClick={(e) => { e.preventDefault(); handleReset(); }}
          aria-label="Distil — go to home"
        >
          <div className="header-logo-mark" aria-hidden="true">✦</div>
          <div className="header-logo-name gradient-text">Distil</div>
        </a>

        <div className="header-right">
          <span className="header-badge" aria-label="Powered by Gemini free tier">
            <span aria-hidden="true">⚡</span>
            Gemini free tier
          </span>
          <span className="header-tagline" aria-hidden="true">Document Q&amp;A</span>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="main" id="main-content">

        {/* ── Landing ──────────────────────────────────────────────────── */}
        {view === 'landing' && (
          <section className="landing" aria-label="Upload your document to get started">
            <div className="hero-glow" aria-hidden="true" />

            <div className="hero">
              <div className="hero-eyebrow">
                <span aria-hidden="true">✦</span>
                <span>RAG-powered · Grounded answers · No hallucinations</span>
              </div>

              <h1>
                Ask anything about your{' '}
                <span className="gradient-text">document</span>
              </h1>

              <p className="hero-desc">
                Upload a Terms &amp; Conditions, privacy policy, EULA, or research
                paper. Ask in plain English. Get precise answers with visible
                source citations — every answer traceable to the original text.
              </p>

              <div className="feature-pills" aria-label="Features">
                <span className="pill">📄 PDF upload</span>
                <span className="pill">📋 Paste text</span>
                <span className="pill">⚡ Clause-aware chunking</span>
                <span className="pill">🔍 Source citations</span>
                <span className="pill">💬 Multi-turn Q&amp;A</span>
                <span className="pill">🔒 Session-only · Never stored</span>
              </div>
            </div>

            <div className="card upload-card">
              <p className="upload-card-label">Get started</p>
              <UploadPanel
                onIngestComplete={handleIngestComplete}
                onIngesting={(active, docName) => handleIngesting(active, docName)}
              />
            </div>
          </section>
        )}

        {/* ── Ingesting ────────────────────────────────────────────────── */}
        {view === 'ingesting' && (
          <div className="ingestion-card" aria-live="polite" aria-label="Ingesting document">
            <div className="card" style={{ padding: 0 }}>
              <IngestionStatus sourceDoc={ingestingDoc} />
            </div>
          </div>
        )}

        {/* ── Chat ─────────────────────────────────────────────────────── */}
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

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="footer" role="contentinfo">
        Distil · RAG Document Q&amp;A · Built with Gemini free tier ·
        {' '}Your document is never saved
      </footer>
    </div>
  );
}
