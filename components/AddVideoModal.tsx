import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Sparkles, Loader2, Youtube, Plus, FileText, Link as LinkIcon, Save, Upload, Zap, ChevronDown, Tag, Users, Briefcase } from 'lucide-react';
import { analyzeVideoContent, parseBulkVideoInput } from '../services/geminiService';
import { VideoEntry } from '../types';
import { logEvent } from '../services/logger';
import { videoStorage } from '../services/storage';
import { normalizeTags, toTitleCase } from '../utils/stringUtils';

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (video: Omit<VideoEntry, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, updates: Partial<VideoEntry>) => void;
  onDelete: (id: string) => void;
  existingVideos: VideoEntry[];
  editVideo: VideoEntry | null;
  availableProfiles: string[];
  availableTopics: string[];
  availableAudiences: string[];
}

type Tab = 'single' | 'bulk';
type EditSection = 'details' | 'transcript';

const MultiSelectInput = ({ 
  label, 
  icon: Icon,
  value, 
  options, 
  onChange, 
  placeholder 
}: { 
  label: string;
  icon: any;
  value: string; 
  options: string[]; 
  onChange: (val: string) => void; 
  placeholder: string;
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTags = useMemo(() => 
    value.split(',').map(s => s.trim()).filter(s => s.length > 0), 
  [value]);

  const filteredOptions = useMemo(() => {
    const search = inputValue.toLowerCase();
    return options.filter(opt => 
      !selectedTags.includes(opt) && 
      opt.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [options, selectedTags, inputValue]);

  const addTag = (tag: string) => {
    const normalized = toTitleCase(tag.trim());
    if (!normalized || selectedTags.includes(normalized)) return;
    
    const newTags = [...selectedTags, normalized];
    onChange(newTags.join(', '));
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = selectedTags.filter(t => t !== tagToRemove);
    onChange(newTags.join(', '));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative group" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
        <Icon size={14} className="text-gray-400" />
        {label}
      </label>
      
      <div 
        className={`w-full min-h-[42px] px-2 py-1.5 rounded-lg border bg-white flex flex-wrap gap-2 items-center cursor-text transition-all ${isFocused ? 'ring-2 ring-blue-100 border-blue-500' : 'border-gray-300 hover:border-gray-400'}`}
        onClick={() => {
          setIsFocused(true);
          inputRef.current?.focus();
        }}
      >
        {selectedTags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium border border-blue-100 animate-fadeIn">
            {tag}
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:text-blue-900 hover:bg-blue-100 rounded-full p-0.5 transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
          placeholder={selectedTags.length === 0 ? placeholder : ""}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
        />
      </div>

      {isFocused && (filteredOptions.length > 0 || (inputValue && !filteredOptions.includes(toTitleCase(inputValue)))) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-slideDown">
          {inputValue && !filteredOptions.some(o => o.toLowerCase() === inputValue.toLowerCase()) && (
             <button
                type="button"
                onClick={() => addTag(inputValue)}
                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium border-b border-gray-50 flex items-center gap-2"
             >
               <Plus size={14} /> Add "{inputValue}"
             </button>
          )}
          {filteredOptions.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => addTag(option)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const AddVideoModal: React.FC<AddVideoModalProps> = ({ 
  isOpen, onClose, onAdd, onUpdate, onDelete, editVideo, existingVideos,
  availableProfiles, availableTopics, availableAudiences 
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('single');
  const [editSection, setEditSection] = useState<EditSection>('details');
  
  const [url, setUrl] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [title, setTitle] = useState('');
  const [headline, setHeadline] = useState(''); 
  const [fullDescription, setFullDescription] = useState(''); 
  const [guestName, setGuestName] = useState('');
  const [guestProfiles, setGuestProfiles] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [topics, setTopics] = useState<string>('');
  const [transcript, setTranscript] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [isShort, setIsShort] = useState<'Y' | 'N'>('N');
  
  const [bulkText, setBulkText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const formatDateForInput = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (editVideo) {
      setActiveTab('single');
      setUrl(editVideo.youtubeId ? `https://www.youtube.com/watch?v=${editVideo.youtubeId}` : '');
      setSpotifyUrl(editVideo.spotifyUrl || '');
      setTitle(editVideo.title);
      setHeadline(editVideo.headline || editVideo.description || '');
      setFullDescription(editVideo.fullDescription || '');
      setGuestName(editVideo.guestName || '');
      setGuestProfiles(editVideo.guestProfiles.join(', '));
      setTargetAudience(Array.isArray(editVideo.targetAudience) ? editVideo.targetAudience.join(', ') : (editVideo.targetAudience || ''));
      setTopics(editVideo.topics.join(', '));
      setTranscript(editVideo.transcript || '');
      setPublishedAt(formatDateForInput(editVideo.publishedAt));
      setIsShort(editVideo.isShort === 'Y' ? 'Y' : 'N');
    } else {
      setUrl('');
      setSpotifyUrl('');
      setTitle('');
      setHeadline('');
      setFullDescription('');
      setGuestName('');
      setGuestProfiles('');
      setTargetAudience('');
      setTopics('');
      setTranscript('');
      setIsShort('N');
      setPublishedAt(new Date().toISOString().split('T')[0]);
    }
    setError(null);
    setSuccessMsg(null);
  }, [editVideo, isOpen]);

  if (!isOpen) return null;

  const extractYoutubeId = (url: string | undefined | null) => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (trimmed.length === 11 && !trimmed.includes('.') && !trimmed.includes('/')) return trimmed;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = trimmed.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const isValidSpotifyUrl = (url: string | undefined | null) => {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim();
      return trimmed.includes('spotify.com');
  };

  const handleTabChange = (tab: Tab) => {
      setActiveTab(tab);
      setError(null);
      setSuccessMsg(null);
  };

  const handleAnalyzeSingle = async () => {
    if (!title && !transcript && !url) {
      setError("Please enter at least a title, URL, or transcript to analyze.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    logEvent('ANALYZE_START', `Analyzing video metadata: ${title || url}`);
    
    try {
      // FIX 1: Combine input into one string, and correctly pass the arrays to the AI
      const aiInput = `Title: ${title}\nHeadline: ${headline}\nURL: ${url}\nTranscript: ${transcript.slice(0, 5000)}`;
      const result = await analyzeVideoContent(aiInput, availableProfiles, availableTopics, availableAudiences);
      
      // Added safety fallbacks (|| []) in case the AI forgets to return an array
      setGuestProfiles((result.guestProfiles || []).join(', '));
      setTopics((result.topics || []).join(', '));
      if (result.guestName) setGuestName(result.guestName);
      if (result.targetAudience) setTargetAudience((result.targetAudience || []).join(', '));
      if (result.headline) setHeadline(result.headline);
      if (result.fullDescription) setFullDescription(result.fullDescription);
      
      const shortStatus = result.isShort === 'Y' ? 'Y' : 'N';
      setIsShort(shortStatus);

      logEvent('ANALYZE_SUCCESS', 'Successfully analyzed metadata');
    } catch (err: any) {
      console.error(err);
      setError("Failed to analyze content.");
      logEvent('ANALYZE_FAILURE', err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !youtubeId) return alert("Title and YouTube ID are required.");
    
    setIsSubmitting(true);

    // NEW: Auto-extract the 11-character ID if a full URL was pasted
    const cleanYoutubeId = (input: string) => {
      // This regex looks for standard YouTube URLs, youtu.be links, or shorts, and grabs the ID
      const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      return match ? match[1] : input.trim();
    };

    const finalYoutubeId = cleanYoutubeId(youtubeId);

    const videoData = {
      title, headline, fullDescription, guestName, isShort, 
      youtubeId: finalYoutubeId, // Uses the cleaned ID
      spotifyUrl, guestProfiles, targetAudience, topics
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

  const handleBulkSubmit = async () => {
    if (!bulkText) return;
    setIsAnalyzing(true);
    setError(null);
    setSuccessMsg(null);
    logEvent('SUBMIT_BULK_START', `Processing bulk text length: ${bulkText.length}`);

    try {
        // Passed the available tags so the AI categorizes bulk imports correctly
        const videosFromAI = await parseBulkVideoInput(bulkText, availableProfiles, availableTopics, availableAudiences);
        const validVideos: Omit<VideoEntry, 'id' | 'createdAt'>[] = [];
        const failedItems: string[] = [];

        videosFromAI.forEach(v => {
            const cleanYtId = extractYoutubeId(v.youtubeId);
            const cleanSpotify = isValidSpotifyUrl(v.spotifyUrl) ? v.spotifyUrl!.trim() : undefined;
            
            if (cleanYtId || cleanSpotify) {
                // FIX 2: Added "as any" to force TypeScript to accept the AI data
                validVideos.push({
                    ...v,
                    youtubeId: cleanYtId || "",
                    spotifyUrl: cleanSpotify,
                    isShort: v.isShort === 'Y' ? 'Y' : 'N',
                    publishedAt: v.publishedAt || new Date().toISOString().split('T')[0]
                } as any); 
            } else {
                failedItems.push(v.title || 'Untitled Item');
            }
        });

        if (validVideos.length > 0) {
            validVideos.forEach(v => onAdd(v));
            setSuccessMsg(`Successfully imported ${validVideos.length} videos.`);
            if (failedItems.length === 0) {
                 setTimeout(resetAndClose, 1500);
            }
        }
        
        if (failedItems.length > 0) {
            const failMsg = `Skipped ${failedItems.length} items because no valid URL was found: "${failedItems.join('", "')}"`;
            setError(failMsg);
        } else if (validVideos.length === 0) {
            setError("No valid items found.");
        }

    } catch (err) {
        setError("Failed to process bulk text.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleDelete = () => {
    if (editVideo && window.confirm("Are you sure you want to delete this video? This cannot be undone.")) {
      onDelete(editVideo.id);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCsv(text);
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const processCsv = async (csvText: string) => {
    setIsLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      // 1. Split text into rows and ignore empty lines
      const rows = csvText.split('\n').filter(row => row.trim() !== '');
      if (rows.length < 2) throw new Error("CSV file must contain headers and at least one row of data.");

      // 2. Safe Row Parser (Ignores commas inside of quotation marks)
      const parseRow = (row: string) => {
        const regex = /(?:"([^"]*(?:""[^"]*)*)"|([^,]+))/g;
        let matches;
        const cols: string[] = [];
        while ((matches = regex.exec(row)) !== null) {
          let val = matches[1] || matches[2] || '';
          cols.push(val.replace(/""/g, '"').trim());
        }
        return cols;
      };

      // 3. Map the column headers so the order doesn't matter
      const headers = parseRow(rows[0]).map(h => h.toLowerCase());
      const getIdx = (aliases: string[]) => headers.findIndex(h => aliases.some(a => h.includes(a)));
      
      const titleIdx = getIdx(['title']);
      const ytIdx = getIdx(['youtubeid', 'youtube']);
      const spotIdx = getIdx(['spotifyurl', 'spotify']);
      const headlineIdx = getIdx(['headline']);
      const fullDescIdx = getIdx(['fulldescription', 'description']);
      const guestIdx = getIdx(['guestname', 'guest']);
      const profilesIdx = getIdx(['guestprofiles', 'profiles']);
      const audienceIdx = getIdx(['targetaudience', 'audience']);
      const topicsIdx = getIdx(['topics']);
      const transcriptIdx = getIdx(['transcript']);
      const dateIdx = getIdx(['publisheddate', 'date']);
      const shortsIdx = getIdx(['isshort', 'short']);

      if (titleIdx === -1) {
        throw new Error("CSV must have at least a 'Title' column.");
      }

      let addedCount = 0;
      let skippedCount = 0;

      // 4. Loop through the data rows
      for (let i = 1; i < rows.length; i++) {
        const cols = parseRow(rows[i]);
        const getVal = (idx: number) => idx >= 0 && cols[idx] ? cols[idx] : "";
        
        const titleVal = getVal(titleIdx);
        const youtubeId = getVal(ytIdx);
        const spotifyUrl = getVal(spotIdx);

        if (!titleVal) continue; // Skip completely empty rows

        // 🛑 THE GATEKEEPER: DUPLICATE CHECKER
        const isDuplicate = existingVideos.some(v => 
          (youtubeId && v.youtubeId === youtubeId) || 
          (spotifyUrl && v.spotifyUrl === spotifyUrl) ||
          (v.title.toLowerCase() === titleVal.toLowerCase())
        );

        if (isDuplicate) {
          skippedCount++; // It exists! Skip it.
          continue; 
        }

        // 5. Build the new video object
        // (Checks if array items are separated by commas or semicolons)
        const profileStr = getVal(profilesIdx);
        const splitChar = profileStr.includes(';') ? ';' : ',';

        const newVideo: Omit<VideoEntry, 'id' | 'createdAt'> = {
          title: titleVal,
          youtubeId: youtubeId,
          spotifyUrl: spotifyUrl,
          headline: getVal(headlineIdx),
          fullDescription: getVal(fullDescIdx),
          guestName: getVal(guestIdx),
          publishedAt: getVal(dateIdx) || new Date().toISOString().split('T')[0],
          guestProfiles: profileStr.split(splitChar).map(s => s.trim()).filter(Boolean),
          topics: getVal(topicsIdx).split(splitChar).map(s => s.trim()).filter(Boolean),
          targetAudience: getVal(audienceIdx).split(splitChar).map(s => s.trim()).filter(Boolean),
          transcript: getVal(transcriptIdx),
          isShort: getVal(shortsIdx).toUpperCase() === 'Y' ? 'Y' : 'N'
        };

        // 6. Save it to the database!
        await onAdd(newVideo); 
        addedCount++;
      }

      // 7. Show the final results
      if (addedCount > 0 || skippedCount > 0) {
        setSuccessMsg(`Import complete! Added ${addedCount} new videos. (Skipped ${skippedCount} duplicates).`);
        if (addedCount > 0) {
          setTimeout(() => onClose(), 3000); // Close modal automatically after 3 seconds
        }
      } else {
        setError("No new videos found to import. All rows were duplicates or invalid.");
      }

    } catch (err: any) {
      setError(err.message || "Failed to parse CSV file. Please check the formatting.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    if (!editVideo) {
       setUrl('');
       setSpotifyUrl('');
       setTitle('');
       setIsShort('N');
    }
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  const isEditMode = !!editVideo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Youtube size={20} />
             </div>
             <h2 className="text-xl font-bold text-gray-900">
               {isEditMode ? 'Edit Video Metadata' : 'Add Podcast Episode'}
             </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {!isEditMode && (
          <div className="flex border-b border-gray-100 px-6">
              <button onClick={() => handleTabChange('single')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'single' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <LinkIcon size={16} /> Single Video
              </button>
              <button onClick={() => handleTabChange('bulk')} className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'bulk' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  <FileText size={16} /> Bulk Import
              </button>
          </div>
        )}

        <div className="overflow-y-auto p-6 flex-grow">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}
            {successMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">{successMsg}</div>}

            {activeTab === 'single' ? (
                <form id="video-form" onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">YouTube Link</label>
                          <input type="text" disabled={isEditMode && !!editVideo.youtubeId} placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Spotify Link</label>
                          <input type="text" placeholder="https://open.spotify.com/episode/..." value={spotifyUrl} onChange={(e) => setSpotifyUrl(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Episode Title</label>
                          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" required />
                      </div>
                    </div>

                    <div className="flex items-center gap-6 py-2 border-y border-gray-50">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={isShort === 'Y'} 
                              onChange={(e) => setIsShort(e.target.checked ? 'Y' : 'N')}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            />
                            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                <Zap size={14} className={isShort === 'Y' ? 'text-red-500' : 'text-gray-400'} />
                                Short?
                            </span>
                        </label>
                    </div>

                    <div>
                       <div className="flex gap-4 mb-2 border-b border-gray-100">
                          <button type="button" onClick={() => setEditSection('details')} className={`pb-2 text-sm font-medium ${editSection === 'details' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Metadata & Description</button>
                          <button type="button" onClick={() => setEditSection('transcript')} className={`pb-2 text-sm font-medium ${editSection === 'transcript' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Transcript (Optional)</button>
                       </div>
                       {editSection === 'details' ? (
                         <div className="space-y-4">
                           <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Headline (Short Description)</label>
                              <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Short 1-2 sentence summary..." />
                           </div>
                           <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
                              <textarea value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} rows={6} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Detailed description..." />
                           </div>
                         </div>
                       ) : (
                         <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={8} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs" placeholder="Paste transcript here..." />
                       )}
                    </div>

                    <div className="flex justify-end">
                        <button type="button" onClick={handleAnalyzeSingle} disabled={isAnalyzing || (!title && !url)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md text-sm">
                            {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                            {isAnalyzing ? 'Analyzing...' : 'Auto-Generate Metadata'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                            <input type="text" placeholder="e.g. Jane Doe" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Published Date</label>
                            <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        
                        <div className="relative">
                            <MultiSelectInput 
                              label="Job Profiles"
                              icon={Briefcase}
                              value={guestProfiles} 
                              options={availableProfiles}
                              onChange={(val) => setGuestProfiles(val)}
                              placeholder="e.g. Salesperson, CEO"
                            />
                        </div>
                        <div className="relative">
                            <MultiSelectInput 
                              label="Target Audience"
                              icon={Users}
                              value={targetAudience} 
                              options={availableAudiences}
                              onChange={(val) => setTargetAudience(val)}
                              placeholder="e.g. Entry Level, Candidates"
                            />
                        </div>
                        <div className="md:col-span-2 relative">
                            <MultiSelectInput 
                              label="Topics"
                              icon={Tag}
                              value={topics} 
                              options={availableTopics}
                              onChange={(val) => setTopics(val)}
                              placeholder="e.g. Interviewing, Salary"
                            />
                        </div>
                    </div>
                </form>
            ) : (
                <div className="space-y-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCsvUpload} className="hidden" />
                        <div className="flex flex-col items-center gap-2">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Upload size={24} /></div>
                            <h3 className="font-semibold text-gray-900">Upload CSV</h3>
                            <p className="text-sm text-gray-500 mb-2">Must contain Title and YouTube/Spotify URL columns.</p>
                            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">Select File</button>
                        </div>
                    </div>
                    <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-semibold">Or paste text</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>
                    <div className="space-y-2">
                        <textarea placeholder="Paste list here..." value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={8} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" />
                    </div>
                </div>
            )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
            <div>
              {isEditMode && <button type="button" onClick={handleDelete} className="text-red-500 hover:text-red-700 text-sm font-medium underline hover:no-underline px-2 py-1">Delete Video</button>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-gray-600 hover:bg-gray-200 font-medium transition-colors">Cancel</button>
              {activeTab === 'single' ? (
                  <button 
                   type="submit" 
                   form="video-form" // 👈 Ensure this matches <form id="video-form" ...>
                   className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg..."
                  >
                  {isEditMode ? 'Save Changes' : 'Add Video'}
                  </button>
              ) : (
                  <button type="button" onClick={handleBulkSubmit} disabled={isAnalyzing || !bulkText} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition-colors disabled:opacity-50">
                      {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                      Process Text
                  </button>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

function setIsLoading(arg0: boolean) {
  throw new Error('Function not implemented.');
}
