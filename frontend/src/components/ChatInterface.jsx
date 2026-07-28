import { useState, useRef, useEffect, useCallback } from 'react';
import SourcesPanel from './SourcesPanel';
import ClausesPanel from './ClausesPanel';
import RiskMatrix from './RiskMatrix';
import './ChatInterface.css';

// ─── AI Prompt Cards Data ──────────────────────────────────────────────────

const PROMPT_CARDS_BY_DOCTYPE = {
  legal: [
    {
      category: 'Privacy & Data',
      question: 'Can they share or sell my personal data?',
      desc: 'Find every clause discussing personal information and third-party disclosure.',
    },
    {
      category: 'Legal Terms',
      question: 'What are my rights to cancel or terminate?',
      desc: 'Review cancellation windows, notice requirements, and termination penalties.',
    },
    {
      category: 'Payments & Fees',
      question: 'Are there hidden charges or auto-renewals?',
      desc: 'Summarize all pricing, renewal clauses, and financial obligations.',
    },
    {
      category: 'Risk & Liability',
      question: 'What is Acme\'s limitation of liability?',
      desc: 'Extract liability caps, indemnification, and dispute resolution terms.',
    },
  ],
  academic: [
    {
      category: 'Hypothesis',
      question: 'What is the primary hypothesis of this paper?',
      desc: 'Summarize the central research question and theoretical framework.',
    },
    {
      category: 'Methodology',
      question: 'What methodology and datasets were used?',
      desc: 'Extract experimental setup, sample sizes, and evaluation metrics.',
    },
    {
      category: 'Key Findings',
      question: 'What were the key results and findings?',
      desc: 'List the quantitative claims and major experimental conclusions.',
    },
    {
      category: 'Limitations',
      question: 'What limitations were acknowledged by the authors?',
      desc: 'Highlight noted scope constraints and suggested future research.',
    },
  ],
  auto: [
    {
      category: 'Overview',
      question: 'What is the main purpose of this document?',
      desc: 'Get a clear executive summary of the document\'s core subject.',
    },
    {
      category: 'Rights & Rules',
      question: 'What are the main restrictions or obligations?',
      desc: 'Identify what the user is permitted and restricted from doing.',
    },
    {
      category: 'Financial Terms',
      question: 'What financial or billing terms are mentioned?',
      desc: 'Find all references to costs, fees, refunds, and pricing.',
    },
    {
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

function MessageActions({ text }) {
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="message-actions">
      <button
        className={`action-btn${copied ? ' copied' : ''}`}
        onClick={() => copy(text)}
        aria-label={copied ? 'Copied' : 'Copy answer'}
        title={copied ? 'Copied' : 'Copy answer'}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        )}
      </button>
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
  const [searchQuery, setSearchQuery] = useState('');
  // 'none' | 'clauses' | 'risk'
  const [activePanel, setActivePanel] = useState('none');

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

  // ─── Export conversation as markdown file ─────────────────────────────────
  const handleExport = () => {
    if (messages.length === 0) {
      alert('No conversation to export yet. Ask a question first!');
      return;
    }

    const date = new Date().toLocaleString();
    let md = `# Distil — Document Q&A Export\n`;
    md += `**Document:** ${sessionInfo.sourceDoc || 'Unknown'}\n`;
    md += `**Type:** ${docType}  |  **Chunks indexed:** ${sessionInfo.chunkCount || '?'}\n`;
    md += `**Exported:** ${date}\n\n---\n\n`;

    messages.forEach((msg, i) => {
      if (msg.role === 'user') {
        md += `## Q${Math.ceil((i + 1) / 2)}: ${msg.text}\n\n`;
      } else {
        md += `**Distil:**\n\n${msg.text}\n\n`;
        if (msg.sources && msg.sources.length > 0) {
          md += `**Sources:**\n`;
          msg.sources.forEach((s, si) => {
            md += `- [${si + 1}] ${s.metadata?.sectionLabel || 'Section'} (score: ${(s.score * 100).toFixed(0)}%)\n`;
          });
          md += '\n';
        }
        md += '---\n\n';
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (sessionInfo.sourceDoc || 'distil-export').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.download = `${safeName}-summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="workspace-container">

      {/* ═════════════════════════════════════════════════════════════════════
         1. LEFT SIDEBAR (Desktop Navigation & Collections)
      ═════════════════════════════════════════════════════════════════════ */}
      <aside className={`workspace-sidebar-left ${showLeftSidebar ? 'open' : 'closed'}`}>
        <div className="sidebar-brand-row">
          <button className="sidebar-brand-logo" onClick={onReset} title="Distil Home">
            <img src="/distil-logo-mark.svg" alt="Distil Logo" className="sidebar-logo-mark-img" />
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
            <button
              className={`sidebar-nav-item ${activePanel === 'none' ? 'active' : ''}`}
              onClick={() => setActivePanel('none')}
            >
              <span>RAG Document Chat</span>
            </button>
            <button
              className={`sidebar-nav-item ${activePanel === 'clauses' ? 'active' : ''}`}
              onClick={() => setActivePanel('clauses')}
            >
              <span>Key Extracted Clauses</span>
            </button>
            <button
              className={`sidebar-nav-item ${activePanel === 'risk' ? 'active' : ''}`}
              onClick={() => setActivePanel('risk')}
            >
              <span>Risk &amp; Compliance Matrix</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button className="gradient-btn sidebar-new-doc-btn" onClick={onReset}>
            + New Analysis
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
            <button
              className="top-bar-action-btn"
              onClick={handleExport}
              title={messages.length === 0 ? 'Ask a question first to enable export' : 'Export conversation as Markdown'}
              style={messages.length === 0 ? { opacity: 0.5 } : {}}
            >
              ↓ Export Summary
            </button>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <div className="workspace-scroll-area">
          <div className="workspace-content-max">
            {activePanel === 'none' && (
              <>
                {/* Empty Workspace Greeting */}
                {messages.length === 0 && !loading && (
                  <div className="workspace-greeting-container">
                    <div className="greeting-header">
                      <h1 className="greeting-title">Good afternoon.</h1>
                      <p className="greeting-sub">
                        What would you like to understand about this document today?
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

                {/* Conversation Messages */}
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
                          {msg.role === 'user' ? 'You' : 'Distil'}
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
                          <SourcesPanel
                            sources={msg.sources}
                            noMatch={msg.noMatch}
                            actions={<MessageActions text={msg.text} />}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Live Reasoning Thinking Animation */}
                  {loading && (
                    <div className="workspace-message assistant thinking">
                      <div className="message-header-row">
                        <div className="message-avatar-badge spinning">✦</div>
                        <span className="message-sender-name">Distil</span>
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
              </>
            )}

            {activePanel === 'clauses' && (
              <ClausesPanel
                sessionId={sessionId}
                docType={docType}
              />
            )}

            {activePanel === 'risk' && (
              <RiskMatrix
                sessionId={sessionId}
                docType={docType}
              />
            )}
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="workspace-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}

        {/* Floating Composer (only in chat view) */}
        {activePanel === 'none' && (
          <div className="floating-composer-wrap">
            <div className="floating-composer-inner">
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
        )}

      </main>

    </div>
  );
}
