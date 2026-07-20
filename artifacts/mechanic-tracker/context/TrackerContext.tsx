import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  createdAt: string;
}

export interface Job {
  id: string;
  vehicleRegistration: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  description: string;
  notes: string;
  isService: boolean;
  createdAt: string;
}

interface TrackerContextType {
  vehicles: Vehicle[];
  jobs: Job[];
  isLoading: boolean;
  addJob: (job: Omit<Job, 'id' | 'createdAt'>) => Job;
  deleteJob: (id: string) => void;
  upsertVehicle: (registration: string, make?: string, model?: string) => Vehicle;
  deleteVehicle: (registration: string) => void;
  getJobsForVehicle: (registration: string) => Job[];
  getLastService: (registration: string) => Job | null;
  getLastServiceEntry: (registration: string) => Job | null;
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
    setJobs(prev => {
      const updated = prev.filter(j => j.id !== id);
      AsyncStorage.setItem(JOBS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const upsertVehicle = useCallback((registration: string, make = '', model = ''): Vehicle => {
    const reg = registration.toUpperCase().trim();
    let existing: Vehicle | undefined;
    setVehicles(prev => {
      existing = prev.find(v => v.registration === reg);
      if (existing) {
        if (make || model) {
          const updated = prev.map(v =>
            v.registration === reg
              ? { ...v, make: make || v.make, model: model || v.model }
              : v
          );
          AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(updated));
          existing = updated.find(v => v.registration === reg)!;
          return updated;
        }
        return prev;
      }
      const newVehicle: Vehicle = {
        id: generateId(),
        registration: reg,
        make,
        model,
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
    setVehicles(prev => {
      const updated = prev.filter(v => v.registration !== registration);
      AsyncStorage.setItem(VEHICLES_KEY, JSON.stringify(updated));
      return updated;
    });
    setJobs(prev => {
      const updated = prev.filter(j => j.vehicleRegistration !== registration);
      AsyncStorage.setItem(JOBS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const getJobsForVehicle = useCallback((registration: string): Job[] => {
    return jobs
      .filter(j => j.vehicleRegistration === registration)
      .sort((a, b) => {
        const da = new Date(`${a.date}T${a.time}`).getTime();
        const db = new Date(`${b.date}T${b.time}`).getTime();
        return db - da;
      });
  }, [jobs]);

  const getLastService = useCallback((registration: string): Job | null => {
    const vehicleJobs = jobs.filter(j => j.vehicleRegistration === registration);
    if (!vehicleJobs.length) return null;
    return vehicleJobs.reduce((latest, job) => {
      const jd = new Date(`${job.date}T${job.time}`).getTime();
      const ld = new Date(`${latest.date}T${latest.time}`).getTime();
      return jd > ld ? job : latest;
    });
  }, [jobs]);

  const getLastServiceEntry = useCallback((registration: string): Job | null => {
    const serviceJobs = jobs.filter(j => j.vehicleRegistration === registration && j.isService);
    if (!serviceJobs.length) return null;
    return serviceJobs.reduce((latest, job) => {
      const jd = new Date(`${job.date}T${job.time}`).getTime();
      const ld = new Date(`${latest.date}T${latest.time}`).getTime();
      return jd > ld ? job : latest;
    });
  }, [jobs]);

  return (
    <TrackerContext.Provider value={{
      vehicles, jobs, isLoading,
      addJob, deleteJob, upsertVehicle, deleteVehicle,
      getJobsForVehicle, getLastService, getLastServiceEntry,
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
