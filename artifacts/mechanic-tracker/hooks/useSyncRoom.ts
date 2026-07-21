import { useState, useCallback, useEffect } from 'react';
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

const SYNC_CODE_KEY = 'mechanic_sync_code';
const LAST_SYNCED_KEY = 'mechanic_last_synced';

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return '/api';
  return `https://${domain}/api`;
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

export function useSyncRoom() {
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [storedCode, storedSynced] = await Promise.all([
        AsyncStorage.getItem(SYNC_CODE_KEY),
        AsyncStorage.getItem(LAST_SYNCED_KEY),
      ]);
      if (storedCode) setCode(storedCode);
      if (storedSynced) setLastSynced(storedSynced);
    })();
  }, []);

  const createRoom = useCallback(async (): Promise<string | null> => {
    setStatus('syncing');
    setErrorMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/sync/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('Server error');
      const { code: newCode } = await res.json() as { code: string };
      await AsyncStorage.setItem(SYNC_CODE_KEY, newCode);
      setCode(newCode);
      setStatus('ok');
      return newCode;
    } catch {
      setStatus('error');
      setErrorMsg('Could not create sync room. Check your connection.');
      return null;
    }
  }, []);

  const joinRoom = useCallback(async (roomCode: string): Promise<string | null> => {
    const upper = roomCode.toUpperCase().trim();
    setStatus('syncing');
    setErrorMsg(null);
    try {
      const res = await fetch(`${getApiBase()}/sync/rooms/${upper}`);
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
      setErrorMsg('Could not connect. Check your connection.');
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
      // 1. Pull
      const pullRes = await fetch(`${getApiBase()}/sync/rooms/${activeCode}`);
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
      for (const v of localVehicles) vehicleMap.set(v.id, v);
      const mergedVehicles = purgeOldTombstones(Array.from(vehicleMap.values()));

      const jobMap = new Map<string, Job>();
      for (const j of remote.jobs) jobMap.set(j.id, j);
      for (const j of localJobs) jobMap.set(j.id, j);
      const mergedJobs = purgeOldTombstones(Array.from(jobMap.values()));

      // 3. Push merged
      const pushRes = await fetch(`${getApiBase()}/sync/rooms/${activeCode}`, {
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
      setErrorMsg('Sync failed. Check your connection.');
      return null;
    }
  }, [code]);

  return { code, status, lastSynced, errorMsg, createRoom, joinRoom, disconnect, sync };
}
