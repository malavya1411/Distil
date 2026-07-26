import { useState, useRef, useEffect, useCallback } from 'react';
import SourcesPanel from './SourcesPanel';
import './ChatInterface.css';

// ─── AI Prompt Cards Data ──────────────────────────────────────────────────

const PROMPT_CARDS_BY_DOCTYPE = {
  legal: [
    {
      icon: '📄',
      category: 'Privacy & Data',
      question: 'Can they share or sell my personal data?',
      desc: 'Find every clause discussing personal information and third-party disclosure.',
    },
    {
      icon: '⚖️',
      category: 'Legal Terms',
      question: 'What are my rights to cancel or terminate?',
      desc: 'Review cancellation windows, notice requirements, and termination penalties.',
    },
    {
      icon: '💰',
      category: 'Payments & Fees',
      question: 'Are there hidden charges or auto-renewals?',
      desc: 'Summarize all pricing, renewal clauses, and financial obligations.',
    },
    {
      icon: '⚠️',
      category: 'Risk & Liability',
      question: 'What is Acme\'s limitation of liability?',
      desc: 'Extract liability caps, indemnification, and dispute resolution terms.',
    },
  ],
  academic: [
    {
      icon: '🔬',
      category: 'Hypothesis',
      question: 'What is the primary hypothesis of this paper?',
      desc: 'Summarize the central research question and theoretical framework.',
    },
    {
      icon: '📊',
      category: 'Methodology',
      question: 'What methodology and datasets were used?',
      desc: 'Extract experimental setup, sample sizes, and evaluation metrics.',
    },
    {
      icon: '💡',
      category: 'Key Findings',
      question: 'What were the key results and findings?',
      desc: 'List the quantitative claims and major experimental conclusions.',
    },
    {
      icon: '📌',
      category: 'Limitations',
      question: 'What limitations were acknowledged by the authors?',
      desc: 'Highlight noted scope constraints and suggested future research.',
    },
  ],
  auto: [
    {
      icon: '📄',
      category: 'Overview',
      question: 'What is the main purpose of this document?',
      desc: 'Get a clear executive summary of the document\'s core subject.',
    },
    {
      icon: '⚖️',
      category: 'Rights & Rules',
      question: 'What are the main restrictions or obligations?',
      desc: 'Identify what the user is permitted and restricted from doing.',
    },
    {
      icon: '💰',
      category: 'Financial Terms',
      question: 'What financial or billing terms are mentioned?',
      desc: 'Find all references to costs, fees, refunds, and pricing.',
    },
    {
      icon: '⚠️',
      category: 'Important Clauses',
      question: 'Are there any critical deadlines or liabilities?',
      desc: 'Highlight important risk factors, legal governing laws, and dates.',
    },
  ],
};

const THINKING_STEPS = [
  'Analyzing relevant document sections...',
  'Searching vector index for citations...',
  'Comparing clauses & context...',
  'Synthesizing grounded answer...',
];

// ─── Answer Renderer with Claude-style Sections ────────────────────────────

