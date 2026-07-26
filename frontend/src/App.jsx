import { useState } from 'react';
import UploadPanel from './components/UploadPanel';
import IngestionStatus from './components/IngestionStatus';
import ChatInterface from './components/ChatInterface';
import './App.css';

// ─── Landing page data ────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    title: 'Upload or paste',
    desc: 'Drop a PDF or paste raw text — Terms & Conditions, privacy policies, EULAs, or research papers.',
  },
  {
    num: '02',
    title: 'Instant indexing',
    desc: 'Your document is split into sections, embedded, and stored in a fast in-memory index.',
  },
  {
    num: '03',
    title: 'Ask anything',
    desc: 'Ask in plain English. Every answer is grounded in the original text with visible source citations.',
  },
];

const FEATURES = [
  {
    color: 'indigo',
    title: 'Grounded answers only',
    desc: 'The model answers strictly from your document. If something isn\'t covered, it says so — no hallucinations.',
  },
  {
    color: 'violet',
    title: 'Source citations',
    desc: 'Every answer links back to the exact section it came from, with a relevance score so you can trust the result.',
  },
  {
    color: 'amber',
    title: 'Fast generation',
    desc: 'Answers arrive in under a second. Optimized processing makes generation fast and responsive.',
  },
  {
    color: 'sky',
    title: 'Clause-aware chunking',
    desc: 'Legal text is split on section boundaries, not arbitrary character counts — better retrieval from the start.',
  },
  {
    color: 'green',
    title: 'Session-only privacy',
    desc: 'Your document never touches a database. It lives only in memory for the duration of your session.',
  },
  {
    color: 'rose',
    title: 'Multi-turn Q&A',
    desc: 'Follow up naturally. Conversation history is maintained so context carries across questions.',
  },
];

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // Views: 'landing' | 'upload' | 'ingesting' | 'chat'
  const [view, setView] = useState('landing');
  const [sessionId, setSessionId] = useState(null);
  const [sessionInfo, setSessionInfo] = useState({});
  const [ingestingDoc, setIngestingDoc] = useState('');

  const goToUpload = () => {
    setView('upload');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [ingestData, setIngestData] = useState(null);
  const [isIngestFinished, setIsIngestFinished] = useState(false);

  const handleIngesting = (active, docName = '') => {
    if (active) {
      setIngestingDoc(docName);
      setIsIngestFinished(false);
      setIngestData(null);
      setView('ingesting');
    }
  };

  const handleIngestComplete = (data) => {
    setIngestData(data);
    setIsIngestFinished(true);
  };

  const handleOpenWorkspace = () => {
    if (ingestData) {
      setSessionId(ingestData.sessionId);
      setSessionInfo({
        sourceDoc: ingestData.sourceDoc,
        chunkCount: ingestData.chunkCount,
        docType: ingestData.docType,
      });
      setView('chat');
    }
  };

  const handleReset = () => {
    setView('landing');
    setSessionId(null);
    setSessionInfo({});
    setIngestingDoc('');
    setIsIngestFinished(false);
    setIngestData(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app">

      {/* ═══ NAVIGATION ══════════════════════════════════════════════════ */}
      <nav className="nav" role="navigation" aria-label="Main navigation">
        <div className="nav-inner">
          {/* Logo */}
          <button
            className="nav-logo"
            onClick={handleReset}
            aria-label="Distil home"
            style={{ background: 'none', border: 'none' }}
          >
            <div className="nav-logo-mark" aria-hidden="true">D</div>
            <span className="nav-logo-name">Distil</span>
          </button>

          {/* Right */}
          <div className="nav-right">
            {view === 'landing' && (
              <button
                className="gradient-btn nav-cta"
                onClick={goToUpload}
                id="nav-get-started-btn"
              >
                Get started
              </button>
            )}
            {view === 'upload' && (
              <button className="nav-link" onClick={handleReset}>
                Home
              </button>
            )}
            {(view === 'ingesting' || view === 'chat') && (
              <button className="nav-link" onClick={goToUpload}>
                New document
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ LANDING PAGE ════════════════════════════════════════════════ */}
      {view === 'landing' && (
        <main id="main-content">

          {/* ── Hero ───────────────────────────────────────────────────── */}
          <section className="hero-section" aria-labelledby="hero-headline">
            <div className="hero-inner">



              <h1 className="hero-headline" id="hero-headline">
                Read less.<br />
                <span className="gradient-text">Understand more.</span>
              </h1>

              <p className="hero-sub">
                Upload a Terms &amp; Conditions, privacy policy, or research paper.
                Ask any question in plain English — get a grounded answer with
                the exact source passage.
              </p>

              <div className="hero-actions">
                <button
                  className="gradient-btn hero-primary-btn"
                  onClick={goToUpload}
                  id="hero-try-btn"
                  aria-label="Get started — navigate to upload page"
                >
                  Get started
                </button>
                <button
                  className="hero-secondary-btn"
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  aria-label="See how it works"
                >
                  See how it works
                </button>
              </div>

              <div className="hero-trust" aria-label="Key features">
                <span className="hero-trust-item">Session-only privacy</span>
                <span className="hero-trust-item">Fast response time</span>
                <span className="hero-trust-item">Grounded in source text</span>
              </div>
            </div>
          </section>

          {/* ── How It Works ───────────────────────────────────────────── */}
          <section
            className="section"
            id="how-it-works"
            aria-labelledby="how-title"
          >
            <div className="section-inner">
              <span className="section-label">How it works</span>
              <h2 className="section-title" id="how-title">
                From document to answer<br />in three steps
              </h2>
              <p className="section-sub">
                No setup, no accounts, no waiting. Just upload and ask.
              </p>

              <div className="steps-grid" role="list">
                {STEPS.map((step) => (
                  <div key={step.num} className="step-card" role="listitem">
                    <div className="step-number" aria-hidden="true">{step.num}</div>
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-desc">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Features ───────────────────────────────────────────────── */}
          <section
            className="section section-alt"
            aria-labelledby="features-title"
          >
            <div className="section-inner">
              <span className="section-label">Features</span>
              <h2 className="section-title" id="features-title">
                Built for accuracy,<br />not just speed
              </h2>
              <p className="section-sub">
                Every design decision prioritises giving you the right answer
                from the right part of the document.
              </p>

              <div className="features-grid" role="list">
                {FEATURES.map((f) => (
                  <div key={f.title} className="feature-card" role="listitem">
                    <h3 className="feature-title">{f.title}</h3>
                    <p className="feature-desc">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Bottom CTA Banner ──────────────────────────────────────── */}
          <section className="cta-banner-section">
            <div className="cta-banner-inner">
              <h2 className="cta-banner-title">Ready to analyze your document?</h2>
              <p className="cta-banner-sub">
                Upload a PDF or paste text. Get grounded answers in seconds.
              </p>
              <button
                className="gradient-btn hero-primary-btn"
                onClick={goToUpload}
                id="bottom-cta-btn"
              >
                Get started now
              </button>
            </div>
          </section>

        </main>
      )}

      {/* ═══ DEDICATED UPLOAD PAGE ═══════════════════════════════════════ */}
      {view === 'upload' && (
        <main id="main-content" className="upload-page">
          <div className="upload-page-inner">
            <div className="upload-page-header">
              <h1 className="upload-page-title">Upload your document</h1>
              <p className="upload-page-sub">
                Upload a PDF file or paste text below. Your document is processed in memory
                and never stored.
              </p>
            </div>

            <div className="upload-widget">
              <UploadPanel
                onIngestComplete={handleIngestComplete}
                onIngesting={(active, docName) => handleIngesting(active, docName)}
              />
            </div>
          </div>
        </main>
      )}

      {/* ═══ INGESTING PAGE ══════════════════════════════════════════════ */}
      {view === 'ingesting' && (
        <main id="main-content" className="ingestion-view" aria-live="polite">
          <IngestionStatus
            sourceDoc={ingestingDoc}
            isFinished={isIngestFinished}
            onOpenWorkspace={handleOpenWorkspace}
          />
        </main>
      )}

      {/* ═══ CHAT PAGE ═══════════════════════════════════════════════════ */}
      {view === 'chat' && sessionId && (
        <main id="main-content" className="chat-view">
          <ChatInterface
            sessionId={sessionId}
            sessionInfo={sessionInfo}
            onReset={handleReset}
          />
        </main>
      )}

      {/* ═══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer className="footer" role="contentinfo">
        <div className="footer-inner">
          <button
            className="footer-logo"
            onClick={handleReset}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Distil home"
          >
            <div className="footer-logo-mark" aria-hidden="true">D</div>
            <span className="footer-logo-name">Distil</span>
          </button>
          <span className="footer-tagline">
            Document QA Assistant · Session-scoped
          </span>
        </div>
      </footer>

    </div>
  );
}
