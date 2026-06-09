import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { VideoEntry } from '../types';
import { MASTER_SEED_DATA } from '../seedData'; // Ensure this matches your seed file path

const COLLECTION_NAME = "videos";
const LOGS_COLLECTION = "activity_logs"; // Define the collection for logs
export const videoStorage = {
  // 1. Fetch all videos from Firestore ordered by creation date
  getAll: async (): Promise<VideoEntry[]> => {
    try {
      const vidsRef = collection(db, COLLECTION_NAME);
      const q = query(vidsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as VideoEntry));
    } catch (error) {
      console.error("Error fetching videos from Firestore:", error);
      return [];
    }
    
  },
  // Add this new function to the videoStorage object in storage.ts
bulkAdd: async (videos: VideoEntry[]): Promise<VideoEntry[]> => {
  try {
    const currentVideos = await videoStorage.getAll();
    const existingYoutubeIds = new Set(currentVideos.map(v => v.youtubeId));

    const newVideos = videos.filter(v => !existingYoutubeIds.has(v.youtubeId));
    console.log(`Importing ${newVideos.length} videos, skipping ${videos.length - newVideos.length} duplicates`);

    if (newVideos.length > 0) {
      const { auth } = await import('./firebase');
      console.log('Current auth user:', auth.currentUser?.email ?? 'NOT LOGGED IN');
      // Write individually instead of batch to avoid hanging
      for (const video of newVideos) {
        const id = video.id || crypto.randomUUID();
        const docRef = doc(db, COLLECTION_NAME, id);
        await setDoc(docRef, { ...video, id, createdAt: video.createdAt || Date.now() });
        console.log(`Saved: ${video.title?.slice(0, 40)}`);
      }
      console.log('All videos saved successfully');
    }

    return await videoStorage.getAll();
  } catch (error) {
    console.error("bulkAdd failed:", error);
    throw error;
  }
},
saveLog: async (log: any) => {
    try {
      const docRef = doc(db, LOGS_COLLECTION, crypto.randomUUID());
      await setDoc(docRef, log);
    } catch (e) {
      console.error("Cloud Logger Error:", e);
    }
  },


  // 2. App.tsx expects this on initial load to know where data came from
  syncWithCloud: async (): Promise<{ videos: VideoEntry[], source: 'cloud' | 'local' }> => {
    const videos = await videoStorage.getAll();
    return { videos, source: 'cloud' };
  },

  // 3. Add a new video to Firestore & return the updated list
  add: async (video: VideoEntry): Promise<VideoEntry[]> => {
    // We use setDoc instead of addDoc so the Firestore ID matches the crypto.randomUUID() generated in App.tsx
    const docRef = doc(db, COLLECTION_NAME, video.id);
    await setDoc(docRef, { ...video });
    
    // Return the fresh list so the UI updates
    return await videoStorage.getAll();
  },

  // 4. Update an existing video in Firestore & return the updated list
  update: async (id: string, updates: Partial<VideoEntry>): Promise<VideoEntry[]> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, updates);
    
    return await videoStorage.getAll();
  },

  // 5. Delete a video from Firestore & return the updated list
  delete: async (id: string): Promise<VideoEntry[]> => {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    
    return await videoStorage.getAll();
  },

  // 6. The Factory Reset (Wipes Cloud Database and Restores Seed Data)
  reset: async (): Promise<void> => {
    try {
      // Step A: Get all current documents
      const vidsRef = collection(db, COLLECTION_NAME);
      const querySnapshot = await getDocs(vidsRef);
      
      // Step B: Initialize a Firestore Batch (allows us to do massive read/writes at exactly the same time)
      const batch = writeBatch(db);
      
      // Step C: Stage all current documents for deletion
      querySnapshot.forEach((document) => {
        batch.delete(doc(db, COLLECTION_NAME, document.id));
      });
      
      // Step D: Stage all original seed documents for insertion
      if (MASTER_SEED_DATA && MASTER_SEED_DATA.videos) {
        // Tell TypeScript to safely treat the imported JSON as VideoEntry objects
        const seedVideos = MASTER_SEED_DATA.videos as any[];
        
        seedVideos.forEach((videoItem) => {
          const video = videoItem as VideoEntry;
          const docRef = doc(db, COLLECTION_NAME, video.id);
          batch.set(docRef, video);
        });
      }
      
      // Step E: Execute the wipe and restore simultaneously!
      await batch.commit();
      console.log("Firestore successfully reset to seed data.");
    } catch (error) {
      console.error("Error resetting Firestore:", error);
      throw error;
    }
  },

  // 7. Fallback Text Search (Used if Gemini AI fails)
  searchWithAI: async (query: string): Promise<VideoEntry[]> => {
    const allVideos = await videoStorage.getAll();
    
    const searchTerms = query.toLowerCase().split(' ');
    
    return allVideos.filter(video => {
      const content = `${video.title} ${video.headline} ${video.guestName} ${video.topics.join(' ')}`.toLowerCase();
      return searchTerms.every(term => content.includes(term));
    });
  },
  getAllLogs: async (): Promise<any[]> => {
    try {
      // Use "timestamp" for ordering as defined in your LogEntry interface
      const q = query(collection(db, LOGS_COLLECTION), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.error("Failed to pull cloud logs:", e);
      return [];
    }
  }
};