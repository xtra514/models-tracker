// server/index.js
// ─────────────────────────────────────────────────────────────────────────────
// NVIDIA Model Tracker — Backend Server
//
// Responsibilities:
//   • Fetch the NVIDIA model list on startup
//   • Probe every model (availability + latency) in background batches
//   • Store results in memory AND persist to server/data.json
//   • Re-probe automatically every PROBE_INTERVAL_MS
//   • Expose:
//       GET  /api/models   → full list with current probe data
//       GET  /api/stream   → SSE stream — pushes every model update live
//       POST /api/probe    → trigger a manual re-probe
//       GET  /api/status   → quick health-check / probe metadata
// ─────────────────────────────────────────────────────────────────────────────

import express       from 'express';
import cors          from 'cors';
import fetch         from 'node-fetch';
import fs            from 'fs';
import path          from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app               = express();
const PORT              = process.env.PORT || 3001;
const API_KEY           = process.env.NVIDIA_API_KEY;

if (!API_KEY) {
  console.error("ERROR: NVIDIA_API_KEY is missing from environment variables.");
}

const NVIDIA_BASE       = 'https://integrate.api.nvidia.com/v1';
const DATA_FILE         = path.join(__dirname, 'data.json');
const PROBE_INTERVAL_MS = 5 * 60 * 1000;   // re-probe every 5 min
const BATCH_SIZE        = 8;               // concurrent pings per batch
const BATCH_DELAY_MS    = 250;             // pause between batches
const PING_TIMEOUT_MS   = 9000;

// ── In-memory store ───────────────────────────────────────────────────────────
let store = {
  models:        [],   // array of model objects with probe data
  probingNow:    false,
  lastProbed:    null,
  nextProbe:     null,
  probeCount:    0,
};

// SSE clients (res objects)
const sseClients = new Set();

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectCategory(id) {
  const l = id.toLowerCase();
  if (l.includes('embed') || l.includes('retriev'))                                                     return 'Embedding';
  if (l.includes('vision') || l.includes('vl') || l.includes('visual') || l.includes('vlm'))           return 'Vision';
  if (l.includes('code') || l.includes('coder') || l.includes('starcoder'))                            return 'Coding';
  if (l.includes('safety') || l.includes('guard') || l.includes('pii'))                               return 'Safety';
  if (l.includes('reward'))                                                                             return 'Reward';
  if (l.includes('translate') || l.includes('riva'))                                                   return 'Translation';
  if (l.includes('diffusion') || l.includes('image') || l.includes('video') || l.includes('vila') || l.includes('clip')) return 'Multimodal';
  if (l.includes('reasoning') || l.includes('reason'))                                                 return 'Reasoning';
  return 'Language';
}

const BRAND_COLORS = {
  nvidia:    { bg: 'rgba(118,185,0,0.15)',   text: '#76b900' },
  meta:      { bg: 'rgba(24,119,242,0.15)',  text: '#5b8dee' },
  google:    { bg: 'rgba(66,133,244,0.15)',  text: '#5b9ef9' },
  mistralai: { bg: 'rgba(255,107,53,0.15)',  text: '#ff8c69' },
  microsoft: { bg: 'rgba(0,120,215,0.15)',   text: '#4da3ff' },
  deepseek:  { bg: 'rgba(64,190,255,0.15)',  text: '#40beff' },
  openai:    { bg: 'rgba(16,163,127,0.15)',  text: '#1ab99a' },
  ibm:       { bg: 'rgba(15,98,254,0.15)',   text: '#5b7ef7' },
  qwen:      { bg: 'rgba(130,80,255,0.15)',  text: '#a070ff' },
  default:   { bg: 'rgba(255,255,255,0.08)', text: '#8b949e' },
};
const getBrandColor = o => BRAND_COLORS[o] || BRAND_COLORS.default;

// Persist to disk
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      models:     store.models,
      lastProbed: store.lastProbed,
      probeCount: store.probeCount,
    }, null, 2));
  } catch (e) {
    console.error('[save]', e.message);
  }
}

// Load persisted data on startup
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      store.models     = raw.models     || [];
      store.lastProbed = raw.lastProbed || null;
      store.probeCount = raw.probeCount || 0;
      console.log(`[cache] Loaded ${store.models.length} models from disk (last probed: ${store.lastProbed ?? 'never'})`);
    }
  } catch (e) {
    console.error('[load]', e.message);
  }
}

// Broadcast an SSE event to all connected clients
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch { sseClients.delete(client); }
  }
}

