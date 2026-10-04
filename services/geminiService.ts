import { VideoEntry } from '../types';

// --- GEMINI FALLBACK SEARCH ---
// Used only when the local smart search (utils/smartSearch.ts) finds nothing.
// The request goes to our own server (server.mjs -> /api/search), which holds the
// Gemini API key. The key is never shipped in the website's JavaScript.
export const searchVideosWithAI = async (query: string, videos: VideoEntry[]): Promise<string[]> => {
  if (!query.trim()) return [];

  // Send a compact catalog so the request stays small
  const catalog = videos.map(v => ({
    id: v.id,
    title: v.title,
    headline: (v.headline || '').slice(0, 300),
    topics: v.topics || [],
    profiles: v.guestProfiles || [],
    guest: v.guestName || '',
    description: (v.fullDescription || v.description || '').slice(0, 400),
  }));

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query.slice(0, 200), videos: catalog }),
  });

  if (!res.ok) throw new Error(`AI search unavailable (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.ids) ? data.ids : [];
};
