import { useState, useRef } from 'react';
import UploadPanel from './components/UploadPanel';
import IngestionStatus from './components/IngestionStatus';
import ChatInterface from './components/ChatInterface';
import './App.css';

// ─── Landing page data ────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    icon: '📄',
    title: 'Upload or paste',
    desc: 'Drop a PDF or paste raw text — Terms & Conditions, privacy policies, EULAs, or research papers.',
  },
  {
    num: '02',
    icon: '⚡',
    title: 'Instant indexing',
    desc: 'Your document is split into sections, embedded with Gemini, and stored in a fast in-memory index.',
  },
  {
    num: '03',
    icon: '💬',
    title: 'Ask anything',
    desc: 'Ask in plain English. Every answer is grounded in the original text with visible source citations.',
  },
];

const FEATURES = [
  {
    icon: '🔍',
    color: 'indigo',
    title: 'Grounded answers only',
    desc: 'The model answers strictly from your document. If something isn\'t covered, it says so — no hallucinations.',
  },
  {
    icon: '📎',
    color: 'violet',
    title: 'Source citations',
    desc: 'Every answer links back to the exact section it came from, with a relevance score so you can trust the result.',
  },
  {
    icon: '⚡',
    color: 'amber',
    title: 'Groq LPU generation',
    desc: 'Answers arrive in under a second. Groq\'s Language Processing Unit makes generation the fastest part of the pipeline.',
  },
  {
    icon: '📑',
    color: 'sky',
    title: 'Clause-aware chunking',
    desc: 'Legal text is split on section boundaries, not arbitrary character counts — better retrieval from the start.',
  },
  {
    icon: '🔒',
    color: 'green',
    title: 'Session-only privacy',
    desc: 'Your document never touches a database. It lives only in memory for the duration of your session.',
  },
  {
    icon: '💬',
    color: 'rose',
    title: 'Multi-turn Q&A',
    desc: 'Follow up naturally. Conversation history is maintained so context carries across questions.',
  },
];

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState('landing');
  const [sessionId, setSessionId] = useState(null);
  const [sessionInfo, setSessionInfo] = useState({});
  const [ingestingDoc, setIngestingDoc] = useState('');
  const uploadRef = useRef(null);

  const scrollToUpload = () => {
    uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
    // Scroll to upload on reset so user can easily re-upload
    setTimeout(scrollToUpload, 100);
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
            aria-label="Distil — go to home"
            style={{ background: 'none', border: 'none' }}
          >
            <div className="nav-logo-mark" aria-hidden="true">✦</div>
            <span className="nav-logo-name">Distil</span>
          </button>

          {/* Center badge */}
          <div className="nav-center">
            <span className="nav-pill">
              <span aria-hidden="true">⚡</span>
              Gemini embeddings · Groq generation
            </span>
          </div>

          {/* Right */}
          <div className="nav-right">
            {view === 'landing' && (
              <>
                <button className="nav-link" onClick={scrollToUpload}>
                  Try it →
                </button>
                <button
                  className="gradient-btn nav-cta"
                  onClick={scrollToUpload}
                  id="nav-get-started-btn"
                >
                  Get started
                </button>
              </>
            )}
            {(view === 'ingesting' || view === 'chat') && (
              <button className="nav-link" onClick={handleReset}>
                ← Back
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ LANDING ═════════════════════════════════════════════════════ */}
      {view === 'landing' && (
        <main id="main-content">

          {/* ── Hero ───────────────────────────────────────────────────── */}
          <section className="hero-section" aria-labelledby="hero-headline">
            <div className="hero-inner">

              <div className="hero-badge">
                <span className="hero-badge-dot" aria-hidden="true" />
                <span>RAG-powered · Free tier · No data stored</span>
              </div>

              <h1 className="hero-headline" id="hero-headline">
                Read less.<br />
                <span className="gradient-text">Understand more.</span>
              </h1>

              <p className="hero-sub">
                Upload a Terms &amp; Conditions, privacy policy, or research paper.
                Ask any question in plain English — get a grounded answer with
                the exact source passage, in under a second.
              </p>

              <div className="hero-actions">
                <button
                  className="gradient-btn hero-primary-btn"
                  onClick={scrollToUpload}
                  id="hero-try-btn"
                  aria-label="Try Distil — scroll to upload"
                >
                  Try it now — it's free ↓
                </button>
                <button
                  className="hero-secondary-btn"
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  aria-label="See how it works"
                >
                  See how it works
                </button>
              </div>

              <div className="hero-trust" aria-label="Trust signals">
                <span className="hero-trust-item"><span>🔒</span> Session-only · never saved</span>
                <span className="hero-trust-item"><span>⚡</span> &lt;1s Groq generation</span>
                <span className="hero-trust-item"><span>✓</span> No hallucinations</span>
                <span className="hero-trust-item"><span>💳</span> $0 · free tier</span>
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
                    <div className="step-icon" aria-hidden="true">{step.icon}</div>
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
                    <div className={`feature-icon-wrap ${f.color}`} aria-hidden="true">
                      {f.icon}
                    </div>
                    <h3 className="feature-title">{f.title}</h3>
                    <p className="feature-desc">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Upload CTA ─────────────────────────────────────────────── */}
          <section
            className="upload-section"
            id="upload"
            ref={uploadRef}
            aria-labelledby="upload-title"
          >
            <div className="upload-section-inner">
              <span className="section-label">Get started</span>
              <h2 className="section-title" id="upload-title">
                Try it with your document
              </h2>
              <p className="section-sub">
                Upload a PDF or paste text below. Your document is never stored
                — it exists only for this session.
              </p>

              <div className="upload-widget">
                <UploadPanel
                  onIngestComplete={handleIngestComplete}
                  onIngesting={(active, docName) => handleIngesting(active, docName)}
                />
              </div>
            </div>
          </section>

        </main>
      )}

      {/* ═══ INGESTING ═══════════════════════════════════════════════════ */}
      {view === 'ingesting' && (
        <main id="main-content" className="ingestion-view" aria-live="polite">
          <div className="card" style={{ maxWidth: 520, width: '100%', padding: 0 }}>
            <IngestionStatus sourceDoc={ingestingDoc} />
          </div>
        </main>
      )}

      {/* ═══ CHAT ════════════════════════════════════════════════════════ */}
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
            <div className="footer-logo-mark" aria-hidden="true">✦</div>
            <span className="footer-logo-name">Distil</span>
          </button>
          <span className="footer-tagline">
            RAG-powered Document Q&amp;A · Gemini embeddings · Groq generation · Session-only · Free
          </span>
        </div>
      </footer>

    </div>
  );
}
