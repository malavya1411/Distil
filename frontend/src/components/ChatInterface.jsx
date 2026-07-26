import { useState, useRef, useEffect, useCallback } from 'react';
import SourcesPanel from './SourcesPanel';
import './ChatInterface.css';

// ─── Suggested question chips (doc-type-aware) ────────────────────────────

const SUGGESTED_BY_DOCTYPE = {
  legal: [
    'Can they share or sell my personal data?',
    'What are my rights to cancel or terminate?',
    'What is the governing law for disputes?',
    'Are there any indemnification clauses?',
    'What data do they collect about me?',
    'Can they change these terms without notice?',
  ],
  academic: [
    'What is the main hypothesis of this paper?',
    'What methodology was used in this study?',
    'What were the key findings or results?',
    'What are the limitations acknowledged by the authors?',
    'What future work do the authors propose?',
  ],
  auto: [
    'What is this document about?',
    'What are the key restrictions or limitations?',
    'What rights does the user have?',
    'Are there any important deadlines or dates?',
    'What happens in case of a dispute?',
  ],
};

// ─── Simple answer renderer (bold + paragraph awareness) ─────────────────

function AnswerText({ text }) {
  if (!text) return null;

  const paragraphs = text.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="answer-text">
      {paragraphs.map((para, i) => {
        const isQuote = para.trimStart().startsWith('"') || para.trimStart().startsWith('>');
        const rendered = para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        if (isQuote) {
          return (
            <blockquote
              key={i}
              dangerouslySetInnerHTML={{
                __html: rendered
                  .replace(/^[">]\s?/, '')
                  .replace(/\n/g, '<br/>'),
              }}
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

// ─── Copy hook ────────────────────────────────────────────────────────────

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

// ─── Message action bar ───────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────

export default function ChatInterface({ sessionId, sessionInfo, onReset }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const docType = sessionInfo.docType || 'auto';
  const suggestedQuestions =
    SUGGESTED_BY_DOCTYPE[docType] || SUGGESTED_BY_DOCTYPE.auto;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
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

  const handleChipClick = (question) => {
    if (loading) return;
    handleSend(question);
  };

  return (
    <div className="chat-wrapper">

      {/* Session banner */}
      <div className="session-banner">
        <div className="session-banner-info">
          <span className="session-badge">Ready</span>
          <span className="session-banner-doc" title={sessionInfo.sourceDoc}>
            <strong>{sessionInfo.sourceDoc || 'Document'}</strong>
            {' · '}
            {sessionInfo.chunkCount} chunks
            {sessionInfo.docType && ` · ${sessionInfo.docType}`}
          </span>
        </div>
        <div className="session-banner-actions">
          <button
            className="session-action-btn"
            onClick={onReset}
            id="upload-new-doc-btn"
            aria-label="Upload a new document"
          >
            New document
          </button>
        </div>
      </div>

      {/* Message list */}
      <div
        className="message-list"
        role="log"
        aria-label="Chat conversation"
        aria-live="polite"
      >

        {/* Empty state with suggested chips */}
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <div>
              <p className="chat-empty-title">Your document is ready</p>
              <p className="chat-empty-sub">
                Ask any natural-language question. Every answer is grounded in the document with visible source citations.
              </p>
            </div>
            <span className="suggested-label">Try asking</span>
            <div className="suggested-chips" role="list" aria-label="Suggested questions">
              {suggestedQuestions.slice(0, 5).map((q) => (
                <button
                  key={q}
                  className="suggested-chip"
                  onClick={() => handleChipClick(q)}
                  role="listitem"
                  aria-label={`Ask: ${q}`}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.role}`}
            role="article"
            aria-label={`${msg.role === 'user' ? 'Your question' : 'Answer'}`}
          >
            <div className="message-avatar" aria-hidden="true">
              {msg.role === 'user' ? 'U' : 'A'}
            </div>

            <div className="message-content">
              <div className="message-bubble">
                {msg.role === 'assistant' ? (
                  <AnswerText text={msg.text} />
                ) : (
                  msg.text
                )}
              </div>

              {msg.role === 'assistant' && (
                <>
                  <MessageActions text={msg.text} model={msg.model} />
                  <SourcesPanel sources={msg.sources} noMatch={msg.noMatch} />
                </>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="message assistant" aria-label="Generating answer…">
            <div className="message-avatar" aria-hidden="true">A</div>
            <div className="message-content">
              <div className="message-bubble">
                <div className="typing-indicator" aria-hidden="true">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="chat-error" role="alert" aria-live="assertive">
          <span>{error}</span>
        </div>
      )}

      {/* Input bar */}
      <div className="chat-input-bar">
        <div className="chat-textarea-wrap">
          <textarea
            ref={textareaRef}
            id="chat-question-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your document… (Enter to send)"
            disabled={loading}
            rows={1}
            aria-label="Question input"
          />
          {input.length > 200 && (
            <span className="char-hint">{input.length} chars</span>
          )}
        </div>
        <button
          id="chat-send-btn"
          className="gradient-btn chat-send-btn"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          aria-label="Send question"
        >
          Send
        </button>
      </div>
    </div>
  );
}
