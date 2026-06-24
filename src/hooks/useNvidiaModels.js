import { useState, useEffect, useCallback, useRef } from 'react';

// All API calls go to our Express backend (proxied by Vite dev server)
const API_BASE = '/api';

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useNvidiaModels() {
  const [models,      setModels]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [probingNow,  setProbingNow]  = useState(false);
  const [lastProbed,  setLastProbed]  = useState(null);
  const [nextProbe,   setNextProbe]   = useState(null);
  const [probeCount,  setProbeCount]  = useState(0);
  const [sseStatus,   setSseStatus]   = useState('connecting'); // 'connecting' | 'open' | 'error'
  const [error,       setError]       = useState(null);

  const esRef = useRef(null);   // EventSource reference

  // Apply a server payload (snapshot or status update) to state
  const applyMeta = useCallback((data) => {
    if (data.lastProbed !== undefined) setLastProbed(data.lastProbed ? new Date(data.lastProbed) : null);
    if (data.nextProbe  !== undefined) setNextProbe(data.nextProbe   ? new Date(data.nextProbe)  : null);
    if (data.probingNow !== undefined) setProbingNow(data.probingNow);
    if (data.probeCount !== undefined) setProbeCount(data.probeCount);
  }, []);

  // Connect to the SSE stream
  const connectSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    setSseStatus('connecting');
    const es = new EventSource(`${API_BASE}/stream`);
    esRef.current = es;

    // Full snapshot on first connect (or reconnect)
    es.addEventListener('snapshot', (e) => {
      const data = JSON.parse(e.data);
      setModels(data.models || []);
      applyMeta(data);
      setLoading(false);
      setSseStatus('open');
    });

    // Incremental update for a single model
    es.addEventListener('model-update', (e) => {
      const updated = JSON.parse(e.data);
      setModels(prev => {
        const idx = prev.findIndex(m => m.id === updated.id);
        if (idx === -1) return [...prev, updated];
        const next = [...prev];
        next[idx] = { ...next[idx], ...updated };
        return next;
      });
    });

    // Probe cycle started
    es.addEventListener('probe-start', (e) => {
      const data = JSON.parse(e.data);
      setProbingNow(true);
      setProbeCount(data.probeCount);
    });

    // Probe cycle finished
    es.addEventListener('probe-complete', (e) => {
      const data = JSON.parse(e.data);
      setProbingNow(false);
      applyMeta(data);
    });

    es.onerror = () => {
      setSseStatus('error');
      // Auto-reconnect after 5 s
      setTimeout(connectSSE, 5000);
    };

    es.onopen = () => setSseStatus('open');
  }, [applyMeta]);

  // On mount: connect SSE (snapshot arrives immediately)
  useEffect(() => {
    connectSSE();
    return () => {
      esRef.current?.close();
    };
  }, [connectSSE]);

  // Manual re-probe (calls POST /api/probe)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/probe`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setError('Probe already running — please wait');
          setTimeout(() => setError(null), 3000);
        } else {
          setError(body.error || `Error ${res.status}`);
        }
      }
    } catch (e) {
      setError('Could not reach server: ' + e.message);
    }
  }, []);

  // Computed stats
  const stats = {
    total:    models.length,
    online:   models.filter(m => m.status === 'online').length,
    degraded: models.filter(m => m.status === 'degraded').length,
    offline:  models.filter(m => m.status === 'offline').length,
    checking: models.filter(m => m.status === 'checking').length,
    avgLatency: (() => {
      const lats = models.filter(m => m.latency != null).map(m => m.latency);
      return lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : null;
    })(),
    fastestModel: [...models]
      .filter(m => m.latency != null)
      .sort((a, b) => a.latency - b.latency)[0] ?? null,
  };

  // Countdown to next probe
  const nextProbeIn = (() => {
    if (!nextProbe) return null;
    const ms = new Date(nextProbe) - Date.now();
    if (ms <= 0) return 'soon';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  })();

  return {
    models,
    loading,
    probing: probingNow,
    stats,
    lastProbed,
    nextProbe,
    nextProbeIn,
    probeCount,
    sseStatus,
    error,
    refresh,
  };
}
