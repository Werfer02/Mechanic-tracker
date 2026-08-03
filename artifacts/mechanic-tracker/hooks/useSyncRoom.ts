import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
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

/** Returns the compile-time default from the env var, or empty string if none set. */
function getDefaultApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return '';
  return `https://${domain}/api`;
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

export function useSyncRoom() {
  const [code,       setCode]           = useState<string | null>(null);
  const [status,     setStatus]         = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced]     = useState<string | null>(null);
  const [errorMsg,   setErrorMsg]       = useState<string | null>(null);
  const [serverUrl,  setServerUrlState] = useState<string>('');

  // Ref so callbacks always see the latest URL without needing to be recreated.
  const serverUrlRef = useRef<string>('');

  // Load all persisted values on mount.
  useEffect(() => {
    (async () => {
      const [storedCode, storedSynced, storedUrl] = await Promise.all([
        AsyncStorage.getItem(SYNC_CODE_KEY),
        AsyncStorage.getItem(LAST_SYNCED_KEY),
        AsyncStorage.getItem(SERVER_URL_KEY),
      ]);
      if (storedCode)   setCode(storedCode);
      if (storedSynced) setLastSynced(storedSynced);

      // storedUrl is null when the user has never saved one — fall back to
      // the value baked in at build time (EXPO_PUBLIC_DOMAIN), which may
      // itself be empty if the APK was built without it.
      const url = storedUrl !== null ? storedUrl : getDefaultApiBase();
      setServerUrlState(url);
      serverUrlRef.current = url;
    })();
  }, []);

  /** Persist a new server URL and update the ref immediately so in-flight
   *  callbacks pick it up without waiting for a re-render. */
  const setServerUrl = useCallback(async (url: string) => {
    const trimmed = url.trim();
    // Update the ref and state synchronously so any in-flight or immediately
    // scheduled API calls (e.g. joinRoom 300 ms after a QR scan) see the new
    // URL without having to await this function.
    serverUrlRef.current = trimmed;
    setServerUrlState(trimmed);
    // Persist in the background — no need to block callers on this.
    await AsyncStorage.setItem(SERVER_URL_KEY, trimmed);
  }, []);

  // ── API helpers ─────────────────────────────────────────────────────────────

  /** Current base for all sync API calls — reads the ref, always fresh. */
  const apiBase = () => serverUrlRef.current || '/api';

  // ── Room actions ─────────────────────────────────────────────────────────────

  const createRoom = useCallback(async (): Promise<string | null> => {
    setStatus('syncing');
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiBase()}/sync/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('Server error');
      const { code: newCode } = await res.json() as { code: string };
      await AsyncStorage.setItem(SYNC_CODE_KEY, newCode);
      setCode(newCode);
      setStatus('ok');
      return newCode;
    } catch {
      setStatus('error');
      setErrorMsg('Could not create sync room. Check your server URL and connection.');
      return null;
    }
  }, []);

  const joinRoom = useCallback(async (roomCode: string): Promise<string | null> => {
    const upper = roomCode.toUpperCase().trim();
    setStatus('syncing');
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiBase()}/sync/rooms/${upper}`);
      if (res.status === 404) {
        setStatus('error');
        setErrorMsg('Room not found. Check the code and try again.');
        return null;
      }
      if (!res.ok) throw new Error('Server error');
      await AsyncStorage.setItem(SYNC_CODE_KEY, upper);
      setCode(upper);
      setStatus('ok');
      return upper; // return the code so callers can immediately pass it to sync()
    } catch {
      setStatus('error');
      setErrorMsg('Could not connect. Check your server URL and connection.');
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

  /**
   * Upload a single photo URI to the server with a per-photo timeout.
   * Returns a hosted URL or null — never throws.
   */
  const uploadOnePhoto = useCallback(async (uri: string): Promise<string | null> => {
    const base = serverUrlRef.current;
    if (!base) return null;
    try {
      // Race the file read against a 10 s timeout so a slow/unreadable URI
      // never hangs the caller.
      const b64 = await Promise.race<string>([
        FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('read timeout')), 10_000)
        ),
      ]);
      const ext      = uri.split('.').pop()?.toLowerCase() ?? '';
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const res = await fetch(`${base}/photos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data: b64, mimeType }),
      });
      if (!res.ok) return null;
      const { url } = await res.json() as { url: string };
      const origin   = base.replace(/\/api\/?$/, '');
      return `${origin}${url}`;
    } catch {
      return null;
    }
  }, []);

  /**
   * After a successful sync, fire-and-forget: upload photos that haven't
   * reached the server yet, then push a second time so desktop sees the URLs.
   * Runs entirely in the background — never blocks or delays the sync result.
   */
  const uploadPendingPhotos = useCallback(async (
    activeCode: string,
    jobs: Job[],
  ): Promise<void> => {
    const needsUpload = jobs.filter(j =>
      !j._deleted && (j.photos?.length ?? 0) > (j.photoUrls?.length ?? 0)
    );
    if (needsUpload.length === 0) return;

    let anyUploaded = false;
    const updated = await Promise.all(
      needsUpload.map(async (job) => {
        const photos    = job.photos    ?? [];
        const photoUrls = [...(job.photoUrls ?? [])];
        let changed = false;
        await Promise.all(
          photos.map(async (uri, i) => {
            if (photoUrls[i]) return;
            const url = await uploadOnePhoto(uri);
            if (url) { photoUrls[i] = url; changed = true; anyUploaded = true; }
          })
        );
        return changed ? { ...job, photoUrls: photoUrls.filter(Boolean) as string[] } : null;
      })
    );
    if (!anyUploaded) return;

    // Build a fresh job map: start from current room state, overlay the updated jobs.
    try {
      const pullRes = await fetch(`${apiBase()}/sync/rooms/${activeCode}`);
      if (!pullRes.ok) return;
      const room = await pullRes.json() as { vehicles: Vehicle[]; jobs: Job[] };
      const jobMap = new Map<string, Job>(room.jobs.map(j => [j.id, j]));
      for (const u of updated) {
        if (u) jobMap.set(u.id, { ...jobMap.get(u.id)!, ...u, photos: undefined });
      }
      await fetch(`${apiBase()}/sync/rooms/${activeCode}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ vehicles: room.vehicles, jobs: Array.from(jobMap.values()) }),
      });
    } catch { /* best-effort — next sync will retry */ }
  }, [uploadOnePhoto]);

  /**
   * Merge-sync: pull remote → union with local → push merged result back.
   * Returns the merged data so the caller can persist it locally.
   * Photo uploads run in the background after the push so they never block sync.
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
      // Strip photos (base64) before pushing — photos are local-only.
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

      // 2. Merge (union by id, local wins on conflict) then purge expired tombstones
      const vehicleMap = new Map<string, Vehicle>();
      for (const v of remote.vehicles) vehicleMap.set(v.id, v);
      for (const v of localVehicles)   vehicleMap.set(v.id, v);
      const mergedVehicles = purgeOldTombstones(Array.from(vehicleMap.values()));

      const jobMap = new Map<string, Job>();
      for (const j of remote.jobs)        jobMap.set(j.id, j);
      for (const j of localJobsToPush)    jobMap.set(j.id, j);
      const mergedJobs = purgeOldTombstones(Array.from(jobMap.values()));

      // 3. Push — always completes fast; photo uploads happen afterwards
      const pushRes = await fetch(`${apiBase()}/sync/rooms/${activeCode}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ vehicles: mergedVehicles, jobs: mergedJobs }),
      });
      if (!pushRes.ok) throw new Error('Push failed');

      // 4. Re-attach local photos so the mobile device keeps its originals
      const localJobsById = new Map(localJobs.map(j => [j.id, j]));
      const mergedJobsWithPhotos = mergedJobs.map(j => {
        const local = localJobsById.get(j.id);
        if (!local) return j;
        return {
          ...j,
          ...(local.photos    && local.photos.length    > 0 ? { photos:    local.photos    } : {}),
          ...(local.photoUrls && local.photoUrls.length > 0 ? { photoUrls: local.photoUrls } : {}),
        };
      });

      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNCED_KEY, now);
      setLastSynced(now);
      setStatus('ok');

      // 5. Background: upload any photos not yet on the server, then push again.
      //    This fires after we return so it never delays or breaks the sync.
      uploadPendingPhotos(activeCode, mergedJobsWithPhotos);

      return { vehicles: mergedVehicles, jobs: mergedJobsWithPhotos };
    } catch {
      setStatus('error');
      setErrorMsg('Sync failed. Check your server URL and connection.');
      return null;
    }
  }, [code, uploadPendingPhotos]);

  return {
    code, status, lastSynced, errorMsg,
    serverUrl, setServerUrl,
    createRoom, joinRoom, disconnect, sync,
  };
}
