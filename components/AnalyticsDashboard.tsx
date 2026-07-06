import React, { useEffect, useState } from 'react';
import { getMarketingStats, MarketingStats, syncLogsWithCloud } from '../services/logger';
import { 
  TrendingUp, 
  Globe, 
  Users, 
  Search, 
  MousePointer2, 
  Calendar,
  BarChart3,
  Target
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const loadAndSyncStats = async () => {
      setIsSyncing(true);
      try {
        // Fetch all logs from Firestore and compute stats directly from cloud data
        const cloudLogs = await syncLogsWithCloud();
        setStats(getMarketingStats(cloudLogs));
      } catch (error) {
        console.error("Dashboard Sync Failed:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    loadAndSyncStats();
  }, []);

  if (isSyncing) return (
    <div className="p-20 text-center space-y-4">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      <p className="text-gray-500 font-medium">Syncing Cloud Intelligence...</p>
    </div>
  );

  if (!stats) return <div className="p-10 text-center text-gray-500">No analytics data available.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-24 space-y-8 animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-blue-600" />
            Marketing Intelligence
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Real-time insights on audience engagement, geographic reach, and content demand.
          </p>
        </div>
        <div className="text-right">
           <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Sessions</span>
           <p className="text-3xl font-extrabold text-gray-900">{stats.totalSessions}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Top Country" 
          value={stats.topCountries[0]?.name || 'N/A'} 
          subValue={`${stats.topCountries[0]?.count || 0} sessions`}
          icon={Globe}
          color="blue"
        />
        <KpiCard 
          title="Top Interest (Profile)" 
          value={stats.topProfiles[0]?.name || 'N/A'} 
          subValue={`${stats.topProfiles[0]?.count || 0} filters`}
          icon={Users}
          color="emerald"
        />
        <KpiCard 
          title="Top Topic" 
          value={stats.topTopics[0]?.name || 'N/A'} 
          subValue={`${stats.topTopics[0]?.count || 0} filters`}
          icon={Target}
          color="violet"
        />
        <KpiCard 
          title="Engagement (Clicks)" 
          value={(stats.conversionEvents.reduce((acc, curr) => acc + curr.count, 0)).toString()} 
          subValue="Watch/Listen Actions"
          icon={MousePointer2}
          color="amber"
        />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Daily Traffic Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            Session Traffic (Last 14 Active Days)
          </h3>
          <div className="h-64 flex items-end gap-2 sm:gap-4">
            {stats.dailyActivity.length > 0 ? (
                stats.dailyActivity.map((day, i) => {
                    const max = Math.max(...stats.dailyActivity.map(d => d.count), 1);
                    const heightPct = (day.count / max) * 100;
                    return (
                        <div key={i} className="flex-1 flex flex-col justify-end group relative">
                            <div 
                                style={{ height: `${heightPct}%` }} 
                                className="w-full bg-blue-100 border-t-2 border-blue-500 rounded-t-sm group-hover:bg-blue-200 transition-all relative"
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10">
                                    {day.count} Sessions
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-2 text-center rotate-45 sm:rotate-0 origin-left truncate">{day.date.slice(5)}</span>
                        </div>
                    )
                })
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm italic">No traffic data yet</div>
            )}
          </div>
        </div>

        {/* Demand Analysis (Horizontal Bars) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400" />
            Content Demand
          </h3>
          
          <div className="space-y-6">
            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Top Profiles Requested</h4>
                <div className="space-y-2">
                    {stats.topProfiles.length > 0 ? stats.topProfiles.slice(0,5).map((p, i) => (
                        <ProgressBar key={i} label={p.name} count={p.count} total={Math.max(...stats.topProfiles.map(x => x.count), 1)} color="bg-emerald-500" />
                    )) : <p className="text-sm text-gray-400 italic">No profile filters used yet</p>}
                </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Top Topics Requested</h4>
                <div className="space-y-2">
                    {stats.topTopics.length > 0 ? stats.topTopics.slice(0,5).map((t, i) => (
                        <ProgressBar key={i} label={t.name} count={t.count} total={Math.max(...stats.topTopics.map(x => x.count), 1)} color="bg-violet-500" />
                    )) : <p className="text-sm text-gray-400 italic">No topic filters used yet</p>}
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Search Intent Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Search size={18} className="text-blue-600" />
                    Search Intent Analysis
                </h3>
                <p className="text-sm text-gray-500">What users are typing into the AI or Search bar. Use this to identify content gaps.</p>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th className="px-6 py-3">Query / Prompt</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3 text-right">Time</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {stats.recentSearches.length > 0 ? (
                        stats.recentSearches.slice(0, 15).map((search, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-3 text-sm font-medium text-gray-900">"{search.query}"</td>
                                <td className="px-6 py-3 text-sm">
                                    {search.resultsCount === -1 ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Keyword Search</span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                            <Search size={10} /> AI Semantic
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-500 text-right font-mono text-xs">
                                    {new Date(search.timestamp).toLocaleDateString()} {new Date(search.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic">No search data recorded yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

// --- Sub Components ---

interface KpiCardProps {
  title: string;
  value: string;
  subValue: string;
  icon: any;
  color: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, subValue, icon: Icon, color }) => {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        violet: 'bg-violet-50 text-violet-600',
        amber: 'bg-amber-50 text-amber-600',
    };

    return (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</span>
                <div className={`p-2 rounded-lg ${colorClasses[color] || 'bg-gray-100'}`}>
                    <Icon size={18} />
                </div>
            </div>
            <div className="text-xl font-bold text-gray-900 truncate" title={value}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{subValue}</div>
        </div>
    );
};

interface ProgressBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, count, total, color }) => {
    const pct = Math.max(5, (count / total) * 100); 
    return (
        <div className="relative pt-1">
            <div className="flex mb-1 items-center justify-between">
                <span className="text-xs font-medium text-gray-700 truncate max-w-[70%]">{label}</span>
                <span className="text-xs font-semibold text-gray-900">{count}</span>
            </div>
            <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-100">
                <div style={{ width: `${pct}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${color} transition-all duration-500`}></div>
            </div>
        </div>
    );
};