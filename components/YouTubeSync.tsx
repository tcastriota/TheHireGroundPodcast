import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X, Youtube } from 'lucide-react';
import { VideoEntry } from '../types';

// Admin tool: compare each episode's title/description with what's live on YouTube,
// review the differences, and apply only the ones you tick.

interface YouTubeSyncProps {
  videos: VideoEntry[];
  onClose: () => void;
  onApply: (changes: { id: string; updates: Partial<VideoEntry> }[]) => Promise<{ saved: number; failed: number }>;
}

type Field = 'title' | 'fullDescription';
interface Diff {
  video: VideoEntry;
  field: Field;
  site: string;
  youtube: string;
  cutOff: boolean;
}

const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

const cleanId = (id: string) => {
  const m = (id || '').match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return m ? m[1] : (id || '').trim();
};

// Site text looks like a truncated copy of the YouTube text: it ends in "..." or stops
// mid-word ("...joins us on the Po" vs "Pod"). Titles where YouTube merely appends
// "- A Hire Ground Short" are NOT counted as cut off.
const isCutOff = (site: string, youtube: string) => {
  const s = norm(site), y = norm(youtube);
  if (!s) return !!y;
  if (s.length >= y.length) return false;
  const endsWithEllipsis = /(\.\.\.|…)$/.test(s);
  const stem = s.replace(/(\.\.\.|…)$/, '').trim();
  if (!y.startsWith(stem)) return false;
  return endsWithEllipsis || /[A-Za-z0-9]/.test(y.charAt(stem.length));
};

const FIELD_LABEL: Record<Field, string> = { title: 'Title', fullDescription: 'Description' };
const keyOf = (d: Diff) => `${d.video.id}:${d.field}`;

