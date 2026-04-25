import { VideoEntry } from '../types';
import { Play, Tag, ExternalLink, Edit2, Users, ChevronDown, ChevronUp, Mic, Zap, Briefcase, Calendar } from 'lucide-react';
import { logEvent } from '../services/logger';
import React, { useState } from 'react';

export type ViewMode = 'detailed' | 'gallery' | 'list';

interface VideoCardProps {
  video: VideoEntry;
  isAdmin: boolean;
  onEdit: (video: VideoEntry) => void;
  viewMode?: ViewMode;
}

const PENDING_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'%3E%3Crect width='400' height='225' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='16' fill='%239ca3af'%3EThumbnail Pending%3C/text%3E%3C/svg%3E";

export const VideoCard: React.FC<VideoCardProps> = ({ video, isAdmin, onEdit, viewMode = 'detailed' }) => {
  const [showFullDesc, setShowFullDesc] = useState(false);
  
  const hasYoutube = video.youtubeId && video.youtubeId.trim().length > 0;
  const hasSpotify = video.spotifyUrl && video.spotifyUrl.trim().length > 0;
  const isShort = video.isShort === 'Y';

  const thumbnail = hasYoutube 
    ? `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`
    : PENDING_IMAGE;

  // Trackers
  // Trackers
  const YT_TRACKER = "si=HGWebsite";
  const getSpotifyUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}${YT_TRACKER}`;
  
  // Bulletproof YouTube URL Generator
  const getYoutubeUrl = (id: string) => {
    if (!id) return '';
    // This dynamically extracts the 11-character ID just in case the database contains a full URL
    const match = id.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    const cleanId = match ? match[1] : id.trim();
    
    return `https://www.youtube.com/watch?v=${cleanId}&${YT_TRACKER}`;
  };
  const handleWatchClick = () => {
      logEvent('VIDEO_WATCH_CLICK', `User clicked to watch: ${video.title} (${video.youtubeId})`);
  };
  
  const handleSpotifyClick = () => {
      logEvent('VIDEO_SPOTIFY_CLICK', `User clicked Spotify: ${video.title}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(video);
  };

  const displayDate = video.publishedAt 
    ? new Date(video.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : new Date(video.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const headlineText = video.headline || video.description || "No headline provided.";

  // 1. LIST VIEW
  if (viewMode === 'list') {
    return (
      <div className="group bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-row h-32 relative">
        <div className="relative w-48 bg-gray-100 flex-shrink-0">
          <img
            src={thumbnail}
            alt={video.title}
            className={`w-full h-full object-cover ${!hasYoutube ? 'opacity-80 grayscale-[30%]' : ''}`}
            onError={(e) => { (e.target as HTMLImageElement).src = PENDING_IMAGE; }}
          />
          {isShort && (
            <div className="absolute top-1 left-1 z-20 flex items-center gap-0.5 bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shadow-sm">
              <Zap size={8} fill="currentColor" /> Short
            </div>
          )}
          {hasYoutube && (
             <a href={getYoutubeUrl(video.youtubeId)} target="_blank" rel="noopener noreferrer" onClick={handleWatchClick} className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/30 transition-colors group-hover:opacity-100">
                <Play fill="white" className="text-white drop-shadow-md opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
             </a>
          )}
        </div>

        <div className="p-4 flex-grow flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {video.guestName && <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">{video.guestName}</span>}
              <span className="text-[10px] text-gray-400 flex items-center gap-1"><Calendar size={10} /> {displayDate}</span>
            </div>
            <h3 className="font-semibold text-sm text-gray-900 leading-tight line-clamp-1 mb-1" title={video.title}>
               {video.title}
            </h3>
            
            {video.targetAudience && video.targetAudience.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {video.targetAudience.map((a, i) => (
                  <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-50 text-purple-600 border border-purple-100 whitespace-nowrap">
                    {a}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-auto">
              {hasYoutube && <a href={getYoutubeUrl(video.youtubeId)} target="_blank" rel="noopener noreferrer" onClick={handleWatchClick} className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"><ExternalLink size={10}/> YouTube</a>}
              {hasSpotify && video.spotifyUrl && <a href={getSpotifyUrl(video.spotifyUrl)} target="_blank" rel="noopener noreferrer" onClick={handleSpotifyClick} className="text-xs text-gray-500 hover:text-green-600 flex items-center gap-1"><ExternalLink size={10}/> Spotify</a>}
            </div>
        </div>

        {isAdmin && (
          <button onClick={handleEdit} className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
            <Edit2 size={14} />
          </button>
        )}
      </div>
    );
  }

  // 2. DETAILED VIEW
  if (viewMode === 'detailed') {
    return (
      <div className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full relative">
        <div className="relative aspect-video bg-gray-100 overflow-hidden z-0 flex-shrink-0">
          <img src={thumbnail} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => { (e.target as HTMLImageElement).src = PENDING_IMAGE; }} />
          {isShort && <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow-sm"><Zap size={10} fill="currentColor" /> Short</div>}
          {hasYoutube ? (
            <a href={getYoutubeUrl(video.youtubeId)} target="_blank" rel="noopener noreferrer" onClick={handleWatchClick} className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-10">
              <div className="bg-white text-gray-900 p-3 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-transform"><Play fill="currentColor" size={20} /></div>
            </a>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10"><div className="bg-white/90 text-gray-600 p-2 rounded-full shadow-sm"><Mic size={20} /></div></div>
          )}
        </div>

        <div className="p-4 flex flex-col flex-grow relative z-0 bg-white">
          <div className="mb-2">
             {video.guestName && <span className="text-xs font-bold text-blue-600 uppercase tracking-wide block mb-1">Guest: {video.guestName}</span>}
             <h3 className="font-bold text-base text-gray-900 line-clamp-2 leading-tight" title={video.title}>{video.title}</h3>
          </div>
          
          <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
             <span className="text-xs text-gray-400">{displayDate}</span>
             <div className="flex gap-2">
                {video.guestProfiles.slice(0, 1).map((p, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                    {p}
                  </span>
                ))}
                {video.guestProfiles.length > 1 && <span className="text-[10px] text-gray-400 self-center">+{video.guestProfiles.length - 1}</span>}
             </div>
          </div>
        </div>

        {isAdmin && (
          <button onClick={handleEdit} className="absolute top-2 right-2 z-30 p-2 bg-white/90 text-blue-600 rounded-full shadow-sm hover:bg-blue-50 transition-all border border-gray-200">
            <Edit2 size={14} />
          </button>
        )}
      </div>
    );
  }

  // 3. GALLERY VIEW
  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full relative">
      <div className="relative aspect-video bg-gray-100 overflow-hidden z-0 flex-shrink-0">
        <img
          src={thumbnail}
          alt={video.title}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${!hasYoutube ? 'opacity-80 grayscale-[30%]' : ''}`}
          onError={(e) => {
            (e.target as HTMLImageElement).src = PENDING_IMAGE;
          }}
        />
        
        {isShort && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow-sm">
            <Zap size={10} fill="currentColor" />
            Short
          </div>
        )}

        {hasYoutube ? (
          <a
            href={getYoutubeUrl(video.youtubeId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWatchClick}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] z-10"
          >
            <div className="bg-red-600 text-white p-3 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <Play fill="currentColor" size={24} />
            </div>
          </a>
        ) : (
             <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
                 <div className="bg-white/90 text-gray-600 p-2 rounded-full shadow-sm">
                    <Mic size={20} />
                 </div>
             </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow relative z-0 bg-white">
        <div className="mb-2">
           {video.guestName && (
             <span className="text-xs font-bold text-blue-600 uppercase tracking-wide block mb-1">
               Guest: {video.guestName}
             </span>
           )}
           <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-lg leading-tight text-gray-900 line-clamp-2" title={video.title}>
                {video.title}
              </h3>
           </div>
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-3 font-medium">
          {headlineText}
        </p>

        <div className="space-y-3 mb-4">
          {video.guestProfiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <div className="flex items-center text-xs font-medium text-gray-500 mr-1" title="Job Profile">
                <Briefcase size={12} className="mr-1" />
                Profile:
              </div>
              {video.guestProfiles.map((p, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {p}
                </span>
              ))}
            </div>
          )}
          
          {video.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <div className="flex items-center text-xs font-medium text-gray-500 mr-1" title="Topics">
                <Tag size={12} className="mr-1" />
                Topics:
              </div>
              {video.topics.map((t, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {t}
                </span>
              ))}
            </div>
          )}

          {video.targetAudience && video.targetAudience.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-50">
               <div className="flex items-center text-xs font-medium text-gray-500 mr-1">
                  <Users size={12} className="mr-1" />
                  For:
               </div>
               {video.targetAudience.map((a, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                    {a}
                  </span>
               ))}
            </div>
          )}
        </div>

        {video.fullDescription && (
            <div className="mt-auto pt-2 border-t border-gray-100">
                <button 
                    type="button"
                    onClick={() => setShowFullDesc(!showFullDesc)}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors w-full justify-start"
                >
                    {showFullDesc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showFullDesc ? 'Hide Details' : 'Show Full Description'}
                </button>
                {showFullDesc && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg leading-relaxed animate-fadeIn">
                        {(video.fullDescription || '').split('\n').map((line, i) => (
                            <p key={i} className="mb-1 last:mb-0">{line || <br/>}</p>
                        ))}
                    </div>
                )}
            </div>
        )}

        <div className="mt-4 pt-3 flex justify-between items-center text-xs text-gray-400">
           <span>{displayDate}</span>
           <div className="flex gap-3">
               {hasYoutube && (
                   <a 
                     href={getYoutubeUrl(video.youtubeId)}
                     target="_blank" 
                     rel="noopener noreferrer"
                     onClick={handleWatchClick}
                     className="flex items-center hover:text-red-600 transition-colors font-medium"
                   >
                     YouTube <ExternalLink size={10} className="ml-1" />
                   </a>
               )}
               {hasSpotify && video.spotifyUrl && (
                   <a 
                     href={getSpotifyUrl(video.spotifyUrl)}
                     target="_blank" 
                     rel="noopener noreferrer"
                     onClick={handleSpotifyClick}
                     className="flex items-center hover:text-green-600 transition-colors font-medium"
                   >
                     Spotify <ExternalLink size={10} className="ml-1" />
                   </a>
               )}
           </div>
        </div>
      </div>

      {isAdmin && (
        <div 
            className="absolute top-2 right-2 z-50 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleEdit}
            className="p-2 bg-white text-blue-600 rounded-full shadow-lg hover:bg-blue-50 hover:text-blue-700 transition-all cursor-pointer border border-gray-200 flex items-center justify-center transform hover:scale-105 active:scale-95"
            title="Edit Metadata"
          >
            <Edit2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
};