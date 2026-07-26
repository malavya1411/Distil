import { useState, useEffect, useRef } from 'react';
import './IngestionStatus.css';

/**
 * IngestionStatus — Premium AI Distillation Loading Screen
 * Inspired by Linear, Notion AI, Claude, and Perplexity.
 *
 * Features:
 *  - Distillation Funnel & Ring SVG animation (converging particles into glowing droplet)
 *  - Live rotating status messages with smooth fade
 *  - Animated progress bar (0% → 100%)
 *  - Timeline cards with completed / active / waiting states
 *  - Smooth completion state with "Open Workspace" transition button
 *  - Floating ambient background circles & glassmorphic AI workspace card
 */

const STATUS_MESSAGES = [
  'Reading document...',
  'Understanding structure...',
  'Detecting headings & clauses...',
  'Creating semantic chunks...',
  'Learning relationships...',
  'Generating embeddings...',
  'Building retrieval index...',
  'Finalizing distillation...',
];

const STAGES = [
  { id: 'extract', label: 'Extracting document text', estimatedProgress: 25 },
  { id: 'chunk',   label: 'Splitting into semantic chunks', estimatedProgress: 50 },
  { id: 'embed',   label: 'Generating embeddings', estimatedProgress: 80 },
  { id: 'index',   label: 'Building search index', estimatedProgress: 100 },
];

export default function IngestionStatus({ sourceDoc, isFinished, onOpenWorkspace }) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [complete, setComplete] = useState(false);
  const statusTimerRef = useRef(null);

  // 1. Smoothly advance progress while waiting for backend
  useEffect(() => {
    if (isFinished) {
      // Backend returned — jump to 100% smoothly
      setProgress(100);
      setActiveStageIdx(3);
      const timer = setTimeout(() => {
        setComplete(true);
      }, 500);
      return () => clearTimeout(timer);
    }

    // Simulated progress from 0% up to 92%
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return 92;
        const diff = 92 - prev;
        const step = Math.max(1, Math.min(6, Math.floor(diff * 0.1)));
        const next = prev + step;

        // Advance timeline stages based on progress threshold
        if (next >= 75) setActiveStageIdx(3);
        else if (next >= 50) setActiveStageIdx(2);
        else if (next >= 25) setActiveStageIdx(1);
        else setActiveStageIdx(0);

        return next;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isFinished]);

  // 2. Rotate AI status messages every 2.4 seconds
  useEffect(() => {
    if (complete) return;

    statusTimerRef.current = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2400);

    return () => clearInterval(statusTimerRef.current);
  }, [complete]);

  // Ring geometry
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="distil-loader-wrapper" role="status" aria-live="polite">
      {/* Floating ambient background blur elements */}
      <div className="ambient-blur orb-1" aria-hidden="true" />
      <div className="ambient-blur orb-2" aria-hidden="true" />
      <div className="ambient-blur orb-3" aria-hidden="true" />

      {/* Main Glass Workspace Card */}
      <div className={`distil-loader-card ${complete ? 'complete' : ''}`}>

        {/* Header */}
        <div className="distil-loader-header">
          <h2 className="distil-loader-title">
            {complete ? 'Your document is ready' : 'Distilling your document'}
          </h2>

          <p className="distil-loader-sub">
            {complete
              ? 'Knowledge structure built and indexed. Ready for instant Q&A.'
              : 'Turning hundreds of pages into structured knowledge.'}
          </p>

          {sourceDoc && (
            <div className="source-doc-pill" title={sourceDoc}>
              <span className="doc-name">{sourceDoc}</span>
            </div>
          )}
        </div>

        {/* Ring & Knowledge Funnel Animation */}
        <div className="funnel-container">
          <svg className="funnel-svg" viewBox="0 0 120 120" width="120" height="120">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6C63FF" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>

              <linearGradient id="successGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#16A34A" />
              </linearGradient>

              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Track background */}
            <circle
              className="funnel-track"
              cx="60"
              cy="60"
              r={radius}
            />

            {/* Progress Fill Ring */}
            <circle
              className="funnel-progress"
              cx="60"
              cy="60"
              r={radius}
              stroke={complete ? 'url(#successGrad)' : 'url(#ringGrad)'}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />

            {/* Particle funnel animation (converging dots) */}
            {!complete && (
              <g className="funnel-particles">
                <circle className="particle p1" cx="60" cy="20" r="2.5" />
                <circle className="particle p2" cx="95" cy="45" r="2" />
                <circle className="particle p3" cx="85" cy="85" r="2.5" />
                <circle className="particle p4" cx="35" cy="85" r="2" />
                <circle className="particle p5" cx="25" cy="45" r="2.5" />
              </g>
            )}

            {/* Center Droplet / Checkmark */}
            <g className="funnel-center">
              {complete ? (
                <path
                  className="check-path"
                  d="M44 60 L54 70 L76 48"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <circle
                  className="center-droplet"
                  cx="60"
                  cy="60"
                  r="8"
                  fill="url(#ringGrad)"
                  filter="url(#glow)"
                />
              )}
            </g>
          </svg>

          {/* Progress Percentage & Shimmer Bar */}
          <div className="progress-metrics">
            <div className="progress-percentage-row">
              <span className="progress-percent-num">{progress}%</span>
              <span className="progress-status-text">
                {complete ? 'Indexed' : STATUS_MESSAGES[messageIndex]}
              </span>
            </div>

            <div className="shimmer-bar-wrap">
              <div
                className={`shimmer-bar-fill ${complete ? 'complete' : ''}`}
                style={{ width: `${progress}%` }}
              >
                <div className="shimmer-light" />
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Processing Steps */}
        <div className="processing-timeline" role="list" aria-label="Processing stages">
          {STAGES.map((stage, idx) => {
            let state = 'waiting';
            if (complete || idx < activeStageIdx) state = 'completed';
            else if (idx === activeStageIdx) state = 'running';

            return (
              <div
                key={stage.id}
                className={`timeline-card ${state}`}
                role="listitem"
              >
                <div className="timeline-left-indicator" />

                <div className="timeline-icon-wrap">
                  {state === 'completed' && (
                    <svg className="icon-check-draw" viewBox="0 0 20 20" width="16" height="16">
                      <path
                        d="M4 10 L8 14 L16 6"
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {state === 'running' && (
                    <div className="running-mini-spinner" />
                  )}
                  {state === 'waiting' && (
                    <span className="waiting-dot">○</span>
                  )}
                </div>

                <div className="timeline-content">
                  <span className="timeline-label">{stage.label}</span>
                  <span className="timeline-status-badge">
                    {state === 'completed' && 'Completed'}
                    {state === 'running' && 'Processing...'}
                    {state === 'waiting' && 'Waiting'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Security Note or Action Button */}
        <div className="distil-loader-footer">
          {complete ? (
            <button
              className="gradient-btn open-workspace-btn"
              onClick={onOpenWorkspace}
              id="open-workspace-btn"
            >
              Open Workspace →
            </button>
          ) : (
            <div className="security-note">
              <svg className="shield-icon" viewBox="0 0 24 24" width="16" height="16">
                <path
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  fill="none"
                  stroke="#6B7280"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>
                Large files usually finish within 30–60 seconds. Your document is processed securely in memory and never stored.
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
