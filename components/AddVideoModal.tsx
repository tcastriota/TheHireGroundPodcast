import React, { useState, useEffect } from 'react';
import { VideoEntry } from '../types';
import { X, Save, Trash2, Plus } from 'lucide-react';

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  editVideo: VideoEntry | null;
  existingVideos: VideoEntry[];
  availableProfiles: string[];
  availableTopics: string[];
  availableAudiences: string[];
  onAdd: (video: Omit<VideoEntry, 'id' | 'createdAt'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<VideoEntry>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({
  isOpen, onClose, editVideo, onAdd, onUpdate, onDelete
}) => {
  // Form State
  const [title, setTitle] = useState('');
  const [headline, setHeadline] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isShort, setIsShort] = useState<'Y' | 'N'>('N');
  const [youtubeId, setYoutubeId] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  
  // Array States for Tags
  const [guestProfiles, setGuestProfiles] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);

  // Input states for creating new tags
  const [profileInput, setProfileInput] = useState('');
  const [audienceInput, setAudienceInput] = useState('');
  const [topicInput, setTopicInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editVideo) {
      setTitle(editVideo.title || '');
      setHeadline(editVideo.headline || '');
      setFullDescription(editVideo.fullDescription || '');
      setGuestName(editVideo.guestName || '');
      setIsShort(editVideo.isShort === 'Y' ? 'Y' : 'N');
      setYoutubeId(editVideo.youtubeId || '');
      setSpotifyUrl(editVideo.spotifyUrl || '');
      setGuestProfiles(editVideo.guestProfiles || []);
      setTargetAudience(editVideo.targetAudience || []);
      setTopics(editVideo.topics || []);
    } else {
      resetForm();
    }
  }, [editVideo, isOpen]);

  const resetForm = () => {
    setTitle(''); setHeadline(''); setFullDescription(''); setGuestName('');
    setIsShort('N'); setYoutubeId(''); setSpotifyUrl('');
    setGuestProfiles([]); setTargetAudience([]); setTopics([]);
    setProfileInput(''); setAudienceInput(''); setTopicInput('');
  };

  const handleTagAdd = (
    e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>, 
    inputValue: string, 
    setArray: React.Dispatch<React.SetStateAction<string[]>>, 
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if ((e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') || !inputValue.trim()) return;
    e.preventDefault();
    setArray(prev => Array.from(new Set([...prev, inputValue.trim()])));
    setInput('');
  };

  const removeTag = (tagToRemove: string, setArray: React.Dispatch<React.SetStateAction<string[]>>) => {
    setArray(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !youtubeId) return alert("Title and YouTube ID are required.");
    
    setIsSubmitting(true);

    // Auto-extract the 11-character ID if a full URL was pasted
    const cleanYoutubeId = (input: string) => {
      const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      return match ? match[1] : input.trim();
    };

    const finalYoutubeId = cleanYoutubeId(youtubeId);

    const videoData = {
      title, headline, fullDescription, guestName, isShort, 
      youtubeId: finalYoutubeId, spotifyUrl, guestProfiles, targetAudience, topics
    };

    try {
      if (editVideo) {
        await onUpdate(editVideo.id, videoData);
      } else {
        await onAdd(videoData);
      }
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to save changes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8 flex flex-col max-h-full overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">{editVideo ? 'Edit Episode' : 'Add New Episode'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Episode Title" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Guest Name</label>
              <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. John Doe" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">YouTube ID or Link *</label>
              <input type="text" value={youtubeId} onChange={e => setYoutubeId(e.target.value)} required className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="dQw4w9WgXcQ or Full Link" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Spotify URL</label>
              <input type="url" value={spotifyUrl} onChange={e => setSpotifyUrl(e.target.value)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="https://open.spotify.com/episode/..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Format</label>
              <select value={isShort} onChange={e => setIsShort(e.target.value as 'Y' | 'N')} className="w-full border p-2.5 rounded-lg outline-none bg-white">
                <option value="N">Full Episode</option>
                <option value="Y">YouTube Short</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Headline (Short Summary)</label>
            <input type="text" value={headline} onChange={e => setHeadline(e.target.value)} className="w-full border p-2.5 rounded-lg outline-none" placeholder="A one-sentence hook..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Full Description</label>
            <textarea value={fullDescription} onChange={e => setFullDescription(e.target.value)} rows={4} className="w-full border p-2.5 rounded-lg outline-none" placeholder="Detailed episode notes..." />
          </div>

          {/* Tag Editors */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="font-bold text-sm text-gray-800">Tags & Metadata (Type and hit Enter to add new)</h3>
            
            {/* Topics */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Topics</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={topicInput} onChange={e => setTopicInput(e.target.value)} onKeyDown={e => handleTagAdd(e, topicInput, setTopics, setTopicInput)} className="flex-1 border p-2 rounded-lg text-sm outline-none" placeholder="Add a topic..." />
                <button type="button" onClick={e => handleTagAdd(e, topicInput, setTopics, setTopicInput)} className="px-3 bg-gray-100 rounded-lg hover:bg-gray-200"><Plus size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <span key={t} className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md text-xs font-medium border border-emerald-100">
                    {t} <X size={12} className="cursor-pointer hover:text-emerald-900" onClick={() => removeTag(t, setTopics)} />
                  </span>
                ))}
              </div>
            </div>

            {/* Profiles */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Guest Profiles</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={profileInput} onChange={e => setProfileInput(e.target.value)} onKeyDown={e => handleTagAdd(e, profileInput, setGuestProfiles, setProfileInput)} className="flex-1 border p-2 rounded-lg text-sm outline-none" placeholder="Add a profile..." />
                <button type="button" onClick={e => handleTagAdd(e, profileInput, setGuestProfiles, setProfileInput)} className="px-3 bg-gray-100 rounded-lg hover:bg-gray-200"><Plus size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {guestProfiles.map(p => (
                  <span key={p} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-medium border border-blue-100">
                    {p} <X size={12} className="cursor-pointer hover:text-blue-900" onClick={() => removeTag(p, setGuestProfiles)} />
                  </span>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Target Audience</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={audienceInput} onChange={e => setAudienceInput(e.target.value)} onKeyDown={e => handleTagAdd(e, audienceInput, setTargetAudience, setAudienceInput)} className="flex-1 border p-2 rounded-lg text-sm outline-none" placeholder="Add an audience (e.g., Job Seekers, Startups)..." />
                <button type="button" onClick={e => handleTagAdd(e, audienceInput, setTargetAudience, setAudienceInput)} className="px-3 bg-gray-100 rounded-lg hover:bg-gray-200"><Plus size={16} /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {targetAudience.map(a => (
                  <span key={a} className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded-md text-xs font-medium border border-purple-100">
                    {a} <X size={12} className="cursor-pointer hover:text-purple-900" onClick={() => removeTag(a, setTargetAudience)} />
                  </span>
                ))}
              </div>
            </div>

          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          {editVideo ? (
            <button type="button" onClick={() => onDelete(editVideo.id)} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-bold px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={16} /> Delete
            </button>
          ) : <div></div>}
          
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={isSubmitting} className="px-5 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50">
              <Save size={16} /> {isSubmitting ? 'Saving...' : 'Save Video'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};