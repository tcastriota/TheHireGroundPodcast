// Production server for Cloud Run (replaces nginx).
// - Serves the built site from ./dist (with SPA fallback to index.html)
// - POST /api/search: forwards a search to Gemini using the GEMINI_API_KEY env var,
//   so the key stays on the server and is never exposed to visitors.
// No dependencies: uses only Node built-ins (Node 20+).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// --- Simple per-IP rate limit so the endpoint can't be abused as a free Gemini proxy ---
const RATE_LIMIT = 20;            // requests
const RATE_WINDOW_MS = 60_000;    // per minute
const hits = new Map();
const rateLimited = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT;
};

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const readBody = (req, limit) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', c => {
    size += c.length;
    if (size > limit) { reject(new Error('too_large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const handleSearch = async (req, res) => {
  if (!GEMINI_API_KEY) return sendJson(res, 503, { error: 'not_configured' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (rateLimited(ip)) return sendJson(res, 429, { error: 'rate_limited' });

  let query, videos;
  try {
    ({ query, videos } = JSON.parse(await readBody(req, 500_000)));
  } catch {
    return sendJson(res, 400, { error: 'bad_request' });
  }
  if (typeof query !== 'string' || !query.trim() || query.length > 200 || !Array.isArray(videos) || videos.length > 1000) {
    return sendJson(res, 400, { error: 'bad_request' });
  }

  const catalog = videos.map(v => ({
    id: String(v.id ?? ''),
    title: String(v.title ?? '').slice(0, 300),
    headline: String(v.headline ?? '').slice(0, 300),
    topics: (Array.isArray(v.topics) ? v.topics : []).map(String).slice(0, 30),
    profiles: (Array.isArray(v.profiles) ? v.profiles : []).map(String).slice(0, 30),
    guest: String(v.guest ?? '').slice(0, 100),
    description: String(v.description ?? '').slice(0, 400),
  })).filter(v => v.id);
  const validIds = new Set(catalog.map(v => v.id));

  const prompt = `You are the search engine for "The Hire Ground Podcast", a career-advice podcast.
A visitor typed this search: "${query.replace(/"/g, "'")}"

Return the ids of the episodes that are genuinely relevant to what the visitor is looking for.
Match on meaning, not exact words: related concepts count (e.g. "finance" matches banking, wealth,
Wall Street, fintech), and treat misspellings as the intended word. Order from most to least relevant.
Return an empty array if nothing is relevant. Only use ids from this list.

Episodes (JSON):
${JSON.stringify(catalog)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
        },
      }),
      signal: controller.signal,
    });
    if (!r.ok) {
      console.error('Gemini error', r.status, (await r.text()).slice(0, 500));
      return sendJson(res, 502, { error: 'ai_error' });
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '[]';
    const ids = JSON.parse(text);
    return sendJson(res, 200, { ids: (Array.isArray(ids) ? ids : []).map(String).filter(id => validIds.has(id)) });
  } catch (err) {
    console.error('Gemini request failed', err?.message || err);
    return sendJson(res, 502, { error: 'ai_error' });
  } finally {
    clearTimeout(timeout);
  }
};

const serveStatic = (req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400); return res.end(); }
  let file = path.normalize(path.join(DIST, urlPath));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) { res.writeHead(403); return res.end(); }

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) file = path.join(file, 'index.html');
    else if (err) file = path.join(DIST, 'index.html'); // SPA fallback

    fs.readFile(file, (readErr, buf) => {
      if (readErr) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(file).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      // Hashed build assets can be cached forever; index.html must always be fresh
      headers['Cache-Control'] = urlPath.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  });
};

http.createServer((req, res) => {
  // Cloud Run forwards the original protocol; send http:// visitors to https://
  if (req.headers['x-forwarded-proto'] === 'http') {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    return res.end();
  }
  if (req.url === '/api/search') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    return handleSearch(req, res);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Server listening on ${PORT} (Gemini search ${GEMINI_API_KEY ? 'enabled' : 'disabled: GEMINI_API_KEY not set'})`);
});