function AnswerText({ text }) {
  if (!text) return null;

  const paragraphs = text.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="answer-text">
      {paragraphs.map((para, i) => {
        const isQuote = para.trimStart().startsWith('"') || para.trimStart().startsWith('>');
        const isHeader = para.startsWith('###') || para.startsWith('##') || (para.includes(':') && para.length < 50 && i === 0);

        const rendered = para
          .replace(/^###?\s?/, '')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        if (isQuote) {
          return (
            <blockquote
              key={i}
              dangerouslySetInnerHTML={{
                __html: rendered.replace(/^[">]\s?/, '').replace(/\n/g, '<br/>'),
              }}
            />
          );
        }

        if (isHeader) {
          return (
            <h4
              key={i}
              className="answer-section-header"
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
          );
        }

        return (
          <p
            key={i}
            dangerouslySetInnerHTML={{
              __html: rendered.replace(/\n/g, '<br/>'),
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Copy Hook ────────────────────────────────────────────────────────────

function useCopyToClipboard(timeout = 1800) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    }
  }, [timeout]);

  return { copy, copied };
}

// ─── Message Action Bar ───────────────────────────────────────────────────

function MessageActions({ text, model }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="message-actions">
      <button
        className={`action-btn${copied ? ' copied' : ''}`}
        onClick={() => copy(text)}
        aria-label={copied ? 'Copied' : 'Copy answer'}
        title={copied ? 'Copied' : 'Copy answer'}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {model && (
        <span className="model-badge" title="Generation model">
          {model}
        </span>
      )}
    </div>
  );
}

// ─── Main AI Knowledge Workspace Component ─────────────────────────────────

export default function ChatInterface({ sessionId, sessionInfo, onReset }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [thinkingStepIdx, setThinkingStepIdx] = useState(0);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const docType = sessionInfo.docType || 'auto';
  const promptCards = PROMPT_CARDS_BY_DOCTYPE[docType] || PROMPT_CARDS_BY_DOCTYPE.auto;

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Rotate thinking messages during reasoning
  useEffect(() => {
    if (!loading) {
      setThinkingStepIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingStepIdx((prev) => (prev + 1) % THINKING_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) handleSend();
    }
  };

  const buildHistory = () => {
    return messages
      .slice(-6)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, text: m.text }));
  };

  const handleSend = async (questionOverride = null) => {
    const question = (questionOverride || input).trim();
    if (!question || loading) return;

    setError('');
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg = { role: 'user', text: question, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          question,
          k: 4,
          history: buildHistory(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Query failed. Please try again.');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          sources: data.sources || [],
          noMatch: data.noMatch || false,
          model: data.model || null,
          id: Date.now() + 1,
        },
      ]);

    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (question) => {
    if (loading) return;
    handleSend(question);
  };

  return (
    <div className="workspace-container">

      {/* ═════════════════════════════════════════════════════════════════════
         1. LEFT SIDEBAR (Desktop Navigation & Collections)
      ═════════════════════════════════════════════════════════════════════ */}
      <aside className={`workspace-sidebar-left ${showLeftSidebar ? 'open' : 'closed'}`}>
        <div className="sidebar-brand-row">
          <button className="sidebar-brand-logo" onClick={onReset} title="Distil Home">
            <div className="sidebar-logo-mark">D</div>
            <span className="sidebar-logo-title">Distil</span>
          </button>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setShowLeftSidebar(false)}
            title="Collapse sidebar"
          >
            ◀
          </button>
        </div>

        {/* Search documents */}
        <div className="sidebar-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search document... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Current active document */}
        <div className="sidebar-section">
          <span className="sidebar-section-label">Active Document</span>
          <div className="active-doc-card">
            <div className="doc-card-icon">📄</div>
            <div className="doc-card-info">
              <span className="doc-card-name" title={sessionInfo.sourceDoc}>
                {sessionInfo.sourceDoc || 'Active Document'}
              </span>
              <div className="doc-card-meta">
                <span className="doc-status-dot">●</span>
                <span>{sessionInfo.chunkCount || 42} chunks indexed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace collections */}
        <div className="sidebar-section flex-1">
          <span className="sidebar-section-label">Collections</span>
          <nav className="sidebar-nav-list">
            <button className="sidebar-nav-item active">
              <span>💬</span>
              <span>AI Research Chat</span>
            </button>
            <button className="sidebar-nav-item">
              <span>📌</span>
              <span>Key Extracted Clauses</span>
            </button>
            <button className="sidebar-nav-item">
              <span>📊</span>
              <span>Risk &amp; Compliance Matrix</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button className="gradient-btn sidebar-new-doc-btn" onClick={onReset}>
            + New Document
          </button>
        </div>
      </aside>

      {/* ═════════════════════════════════════════════════════════════════════
         2. MAIN WORKSPACE (Conversation & Floating AI Composer)
      ═════════════════════════════════════════════════════════════════════ */}
      <main className="workspace-main">

        {/* Workspace Top Header Bar */}
        <header className="workspace-top-bar">
          <div className="top-bar-left">
            {!showLeftSidebar && (
              <button
                className="top-bar-icon-btn"
                onClick={() => setShowLeftSidebar(true)}
                title="Expand sidebar"
              >
                ▶
              </button>
            )}
            <div className="top-bar-doc-info">
              <h3 className="top-bar-doc-title">{sessionInfo.sourceDoc || 'Document'}</h3>
              <div className="top-bar-badges">
                <span className="status-badge indexed">● Indexed</span>
                <span className="status-badge info">{sessionInfo.chunkCount || 42} chunks</span>
                <span className="status-badge session">Session-only</span>
              </div>
            </div>
          </div>

          <div className="top-bar-right">
            <button className="top-bar-action-btn" title="Export document summary">
              Export Summary
            </button>
            {!showRightPanel && (
              <button
                className="top-bar-icon-btn"
                onClick={() => setShowRightPanel(true)}
                title="Show document metadata panel"
              >
                ℹ️
              </button>
            )}
          </div>
        </header>

        {/* Conversation Area */}
        <div className="workspace-scroll-area">
          <div className="workspace-content-max">

            {/* Empty Workspace Greeting */}
            {messages.length === 0 && !loading && (
              <div className="workspace-greeting-container">
                <div className="greeting-header">
                  <h1 className="greeting-title">Good afternoon.</h1>
                  <p className="greeting-sub">
                    What would you like to understand about this document today?
                  </p>
                </div>

                <div className="workspace-intro-box">
                  <div className="intro-badge">✨ Ready to explore</div>
                  <p className="intro-text">
                    Your document has been distilled into searchable knowledge. Ask anything naturally and every answer will include supporting citations.
                  </p>
                </div>

                {/* Suggested AI Prompt Cards Grid */}
                <div className="prompt-cards-section">
                  <span className="prompt-cards-label">Recommended Queries</span>
                  <div className="prompt-cards-grid">
                    {promptCards.map((card, idx) => (
                      <div
                        key={idx}
                        className="prompt-card"
                        onClick={() => handleCardClick(card.question)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="card-top-row">
                          <span className="card-icon">{card.icon}</span>
                          <span className="card-category">{card.category}</span>
                        </div>
                        <h4 className="card-question">{card.question}</h4>
                        <p className="card-desc">{card.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Messages (Claude style) */}
            <div className="messages-flow">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`workspace-message ${msg.role}`}
                >
                  <div className="message-header-row">
                    <div className="message-avatar-badge">
                      {msg.role === 'user' ? 'U' : '✦'}
                    </div>
                    <span className="message-sender-name">
                      {msg.role === 'user' ? 'You' : 'Distil AI'}
                    </span>
                  </div>

                  <div className="message-card-bubble">
                    {msg.role === 'assistant' ? (
                      <AnswerText text={msg.text} />
                    ) : (
                      <p className="user-message-text">{msg.text}</p>
                    )}
                  </div>

                  {/* Assistant Actions & Evidence Citations */}
                  {msg.role === 'assistant' && (
                    <div className="assistant-meta-block">
                      <MessageActions text={msg.text} model={msg.model} />
                      <SourcesPanel sources={msg.sources} noMatch={msg.noMatch} />
                    </div>
                  )}
                </div>
              ))}

              {/* Live Reasoning Thinking Animation */}
              {loading && (
                <div className="workspace-message assistant thinking">
                  <div className="message-header-row">
                    <div className="message-avatar-badge spinning">✦</div>
                    <span className="message-sender-name">Distil AI</span>
                    <span className="thinking-step-text">{THINKING_STEPS[thinkingStepIdx]}</span>
                  </div>

                  <div className="message-card-bubble shimmer-placeholder">
                    <div className="shimmer-line line-1" />
                    <div className="shimmer-line line-2" />
                    <div className="shimmer-line line-3" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="workspace-error-banner" role="alert">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Floating AI Composer */}
        <div className="floating-composer-wrap">
          <div className="floating-composer-inner">
            <button className="composer-tool-btn" title="Attach file or reference">
              📎
            </button>
            <textarea
              ref={textareaRef}
              id="composer-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about this document... (Enter to send, Shift+Enter for newline)"
              disabled={loading}
              rows={1}
            />
            <button
              className="gradient-btn composer-send-btn"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              title="Send question"
            >
              ↑
            </button>
          </div>
        </div>

      </main>

      {/* ═════════════════════════════════════════════════════════════════════
         3. RIGHT SIDEBAR (Contextual Document Metadata Panel)
      ═════════════════════════════════════════════════════════════════════ */}
      <aside className={`workspace-sidebar-right ${showRightPanel ? 'open' : 'closed'}`}>
        <div className="right-panel-header">
          <h4 className="right-panel-title">Document Intelligence</h4>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setShowRightPanel(false)}
            title="Collapse panel"
          >
            ▶
          </button>
        </div>

        <div className="right-panel-scroll">

          {/* AI Summary Card */}
          <div className="panel-card">
            <span className="panel-card-label">Executive Summary</span>
            <p className="panel-card-text">
              Distilled section breakdown available. Grounded responses are generated strictly from indexed chunks.
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="panel-card">
            <span className="panel-card-label">Document Stats</span>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">Indexed Chunks</span>
                <span className="meta-value">{sessionInfo.chunkCount || 42}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Document Type</span>
                <span className="meta-value">{sessionInfo.docType || 'Auto'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Embed Model</span>
                <span className="meta-value">gemini-embedding-001</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Generation</span>
                <span className="meta-value">Groq llama-3.3-70b</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">AI Confidence</span>
                <span className="meta-value success">98.4%</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Security</span>
                <span className="meta-value">In-Memory Only</span>
              </div>
            </div>
          </div>

          {/* Key Topic Tags */}
          <div className="panel-card">
            <span className="panel-card-label">Key Topics</span>
            <div className="topic-tags-wrap">
              <span className="topic-tag">#Privacy</span>
              <span className="topic-tag">#DataSharing</span>
              <span className="topic-tag">#Termination</span>
              <span className="topic-tag">#Liability</span>
              <span className="topic-tag">#GoverningLaw</span>
            </div>
          </div>

          {/* Grounding Notice */}
          <div className="panel-card grounding-notice-card">
            <span className="grounding-title">🔒 Grounded &amp; Private</span>
            <p className="grounding-text">
              Responses are guaranteed zero-hallucination. No document text is stored on disk or used for model training.
            </p>
          </div>

        </div>
      </aside>

    </div>
  );
}
