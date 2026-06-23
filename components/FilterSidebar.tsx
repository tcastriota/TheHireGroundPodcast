import React from 'react';
import { FilterState, VideoEntry } from '../types';
import { Search, Filter, X, Zap, LayoutGrid, PlaySquare } from 'lucide-react';
import { logEvent } from '../services/logger';

interface FilterSidebarProps {
  videos: VideoEntry[];
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  availableProfiles: string[];
  availableTopics: string[];
  isOpenMobile: boolean;
  closeMobile: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({ 
  filterState, setFilterState, availableProfiles, availableTopics, isOpenMobile, closeMobile
}) => {
  
  const toggleProfile = (profile: string) => {
    setFilterState(prev => {
      const isAdding = !prev.selectedProfiles.includes(profile);
      if (isAdding) logEvent('FILTER_PROFILE', `Added profile: ${profile}`);
      return {
        ...prev,
        selectedProfiles: isAdding
          ? [...prev.selectedProfiles, profile]
          : prev.selectedProfiles.filter(p => p !== profile)
      };
    });
  };

  const toggleTopic = (topic: string) => {
    setFilterState(prev => {
      const isAdding = !prev.selectedTopics.includes(topic);
      if (isAdding) logEvent('FILTER_TOPIC', `Added topic: ${topic}`);
      return {
        ...prev,
        selectedTopics: isAdding
          ? [...prev.selectedTopics, topic]
          : prev.selectedTopics.filter(t => t !== topic)
      };
    });
  };

  const isActive = filterState.selectedProfiles.length > 0 || 
                   filterState.selectedTopics.length > 0 || 
                   filterState.searchQuery.length > 0 ||
                   filterState.shortsFilter !== 'all';

  return (
    <div className="w-full bg-white flex flex-col h-full border-r border-gray-200">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Filter size={20} className="text-blue-600"/>
          Directory
        </h2>
        {/* Only show close button on mobile */}
        <button onClick={closeMobile} className="p-2 text-gray-400 hover:text-gray-600 lg:hidden">
          <X size={24} />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-grow space-y-8">
       

        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Video Type</h3>
          <div className="flex flex-col gap-1">
            <button onClick={() => setFilterState(p => ({...p, shortsFilter: 'all'}))} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${filterState.shortsFilter === 'all' ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:bg-gray-50'}`}><LayoutGrid size={14}/> All</button>
            <button onClick={() => setFilterState(p => ({...p, shortsFilter: 'videos'}))} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${filterState.shortsFilter === 'videos' ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:bg-gray-50'}`}><PlaySquare size={14}/> Full Episodes</button>
            <button onClick={() => setFilterState(p => ({...p, shortsFilter: 'shorts'}))} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${filterState.shortsFilter === 'shorts' ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:bg-gray-50'}`}><Zap size={14}/> Shorts Only</button>
          </div>
        </div>

        {isActive && (
          <button onClick={() => setFilterState(prev => ({ ...prev, selectedProfiles: [], selectedTopics: [], searchQuery: '', shortsFilter: 'all' }))} className="text-xs text-red-500 font-medium flex items-center gap-1">
            <X size={12} /> Clear all filters
          </button>
        )}

        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Guest Profile</h3>
          <div className="space-y-2">
            {availableProfiles.map(profile => (
              <label key={profile} className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="hidden" checked={filterState.selectedProfiles.includes(profile)} onChange={() => toggleProfile(profile)} />
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${filterState.selectedProfiles.includes(profile) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {filterState.selectedProfiles.includes(profile) && <X size={10} className="text-white" />}
                </div>
                <span className={`text-sm ${filterState.selectedProfiles.includes(profile) ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>{profile}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Topics</h3>
          <div className="space-y-2">
            {availableTopics.map(topic => (
              <label key={topic} className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="hidden" checked={filterState.selectedTopics.includes(topic)} onChange={() => toggleTopic(topic)} />
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${filterState.selectedTopics.includes(topic) ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`}>
                  {filterState.selectedTopics.includes(topic) && <X size={10} className="text-white" />}
                </div>
                <span className={`text-sm ${filterState.selectedTopics.includes(topic) ? 'text-emerald-700 font-medium' : 'text-gray-600'}`}>{topic}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};