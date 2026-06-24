import { motion } from 'framer-motion';

function StatIcon({ type }) {
  if (type === 'total') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
  if (type === 'online') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
  if (type === 'latency') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
  if (type === 'issues') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
  return null;
}

export function StatsGrid({ stats }) {
  const cards = [
    {
      id: 'total',
      label: 'Total Models',
      value: stats.total,
      delta: `${stats.checking} probing`,
      deltaType: 'neutral',
      valueClass: '',
    },
    {
      id: 'online',
      label: 'Online',
      value: stats.online,
      delta: stats.total > 0 ? `${Math.round((stats.online / stats.total) * 100)}% availability` : '—',
      deltaType: 'up',
      valueClass: 'green',
    },
    {
      id: 'latency',
      label: 'Avg. Latency',
      value: stats.avgLatency != null ? `${stats.avgLatency}ms` : '—',
      delta: stats.fastestModel ? `Fastest: ${stats.fastestModel.latency}ms` : 'No data yet',
      deltaType: 'up',
      valueClass: 'cyan',
    },
    {
      id: 'issues',
      label: 'Issues',
      value: stats.degraded + stats.offline,
      delta: `${stats.degraded} degraded · ${stats.offline} offline`,
      deltaType: stats.degraded + stats.offline > 0 ? 'down' : 'up',
      valueClass: stats.degraded + stats.offline > 0 ? 'orange' : '',
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card, i) => (
        <motion.div
          key={card.id}
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="stat-label">
            <StatIcon type={card.id} />
            {card.label}
          </div>
          <div className={`stat-value ${card.valueClass}`}>
            {card.value ?? '—'}
          </div>
          <div className={`stat-delta ${card.deltaType}`}>
            {card.delta}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
