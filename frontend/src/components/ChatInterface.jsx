import { useState, useRef, useEffect } from 'react';
import SourcesPanel from './SourcesPanel';
import './ChatInterface.css';

/**
 * ChatInterface — multi-turn Q&A against the ingested document.
 *
 * Props:
 *   sessionId  - active session ID from the backend
 *   sessionInfo - { sourceDoc, chunkCount, docType }
 *   onReset    - callback to go back to upload screen
 */
export default function ChatInterface({ sessionId, sessionInfo, onReset }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  };

  const handleKeyDown = (e) => {
    // Send on Enter (not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) handleSend();
    }
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setError('');
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Optimistically add user message
    const userMsg = { role: 'user', text: question, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, question, k: 4 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Query failed. Please try again.');
      }

      const assistantMsg = {
        role: 'assistant',
        text: data.answer,
        sources: data.sources || [],
        noMatch: data.noMatch || false,
        id: Date.now() + 1,
      };

      setMessages((prev) => [...prev, assistantMsg]);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-wrapper">
      {/* Session banner */}
      <div className="session-banner">
        <div className="session-banner-info">
          <span className="session-badge">● Ready</span>
          <span>
            <strong>{sessionInfo.sourceDoc || 'Document'}</strong>
            {' '}·{' '}
            {sessionInfo.chunkCount} chunks indexed
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
            ↩ New document
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="message-list" role="log" aria-label="Chat conversation" aria-live="polite">
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <span className="chat-empty-icon">💬</span>
            <p>Your document is ready. Ask anything about it — try a specific clause, a data policy, or a limitation.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`} role="article">
            <div className="message-avatar" aria-hidden="true">
              {msg.role === 'user' ? 'U' : '✦'}
            </div>

            <div className="message-content">
              <div
                className="message-bubble"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {msg.text}
              </div>

              {msg.role === 'assistant' && (
                <SourcesPanel sources={msg.sources} noMatch={msg.noMatch} />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="message assistant" aria-label="Assistant is thinking">
            <div className="message-avatar" aria-hidden="true">✦</div>
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
        <div className="chat-error" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Input bar */}
      <div className="chat-input-bar">
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
        <button
          id="chat-send-btn"
          className="gradient-btn chat-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label="Send question"
        >
          Send ↑
        </button>
      </div>
    </div>
  );
}
