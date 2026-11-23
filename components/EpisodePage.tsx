import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, Edit2, ExternalLink, FileText, Play } from 'lucide-react';
import { VideoEntry } from '../types';
import { logEvent } from '../services/logger';
import { realTranscript, youtubeWatchUrl } from '../utils/episodes';

interface EpisodePageProps {
  video: VideoEntry;
  isAdmin: boolean;
  onBack: () => void;
  onEdit: (video: VideoEntry) => void;
}

// --- YouTube IFrame API (loaded once, shared by every episode page) ---
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}
let ytApiPromise: Promise<any> | null = null;
const loadYouTubeApi = (): Promise<any> => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { ytApiPromise = null; reject(new Error('YouTube API failed to load')); };
      document.head.appendChild(script);
    });
  }
  return ytApiPromise;
};

const cleanYoutubeId = (id: string) => {
  const match = (id || '').match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : (id || '').trim();
};

// "1:02:03" / "02:03" -> seconds
const toSeconds = (ts: string) => ts.split(':').map(Number).reduce((total, n) => total * 60 + n, 0);

// Transcripts pasted from YouTube look like "0:06\n6 seconds\nHi everyone...".
// Drop the spoken-duration lines ("6 seconds", "1 minute, 5 seconds") and put each
// timestamp on the same line as the text that follows it.
const DURATION_LINE = /^\d+ (?:hours?|minutes?|seconds?)(?:,? \d+ (?:hours?|minutes?|seconds?))*$/i;
const TIMESTAMP_ONLY = /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/;
const tidyTranscript = (text: string) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !DURATION_LINE.test(l));
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (TIMESTAMP_ONLY.test(lines[i]) && i + 1 < lines.length && !TIMESTAMP_ONLY.test(lines[i + 1])) {
      out.push(`${lines[i]}  ${lines[i + 1]}`);
      i++;
    } else out.push(lines[i]);
  }
  return out;
};

