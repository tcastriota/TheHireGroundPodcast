import { auth } from './firebase';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Convert a JS value to Firestore REST field format
function toValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toValue) } };
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toDoc(obj: Record<string, any>) {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toValue(v);
  }
  return { fields };
}

async function getToken(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

// Equivalent to setDoc
export async function restSet(collection: string, docId: string, data: Record<string, any>): Promise<void> {
  const token = await getToken();
  const url = `${BASE_URL}/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(toDoc(data))
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Firestore write failed: ${res.status}`);
  }
}

// Equivalent to updateDoc
export async function restUpdate(collection: string, docId: string, data: Record<string, any>): Promise<void> {
  const token = await getToken();
  // updateMask.fieldPaths must be repeated per field, not comma-joined
  const mask = Object.keys(data).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${BASE_URL}/${collection}/${docId}?${mask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(toDoc(data))
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Firestore update failed: ${res.status}`);
  }
}

// Public write — no auth token required (used for activity logging from non-admin users)
export async function restSetPublic(collection: string, docId: string, data: Record<string, any>): Promise<void> {
  const url = `${BASE_URL}/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toDoc(data))
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Firestore public write failed: ${res.status}`);
  }
}

// Equivalent to deleteDoc
export async function restDelete(collection: string, docId: string): Promise<void> {
  const token = await getToken();
  const url = `${BASE_URL}/${collection}/${docId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Firestore delete failed: ${res.status}`);
  }
}
