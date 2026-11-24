import React, { useState } from 'react';
import { FilterState, VideoEntry } from '../types';
import { Filter, X, Zap, LayoutGrid, PlaySquare, ChevronDown, ChevronRight } from 'lucide-react';
import { logEvent } from '../services/logger';

interface FilterSidebarProps {
  videos: VideoEntry[];
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  availableProfiles: string[];
  availableTopics: string[];
  availableAudiences: string[];
  isOpenMobile: boolean;
  closeMobile: () => void;
}

type ListKey = 'selectedProfiles' | 'selectedTopics' | 'selectedAudiences';

// One collapsible group of checkboxes (Guest Profile, Topics, Target Audience)
const FilterSection: React.FC<{
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  color: { box: string; text: string; badge: string };
}> = ({ title, options, selected, onToggle, color }) => {
  const [open, setOpen] = useState(false);
  if (options.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </span>
        {selected.length > 0 && (
          <span className={`normal-case tracking-normal font-semibold px-1.5 py-0.5 rounded-full text-[10px] ${color.badge}`}>
            {selected.length} selected
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-2 mt-3">
          {options.map(option => {
            const checked = selected.includes(option);
            return (
              <label key={option} className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="hidden" checked={checked} onChange={() => onToggle(option)} />
                <div className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${checked ? color.box : 'border-gray-300'}`}>
                  {checked && <X size={10} className="text-white" />}
                </div>
                <span className={`text-sm ${checked ? `${color.text} font-medium` : 'text-gray-600'}`}>{option}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filterState, setFilterState, availableProfiles, availableTopics, availableAudiences, isOpenMobile, closeMobile
}) => {

  const toggle = (key: ListKey, value: string, logType: string) => {
    setFilterState(prev => {
      const isAdding = !prev[key].includes(value);
      if (isAdding) logEvent(logType, `Added ${logType.replace('FILTER_', '').toLowerCase()}: ${value}`);
      return {
        ...prev,
        [key]: isAdding ? [...prev[key], value] : prev[key].filter(v => v !== value)
      };
    });
  };

  const isActive = filterState.selectedProfiles.length > 0 ||
                   filterState.selectedTopics.length > 0 ||
                   filterState.selectedAudiences.length > 0 ||
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

      <div className="p-4 overflow-y-auto flex-grow space-y-6">

        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Video Type</h3>
          <div className="flex flex-col gap-1">
            <button onClick={() => setFilterState(p => ({...p, shortsFilter: 'all'}))} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${filterState.shortsFilter === 'all' ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:bg-gray-50'}`}><LayoutGrid size={14}/> All</button>
            <button onClick={() => setFilterState(p => ({...p, shortsFilter: 'videos'}))} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${filterState.shortsFilter === 'videos' ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:bg-gray-50'}`}><PlaySquare size={14}/> Full Episodes</button>
            <button onClick={() => setFilterState(p => ({...p, shortsFilter: 'shorts'}))} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${filterState.shortsFilter === 'shorts' ? 'bg-amber-100 text-amber-900' : 'text-gray-600 hover:bg-gray-50'}`}><Zap size={14}/> Shorts Only</button>
          </div>
        </div>

        {isActive && (
          <button onClick={() => setFilterState(prev => ({ ...prev, selectedProfiles: [], selectedTopics: [], selectedAudiences: [], searchQuery: '', shortsFilter: 'all' }))} className="text-xs text-red-500 font-medium flex items-center gap-1">
            <X size={12} /> Clear all filters
          </button>
        )}

        <FilterSection
          title="Guest Profile"
          options={availableProfiles}
          selected={filterState.selectedProfiles}
          onToggle={(v) => toggle('selectedProfiles', v, 'FILTER_PROFILE')}
          color={{ box: 'bg-blue-600 border-blue-600', text: 'text-blue-700', badge: 'bg-blue-50 text-blue-700' }}
        />

        <FilterSection
          title="Topics"
          options={availableTopics}
          selected={filterState.selectedTopics}
          onToggle={(v) => toggle('selectedTopics', v, 'FILTER_TOPIC')}
          color={{ box: 'bg-emerald-600 border-emerald-600', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700' }}
        />

        <FilterSection
          title="Target Audience"
          options={availableAudiences}
          selected={filterState.selectedAudiences}
          onToggle={(v) => toggle('selectedAudiences', v, 'FILTER_AUDIENCE')}
          color={{ box: 'bg-purple-600 border-purple-600', text: 'text-purple-700', badge: 'bg-purple-50 text-purple-700' }}
        />
      </div>
    </div>
  );
};
