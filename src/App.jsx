import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNvidiaModels } from './hooks/useNvidiaModels';
import { Sidebar } from './components/Sidebar';
import { StatsGrid } from './components/StatsGrid';
import { ModelCard } from './components/ModelCard';
import { ModelDrawer } from './components/ModelDrawer';
import { ApiDocsTab } from './components/ApiDocsTab';
import './index.css';

const CATEGORIES = ['All', 'Language', 'Vision', 'Coding', 'Embedding', 'Safety', 'Reasoning', 'Multimodal', 'Translation', 'Reward'];
const STATUSES   = ['All', 'online', 'degraded', 'offline', 'checking'];

// ── Refresh icon (inline) ────────────────────────────────────────────────────
const RefreshIcon = ({ spinning }) => (
  <motion.svg
    animate={spinning ? { rotate: 360 } : { rotate: 0 }}
    transition={spinning ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
    width="15" height="15" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </motion.svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// ── Dashboard tab ────────────────────────────────────────────────────────────
function DashboardTab({ models, onSelect }) {
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus]     = useState('All');

  const filtered = useMemo(() => {
    return models.filter(m => {
      const matchSearch   = !search || m.id.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === 'All' || m.category === category;
      const matchStatus   = status === 'All' || m.status === status;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [models, search, category, status]);

  return (
    <>
      {/* Filter bar */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="section-title">
          All Models
          <span className="section-count">({filtered.length})</span>
        </div>

        {/* Search */}
        <div className="topbar-search" style={{ minWidth: 180 }}>
          <SearchIcon />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search models…"
            aria-label="Search models"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="filter-bar" style={{ marginBottom: 8 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`filter-chip ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Status chips */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {STATUSES.map(s => (
          <button
            key={s}
            className={`filter-chip ${status === s ? 'active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s === 'All' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">No models found</div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <motion.div className="models-grid" layout>
          <AnimatePresence mode="popLayout">
            {filtered.map((model, i) => (
              <ModelCard
                key={model.id}
                model={model}
                index={i}
                onClick={() => onSelect(model)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ── Performance tab ──────────────────────────────────────────────────────────
function PerformanceTab({ models, onSelect }) {
  const probed = models
    .filter(m => m.latency != null)
    .sort((a, b) => a.latency - b.latency);

  const maxLatency = probed.length > 0 ? probed[probed.length - 1].latency : 1;

  return (
    <>
      <div className="section-header" style={{ marginBottom: 24 }}>
        <div className="section-title">Response Time Leaderboard</div>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {probed.length} models measured
        </span>
      </div>

      {probed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title" style={{ color: 'var(--text-muted)' }}>
            Waiting for probe results…
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
            Models are being probed. Check back in a moment.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {probed.map((model, i) => {
            const pct = (model.latency / maxLatency) * 100;
            const color = model.latency < 500 ? '#76b900'
              : model.latency < 2000 ? '#f0883e' : '#f85149';

            return (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => onSelect(model)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-green)';
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--bg-card)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600,
                    color: 'var(--text-muted)', width: 28, textAlign: 'right',
                  }}>
                    #{i + 1}
                  </span>
                  <div
                    className="model-avatar"
                    style={{ width: 32, height: 32, fontSize: 11, background: model.brandColor.bg, color: model.brandColor.text }}
                  >
                    {model.owner.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {model.shortName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{model.owner}</div>
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color }}>
                    {model.latency}ms
                  </span>
                  <span className={`status-badge badge-${model.status}`} style={{ fontSize: 10 }}>
                    <span className="status-badge-dot" />
                    {model.status}
                  </span>
                </div>

                {/* Latency bar */}
                <div style={{ marginLeft: 40, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '100%', background: color, borderRadius: 99 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Fastest tab ──────────────────────────────────────────────────────────────
function FastestTab({ models, onSelect }) {
  const top = models
    .filter(m => m.status === 'online' && m.latency != null)
    .sort((a, b) => a.latency - b.latency)
    .slice(0, 20);

  return (
    <>
      <div className="section-header" style={{ marginBottom: 24 }}>
        <div className="section-title">⚡ Fastest Online Models</div>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Top 20 by response time</span>
      </div>

      {top.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title" style={{ color: 'var(--text-muted)' }}>Collecting data…</div>
        </div>
      ) : (
        <motion.div className="models-grid">
          <AnimatePresence mode="popLayout">
            {top.map((model, i) => (
              <ModelCard key={model.id} model={model} index={i} onClick={() => onSelect(model)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const handleClearServerCache = async () => {
    if (window.confirm("Are you sure you want to clear the server's tracked model history?")) {
      // For now, this is a placeholder unless we add a server endpoint for it.
      alert("Note: Server history reset requires backend restart currently.");
    }
  };

  return (
    <>
      <div className="section-header" style={{ marginBottom: 24 }}>
        <div className="section-title">⚙ System Settings</div>
      </div>
      
      <div style={{ maxWidth: 600 }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <h3 style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 12, fontFamily: 'Space Grotesk' }}>API Configuration</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            The API Key is currently hardcoded securely in the backend server (`server/index.js`). 
            The background task fetches from NVIDIA using this key.
          </p>

          <h3 style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 12, fontFamily: 'Space Grotesk', marginTop: 24 }}>System Controls</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            The background worker probes NVIDIA models every 5 minutes in batches to prevent rate limiting.
          </p>
          <button className="btn btn-ghost" onClick={handleClearServerCache} style={{ borderColor: 'rgba(248,81,73,0.3)', color: '#f85149' }}>
             Reset Tracker History
          </button>
        </div>
      </div>
    </>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { models, loading, probing, stats, lastProbed, nextProbeIn, sseStatus, error, refresh } = useNvidiaModels();
  const [activeTab, setActiveTab]       = useState('dashboard');
  const [selectedModel, setSelectedModel] = useState(null);

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        modelCount={stats.total}
        onlineCount={stats.online}
      />

      <main className="main-content">
        {/* Top bar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div className="topbar-title">
                {activeTab === 'dashboard'   && 'Model Dashboard'}
                {activeTab === 'performance' && 'Performance Monitor'}
                {activeTab === 'fastest'     && 'Fastest Models'}
                {activeTab === 'settings'    && 'System Settings'}
                {activeTab === 'api'         && 'Developer API'}
              </div>
            </div>
            {/* SSE / Auto-probe pill */}
            {!probing && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 99,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-subtle)',
                fontSize: 11, color: 'var(--text-muted)',
              }}>
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: sseStatus === 'open' ? 'var(--nvidia-green)' : sseStatus === 'connecting' ? '#f0883e' : '#f85149'
                }} />
                {sseStatus === 'open' ? (nextProbeIn ? `Auto-probe in ${nextProbeIn}` : 'Live stream active') : sseStatus === 'connecting' ? 'Connecting stream…' : 'Stream offline'}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <div className="topbar-actions">
            {probing && (
              <div className="live-badge">
                <span className="live-dot" />
                PROBING
              </div>
            )}

            <motion.button
              className="btn btn-ghost"
              onClick={refresh}
              disabled={probing || loading}
              whileTap={{ scale: 0.96 }}
              title="Re-probe all models now"
              style={{ opacity: probing || loading ? 0.5 : 1 }}
            >
              <RefreshIcon spinning={probing} />
              {probing ? 'Probing…' : 'Refresh Now'}
            </motion.button>
          </div>
        </header>

        {/* Page body */}
        <div className="page-body">
          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(248,81,73,0.08)',
              border: '1px solid rgba(248,81,73,0.3)',
              borderRadius: 10, padding: '12px 16px',
              color: '#f85149', fontSize: 13, marginBottom: 24,
            }}>
              ⚠ API Error: {error} — Check your API key or network.
            </div>
          )}

          {/* Stats */}
          <StatsGrid stats={stats} />

          {/* Loading skeletons */}
          {loading && (
            <div className="models-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton-card skeleton" />
              ))}
            </div>
          )}

          {/* Tab content */}
          {!loading && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTab === 'dashboard'   && <DashboardTab models={models} onSelect={setSelectedModel} />}
                {activeTab === 'performance' && <PerformanceTab models={models} onSelect={setSelectedModel} />}
                {activeTab === 'fastest'     && <FastestTab models={models} onSelect={setSelectedModel} />}
                {activeTab === 'settings'    && <SettingsTab />}
                {activeTab === 'api'         && <ApiDocsTab />}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedModel && (
          <ModelDrawer
            model={selectedModel}
            onClose={() => setSelectedModel(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
