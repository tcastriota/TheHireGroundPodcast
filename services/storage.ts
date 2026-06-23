import { collection, getDocs, doc, query, orderBy, addDoc } from "firebase/firestore";
import { db } from "./firebase";
import { restSet, restSetPublic, restUpdate, restDelete } from "./firestoreRest";
import { VideoEntry } from '../types';
import { MASTER_SEED_DATA } from '../seedData';

const COLLECTION_NAME = "videos";
const LOGS_COLLECTION = "activity_logs";

export const videoStorage = {
  // 1. Fetch all videos from Firestore ordered by creation date (SDK reads work fine)
  getAll: async (): Promise<VideoEntry[]> => {
    try {
      const vidsRef = collection(db, COLLECTION_NAME);
      const q = query(vidsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => ({
        ...d.data(),
        id: d.id
      } as VideoEntry));
    } catch (error) {
      console.error("Error fetching videos from Firestore:", error);
      return [];
    }
  },

  // 2. Bulk import — uses REST API writes to avoid SDK transport hang
  bulkAdd: async (videos: VideoEntry[]): Promise<VideoEntry[]> => {
    const currentVideos = await videoStorage.getAll();
    const existingYoutubeIds = new Set(currentVideos.map(v => v.youtubeId));
    const newVideos = videos.filter(v => !existingYoutubeIds.has(v.youtubeId));

    console.log(`Staging ${newVideos.length} new videos via REST API...`);
    for (const video of newVideos) {
      const id = video.id || crypto.randomUUID();
      await restSet(COLLECTION_NAME, id, { ...video, id, createdAt: video.createdAt || Date.now() });
    }
    console.log("Bulk import complete.");
    return await videoStorage.getAll();
  },

  // 3. App.tsx expects this on initial load
  syncWithCloud: async (): Promise<{ videos: VideoEntry[], source: 'cloud' | 'local' }> => {
    const videos = await videoStorage.getAll();
    return { videos, source: 'cloud' };
  },

  // 4. Add a new video — REST API write
  add: async (video: VideoEntry): Promise<VideoEntry[]> => {
    await restSet(COLLECTION_NAME, video.id, { ...video });
    return await videoStorage.getAll();
  },

  // 5. Update an existing video — REST API write
  update: async (id: string, updates: Partial<VideoEntry>): Promise<VideoEntry[]> => {
    await restUpdate(COLLECTION_NAME, id, updates as Record<string, any>);
    return await videoStorage.getAll();
  },

  // 6. Delete a video — REST API write
  delete: async (id: string): Promise<VideoEntry[]> => {
    await restDelete(COLLECTION_NAME, id);
    return await videoStorage.getAll();
  },

  // 7. Save an activity log entry — SDK write (public rule in firestore.rules)
  saveLog: async (log: any) => {
    try {
      await addDoc(collection(db, LOGS_COLLECTION), log);
    } catch (e) {
      console.error("Cloud Logger Error:", e);
    }
  },

  // 8. Factory Reset — wipe all videos and restore seed data via REST API
  reset: async (): Promise<void> => {
    try {
      // Delete all existing videos
      const vidsRef = collection(db, COLLECTION_NAME);
      const querySnapshot = await getDocs(vidsRef);
      for (const document of querySnapshot.docs) {
        await restDelete(COLLECTION_NAME, document.id);
      }

      // Re-insert seed data
      if (MASTER_SEED_DATA && MASTER_SEED_DATA.videos) {
        const seedVideos = MASTER_SEED_DATA.videos as any[];
        for (const videoItem of seedVideos) {
          const video = videoItem as VideoEntry;
          await restSet(COLLECTION_NAME, video.id, video);
        }
      }

      console.log("Firestore successfully reset to seed data.");
    } catch (error) {
      console.error("Error resetting Firestore:", error);
      throw error;
    }
  },

  // 9. Fallback Text Search
  searchWithAI: async (searchQuery: string): Promise<VideoEntry[]> => {
    const allVideos = await videoStorage.getAll();
    const searchTerms = searchQuery.toLowerCase().split(' ');
    return allVideos.filter(video => {
      const content = `${video.title} ${video.headline} ${video.guestName} ${video.topics.join(' ')}`.toLowerCase();
      return searchTerms.every(term => content.includes(term));
    });
  },

  // 10. Fetch all activity logs
  getAllLogs: async (): Promise<any[]> => {
    try {
      const q = query(collection(db, LOGS_COLLECTION), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.error("Failed to pull cloud logs:", e);
      return [];
    }
  }
};