const TextBlock: React.FC<{ label: string; text: string; tone: string }> = ({ label, text, tone }) => {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 280;
  return (
    <div className={`rounded-lg p-3 text-xs leading-relaxed ${tone}`}>
      <div className="font-bold uppercase tracking-wide text-[10px] mb-1 opacity-70">{label}</div>
      <div className="whitespace-pre-line break-words">{long && !expanded ? `${text.slice(0, 280)}…` : (text || <em className="opacity-60">(empty)</em>)}</div>
      {long && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 font-semibold underline opacity-80 hover:opacity-100">
          {expanded ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
};

export const YouTubeSync: React.FC<YouTubeSyncProps> = ({ videos, onClose, onApply }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<Record<string, { title: string | null; description: string | null }>>({});
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ saved: number; failed: number } | null>(null);

  const load = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const ids = [...new Set(videos.map(v => cleanId(v.youtubeId)).filter(id => /^[A-Za-z0-9_-]{11}$/.test(id)))];
      const res = await fetch(`/api/youtube-meta?ids=${ids.join(',')}`);
      if (!res.ok) throw new Error(
        res.status === 429 ? 'Too many requests, wait a minute and try again.'
        : res.status === 502 ? 'YouTube API error. Check the YOUTUBE_API_KEY in Cloud Run and that the YouTube Data API is enabled.'
        : `Server error (${res.status})`);
      setMeta((await res.json()).items || {});
    } catch (e: any) {
      setError(e?.message || 'Could not reach YouTube.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const { diffs, unreachable } = useMemo(() => {
    const out: Diff[] = [];
    let unreachable = 0;
    for (const video of videos) {
      const m = meta[cleanId(video.youtubeId)];
      if (!m) { if (!loading && video.youtubeId) unreachable++; continue; }
      if (m.title === null && m.description === null) { unreachable++; continue; }
      const pairs: [Field, string, string | null][] = [
        ['title', video.title || '', m.title],
        ['fullDescription', video.fullDescription || '', m.description],
      ];
      for (const [field, site, youtube] of pairs) {
        if (youtube === null || norm(site) === norm(youtube)) continue;
        out.push({ video, field, site, youtube, cutOff: isCutOff(site, youtube) });
      }
    }
    // Cut-off text first, then titles before descriptions
    out.sort((a, b) => Number(b.cutOff) - Number(a.cutOff) || a.field.localeCompare(b.field) * -1);
    return { diffs: out, unreachable };
  }, [meta, videos, loading]);

  // Pre-select the clearly truncated ones; everything else is opt-in
  useEffect(() => { setSelected(new Set(diffs.filter(d => d.cutOff).map(keyOf))); }, [diffs]);

  const visible = showAll ? diffs : diffs.filter(d => d.cutOff);
  // Videos where YouTube returned a title but no description (descriptions blocked)
  const missingDescriptions = Object.values(meta).filter(m => m.title !== null && m.description === null).length;
  const cutOffCount = diffs.filter(d => d.cutOff).length;

  const toggle = (k: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(k) ? next.delete(k) : next.add(k);
    return next;
  });

  const apply = async () => {
    const byVideo = new Map<string, Partial<VideoEntry>>();
    for (const d of diffs) {
      if (!selected.has(keyOf(d))) continue;
      byVideo.set(d.video.id, { ...(byVideo.get(d.video.id) || {}), [d.field]: d.youtube });
    }
    if (byVideo.size === 0) return;
    setSaving(true);
    const r = await onApply([...byVideo].map(([id, updates]) => ({ id, updates })));
    setSaving(false);
    setResult(r);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Youtube size={20} className="text-red-600" /> Sync from YouTube</h2>
            <p className="text-sm text-gray-500 mt-1">Compare titles and descriptions with what's live on YouTube. Only the changes you tick are saved.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-500">
              <Loader2 className="animate-spin text-red-600" size={28} />
              <p className="text-sm">Fetching {videos.length} videos from YouTube…</p>
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="text-amber-500" size={28} />
              <p className="text-sm text-gray-700">{error}</p>
              <button onClick={load} className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"><RefreshCw size={14} /> Try again</button>
            </div>
          ) : result ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="text-green-600" size={32} />
              <p className="text-base font-semibold text-gray-900">Updated {result.saved} episode{result.saved === 1 ? '' : 's'}</p>
              {result.failed > 0 && <p className="text-sm text-red-600">{result.failed} failed to save. Check you're logged in as an admin and try again.</p>}
              <button onClick={load} className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"><RefreshCw size={14} /> Check again</button>
            </div>
          ) : (
            <>
              {missingDescriptions > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Couldn't read descriptions for {missingDescriptions} video{missingDescriptions === 1 ? '' : 's'} from YouTube, so description differences aren't shown.
                    Add a <strong>YOUTUBE_API_KEY</strong> to the Cloud Run service to fix this.
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-sm text-gray-600">
                  <strong>{diffs.length}</strong> difference{diffs.length === 1 ? '' : 's'} found
                  {cutOffCount > 0 && <> · <strong className="text-amber-700">{cutOffCount}</strong> look cut off</>}
                  {unreachable > 0 && <> · {unreachable} couldn't be read from YouTube</>}
                </p>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                    <button onClick={() => setShowAll(false)} className={`px-3 py-1.5 ${!showAll ? 'bg-amber-100 text-amber-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>Cut off ({cutOffCount})</button>
                    <button onClick={() => setShowAll(true)} className={`px-3 py-1.5 border-l border-gray-200 ${showAll ? 'bg-amber-100 text-amber-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>All ({diffs.length})</button>
                  </div>
                  <button onClick={() => setSelected(new Set([...selected, ...visible.map(keyOf)]))} className="text-blue-600 hover:underline">Select shown</button>
                  <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:underline">Clear</button>
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500">{diffs.length === 0 ? 'Everything matches YouTube. 🎉' : 'Nothing cut off. Switch to "All" to see other differences.'}</p>
              ) : (
                <ul className="space-y-3">
                  {visible.map(d => {
                    const k = keyOf(d);
                    return (
                      <li key={k} className={`border rounded-xl p-4 ${selected.has(k) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" checked={selected.has(k)} onChange={() => toggle(k)} className="mt-1 w-4 h-4 accent-blue-600 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{FIELD_LABEL[d.field]}</span>
                              {d.cutOff && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">CUT OFF</span>}
                              {d.video.isShort === 'Y' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">SHORT</span>}
                              <span className="text-sm font-medium text-gray-900 truncate">{d.video.title}</span>
                            </div>
                            <div className="grid md:grid-cols-2 gap-2">
                              <TextBlock label="On site now" text={d.site} tone="bg-gray-100 text-gray-700" />
                              <TextBlock label="On YouTube" text={d.youtube} tone="bg-red-50 text-gray-800" />
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        {!loading && !error && !result && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">{selected.size} change{selected.size === 1 ? '' : 's'} selected</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={apply} disabled={saving || selected.size === 0} className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />} Apply {selected.size} change{selected.size === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
