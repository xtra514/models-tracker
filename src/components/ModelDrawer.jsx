import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkline } from './Sparkline';

export function ModelDrawer({ model, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Playground state
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const abortCtrlRef = useRef(null);
  const responseEndRef = useRef(null);

  useEffect(() => {
    // Reset state when model changes
    setActiveTab('overview');
    setPrompt('');
    setResponse('');
    setError(null);
  }, [model]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (responseEndRef.current) {
      responseEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [response]);

  if (!model) return null;

  const sparkColor = model.status === 'online' ? '#76b900'
    : model.status === 'degraded' ? '#f0883e' : '#8b949e';

  const uptimeColor = (model.uptime ?? 0) >= 90
    ? '#76b900'
    : (model.uptime ?? 0) >= 60
    ? '#f0883e'
    : '#f85149';

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setResponse('');
    setError(null);
    
    abortCtrlRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: abortCtrlRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let text = '';

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                const token = data.choices[0]?.delta?.content || '';
                text += token;
                setResponse(text);
              } catch (e) {
                // ignore unparseable chunks
              }
            }
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="drawer-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="drawer"
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Close */}
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Model Identity */}
        <div style={{ marginBottom: 24, paddingRight: 40, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              className="model-avatar"
              style={{
                background: model.brandColor.bg,
                color: model.brandColor.text,
                width: 48,
                height: 48,
                fontSize: 16,
              }}
            >
              {model.owner.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {model.shortName}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{model.owner}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, gap: 16, flexShrink: 0 }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              background: 'none', border: 'none', padding: '0 0 8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: activeTab === 'overview' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'overview' ? '2px solid var(--nvidia-green)' : '2px solid transparent',
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            style={{
              background: 'none', border: 'none', padding: '0 0 8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: activeTab === 'playground' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'playground' ? '2px solid var(--nvidia-green)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            Playground <span style={{ fontSize: 9, background: 'rgba(118,185,0,0.15)', color: '#76b900', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>BETA</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 24 }}>
          {activeTab === 'overview' ? (
            <>
              {/* Status */}
              <DrawerSection title="Current Status">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`status-badge badge-${model.status}`}>
                    <span className="status-badge-dot" />
                    {model.status.charAt(0).toUpperCase() + model.status.slice(1)}
                  </span>
                  {model.lastChecked && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Last checked {new Date(model.lastChecked).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </DrawerSection>

              {/* Performance */}
              <DrawerSection title="Performance">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <MetricBox label="Response Time" value={model.latency != null ? `${model.latency}ms` : '—'} />
                  <MetricBox label="Checks Ran" value={model.checks || '0'} />
                  <MetricBox label="Successful" value={model.successChecks || '0'} />
                  <MetricBox label="Failed" value={(model.checks || 0) - (model.successChecks || 0)} />
                </div>
              </DrawerSection>

              {/* Uptime */}
              <DrawerSection title="Uptime">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Current Session</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: uptimeColor, fontFamily: 'JetBrains Mono' }}>
                    {model.uptime != null ? `${model.uptime}%` : '—'}
                  </span>
                </div>
                <div className="uptime-bar">
                  <motion.div
                    className="uptime-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${model.uptime ?? 0}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    style={{ background: `linear-gradient(90deg, ${uptimeColor}, ${uptimeColor}aa)` }}
                  />
                </div>
              </DrawerSection>

              {/* Latency History */}
              <DrawerSection title="Latency History">
                {model.latencyHistory && model.latencyHistory.length >= 2 ? (
                  <Sparkline data={model.latencyHistory} color={sparkColor} height={80} />
                ) : (
                  <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Not enough data yet — refresh to collect history
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>Oldest</span>
                  <span>Latest</span>
                </div>
              </DrawerSection>

              {/* Model Info */}
              <DrawerSection title="Model Details">
                <InfoRow label="Provider" value={model.owner} />
                <InfoRow label="Category" value={model.category} />
                <InfoRow label="Full ID" value={model.id} mono />
              </DrawerSection>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Warning if offline */}
              {model.status !== 'online' && (
                <div style={{ padding: '12px', background: 'rgba(240, 136, 62, 0.1)', border: '1px solid rgba(240, 136, 62, 0.3)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#f0883e' }}>
                  <strong>Warning:</strong> This model is currently {model.status}. Generations may fail.
                </div>
              )}

              {/* Output Window */}
              <div style={{
                flex: 1, 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid var(--border-subtle)', 
                borderRadius: 8, 
                padding: 16, 
                marginBottom: 16, 
                overflowY: 'auto',
                fontFamily: 'Inter',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                minHeight: 200
              }}>
                {response || <span style={{ color: 'var(--text-muted)' }}>Output will appear here...</span>}
                {error && <div style={{ color: '#f85149', marginTop: 8, fontSize: 13 }}>{error}</div>}
                <div ref={responseEndRef} />
              </div>

              {/* Input Area */}
              <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Ask ${model.shortName} something...`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    color: 'var(--text-primary)',
                    fontFamily: 'Inter',
                    fontSize: 14,
                    minHeight: 80,
                    resize: 'vertical',
                    outline: 'none',
                    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.2)'
                  }}
                />
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {isGenerating ? (
                    <button className="btn btn-ghost" onClick={handleStop} style={{ borderColor: 'rgba(248,81,73,0.3)', color: '#f85149' }}>
                      Stop
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={handleGenerate} disabled={!prompt.trim() || model.status === 'offline'}>
                      Generate
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function DrawerSection({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: mono ? 'JetBrains Mono' : 'Inter', wordBreak: 'break-all', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
