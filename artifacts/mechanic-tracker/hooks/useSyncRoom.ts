import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getQueue, dequeuePhotos } from '@/utils/photoUploadQueue';
import type { Vehicle, Job } from '@/context/TrackerContext';

const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function purgeOldTombstones<T extends { _deleted?: boolean; _deletedAt?: string }>(items: T[]): T[] {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  return items.filter(item => {
    if (!item._deleted) return true;
    if (!item._deletedAt) return false;
    return new Date(item._deletedAt).getTime() > cutoff;
  });
}

const SYNC_CODE_KEY   = 'mechanic_sync_code';
const LAST_SYNCED_KEY = 'mechanic_last_synced';
const SERVER_URL_KEY  = 'mechanic_server_url';

function getDefaultApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return '';
  return `https://${domain}/api`;
}

/**
 * Accept both the desktop address (`http://192.168.1.50:8080`) and the
 * API address (`http://192.168.1.50:8080/api`). Docker's nginx serves the
 * desktop at the former and proxies API requests at the latter, so users
 * naturally encounter both forms when configuring the mobile app.
 */
function normalizeApiBase(url: string): string {
  let trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  // Make manual LAN entries such as `192.168.1.50:8080` valid fetch URLs.
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function errorDetail(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Network request failed';
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

export function useSyncRoom() {
  const [code,       setCode]       = useState<string | null>(null);
  const [status,     setStatus]     = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [serverUrl,  setServerUrlState] = useState<string>('');

  const serverUrlRef = useRef<string>('');

  useEffect(() => {
    (async () => {
      const [storedCode, storedSynced, storedUrl] = await Promise.all([
        AsyncStorage.getItem(SYNC_CODE_KEY),
        AsyncStorage.getItem(LAST_SYNCED_KEY),
        AsyncStorage.getItem(SERVER_URL_KEY),
      ]);
      if (storedCode)   setCode(storedCode);
      if (storedSynced) setLastSynced(storedSynced);
      const url = normalizeApiBase(storedUrl !== null ? storedUrl : getDefaultApiBase());
      setServerUrlState(url);
      serverUrlRef.current = url;
    })();
  }, []);

  const setServerUrl = useCallback(async (url: string) => {
    const normalized = normalizeApiBase(url);
    serverUrlRef.current = normalized;
    setServerUrlState(normalized);
    await AsyncStorage.setItem(SERVER_URL_KEY, normalized);
  }, []);

  const apiBase = () => normalizeApiBase(serverUrlRef.current) || '/api';

  // ── Room actions ─────────────────────────────────────────────────────────────

  const createRoom = useCallback(async (): Promise<string | null> => {
    setStatus('syncing');
    setErrorMsg(null);
    const endpoint = `${apiBase()}/sync/rooms`;
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);
      const { code: newCode } = await res.json() as { code: string };
      await AsyncStorage.setItem(SYNC_CODE_KEY, newCode);
      setCode(newCode);
      setStatus('ok');
      return newCode;
    } catch (error) {
      console.warn('[sync] create room failed:', error);
      setStatus('error');
      setErrorMsg(`Could not create sync room. Check your server URL and connection. (${errorDetail(error)}: ${endpoint})`);
      return null;
    }
  }, []);

  const joinRoom = useCallback(async (roomCode: string): Promise<string | null> => {
    const upper = roomCode.toUpperCase().trim();
    setStatus('syncing');
    setErrorMsg(null);
    const endpoint = `${apiBase()}/sync/rooms/${upper}`;
    try {
      const res = await fetch(endpoint);
      if (res.status === 404) {
        setStatus('error');
        setErrorMsg('Room not found. Check the code and try again.');
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);
      await AsyncStorage.setItem(SYNC_CODE_KEY, upper);
      setCode(upper);
      setStatus('ok');
      return upper;
    } catch (error) {
      console.warn('[sync] join room failed:', error);
      setStatus('error');
      setErrorMsg(`Could not connect. Check your server URL and connection. (${errorDetail(error)}: ${endpoint})`);
      return null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(SYNC_CODE_KEY),
      AsyncStorage.removeItem(LAST_SYNCED_KEY),
    ]);
    setCode(null);
    setStatus('idle');
    setLastSynced(null);
    setErrorMsg(null);
  }, []);

  // ── Upload a single photo from base64 (no file-system reads) ─────────────────

  const uploadOnePhoto = useCallback(async (base64: string, mimeType: string): Promise<string | null> => {
    const base = serverUrlRef.current;
    if (!base) return null;
    try {
      const res = await fetch(`${base}/photos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: base64, mimeType }),
      });
      if (!res.ok) return null;
      const { url } = await res.json() as { url: string };
      const origin = base.replace(/\/api\/?$/, '');
      return `${origin}${url}`;
    } catch {
      return null;
    }
  }, []);

  /**
   * Fire-and-forget after a successful sync push.
   * Reads the persistent upload queue (base64 stored at pick-time),
   * uploads any pending photos, patches the sync room with the new URLs.
   * Never throws — worst case the photos stay queued for the next cycle.
   */
  const drainUploadQueue = useCallback(async (activeCode: string): Promise<void> => {
    const queue = await getQueue();
    if (queue.length === 0) return;

    const succeeded: Array<{ jobId: string; uri: string; hostedUrl: string }> = [];
    await Promise.all(
      queue.map(async entry => {
        const hostedUrl = await uploadOnePhoto(entry.base64, entry.mimeType);
        if (hostedUrl) succeeded.push({ jobId: entry.jobId, uri: entry.uri, hostedUrl });
      })
    );

    if (succeeded.length === 0) return;

    // Remove successfully-uploaded entries from the queue
    await dequeuePhotos(succeeded);

    // Pull current room, patch jobs with new photo URLs, push back
    try {
      const pullRes = await fetch(`${apiBase()}/sync/rooms/${activeCode}`);
      if (!pullRes.ok) return;
      const room = await pullRes.json() as { vehicles: Vehicle[]; jobs: Job[] };

      // Group results by jobId
      const byJob = new Map<string, Array<{ uri: string; hostedUrl: string }>>();
      for (const s of succeeded) {
        const list = byJob.get(s.jobId) ?? [];
        list.push({ uri: s.uri, hostedUrl: s.hostedUrl });
        byJob.set(s.jobId, list);
      }

      const patchedJobs = room.jobs.map(j => {
        const patches = byJob.get(j.id);
        if (!patches) return j;
        // For each URI that now has a URL, append to photoUrls if not already present
        const existing = j.photoUrls ?? [];
        const newUrls  = [...existing];
        let changed = false;
        for (const { hostedUrl } of patches) {
          if (!newUrls.includes(hostedUrl)) { newUrls.push(hostedUrl); changed = true; }
        }
        return changed ? { ...j, photoUrls: newUrls } : j;
      });

      await fetch(`${apiBase()}/sync/rooms/${activeCode}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ vehicles: room.vehicles, jobs: patchedJobs }),
      });
    } catch { /* best-effort — next sync will retry */ }
  }, [uploadOnePhoto]);

  // ── Core sync ─────────────────────────────────────────────────────────────────

  /**
   * Merge-sync: pull remote → union with local → push merged result back.
   * Returns the merged data so the caller can persist it locally.
   * Photo uploads drain from the queue in the background after the push.
   */
  const sync = useCallback(async (
    localVehicles: Vehicle[],
    localJobs: Job[],
    roomCodeOverride?: string,
  ): Promise<{ vehicles: Vehicle[]; jobs: Job[] } | null> => {
    const activeCode = roomCodeOverride ?? code;
    if (!activeCode) return null;
    setStatus('syncing');
    setErrorMsg(null);
    try {
      // Strip local-only photos (base64 URIs) before pushing — server-side is lean
      const localJobsToPush = localJobs.map(({ photos: _p, ...j }) => j as Job);

      // 1. Pull
      const pullRes = await fetch(`${apiBase()}/sync/rooms/${activeCode}`);
      if (pullRes.status === 404) {
        setStatus('error');
        setErrorMsg('Sync room no longer exists. Create a new one.');
        return null;
      }
      if (!pullRes.ok) throw new Error('Pull failed');
      const remote = await pullRes.json() as { vehicles: Vehicle[]; jobs: Job[] };

      // 2. Merge — remote first so local fields win; remote-only fields (photoUrls) survive
      const vehicleMap = new Map<string, Vehicle>();
      for (const v of remote.vehicles) vehicleMap.set(v.id, v);
      for (const v of localVehicles)   vehicleMap.set(v.id, v);
      const mergedVehicles = purgeOldTombstones([...vehicleMap.values()]);

      const jobMap = new Map<string, Job>();
      for (const j of remote.jobs)     jobMap.set(j.id, j);
      for (const j of localJobsToPush) {
        const existing = jobMap.get(j.id);
        // Keep remote-only fields (e.g. photoUrls set by a prior background upload)
        jobMap.set(j.id, existing ? { ...existing, ...j } : j);
      }
      const mergedJobs = purgeOldTombstones([...jobMap.values()]);

      // 3. Push
      const pushRes = await fetch(`${apiBase()}/sync/rooms/${activeCode}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ vehicles: mergedVehicles, jobs: mergedJobs }),
      });
      if (!pushRes.ok) throw new Error('Push failed');

      // 4. Re-attach local photo URIs so the mobile device keeps its previews
      const localJobsById = new Map(localJobs.map(j => [j.id, j]));
      const mergedJobsWithPhotos = mergedJobs.map(j => {
        const local = localJobsById.get(j.id);
        if (!local?.photos?.length) return j;
        return { ...j, photos: local.photos };
      });

      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNCED_KEY, now);
      setLastSynced(now);
      setStatus('ok');

      // 5. Background: drain upload queue — uploads photos, then does a second push
      drainUploadQueue(activeCode);

      return { vehicles: mergedVehicles, jobs: mergedJobsWithPhotos };
    } catch (error) {
      setStatus('error');
      console.warn('[sync] sync failed:', error);
      setErrorMsg(`Sync failed. Check your server URL and connection. (${errorDetail(error)})`);
      return null;
    }
  }, [code, drainUploadQueue]);

  return {
    code, status, lastSynced, errorMsg,
    serverUrl, setServerUrl,
    createRoom, joinRoom, disconnect, sync,
  };
}
