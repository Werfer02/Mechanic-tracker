import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  mileage?: number;
  createdAt: string;
  _deleted?: boolean;
  _deletedAt?: string;
}

export interface Job {
  id: string;
  vehicleRegistration: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  description: string;
  notes: string;
  isService: boolean;
  mileageAtService?: number;
  createdAt: string;
  _deleted?: boolean;
  _deletedAt?: string;
}

interface TrackerContextType {
  vehicles: Vehicle[];
  jobs: Job[];
  /** Raw arrays including tombstones — pass these to sync, never render them directly. */
  syncVehicles: Vehicle[];
  syncJobs: Job[];
  isLoading: boolean;
  addJob: (job: Omit<Job, 'id' | 'createdAt'>) => Job;
  deleteJob: (id: string) => void;
  upsertVehicle: (registration: string, make?: string, model?: string, mileage?: number) => Vehicle;
  deleteVehicle: (registration: string) => void;
  getJobsForVehicle: (registration: string) => Job[];
  getLastService: (registration: string) => Job | null;
  getLastServiceEntry: (registration: string) => Job | null;
  /** Replace all local data with synced data (may include tombstones) and persist. */
  replaceData: (vehicles: Vehicle[], jobs: Job[]) => Promise<void>;
}

const TrackerContext = createContext<TrackerContextType | null>(null);

const VEHICLES_KEY = 'mechanic_tracker_vehicles';
const JOBS_KEY = 'mechanic_tracker_jobs';

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [vRaw, jRaw] = await Promise.all([
          AsyncStorage.getItem(VEHICLES_KEY),
          AsyncStorage.getItem(JOBS_KEY),
        ]);
        if (vRaw) setVehicles(JSON.parse(vRaw));
        if (jRaw) setJobs(JSON.parse(jRaw));
      } catch (e) {
        // silently fail on load
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const saveVehicles = useCallback(async (updated: Vehicle[]) => {
    setVehicles(updated);
    await AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(updated));
  }, []);

  const saveJobs = useCallback(async (updated: Job[]) => {
    setJobs(updated);
    await AsyncStorage.setItem(JOBS_KEY, JSON.stringify(updated));
  }, []);

  const addJob = useCallback((jobData: Omit<Job, 'id' | 'createdAt'>): Job => {
    const job: Job = {
      ...jobData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setJobs(prev => {
      const updated = [job, ...prev];
      AsyncStorage.setItem(JOBS_KEY, JSON.stringify(updated));
      return updated;
    });
    return job;
  }, []);

  const deleteJob = useCallback((id: string) => {
    const now = new Date().toISOString();
    setJobs(prev => {
      const updated = prev.map(j => j.id === id ? { ...j, _deleted: true, _deletedAt: now } : j);
      AsyncStorage.setItem(JOBS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const upsertVehicle = useCallback((registration: string, make = '', model = '', mileage?: number): Vehicle => {
    const reg = registration.toUpperCase().trim();
    let existing: Vehicle | undefined;
    setVehicles(prev => {
      existing = prev.find(v => v.registration === reg);
      if (existing) {
        // Un-delete if previously deleted, and optionally update make/model/mileage
        const updated = prev.map(v =>
          v.registration === reg
            ? {
                ...v,
                _deleted: undefined,
                make: make || v.make,
                model: model || v.model,
                ...(mileage !== undefined ? { mileage } : {}),
              }
            : v
        );
        AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(updated));
        existing = updated.find(v => v.registration === reg)!;
        return updated;
      }
      const newVehicle: Vehicle = {
        id: generateId(),
        registration: reg,
        make,
        model,
        ...(mileage !== undefined ? { mileage } : {}),
        createdAt: new Date().toISOString(),
      };
      existing = newVehicle;
      const updated = [...prev, newVehicle];
      AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(updated));
      return updated;
    });
    // Return synchronously — caller may need it immediately
    return existing ?? { id: generateId(), registration: reg, make, model, createdAt: new Date().toISOString() };
  }, []);

  const deleteVehicle = useCallback((registration: string) => {
    const now = new Date().toISOString();
    setVehicles(prev => {
      const updated = prev.map(v => v.registration === registration ? { ...v, _deleted: true, _deletedAt: now } : v);
      AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(updated));
      return updated;
    });
    setJobs(prev => {
      const updated = prev.map(j => j.vehicleRegistration === registration ? { ...j, _deleted: true, _deletedAt: now } : j);
      AsyncStorage.setItem(JOBS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getJobsForVehicle = useCallback((registration: string): Job[] => {
    return jobs
      .filter(j => j.vehicleRegistration === registration && !j._deleted)
      .sort((a, b) => {
        const da = new Date(`${a.date}T${a.time}`).getTime();
        const db = new Date(`${b.date}T${b.time}`).getTime();
        return db - da;
      });
  }, [jobs]);

  const getLastService = useCallback((registration: string): Job | null => {
    const vehicleJobs = jobs.filter(j => j.vehicleRegistration === registration && !j._deleted);
    if (!vehicleJobs.length) return null;
    return vehicleJobs.reduce((latest, job) => {
      const jd = new Date(`${job.date}T${job.time}`).getTime();
      const ld = new Date(`${latest.date}T${latest.time}`).getTime();
      return jd > ld ? job : latest;
    });
  }, [jobs]);

  const getLastServiceEntry = useCallback((registration: string): Job | null => {
    const serviceJobs = jobs.filter(j => j.vehicleRegistration === registration && j.isService && !j._deleted);
    if (!serviceJobs.length) return null;
    return serviceJobs.reduce((latest, job) => {
      const jd = new Date(`${job.date}T${job.time}`).getTime();
      const ld = new Date(`${latest.date}T${latest.time}`).getTime();
      return jd > ld ? job : latest;
    });
  }, [jobs]);

  const replaceData = useCallback(async (newVehicles: Vehicle[], newJobs: Job[]) => {
    await Promise.all([
      AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(newVehicles)),
      AsyncStorage.setItem(JOBS_KEY, JSON.stringify(newJobs)),
    ]);
    setVehicles(newVehicles);
    setJobs(newJobs);
  }, []);

  // Filtered views for UI (tombstones hidden)
  const visibleVehicles = vehicles.filter(v => !v._deleted);
  const visibleJobs     = jobs.filter(j => !j._deleted);

  return (
    <TrackerContext.Provider value={{
      vehicles: visibleVehicles,
      jobs: visibleJobs,
      syncVehicles: vehicles,  // raw — includes tombstones, pass to sync only
      syncJobs: jobs,
      isLoading,
      addJob, deleteJob, upsertVehicle, deleteVehicle,
      getJobsForVehicle, getLastService, getLastServiceEntry,
      replaceData,
    }}>
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used inside TrackerProvider');
  return ctx;
}