// ── Probe logic ───────────────────────────────────────────────────────────────
async function pingModel(modelId) {
  const start = Date.now();
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);

  try {
    const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model:    modelId,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream:   false,
      }),
    });
    clearTimeout(timer);
    const latency = Date.now() - start;

    if (res.ok)                               return { status: 'online',   latency };
    if (res.status === 503 || res.status === 502) return { status: 'degraded', latency };
    if (res.status === 404)                   return { status: 'offline',  latency: null };
    if (res.status === 422 || res.status === 400) return { status: 'online', latency }; // bad payload, model exists
    return { status: 'degraded', latency };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') return { status: 'degraded', latency: null };
    return { status: 'offline',  latency: null };
  }
}

async function fetchModelList() {
  const res = await fetch(`${NVIDIA_BASE}/models`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`NVIDIA API ${res.status}`);
  const { data } = await res.json();

  return (data || []).map(m => {
    const [owner, ...rest] = m.id.split('/');
    return {
      id:         m.id,
      owner,
      shortName:  rest.join('/') || owner,
      category:   detectCategory(m.id),
      brandColor: getBrandColor(owner),
      // probe fields — will be filled in later
      status:         'checking',
      latency:        null,
      latencyHistory: [],
      uptime:         null,
      checks:         0,
      successChecks:  0,
      lastChecked:    null,
    };
  });
}

