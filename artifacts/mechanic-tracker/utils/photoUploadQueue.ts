/**
 * Persistent upload queue — stores pending photo uploads in AsyncStorage so
 * they survive app restarts. Uses the photo's local URI as the key so entries
 * remain correct even if a photo is removed from a job before the upload fires.
 *
 * The base64 payload comes directly from ImagePicker (always available at
 * pick-time), so we never need to re-read files from disk.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'mechanic_photo_upload_queue';

export interface UploadEntry {
  jobId:    string;
  uri:      string; // local URI — used as the dedup key
  base64:   string;
  mimeType: string;
}

/** Add entries to the queue, deduplicating by jobId + uri. */
export async function enqueuePhotos(entries: UploadEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const raw  = await AsyncStorage.getItem(QUEUE_KEY);
    const prev: UploadEntry[] = raw ? JSON.parse(raw) : [];
    const map  = new Map(prev.map(e => [`${e.jobId}:${e.uri}`, e]));
    for (const e of entries) map.set(`${e.jobId}:${e.uri}`, e);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...map.values()]));
  } catch { /* best-effort */ }
}

/** Read all pending entries. */
export async function getQueue(): Promise<UploadEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Remove successfully-uploaded entries from the queue. */
export async function dequeuePhotos(keys: Array<{ jobId: string; uri: string }>): Promise<void> {
  if (keys.length === 0) return;
  try {
    const raw  = await AsyncStorage.getItem(QUEUE_KEY);
    const prev: UploadEntry[] = raw ? JSON.parse(raw) : [];
    const set  = new Set(keys.map(k => `${k.jobId}:${k.uri}`));
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(prev.filter(e => !set.has(`${e.jobId}:${e.uri}`))));
  } catch { /* best-effort */ }
}
