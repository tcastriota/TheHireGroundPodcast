import React, { useState, useEffect, useMemo } from 'react';
import { VideoEntry, FilterState } from './types';
import { FilterSidebar } from './components/FilterSidebar';
import { VideoCard, ViewMode } from './components/VideoCard';
import { videoStorage } from './services/storage';
import { AddVideoModal } from './components/AddVideoModal';
import { 
  Sparkles, Mic, ArrowDown, ArrowUp, Lock, Plus, List, LayoutGrid, Grid, Layout, Menu, X, Loader2, 
  BookOpen, BarChart3, Tags, Settings, Download, FileJson, UploadCloud, 
  RefreshCcw, Database, FileSpreadsheet 
} from 'lucide-react';
import { searchVideosWithAI } from './services/geminiService';
import { logEvent, getLogs, initLoggerSession, syncLogsWithCloud, downloadLogsAsCsv, downloadLogsAsJson } from './services/logger';
import { Documentation } from './components/Documentation';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { TagManager } from './components/TagManager';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './services/firebase';

const App: React.FC = () => {

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    selectedProfiles: [],
    selectedTopics: [],
    aiSearchActive: false,
    shortsFilter: 'all'
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoEntry | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [showOutdatedModal, setShowOutdatedModal] = useState(
    window.location.hostname.includes('221885926112')
  );

  const [view, setView] = useState<'directory' | 'docs' | 'analytics' | 'tags'>('directory');
  
  const [aiQuery, setAiQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiResultIds, setAiResultIds] = useState<string[] | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 'desc' is Latest First
  const jsonUploadRef = React.useRef<HTMLInputElement>(null);
  const csvUploadRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    const initApp = async () => {
      try {
        const fetched = await videoStorage.getAll();
        setVideos(fetched);

        // Sync Cloud Logs and initialize GeoData (run in background, don't block loading)
        syncLogsWithCloud();
        initLoggerSession();
      } catch (e) { 
        console.error(e); 
      } finally { 
        setIsLoading(false); 
      }
    };
    initApp();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, 'admin@thehireground.com', passwordInput);
      setIsAdminMode(true);
      setShowPasswordModal(false);
      setPasswordError(false);
      setPasswordInput('');
      logEvent('ADMIN_LOGIN_SUCCESS', 'User logged in as admin');
    } catch (error) {
      console.error("Login failed", error);
      setPasswordError(true); 
    }
  };

  const allProfiles = useMemo(() => Array.from(new Set(videos.flatMap(v => v.guestProfiles || []))).sort(), [videos]);
  const allTopics = useMemo(() => Array.from(new Set(videos.flatMap(v => v.topics || []))).sort(), [videos]);
  const allAudiences = useMemo(() => Array.from(new Set(videos.flatMap(v => v.targetAudience || []))).sort(), [videos]);

  const handleAiSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiQuery.trim()) return;

    setIsAiSearching(true);
    setFilterState(prev => ({ ...prev, searchQuery: '', aiSearchActive: false }));

    try {
        console.log("Sending to Gemini:", aiQuery);
        const ids = await searchVideosWithAI(aiQuery, videos);
        
        if (ids && ids.length > 0) {
            setAiResultIds(ids);
            setFilterState(prev => ({ ...prev, aiSearchActive: true }));
            logEvent('AI_SEARCH_SUCCESS', `Prompt: "${aiQuery}" | Found: ${ids.length}`);
        } else {
            alert("AI couldn't find matches. Try rephrasing!");
            setAiResultIds([]); 
            setFilterState(prev => ({ ...prev, aiSearchActive: true }));
            logEvent('AI_SEARCH_EMPTY', `Prompt: "${aiQuery}"`);
        }
    } catch (err: any) {
        console.error("AI Search CRASHED:", err);
        alert(`AI Error: ${err.message || 'Check console'}. Are you sure your API key is valid?`);
        setAiResultIds([]);
        setFilterState(prev => ({ ...prev, aiSearchActive: true }));
    } finally {
        setIsAiSearching(false);
    }
  };

  const clearAiSearch = () => {
    setAiQuery('');
    setAiResultIds(null);
    setFilterState(prev => ({ ...prev, aiSearchActive: false, searchQuery: '' }));
  };

  const filteredVideos = useMemo(() => {
    let result = videos;

    if (filterState.aiSearchActive && aiResultIds) {
      result = result.filter(v => aiResultIds.includes(v.id));
    } else if (filterState.searchQuery) {
      const q = filterState.searchQuery.toLowerCase();
      result = result.filter(v => 
        v.title.toLowerCase().includes(q) || 
        (v.guestName && v.guestName.toLowerCase().includes(q)) ||
        (v.topics && v.topics.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (filterState.selectedProfiles.length > 0) {
      result = result.filter(v => filterState.selectedProfiles.some(p => v.guestProfiles?.includes(p)));
    }

    if (filterState.selectedTopics.length > 0) {
      result = result.filter(v => filterState.selectedTopics.some(t => v.topics?.includes(t)));
    }

    if (filterState.shortsFilter === 'shorts') {
      result = result.filter(v => v.isShort === 'Y');
    } else if (filterState.shortsFilter === 'videos') {
      result = result.filter(v => v.isShort !== 'Y');
    }

   return result.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.createdAt).getTime();
      const dateB = new Date(b.publishedAt || b.createdAt).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  }, [videos, filterState, aiResultIds, sortOrder]);

  const downloadVideosAsJson = () => {
    const blob = new Blob([JSON.stringify(videos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hire_ground_db_backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
  };
  
  const downloadVideosAsCsv = () => {
    if (videos.length === 0) return;
    const headers = [
      "YouTubeID", "Title", "Headline", "FullDescription", "GuestName", 
      "GuestProfiles", "TargetAudience", "Topics", "Transcript", "PublishedDate", "IsShort", "SpotifyUrl"
    ];
    const rows = videos.map(v => [
      v.youtubeId,
      `"${(v.title || '').replace(/"/g, '""')}"`,
      `"${(v.headline || '').replace(/"/g, '""')}"`,
      `"${(v.fullDescription || '').replace(/"/g, '""')}"`,
      `"${(v.guestName || '').replace(/"/g, '""')}"`,
      `"${v.guestProfiles.join(', ')}"`,
      `"${(v.targetAudience || []).join(', ')}"`,
      `"${v.topics.join(', ')}"`,
      `"${(v.transcript || '').replace(/"/g, '""')}"`,
      v.publishedAt || '',
      v.isShort || 'N',
      v.spotifyUrl || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `hire_ground_videos_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleResetApp = async () => {
    if (window.confirm("⚠️ CLOUD FACTORY RESET ⚠️\n\nThis will permanently delete all documents in your Firestore database and restore the master catalog.\n\nAre you absolutely sure?")) {
        try {
            logEvent('ADMIN_FACTORY_RESET_START');
            await videoStorage.reset(); 
            
            // Clear session storage, but keep local storage logs safe
            sessionStorage.clear();
            
            const reloadUrl = window.location.origin + window.location.pathname + '?reset=' + Date.now();
            window.location.replace(reloadUrl);
        } catch (e) {
            console.error("Firestore Reset failed", e);
            alert("Failed to reset the database. Check console for Firebase errors.");
        }
    }
  };

  const handleVideoAdd = async (newVideo: Omit<VideoEntry, 'id' | 'createdAt'>) => {
      const completeVideo: VideoEntry = {
          ...newVideo,
          id: crypto.randomUUID(),
          createdAt: Date.now()
      };
      
      const updatedList = await videoStorage.add(completeVideo); 
      setVideos(updatedList);
      setIsModalOpen(false);
  };
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvText = event.target?.result as string;
        // Split by newlines, handling both Windows and Mac line endings
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length < 2) throw new Error("CSV is empty or missing data rows.");

        // Custom parser to handle Google Sheets quoting (e.g., "Hello, World")
        const parseRow = (str: string) => {
            const result = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < str.length; i++) {
                if (inQuotes) {
                    if (str[i] === '"' && str[i + 1] === '"') { cur += '"'; i++; } // Escaped quote
                    else if (str[i] === '"') { inQuotes = false; }
                    else { cur += str[i]; }
                } else {
                    if (str[i] === '"') { inQuotes = true; }
                    else if (str[i] === ',') { result.push(cur.trim()); cur = ''; }
                    else { cur += str[i]; }
                }
            }
            result.push(cur.trim());
            return result;
        };

        // Normalize headers to lowercase, removing spaces/special characters for easy matching
        const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const parsedVideos: VideoEntry[] = [];

        for (let i = 1; i < lines.length; i++) {
          const row = parseRow(lines[i]);
          if (row.length < 2) continue; // Skip empty/malformed rows

          // Helper to find the right column regardless of slight naming variations in the CSV
          const getVal = (possibleNames: string[]) => {
             const idx = headers.findIndex(h => possibleNames.some(n => h.includes(n)));
             return idx !== -1 ? (row[idx] ?? '') : '';
          };

          // Helper to parse comma or pipe-separated lists in a single cell
          const parseArray = (val: string) => val.split(/[,|]/).map(s => s.trim()).filter(s => s !== '');

          const video: VideoEntry = {
            id: crypto.randomUUID(),
            title: getVal(['title']),
            headline: getVal(['headline']),
            fullDescription: getVal(['description', 'fulldescription']),
            guestName: getVal(['guest', 'guestname']),
            isShort: getVal(['isshort', 'short']).toUpperCase() === 'Y' ? 'Y' : 'N',
            youtubeId: getVal(['youtube', 'youtubeid', 'videoid']),
            spotifyUrl: getVal(['spotify', 'spotifyurl']),
            guestProfiles: parseArray(getVal(['profile', 'guestprofile', 'guestprofiles'])),
            targetAudience: parseArray(getVal(['audience', 'targetaudience'])),
            topics: parseArray(getVal(['topic', 'topics'])),
            createdAt: Date.now()
          };

          // Only stage the video if it has the bare minimum requirements
          if (video.title && video.youtubeId) {
              parsedVideos.push(video);
          }
        }

        if (parsedVideos.length === 0) {
            throw new Error("No valid videos found. Ensure your CSV has 'Title' and 'YouTubeID' columns.");
        }

        // Send to our storage batcher (which skips duplicates automatically!)
        const updatedList = await videoStorage.bulkAdd(parsedVideos);
        setVideos(updatedList);
        
        alert(`Success! Processed ${parsedVideos.length} valid rows from CSV. Duplicates were safely skipped.`);

      } catch (error: any) {
        console.error("CSV Upload failed:", error);
        alert(`Upload failed: ${error.message}`);
      }
    };
    
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const importedVideos: VideoEntry[] = Array.isArray(json)
        ? json
        : Array.isArray(json.videos)
          ? json.videos
          : Array.isArray(json.data?.videos)
            ? json.data.videos
            : Array.isArray(json.items)
              ? json.items
              : Array.isArray(json.documents)
                ? json.documents
                : [];

      if (!importedVideos || importedVideos.length === 0) {
        throw new Error("No videos found in JSON file. Expected an array of video objects or a JSON object with a 'videos' array.");
      }

      const validVideos = importedVideos.filter((item: any) => item && (item.youtubeId || item.YouTubeID || item.youtubeID) && (item.title || item.Title));
      if (validVideos.length === 0) {
        throw new Error("Uploaded JSON contains no valid video records. Each item should include at least 'youtubeId' and 'title'.");
      }

      const normalizedVideos = validVideos.map((item: any) => ({
        ...item,
        youtubeId: item.youtubeId || item.YouTubeID || item.youtubeID || item.videoId || item.videoID || '',
        title: item.title || item.Title || '',
        headline: item.headline || item.Headline || item.headline || '',
        description: item.description || item.Description || item.fullDescription || item.FullDescription || '',
        fullDescription: item.fullDescription || item.FullDescription || item.description || item.Description || '',
        guestName: item.guestName || item.GuestName || item.guest || item.Guest || '',
        guestProfiles: item.guestProfiles || item.GuestProfiles || item.guestProfile || item.GuestProfile || [],
        targetAudience: item.targetAudience || item.TargetAudience || item.audience || item.Audience || [],
        topics: item.topics || item.Topics || [],
        transcript: item.transcript || item.Transcript || '',
        spotifyUrl: item.spotifyUrl || item.SpotifyUrl || item.spotifyURL || item.SpotifyURL || '',
        publishedAt: item.publishedAt || item.PublishedDate || item.PublishedAt || '',
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : (item.createdAt ? Date.parse(item.createdAt as string) || Date.now() : Date.now()),
        isShort: ['Y', 'N'].includes(item.isShort) ? item.isShort : ['Y', 'N'].includes(item.is_short) ? item.is_short : ['Y', 'N'].includes(item.IsShort) ? item.IsShort : ['Y', 'N'].includes(item.Short) ? item.Short : undefined,
        id: item.id || crypto.randomUUID(),
      })) as VideoEntry[];

      const updatedList = await videoStorage.bulkAdd(normalizedVideos);
      setVideos(updatedList);
      console.log(`JSON upload complete, refreshed videos count: ${updatedList.length}`);
      alert(`Success! Imported ${normalizedVideos.length} videos from JSON backup.`);
    } catch (error: any) {
      console.error("JSON Import failed:", error);
      alert(`JSON Import failed: ${error.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleVideoUpdate = async (id: string, updates: Partial<VideoEntry>) => {
      const updatedList = await videoStorage.update(id, updates);
      setVideos(updatedList); 
      if (isModalOpen) {
          setIsModalOpen(false);
          setEditingVideo(null);
      }
  };

  const handleVideoDelete = async (id: string) => {
      if (window.confirm("Are you sure you want to permanently delete this episode?")) {
          const updatedList = await videoStorage.delete(id);
          setVideos(updatedList);
          setIsModalOpen(false);
          setEditingVideo(null);
      }
  };

  if (isLoading) return <div className="h-screen flex flex-col items-center justify-center gap-4">
    <Loader2 className="animate-spin text-amber-500" size={40} />
    <p className="text-gray-500 font-medium">Loading Directory...</p>
  </div>;

  return (
  <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden relative">
    
    {/* 1. RESPONSIVE SIDEBAR */}
    <div className={`
      fixed inset-y-0 left-0 z-50 bg-white transform transition-all duration-300 ease-in-out
      lg:relative lg:translate-x-0 lg:z-20 shrink-0
      ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl w-72' : '-translate-x-full w-72'}
      ${isSidebarCollapsed ? 'lg:w-0 lg:overflow-hidden' : 'lg:w-72'}
    `}>
      <FilterSidebar
        videos={videos}
        filterState={filterState}
        setFilterState={setFilterState}
        availableProfiles={allProfiles}
        availableTopics={allTopics}
        isOpenMobile={isMobileMenuOpen}
        closeMobile={() => setIsMobileMenuOpen(false)}
      />
    </div>

    {/* Desktop sidebar toggle button */}
    <button
      onClick={() => setIsSidebarCollapsed(prev => !prev)}
      className="hidden lg:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 z-30 w-5 h-12 bg-white border border-gray-200 rounded-r-lg shadow-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
      style={{ left: isSidebarCollapsed ? '0px' : '288px' }}
      title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {isSidebarCollapsed ? '›' : '‹'}
    </button>

    {/* Mobile Backdrop */}
    {isMobileMenuOpen && (
      <div 
        className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" 
        onClick={() => setIsMobileMenuOpen(false)}
      />
    )}

    {/* 2. MAIN CONTENT AREA */}
    <div className="flex-1 flex flex-col min-w-0 h-full relative z-10">
      
      <header className="bg-white border-b border-gray-200 px-3 md:px-6 py-3 flex items-center justify-between shrink-0 relative z-30 gap-3 md:gap-6">
  
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden shrink-0">
            <Menu size={20} />
          </button>
          <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600 hidden sm:flex">
            <Mic size={18} />
          </div>
          <h1 className="font-bold text-base md:text-xl truncate hidden sm:block text-gray-900">The Hire Ground Podcast</h1>
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-center max-w-md ml-4">
          <form onSubmit={handleAiSearch} className="relative w-full flex items-center bg-white rounded-xl border border-gray-300 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all overflow-hidden h-10 md:h-12 group">
              <div className="pl-3 text-gray-400 flex items-center justify-center shrink-0">
                  {isAiSearching ? <Loader2 className="animate-spin text-blue-600" size={18} /> : <Sparkles className={`transition-colors ${aiResultIds ? "text-blue-600" : "text-gray-400 group-hover:text-blue-400"}`} size={18} />}
              </div>
              <input 
                  type="text" 
                  value={aiQuery}
                  onChange={(e) => {
                      const val = e.target.value;
                      setAiQuery(val);
                      setFilterState(prev => ({ ...prev, searchQuery: val, aiSearchActive: false }));
                      setAiResultIds(null);
                  }}
                  placeholder="Search episodes by title, guest, or topic..."
                  className="flex-1 px-3 h-full outline-none text-sm text-gray-700 placeholder-gray-400 min-w-0 bg-transparent"
              />
              {aiResultIds && (
                  <button type="button" onClick={clearAiSearch} className="px-3 h-full text-gray-400 hover:text-gray-600 border-l border-gray-100 flex items-center justify-center bg-gray-50 transition-colors shrink-0">
                      <X size={16} />
                  </button>
              )}
              <button type="submit" disabled={isAiSearching || !aiQuery.trim()} className="bg-gray-50 h-full hover:bg-gray-100 border-l border-gray-200 px-4 text-gray-600 font-medium text-sm transition-colors whitespace-nowrap disabled:opacity-50 shrink-0">
                  Search
              </button>
          </form>

          {/* New Sort Buttons */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl h-10 md:h-12 ml-2 overflow-hidden shadow-sm shrink-0">
              <button 
                  onClick={() => setSortOrder('desc')} 
                  className={`px-3 h-full flex items-center justify-center transition-colors ${sortOrder === 'desc' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
                  title="Latest First"
              >
                  <ArrowDown size={18} />
              </button>
              <div className="w-px h-full bg-gray-200"></div>
              <button 
                  onClick={() => setSortOrder('asc')} 
                  className={`px-3 h-full flex items-center justify-center transition-colors ${sortOrder === 'asc' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
                  title="Oldest First"
              >
                  <ArrowUp size={18} />
              </button>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
           {/* Original Amber Highlight Layout Buttons */}
           {view === 'directory' && (
             <div className="hidden sm:flex items-center bg-white p-0.5 rounded-lg border border-gray-200 overflow-hidden shadow-sm h-10">
                 <button 
                     onClick={() => setViewMode('list')} 
                     className={`px-3 h-full flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-amber-100 text-amber-400 font-bold' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`} 
                     title="List View"
                 >
                     <List size={18} />
                 </button>
                 <button 
                     onClick={() => setViewMode('gallery')} 
                     className={`px-3 h-full flex items-center justify-center transition-all ${viewMode === 'gallery' ? 'bg-amber-100 text-amber-400 font-bold' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`} 
                     title="Gallery View"
                 >
                     <Layout size={18} />
                 </button>
                 <button 
                     onClick={() => setViewMode('detailed')} 
                     className={`px-3 h-full flex items-center justify-center transition-all ${viewMode === 'detailed' ? 'bg-amber-100 text-amber-400 font-bold' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`} 
                     title="Detailed View"
                 >
                     <Grid size={18} />
                 </button>
             </div>
          )}
           
          {/* Admin Controls */}
          {isAdminMode ? (
            <div className="flex items-center gap-1 md:gap-2 relative">
              {/* Dashboard Tabs */}
              <button onClick={() => setView('analytics')} className={`p-2 rounded-lg hover:bg-gray-100 text-gray-500 hidden lg:block transition-colors ${view === 'analytics' ? 'bg-blue-50 text-blue-600' : ''}`}><BarChart3 size={18} /></button>
              <button onClick={() => setView('tags')} className={`p-2 rounded-lg hover:bg-gray-100 text-gray-500 hidden lg:block transition-colors ${view === 'tags' ? 'bg-blue-50 text-blue-600' : ''}`}><Tags size={18} /></button>
              <button onClick={() => setView('docs')} className={`p-2 rounded-lg hover:bg-gray-100 text-gray-500 hidden lg:block transition-colors ${view === 'docs' ? 'bg-blue-50 text-blue-600' : ''}`}><BookOpen size={18} /></button>
              
              <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white p-2 md:px-4 md:py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0">
                <Plus size={18} /> <span className="hidden md:inline text-sm font-bold">Add</span>
              </button>

              {/* Settings Dropdown */}
              <div className="relative flex items-center h-10 shrink-0">
                  <button 
                      onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                      className={`p-2 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors ${isSettingsOpen ? 'bg-gray-100 text-blue-600' : ''}`}
                  >
                      <Settings size={20} />
                  </button>
                  
                  {isSettingsOpen && (
                      <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                          <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 animate-slideDown origin-top-right">
                              <div className="p-2 space-y-1">
                                  
                                  {/* System Section */}
                                  <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">System</div>
                                  <button onClick={() => { setShowPublishModal(true); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2">
                                      <UploadCloud size={14} className="text-green-600" /> Publish Updates
                                  </button>
                                  <button onClick={() => { handleResetApp(); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                                      <RefreshCcw size={14} className="text-red-600" /> Factory Reset
                                  </button>
                                  
                                  <div className="h-px bg-gray-100 my-1"></div>
                                  
                                  {/* Data Export Section */}
                                  <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Data Import</div>

                                  <button onClick={() => jsonUploadRef.current?.click()} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 cursor-pointer">
                                    <UploadCloud size={14} className="text-blue-600" /> Upload (JSON Backup)
                                  </button>

                                  <button onClick={() => csvUploadRef.current?.click()} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 cursor-pointer">
                                    <UploadCloud size={14} className="text-purple-600" /> Upload (CSV)
                                  </button>

                                  <div className="h-px bg-gray-100 my-1"></div>
                                  <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Data Export</div>
                                  <button onClick={() => { downloadVideosAsCsv(); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2">
                                      <Database size={14} className="text-blue-600" /> Export Videos (CSV)
                                  </button>
                                  <button onClick={() => { downloadVideosAsJson(); setIsSettingsOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2">
                                      <FileJson size={14} className="text-indigo-600" /> Backup Database (JSON)
                                  </button>
                                  
                                  <div className="h-px bg-gray-100 my-1"></div>
                                  
                                  {/* Logs Section */}
                                  <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Logs</div>
                                  <button onClick={() => { downloadLogsAsCsv().then(() => setIsSettingsOpen(false)); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2">
                                      <FileSpreadsheet size={14} className="text-emerald-600" /> Activity Logs (CSV)
                                  </button>
                                  <button onClick={() => { downloadLogsAsJson().then(() => setIsSettingsOpen(false)); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2">
                                      <FileJson size={14} className="text-amber-600" /> Save Logs (logFile.json)
                                  </button>

                                  <div className="h-px bg-gray-100 my-1"></div>
                                  
                                  {/* Exit Admin */}
                                  <button onClick={() => { setIsAdminMode(false); setIsSettingsOpen(false); setView('directory'); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors">
                                    Exit Admin
                                    </button>
                              </div>
                          </div>
                      </>
                  )}
              </div>
            </div>
          ) : (
            <button onClick={() => setShowPasswordModal(true)} className="text-gray-400 hover:text-gray-600 p-2 flex items-center gap-1.5 transition-colors shrink-0">
              <Lock size={18} /> <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* VIDEO FEED */}
      <main className="flex-1 overflow-y-auto p-3 md:p-6 bg-gray-50 relative z-10">
        {view === 'directory' && (
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 md:mb-6">
                <p className="text-xs md:text-sm text-gray-500 font-medium">
                  Found <span className="text-blue-600 font-bold">{filteredVideos.length}</span> episodes
                  {filterState.aiSearchActive && <span className="ml-2 text-blue-600 font-medium">(AI Filter Active)</span>}
                </p>
            </div>

            {filteredVideos.length > 0 ? (
          <div className={`grid gap-4 md:gap-6 ${
              viewMode === 'list' ? 'grid-cols-1' : 
              viewMode === 'gallery' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 
              'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
          }`}>
              {filteredVideos.map(video => (
                  <VideoCard 
                      key={video.id} 
                      video={video} 
                      isAdmin={isAdminMode} 
                      onEdit={() => { setEditingVideo(video); setIsModalOpen(true); }}
                      viewMode={viewMode}
                  />
              ))}
          </div>
      ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">No episodes found</h3>
                  <p className="text-gray-500 max-w-sm mx-auto">Try adjusting your filters or search query.</p>
                  {aiQuery && <button onClick={clearAiSearch} className="mt-4 text-blue-600 font-medium hover:underline">Clear Search</button>}
              </div>
            )}
          </div>
        )}

        {view === 'analytics' && <AnalyticsDashboard />}
        {view === 'tags' && <TagManager videos={videos} onUpdate={handleVideoUpdate} />}
        {view === 'docs' && <Documentation />}
      </main>
    </div>

    {/* Hidden file inputs — must live outside dropdown so onChange fires reliably */}
    <input ref={jsonUploadRef} type="file" accept=".json" className="hidden" onChange={handleJsonUpload} />
    <input ref={csvUploadRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />

    {/* MODALS */}
    {showPasswordModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
          <h2 className="text-lg font-bold mb-4">Admin Login</h2>
          <form onSubmit={handleAdminLogin}>
            <input 
              type="password" 
              autoFocus
              className="w-full border border-gray-200 p-2.5 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password..."
            />
            {passwordError && <p className="text-red-500 text-xs mb-3">Incorrect password.</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-gray-500 text-sm font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all">Login</button>
            </div>
          </form>
        </div>
      </div>
    )}

    {showOutdatedModal && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/90 backdrop-blur-sm p-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center">
          <div className="mb-5 text-gray-800">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Out of Date Version</h2>
          <p className="text-gray-500 text-sm mb-7 leading-relaxed">
            This is an out of date version of the prototype. Do you want me to redirect you to the latest version?
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => window.close()}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close Window
            </button>
            <button
              onClick={() => { window.location.href = 'https://thehiregroundpodcast-599900447713.us-east1.run.app/'; }}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              Yes, Redirect
            </button>
          </div>
        </div>
      </div>
    )}

    {isModalOpen && (
        <AddVideoModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingVideo(null); }}
          editVideo={editingVideo}
          existingVideos={videos}
          availableProfiles={allProfiles}
          availableTopics={allTopics}
          availableAudiences={allAudiences}
          onAdd={handleVideoAdd}
          onUpdate={handleVideoUpdate}
          onDelete={handleVideoDelete}
        />
      )}
  </div>
);
};

export default App;