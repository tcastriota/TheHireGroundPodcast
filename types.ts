
export interface VideoEntry {
  id: string;
  youtubeId: string;
  title: string;
  headline: string;
  description?: string;
  fullDescription?: string;
  guestName?: string;
  guestProfiles: string[];
  targetAudience: string[]; // Changed from optional string to string array
  topics: string[];
  transcript?: string;
  spotifyUrl?: string;
  publishedAt?: string;
  createdAt: number;
  isShort?: 'Y' | 'N'; // New field to indicate if it's a YouTube Short
}

export interface FilterState {
  searchQuery: string;
  selectedProfiles: string[];
  selectedTopics: string[];
  selectedAudiences: string[];
  aiSearchActive: boolean;
  shortsFilter: 'all' | 'shorts' | 'videos'; // Filter for content format
}

export interface AnalysisResult {
  guestName?: string;
  guestProfiles: string[];
  targetAudience: string[]; // Changed to array
  topics: string[];
  suggestedTitle?: string;
  headline?: string;
  fullDescription?: string;
  isShort?: 'Y' | 'N';
}
