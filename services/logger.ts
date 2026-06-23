import { videoStorage } from './storage';

export interface LogEntry {
  timestamp: string;
  easternTime: string;
  action: string;
  details?: string;
  session: {
    ip: string;
    city: string;
    region: string;
    country: string;
    userAgent: string;
    screenSize: string;
    referrer: string;
  };
}

export interface MarketingStats {
  totalSessions: number;
  topCountries: { name: string; count: number }[];
  topProfiles: { name: string; count: number }[];
  topTopics: { name: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
  recentSearches: { query: string; timestamp: string; resultsCount: number }[];
  conversionEvents: { name: string; count: number }[];
}

const LOG_KEY = 'hire_ground_activity_logs';

let currentSessionData = {
  ip: 'Loading...',
  city: 'Unknown',
  region: 'Unknown',
  country: 'Unknown',
  userAgent: navigator.userAgent,
  screenSize: `${window.innerWidth}x${window.innerHeight}`,
  referrer: document.referrer || 'Direct'
};

/**
 * Initializes session GeoData and syncs historical logs from the cloud.
 */
export const initLoggerSession = async () => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const data = await response.json();
      currentSessionData = {
        ...currentSessionData,
        ip: data.ip || 'Unknown',
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        country: data.country_name || 'Unknown',
      };
      // Log the session start once we have data
      await logEvent('SESSION_START', 'User session initialized with Geo Data');
    }
  } catch (error) {
    console.warn("Logger: GeoIP blocked or offline.");
    currentSessionData.ip = 'Anonymous/Blocked';
    await logEvent('SESSION_START', 'User session initialized (Geo Blocked)');
  }
};

/**
 * NEW: Syncs LocalStorage with Firestore logs so history is cross-device.
 */
export const syncLogsWithCloud = async () => {
  try {
    const cloudLogs = await videoStorage.getAllLogs();
    if (cloudLogs && cloudLogs.length > 0) {
      localStorage.setItem(LOG_KEY, JSON.stringify(cloudLogs));
      return cloudLogs;
    }
  } catch (error) {
    console.error("Failed to sync cloud logs:", error);
  }
  return getLogs();
};

/**
 * UPDATED: Now Async. Persists to BOTH LocalStorage (speed) and Firestore (permanence).
 */
export const logEvent = async (action: string, details: string = '') => {
  try {
    const easternTime = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "medium"
    });

    const newEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      easternTime,
      action,
      details,
      session: { ...currentSessionData }
    };

    // 1. Update LocalStorage for immediate UI feedback
    const existingLogs = getLogs();
    const updatedLogs = [newEntry, ...existingLogs].slice(0, 1000); // Keep last 1000 locally
    localStorage.setItem(LOG_KEY, JSON.stringify(updatedLogs));

    // 2. Persist to Firestore for permanent history
    await videoStorage.saveLog(newEntry);
    
  } catch (error) {
    console.error("Failed to log event:", error);
  }
};

/**
 * Reads logs from LocalStorage.
 */
export const getLogs = (): LogEntry[] => {
  try {
    const existingLogs = localStorage.getItem(LOG_KEY);
    return existingLogs ? JSON.parse(existingLogs) : [];
  } catch (error) {
    return [];
  }
};

/**
 * Aggregates logs into marketing statistics.
 */
export const getMarketingStats = (): MarketingStats => {
  const logs = getLogs();
  const stats: MarketingStats = {
    totalSessions: 0,
    topCountries: [],
    topProfiles: [],
    topTopics: [],
    dailyActivity: [],
    recentSearches: [],
    conversionEvents: []
  };

  const countryMap = new Map<string, number>();
  const profileMap = new Map<string, number>();
  const topicMap = new Map<string, number>();
  const dateMap = new Map<string, number>();
  const conversionMap = new Map<string, number>();

  logs.forEach(log => {
    if (log.action === 'SESSION_START' || log.action === 'APP_SESSION_START') {
      stats.totalSessions++;
      const country = log.session?.country || 'Unknown';
      countryMap.set(country, (countryMap.get(country) || 0) + 1);
      
      const dateKey = log.timestamp.split('T')[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    }

    if (log.action === 'FILTER_PROFILE' && log.details?.includes('Added')) {
      const profile = log.details.replace('Added profile: ', '').trim();
      profileMap.set(profile, (profileMap.get(profile) || 0) + 1);
    }
    
    if (log.action === 'FILTER_TOPIC' && log.details?.includes('Added')) {
      const topic = log.details.replace('Added topic: ', '').trim();
      topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
    }

    if (log.action === 'AI_SEARCH_SUCCESS') {
      stats.recentSearches.push({
        query: log.details || 'Unknown Query',
        resultsCount: 0, // Simplified for this view
        timestamp: log.timestamp
      });
    }

    if (log.action.includes('_CLICK')) {
      conversionMap.set(log.action, (conversionMap.get(log.action) || 0) + 1);
    }
  });

  const sortMap = (map: Map<string, number>) => 
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  stats.topCountries = sortMap(countryMap).slice(0, 5);
  stats.topProfiles = sortMap(profileMap).slice(0, 8);
  stats.topTopics = sortMap(topicMap).slice(0, 8);
  stats.conversionEvents = sortMap(conversionMap);

  const sortedDates = Array.from(dateMap.keys()).sort();
  stats.dailyActivity = sortedDates.slice(-14).map(date => ({
      date,
      count: dateMap.get(date) || 0
  }));

  return stats;
};

export const downloadLogsAsCsv = async () => {
  const logs = await syncLogsWithCloud();
  if (logs.length === 0) return alert("No logs found.");

  const headers = ["Timestamp", "ET Time", "Action", "Details", "IP", "City", "Country"];

  const escapeCSV = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

  const rows = logs.map(log => [
    escapeCSV(log.timestamp),
    escapeCSV(log.easternTime),
    escapeCSV(log.action),
    escapeCSV(log.details),
    escapeCSV(log.session?.ip),
    escapeCSV(log.session?.city),
    escapeCSV(log.session?.country)
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `activity_logs_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
};

export const downloadLogsAsJson = async () => {
  const logs = await syncLogsWithCloud();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'logFile.json';
  link.click();
};