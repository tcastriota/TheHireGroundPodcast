import { VideoEntry } from '../types';

// --- EPISODE PAGES ---
// Each episode gets its own URL: /episodes/<title-slug>-<first 8 chars of id>
// The id suffix keeps links working even if the title is edited later.

// Episodes that currently open their own page when clicked (trial rollout).
// Add ids here to enable more, or remove this check to enable every episode.
export const EPISODE_PAGE_IDS = new Set<string>([
  '840b3c35-a568-4d39-bc55-3de32d33a277', // Rachel Hyman (Season 3, Episode 1)
]);

export const hasEpisodePage = (video: VideoEntry) => EPISODE_PAGE_IDS.has(video.id);

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

export const episodePath = (video: VideoEntry) =>
  `/episodes/${slugify(video.title) || 'episode'}-${video.id.slice(0, 8)}`;

// Returns the id prefix from an /episodes/... path, or null if it isn't an episode URL
export const episodeIdFromPath = (pathname: string): string | null => {
  const m = pathname.match(/^\/episodes\/(?:.*-)?([0-9a-z]{8})\/?$/i);
  return m ? m[1].toLowerCase() : null;
};

export const findEpisodeByIdPrefix = (videos: VideoEntry[], prefix: string) =>
  videos.find(v => v.id.toLowerCase().startsWith(prefix));

// Old entries use placeholders like "Not Available" instead of a real transcript
export const realTranscript = (t?: string) => {
  const text = (t || '').trim();
  return text.length > 20 ? text : '';
};

export const youtubeWatchUrl = (id: string) => {
  const match = (id || '').match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  const cleanId = match ? match[1] : (id || '').trim();
  return cleanId ? `https://www.youtube.com/watch?v=${cleanId}&si=HGWebsite` : '';
};
