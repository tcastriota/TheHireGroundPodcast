import React, { useState } from 'react';
import { ArrowLeft, Briefcase, Calendar, ChevronDown, ChevronUp, Edit2, ExternalLink, FileText, Play, Tag, Users, Zap } from 'lucide-react';
import { VideoEntry } from '../types';
import { logEvent } from '../services/logger';
import { realTranscript, youtubeWatchUrl } from '../utils/episodes';

interface EpisodePageProps {
  video: VideoEntry;
  isAdmin: boolean;
  onBack: () => void;
  onEdit: (video: VideoEntry) => void;
}

// Single-episode page, styled like the gallery card but showing everything:
// large thumbnail (click -> YouTube), full description, all tags and the transcript.
export const EpisodePage: React.FC<EpisodePageProps> = ({ video, isAdmin, onBack, onEdit }) => {
  const [showTranscript, setShowTranscript] = useState(false);

  const youtubeUrl = youtubeWatchUrl(video.youtubeId);
  const spotifyUrl = video.spotifyUrl?.trim()
    ? `${video.spotifyUrl}${video.spotifyUrl.includes('?') ? '&' : '?'}si=HGWebsite`
    : '';
  const transcript = realTranscript(video.transcript);
  const isShort = video.isShort === 'Y';

  const displayDate = video.publishedAt
    ? new Date(video.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : new Date(Number(video.createdAt)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const handleWatchClick = () => logEvent('VIDEO_WATCH_CLICK', `Episode page -> YouTube: ${video.title} (${video.youtubeId})`);
  const handleSpotifyClick = () => logEvent('VIDEO_SPOTIFY_CLICK', `Episode page -> Spotify: ${video.title}`);

  const tagRow = (label: string, icon: React.ReactNode, items: string[] | undefined, color: string) =>
    items && items.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center text-xs font-medium text-gray-500 mr-1">{icon}{label}</span>
        {items.map((t, i) => (
          <span key={i} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}>{t}</span>
        ))}
      </div>
    );

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
        {/* Thumbnail: click to watch on YouTube */}
        <div className="group relative aspect-video bg-gray-100 overflow-hidden">
          <img
            src={`https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (!img.src.includes('hqdefault')) img.src = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
            }}
          />
          {isShort && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold uppercase shadow-sm">
              <Zap size={12} fill="currentColor" /> Short
            </div>
          )}
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWatchClick}
              aria-label="Watch on YouTube"
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/35 transition-colors z-10"
            >
              <div className="bg-red-600 text-white p-5 rounded-full shadow-lg transform group-hover:scale-110 transition-transform">
                <Play fill="currentColor" size={36} />
              </div>
            </a>
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
              <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={handleWatchClick} className="flex items-center gap-1 font-medium hover:text-red-600 transition-colors">
                Watch on YouTube <ExternalLink size={12} />
              </a>
            )}
            {spotifyUrl && (
              <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" onClick={handleSpotifyClick} className="flex items-center gap-1 font-medium hover:text-green-600 transition-colors">
                Listen on Spotify <ExternalLink size={12} />
              </a>
            )}
          </div>

          {video.headline && <p className="text-gray-700 text-base font-medium mb-6">{video.headline}</p>}

          <div className="space-y-3 mb-6">
            {tagRow('Profile:', <Briefcase size={12} className="mr-1" />, video.guestProfiles, 'bg-blue-50 text-blue-700 border-blue-100')}
            {tagRow('Topics:', <Tag size={12} className="mr-1" />, video.topics, 'bg-emerald-50 text-emerald-700 border-emerald-100')}
            {tagRow('For:', <Users size={12} className="mr-1" />, video.targetAudience, 'bg-purple-50 text-purple-700 border-purple-100')}
          </div>

          {video.fullDescription && (
            <section className="pt-6 border-t border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">About this episode</h2>
              <div className="text-sm text-gray-700 leading-relaxed">
                {video.fullDescription.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 last:mb-0">{line || <br />}</p>
                ))}
              </div>
            </section>
          )}

          <section className="pt-6 mt-6 border-t border-gray-100">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
              <FileText size={14} /> Transcript
            </h2>
            {transcript ? (
              <>
                <div className={`relative text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg ${showTranscript ? '' : 'max-h-48 overflow-hidden'}`}>
                  {transcript.split('\n').map((line, i) => (
                    <p key={i} className="mb-2 last:mb-0">{line || <br />}</p>
                  ))}
                  {!showTranscript && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-50 to-transparent" />}
                </div>
                <button
                  type="button"
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="mt-2 flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {showTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {showTranscript ? 'Show less' : 'Show full transcript'}
                </button>
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