// Main probe cycle
async function runProbeCycle() {
  if (store.probingNow) {
    console.log('[probe] Already probing, skipping cycle');
    return;
  }
  store.probingNow = true;
  store.probeCount++;

  console.log(`[probe] Cycle #${store.probeCount} started — ${store.models.length} models`);
  broadcast('probe-start', { probeCount: store.probeCount, total: store.models.length });

  const now = new Date().toISOString();

  for (let i = 0; i < store.models.length; i += BATCH_SIZE) {
    const batch   = store.models.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(m => pingModel(m.id)));

    batch.forEach((m, idx) => {
      const result      = results[idx];
      const modelIdx    = store.models.findIndex(x => x.id === m.id);
      if (modelIdx === -1) return;

      const cur          = store.models[modelIdx];
      const newChecks    = cur.checks + 1;
      const newSuccess   = cur.successChecks + (result.status === 'online' ? 1 : 0);
      const newHistory   = [...(cur.latencyHistory || []).slice(-19), result.latency ?? 0];

      const updated = {
        ...cur,
        status:         result.status,
        latency:        result.latency,
        latencyHistory: newHistory,
        checks:         newChecks,
        successChecks:  newSuccess,
        uptime:         Math.round((newSuccess / newChecks) * 100),
        lastChecked:    now,
      };

      store.models[modelIdx] = updated;

      // Push each update live via SSE
      broadcast('model-update', updated);
    });

    // Save to disk after every batch for resilience
    saveData();

    if (i + BATCH_SIZE < store.models.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  store.lastProbed  = now;
  store.probingNow  = false;
  store.nextProbe   = new Date(Date.now() + PROBE_INTERVAL_MS).toISOString();

  saveData();
  broadcast('probe-complete', {
    lastProbed:  store.lastProbed,
    nextProbe:   store.nextProbe,
    probeCount:  store.probeCount,
    online:      store.models.filter(m => m.status === 'online').length,
    total:       store.models.length,
  });

  console.log(`[probe] Cycle #${store.probeCount} done — online: ${store.models.filter(m=>m.status==='online').length}/${store.models.length}`);
}

// ── Startup sequence ──────────────────────────────────────────────────────────
async function boot() {
  // 1. Load last persisted data so first API response is instant
  loadData();

  // 2. Fetch current model list from NVIDIA
  console.log('[boot] Fetching model list from NVIDIA...');
  try {
    const freshList = await fetchModelList();

    // Merge fresh list with existing probe data (preserve history)
    store.models = freshList.map(m => {
      const existing = store.models.find(e => e.id === m.id);
      return existing
        ? { ...m,
            status:         existing.status,
            latency:        existing.latency,
            latencyHistory: existing.latencyHistory,
            checks:         existing.checks,
            successChecks:  existing.successChecks,
            uptime:         existing.uptime,
            lastChecked:    existing.lastChecked }
        : m;
    });

    console.log(`[boot] ${store.models.length} models loaded`);
  } catch (e) {
    console.error('[boot] Failed to fetch model list:', e.message);
    if (store.models.length === 0) process.exit(1);
    console.log('[boot] Using cached model list');
  }

  // 3. Start probing immediately (don't await — run in background)
  runProbeCycle();

  // 4. Schedule recurring probe cycle
  setInterval(runProbeCycle, PROBE_INTERVAL_MS);
  console.log(`[boot] Auto-probe every ${PROBE_INTERVAL_MS / 60000} min`);
}

// ── Express middleware ────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve the Vite frontend in production
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Routes ────────────────────────────────────────────────────────────────────

// ── API v1 (Public / Developer Endpoints) ───────────────────────────────────

// GET /api/v1/models — Returns the full list of tracked models
app.get('/api/v1/models', (req, res) => {
  res.json({
    success: true,
    data: store.models.map(m => ({
      id: m.id,
      owner: m.owner,
      category: m.category,
      status: m.status,
      latency: m.latency,
      uptime_percent: m.uptime,
      last_checked: m.lastChecked
    }))
  });
});

// GET /api/v1/models/:owner/:id — Returns data for a specific model
app.get('/api/v1/models/:owner/:id', (req, res) => {
  const fullId = `${req.params.owner}/${req.params.id}`;
  const model = store.models.find(m => m.id === fullId);
  
  if (!model) {
    return res.status(404).json({ success: false, error: 'Model not found' });
  }

  res.json({
    success: true,
    data: {
      id: model.id,
      owner: model.owner,
      category: model.category,
      status: model.status,
      latency: model.latency,
      uptime_percent: model.uptime,
      last_checked: model.lastChecked
    }
  });
});

// GET /api/v1/stats — Returns aggregate network statistics
app.get('/api/v1/stats', (req, res) => {
  const models = store.models;
  const onlineModels = models.filter(m => m.status === 'online');
  const totalLatency = onlineModels.reduce((acc, m) => acc + (m.latency || 0), 0);
  
  res.json({
    success: true,
    data: {
      total_models_tracked: models.length,
      online_count: onlineModels.length,
      degraded_count: models.filter(m => m.status === 'degraded').length,
      offline_count: models.filter(m => m.status === 'offline').length,
      average_latency_ms: onlineModels.length > 0 ? Math.round(totalLatency / onlineModels.length) : null,
      last_network_probe: store.lastProbed
    }
  });
});

// ── Internal / Dashboard Routes ───────────────────────────────────────────────

// GET /api/models — full model list with probe data (instant response)
app.get('/api/models', (req, res) => {
  res.json({
    models:     store.models,
    lastProbed: store.lastProbed,
    nextProbe:  store.nextProbe,
    probingNow: store.probingNow,
    probeCount: store.probeCount,
  });
});

// GET /api/status — lightweight health check
app.get('/api/status', (req, res) => {
  const models = store.models;
  res.json({
    ok:         true,
    probingNow: store.probingNow,
    lastProbed: store.lastProbed,
    nextProbe:  store.nextProbe,
    probeCount: store.probeCount,
    sseClients: sseClients.size,
    total:      models.length,
    online:     models.filter(m => m.status === 'online').length,
    degraded:   models.filter(m => m.status === 'degraded').length,
    offline:    models.filter(m => m.status === 'offline').length,
  });
});

// POST /api/probe — trigger a manual re-probe
app.post('/api/probe', (req, res) => {
  if (store.probingNow) {
    return res.status(409).json({ error: 'Probe already running' });
  }
  runProbeCycle();
  res.json({ ok: true, message: 'Probe started' });
});

// GET /api/stream — SSE endpoint for live model updates
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');   // disable nginx buffering
  res.flushHeaders();

  // Send current snapshot immediately so new clients are up to date
  res.write(`event: snapshot\ndata: ${JSON.stringify({
    models:     store.models,
    lastProbed: store.lastProbed,
    nextProbe:  store.nextProbe,
    probingNow: store.probingNow,
    probeCount: store.probeCount,
  })}\n\n`);

  sseClients.add(res);
  console.log(`[sse] Client connected (${sseClients.size} total)`);

  // Keepalive ping every 20 s
  const keepAlive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch { /* closed */ }
  }, 20_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
    console.log(`[sse] Client disconnected (${sseClients.size} total)`);
  });
});

// POST /api/chat — securely proxy chat requests to NVIDIA so the frontend doesn't need the API key
app.post('/api/chat', async (req, res) => {
  try {
    const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    // Stream the response back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟢 NVIDIA Tracker server running on http://localhost:${PORT}`);
  console.log(`   GET /api/models  — full data`);
  console.log(`   GET /api/stream  — SSE live updates`);
  console.log(`   POST /api/probe  — trigger manual probe\n`);
});

boot();
