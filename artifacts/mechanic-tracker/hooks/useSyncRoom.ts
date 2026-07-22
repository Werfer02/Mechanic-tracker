import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
   * Merge-sync: pull remote → union with local → push merged result back.
   * Returns the merged data so the caller can persist it locally.
   */
  const sync = useCallback(async (
    localVehicles: Vehicle[],
    localJobs: Job[],
    roomCodeOverride?: string, // pass immediately after joinRoom to bypass stale state
  ): Promise<{ vehicles: Vehicle[]; jobs: Job[] } | null> => {
    const activeCode = roomCodeOverride ?? code;
    if (!activeCode) return null;
    setStatus('syncing');
    setErrorMsg(null);
    try {
      // Strip photos from every job before pushing — base64 images bloat the
      // sync payload to many MB and cause 413 errors. Photos are mobile-only.
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
      for (const j of remote.jobs) jobMap.set(j.id, j);
      for (const j of localJobsToPush) jobMap.set(j.id, j);
      const mergedJobs = purgeOldTombstones(Array.from(jobMap.values()));

      // 3. Push merged
      const pushRes = await fetch(`${apiBase()}/sync/rooms/${activeCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicles: mergedVehicles, jobs: mergedJobs }),
      });
      if (!pushRes.ok) throw new Error('Push failed');

      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNCED_KEY, now);
      setLastSynced(now);
      setStatus('ok');
      return { vehicles: mergedVehicles, jobs: mergedJobs };
    } catch {
      setStatus('error');
      setErrorMsg('Sync failed. Check your server URL and connection.');
      return null;
    }
  }, [code]);

  return {
    code, status, lastSynced, errorMsg,
    serverUrl, setServerUrl,
    createRoom, joinRoom, disconnect, sync,
  };
}