// Finds URLs and timestamps (e.g. 00:03:04, 7:35) in description/transcript text
const RICH_TOKEN = /(https?:\/\/[^\s<>"]+)|\b((?:\d{1,2}:)?\d{1,2}:\d{2})\b/g;

// Single-episode page: embedded player, full description with clickable links and
// timestamps (they jump the player without leaving the site) and the transcript.
export const EpisodePage: React.FC<EpisodePageProps> = ({ video, isAdmin, onBack, onEdit }) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const [playerFailed, setPlayerFailed] = useState(false);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLElement>(null);
  const playerRef = useRef<any>(null);

  const youtubeId = cleanYoutubeId(video.youtubeId);
  const youtubeUrl = youtubeWatchUrl(video.youtubeId);
  const spotifyUrl = video.spotifyUrl?.trim()
    ? `${video.spotifyUrl}${video.spotifyUrl.includes('?') ? '&' : '?'}si=HGWebsite`
    : '';
  const transcript = realTranscript(video.transcript);

  const displayDate = video.publishedAt
    ? new Date(video.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : new Date(Number(video.createdAt)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  // Create the embedded YouTube player
  useEffect(() => {
    if (!youtubeId) return;
    let cancelled = false;
    loadYouTubeApi()
      .then(YT => {
        if (cancelled || !playerHostRef.current) return;
        // YouTube replaces the element it is given with an iframe, so hand it a
        // plain element React doesn't manage
        const mount = document.createElement('div');
        playerHostRef.current.replaceChildren(mount);
        playerRef.current = new YT.Player(mount, {
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onStateChange: (e: any) => {
              if (e.data === 1) logEvent('VIDEO_WATCH_CLICK', `Played on site: ${video.title} (${youtubeId})`);
            },
            onError: () => setPlayerFailed(true),
          },
        });
      })
      .catch(() => !cancelled && setPlayerFailed(true));
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
    };
  }, [youtubeId]);

  const seekTo = (ts: string) => {
    const player = playerRef.current;
    playerWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (player?.seekTo) {
      player.seekTo(toSeconds(ts), true);
      player.playVideo?.();
    } else if (youtubeUrl) {
      // Player unavailable (blocked/failed): fall back to YouTube at that time
      window.open(`${youtubeUrl}&t=${toSeconds(ts)}s`, '_blank', 'noopener');
    }
    logEvent('EPISODE_TIMESTAMP_CLICK', `${video.title} @ ${ts}`);
  };

  // Turn URLs and timestamps inside a line of text into live links
  const renderRichLine = (line: string, key: number) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const m of line.matchAll(RICH_TOKEN)) {
      const start = m.index ?? 0;
      if (start > last) parts.push(line.slice(last, start));
      if (m[1]) {
        // Don't swallow trailing punctuation like "." or ")"
        const url = m[1].replace(/[.,!?;:)\]]+$/, '');
        const ownSite = /^https?:\/\/(www\.)?thehiregroundpodcast\.com/i.test(url);
        parts.push(
          <a key={`u${start}`} href={url} {...(ownSite ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
             className="text-blue-600 hover:underline break-all">{url}</a>
        );
        if (url.length < m[1].length) parts.push(m[1].slice(url.length));
      } else {
        const ts = m[2];
        parts.push(
          <button key={`t${start}`} type="button" onClick={() => seekTo(ts)}
                  className="text-blue-600 hover:underline font-medium tabular-nums" title={`Jump to ${ts}`}>{ts}</button>
        );
      }
      last = start + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <p key={key} className="mb-2 last:mb-0">{parts.length ? parts : <br />}</p>;
  };

  const collapseTranscript = () => {
    setShowTranscript(false);
    transcriptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <a
        href="/"
        onClick={(e) => { e.preventDefault(); onBack(); }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> All episodes
      </a>

      <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
        {/* Embedded YouTube player (falls back to a thumbnail linking to YouTube) */}
        <div ref={playerWrapRef} className="relative aspect-video bg-black">
          {playerFailed || !youtubeId ? (
            <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Watch on YouTube" className="group absolute inset-0">
              <img src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`} alt={video.title} className="w-full h-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition-colors">
                <span className="bg-red-600 text-white p-5 rounded-full shadow-lg"><Play fill="currentColor" size={36} /></span>
              </span>
            </a>
          ) : (
            <div ref={playerHostRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
          )}
        </div>

        <div className="p-6 md:p-8">
          {video.guestName && (
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wide block mb-2">Guest: {video.guestName}</span>
          )}
          <h1 className="font-bold text-2xl md:text-3xl leading-tight text-gray-900 mb-3">{video.title}</h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 mb-5">
            <span className="flex items-center gap-1.5"><Calendar size={14} /> {displayDate}</span>
            {youtubeUrl && (
              <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium hover:text-red-600 transition-colors">
                Watch on YouTube <ExternalLink size={12} />
              </a>
            )}
            {spotifyUrl && (
              <a href={spotifyUrl} target="_blank" rel="noopener noreferrer"
                 onClick={() => logEvent('VIDEO_SPOTIFY_CLICK', `Episode page -> Spotify: ${video.title}`)}
                 className="flex items-center gap-1 font-medium hover:text-green-600 transition-colors">
                Listen on Spotify <ExternalLink size={12} />
              </a>
            )}
          </div>

          {video.headline && <p className="text-gray-700 text-base font-medium">{video.headline}</p>}

          {video.fullDescription && (
            <section className="pt-6 mt-6 border-t border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">About this episode</h2>
              <div className="text-sm text-gray-700 leading-relaxed">
                {video.fullDescription.split('\n').map(renderRichLine)}
              </div>
            </section>
          )}

          <section ref={transcriptRef} className="pt-6 mt-6 border-t border-gray-100 scroll-mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide">
                <FileText size={14} /> Transcript
              </h2>
              {transcript && showTranscript && (
                <button type="button" onClick={collapseTranscript} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                  <ChevronUp size={16} /> Show less
                </button>
              )}
            </div>
            {transcript ? (
              <>
                <div className={`relative text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg ${showTranscript ? '' : 'max-h-48 overflow-hidden'}`}>
                  {tidyTranscript(transcript).map(renderRichLine)}
                  {!showTranscript && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-50 to-transparent" />}
                </div>
                {!showTranscript && (
                  <button type="button" onClick={() => setShowTranscript(true)} className="mt-2 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                    <ChevronDown size={16} /> Show full transcript
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">Transcript coming soon.</p>
            )}
          </section>
        </div>

        {isAdmin && (
          <button
            onClick={() => onEdit(video)}
            className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 text-blue-600 text-sm font-medium rounded-full shadow-sm hover:bg-blue-50 transition-all border border-gray-200"
          >
            <Edit2 size={14} /> Edit
          </button>
        )}
      </article>
    </div>
  );
};
