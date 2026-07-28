import { useEffect } from 'react';
import './TermsModal.css';
import { DISTIL_TERMS_AND_CONDITIONS } from '../data/sampleTerms';

export default function TermsModal({ isOpen, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="terms-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
      <div className="terms-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="terms-modal-header">
          <div className="terms-header-title-group">
            <span className="terms-icon">⚖️</span>
            <h2 id="terms-modal-title" className="terms-modal-title">Terms of Service &amp; Privacy</h2>
          </div>
          <button className="terms-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="terms-modal-body">
          <div className="terms-badge-bar">
            <span className="terms-badge">Official Legal Terms</span>
            <span className="terms-badge-sub">Effective: July 2026</span>
          </div>

          <pre className="terms-text-content">
            {DISTIL_TERMS_AND_CONDITIONS}
          </pre>
        </div>

        {/* Footer */}
        <div className="terms-modal-footer">
          <button className="gradient-btn terms-accept-btn" onClick={onClose}>
            I Understand &amp; Agree
          </button>
        </div>
      </div>
    </div>
  );
}
