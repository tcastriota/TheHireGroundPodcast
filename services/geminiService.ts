import { VideoEntry } from '../types';

// --- 1. LOCAL SEARCH BAR ---
// We kept the function name the same so your other files don't crash, 
// but it is now a 100% offline, local text filter. No API keys involved!
export const searchVideosWithAI = async (query: string, videos: VideoEntry[]): Promise<string[]> => {
  if (!query.trim()) return [];

  const searchTerms = query.toLowerCase().split(' ');
  
  return videos.filter(video => {
    // It searches through the title, headline, guest name, and tags locally
    const content = `${video.title} ${video.headline} ${video.guestName} ${(video.topics || []).join(' ')}`.toLowerCase();
    
    // Returns true only if every word they typed is found somewhere in the video details
    return searchTerms.every(term => content.includes(term));
  }).map(v => v.id);
};

