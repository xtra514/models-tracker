import { motion, AnimatePresence } from 'framer-motion';
import { Sparkline } from './Sparkline';

const CATEGORY_COLORS = {
  Language:    { bg: 'rgba(118,185,0,0.12)',  text: '#76b900', dot: '#76b900' },
  Vision:      { bg: 'rgba(0,212,255,0.10)',   text: '#00d4ff', dot: '#00d4ff' },
  Coding:      { bg: 'rgba(156,89,245,0.12)',  text: '#9c59f5', dot: '#9c59f5' },
  Embedding:   { bg: 'rgba(255,166,0,0.12)',   text: '#ffa600', dot: '#ffa600' },
  Safety:      { bg: 'rgba(248,81,73,0.12)',   text: '#f85149', dot: '#f85149' },
  Reasoning:   { bg: 'rgba(255,107,53,0.12)',  text: '#ff6b35', dot: '#ff6b35' },
  Multimodal:  { bg: 'rgba(99,179,237,0.12)',  text: '#63b3ed', dot: '#63b3ed' },
  Translation: { bg: 'rgba(52,211,153,0.12)',  text: '#34d399', dot: '#34d399' },
  Reward:      { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', dot: '#f59e0b' },
};

function StatusBadge({ status }) {
  const map = {
    online:   { cls: 'badge-online',    label: 'Online' },
    degraded: { cls: 'badge-degraded',  label: 'Degraded' },
    offline:  { cls: 'badge-offline',   label: 'Offline' },
    checking: { cls: 'badge-checking',  label: 'Probing…' },
  };
  const { cls, label } = map[status] || map.checking;
  return (
    <span className={`status-badge ${cls}`}>
      <span className="status-badge-dot" />
      {label}
    </span>
  );
}

function LatencyClass(ms) {
  if (ms == null) return '';
  if (ms < 500) return 'fast';
  if (ms < 2000) return 'medium';
  return 'slow';
}

export function ModelCard({ model, index, onClick }) {
  const catColor = CATEGORY_COLORS[model.category] || CATEGORY_COLORS.Language;
  const sparkColor = model.status === 'online' ? '#76b900'
    : model.status === 'degraded' ? '#f0883e'
    : '#8b949e';

  return (
    <motion.div
      className="model-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index * 0.03, 0.4),
        ease: [0.16, 1, 0.3, 1],
      }}
      layout
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`${model.id} — ${model.status}`}
    >
      {/* Header */}
      <div className="model-card-header">
        <div
          className="model-avatar"
          style={{ background: model.brandColor.bg, color: model.brandColor.text }}
        >
          {model.owner.slice(0, 2).toUpperCase()}
        </div>

        <div className="model-info">
          <div className="model-name" title={model.id}>{model.shortName}</div>
          <div className="model-owner">{model.owner}</div>
        </div>

        <StatusBadge status={model.status} />
      </div>

      {/* Metrics */}
      <div className="model-metrics">
        <div className="metric-item">
          <span className={`metric-value ${LatencyClass(model.latency)}`}>
            {model.latency != null ? `${model.latency}ms` : '—'}
          </span>
          <span className="metric-label">Latency</span>
        </div>
        <div className="metric-item">
          <span className="metric-value">
            {model.uptime != null ? `${model.uptime}%` : '—'}
          </span>
          <span className="metric-label">Uptime</span>
        </div>
        <div className="metric-item">
          <span className="metric-value">{model.checks || '—'}</span>
          <span className="metric-label">Checks</span>
        </div>
      </div>

      {/* Sparkline */}
      <AnimatePresence>
        {model.latencyHistory.length >= 2 && (
          <Sparkline
            key={model.latencyHistory.length}
            data={model.latencyHistory}
            color={sparkColor}
            height={36}
          />
        )}
        {model.latencyHistory.length < 2 && model.status === 'checking' && (
          <div style={{ height: 36 }} className="skeleton" />
        )}
      </AnimatePresence>

      {/* Tags */}
      <div className="model-tags">
        <span
          className="model-tag"
          style={{ background: catColor.bg, color: catColor.text }}
        >
          {model.category}
        </span>
        {model.shortName.includes('70b') && (
          <span className="model-tag" style={{ background: 'rgba(255,255,255,0.06)', color: '#8b949e' }}>70B</span>
        )}
        {model.shortName.includes('7b') && (
          <span className="model-tag" style={{ background: 'rgba(255,255,255,0.06)', color: '#8b949e' }}>7B</span>
        )}
        {model.shortName.includes('instruct') && (
          <span className="model-tag" style={{ background: 'rgba(255,255,255,0.06)', color: '#8b949e' }}>Instruct</span>
        )}
      </div>
    </motion.div>
  );
}
