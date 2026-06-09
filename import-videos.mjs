import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Load service account key
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

const raw = JSON.parse(readFileSync('./hire_ground_db_backup_2026-06-08.json', 'utf8'));
const videos = Array.isArray(raw) ? raw : raw.videos;

console.log(`Importing ${videos.length} videos...`);

for (const video of videos) {
  const id = video.id || crypto.randomUUID();
  await db.collection('videos').doc(id).set({ ...video, id });
  console.log(`Saved: ${video.title?.slice(0, 50)}`);
}

console.log('Done!');
