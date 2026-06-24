import { motion } from 'framer-motion';

export function Sparkline({ data = [], color = '#76b900', height = 40 }) {
  if (!data || data.length < 2) {
    return (
      <div className="sparkline-container" style={{ height }}>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none">
          <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        </svg>
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const min = 0;
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const pad = 3;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - pad * 2) + pad;
    const y = h - ((v - min) / range) * (h - pad * 2) - pad;
    return [x, y];
  });

  const linePath = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${h} L ${points[0][0]} ${h} Z`;

  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <div className="sparkline-container" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        {/* Line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {/* Last point dot */}
        {points.length > 0 && (
          <motion.circle
            cx={points[points.length - 1][0]}
            cy={points[points.length - 1][1]}
            r="2.5"
            fill={color}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.7, type: 'spring', stiffness: 300 }}
          />
        )}
      </svg>
    </div>
  );
}
