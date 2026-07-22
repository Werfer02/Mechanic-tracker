import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface MechanicDB extends DBSchema {
  vehicles: { key: string; value: AnyRecord };
  jobs:     { key: string; value: AnyRecord };
}

let _db: IDBPDatabase<MechanicDB> | null = null;

async function getDb() {
  if (!_db) {
    _db = await openDB<MechanicDB>('mechanic-desktop', 1, {
      upgrade(db) {
        db.createObjectStore('vehicles', { keyPath: 'id' });
        db.createObjectStore('jobs',     { keyPath: 'id' });
      },
    });
  }
  return _db;
}

export async function loadVehicles(): Promise<AnyRecord[]> {
  return (await getDb()).getAll('vehicles');
}
export async function loadJobs(): Promise<AnyRecord[]> {
  return (await getDb()).getAll('jobs');
}
export async function saveVehicles(vehicles: AnyRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('vehicles', 'readwrite');
  await tx.store.clear();
  await Promise.all(vehicles.map(v => tx.store.put(v)));
  await tx.done;
}
export async function saveJobs(jobs: AnyRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('jobs', 'readwrite');
  await tx.store.clear();
  await Promise.all(jobs.map(j => tx.store.put(j)));
  await tx.done;
}
