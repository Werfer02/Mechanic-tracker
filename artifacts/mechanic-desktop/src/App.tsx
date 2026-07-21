import { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  useCreateSyncRoom,
  useGetSyncRoom,
  usePushSyncRoom,
  getGetSyncRoomQueryKey,
} from '@workspace/api-client-react';

const queryClient = new QueryClient();

// ── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  createdAt: string;
}

interface Job {
  id: string;
  vehicleRegistration: string;
  date: string;
  time: string;
  description: string;
  notes: string;
  isService: boolean;
  createdAt: string;
}

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const LS_KEY = 'mechanic_desktop_sync_code';

// ── Number plate component ───────────────────────────────────────────────────

function NumberPlate({ reg, size = 'md' }: { reg: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };
  return (
    <span
      className={`inline-block font-bold rounded ${sizes[size]}`}
      style={{
        background: '#FFF9C4',
        color: '#1A1A00',
        border: '2px solid #E6D800',
        letterSpacing: '0.15em',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {reg.toUpperCase()}
    </span>
  );
}

// ── Add Job Modal ────────────────────────────────────────────────────────────

interface AddJobModalProps {
  vehicles: Vehicle[];
  defaultVehicleReg?: string;
  onAdd: (job: Job) => void;
  onClose: () => void;
}

function AddJobModal({ vehicles, defaultVehicleReg, onAdd, onClose }: AddJobModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [vehicleReg, setVehicleReg] = useState(defaultVehicleReg || vehicles[0]?.registration || '');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nowTime);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isService, setIsService] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleReg || !description.trim()) return;
    const job: Job = {
      id: genId(),
      vehicleRegistration: vehicleReg,
      date,
      time,
      description: description.trim(),
      notes: notes.trim(),
      isService,
      createdAt: new Date().toISOString(),
    };
    onAdd(job);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-6 shadow-2xl"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
      >
        <h2 className="text-lg font-semibold mb-5">Log New Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Vehicle</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={vehicleReg}
              onChange={e => setVehicleReg(e.target.value)}
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.registration}>
                  {v.registration} — {v.make} {v.model}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Date</label>
              <input
                type="date"
                className="w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Time</label>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Description</label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Oil change, brake pads..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Optional notes..."
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={`w-11 h-6 rounded-full transition-colors relative ${isService ? 'bg-primary' : 'bg-secondary border border-border'}`}
              onClick={() => setIsService(p => !p)}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isService ? 'left-5' : 'left-0.5'}`} />
            </div>
            <div>
              <div className="text-sm font-medium">Full Service</div>
              <div className="text-xs text-muted-foreground">Mark this job as a complete service</div>
            </div>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Log Job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pairing Screen ───────────────────────────────────────────────────────────

interface PairingScreenProps {
  onConnect: (code: string) => void;
}

function PairingScreen({ onConnect }: PairingScreenProps) {
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const createRoom = useCreateSyncRoom();

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }
    setError('');
    onConnect(code);
  }

  function handleNewRoom() {
    createRoom.mutate(undefined, {
      onSuccess: (data) => {
        onConnect(data.code.toUpperCase());
      },
      onError: () => {
        setError('Failed to create a sync room. Check the API server.');
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">Mechanic Tracker</span>
          </div>
          <p className="text-sm text-muted-foreground">Desktop companion — sync with your mobile app</p>
        </div>

        <div className="rounded-xl border p-6" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Enter Sync Code
              </label>
              <input
                type="text"
                maxLength={6}
                className="w-full rounded-md border px-4 py-3 text-2xl font-mono font-bold uppercase tracking-[0.5em] text-center bg-secondary border-border text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="XXXXXX"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">
                Open the Sync tab in the mobile app to find your code
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Connect
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground bg-card px-2">
              or
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewRoom}
            disabled={createRoom.isPending}
            className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {createRoom.isPending ? 'Creating...' : 'Create New Sync Room'}
          </button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Start fresh — then enter the generated code in your mobile app
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: Job }) {
  const dateStr = job.date ? new Date(job.date + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '—';

  return (
    <div
      className="flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-secondary/50"
      style={{ borderColor: 'hsl(var(--border))' }}
    >
      {/* Date column */}
      <div className="min-w-[90px] text-right">
        <div className="text-xs text-muted-foreground">{dateStr}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{job.time}</div>
      </div>

      {/* Divider */}
      <div className="w-px self-stretch bg-border" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground leading-snug">{job.description}</span>
          {job.isService && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ background: 'hsl(142 71% 45% / 0.15)', color: '#22C55E', border: '1px solid hsl(142 71% 45% / 0.3)' }}
            >
              Service
            </span>
          )}
        </div>
        {job.notes && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{job.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Workshop View ────────────────────────────────────────────────────────────

interface WorkshopViewProps {
  syncCode: string;
  onDisconnect: () => void;
}

function WorkshopView({ syncCode, onDisconnect }: WorkshopViewProps) {
  const queryClient = useQueryClient();
  const [selectedReg, setSelectedReg] = useState<string | null>(null);
  const [showAddJob, setShowAddJob] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [localJobs, setLocalJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const pushRoom = usePushSyncRoom();
  const hasInitialized = useRef(false);

  const { data, isLoading, isError, refetch } = useGetSyncRoom(syncCode, {
    query: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  });

  const vehicles: Vehicle[] = data?.vehicles || [];
  const remoteJobs: Job[] = data?.jobs || [];

  // Merge remote + local jobs (union by id)
  const allJobs = [
    ...remoteJobs,
    ...localJobs.filter(lj => !remoteJobs.find(rj => rj.id === lj.id)),
  ];

  // Auto-select first vehicle on load
  useEffect(() => {
    if (!hasInitialized.current && vehicles.length > 0) {
      setSelectedReg(vehicles[0].registration);
      hasInitialized.current = true;
    }
  }, [vehicles]);

  const selectedVehicle = vehicles.find(v => v.registration === selectedReg) || null;
  const vehicleJobs = allJobs
    .filter(j => j.vehicleRegistration === selectedReg)
    .filter(j => !search || j.description.toLowerCase().includes(search.toLowerCase()) || j.notes.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const da = new Date(`${a.date}T${a.time}`).getTime();
      const db = new Date(`${b.date}T${b.time}`).getTime();
      return db - da;
    });

  const lastService = vehicleJobs.find(j => j.isService);
  const lastWork = vehicleJobs[0];

  async function handleSync() {
    setSyncStatus('syncing');
    try {
      const latest = await refetch();
      const remoteV = latest.data?.vehicles || [];
      const remoteJ = latest.data?.jobs || [];

      const mergedVehicles = [
        ...remoteV,
        ...(vehicles.filter(lv => !remoteV.find(rv => rv.id === lv.id))),
      ];
      const mergedJobs = [
        ...remoteJ,
        ...localJobs.filter(lj => !remoteJ.find(rj => rj.id === lj.id)),
      ];

      await pushRoom.mutateAsync({
        code: syncCode,
        data: { vehicles: mergedVehicles, jobs: mergedJobs },
      });

      setLocalJobs([]);
      queryClient.invalidateQueries({ queryKey: getGetSyncRoomQueryKey(syncCode) });
      setLastSync(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      setSyncStatus('ok');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }

  async function handleAddJob(job: Job) {
    const updatedLocalJobs = [...localJobs, job];
    setLocalJobs(updatedLocalJobs);
    setShowAddJob(false);
    if (!selectedReg) setSelectedReg(job.vehicleRegistration);

    // Push immediately
    try {
      const mergedJobs = [
        ...remoteJobs,
        ...updatedLocalJobs.filter(lj => !remoteJobs.find(rj => rj.id === lj.id)),
      ];
      await pushRoom.mutateAsync({
        code: syncCode,
        data: { vehicles, jobs: mergedJobs },
      });
      setLocalJobs([]);
      queryClient.invalidateQueries({ queryKey: getGetSyncRoomQueryKey(syncCode) });
    } catch {
      // Jobs are stored in localJobs and will push on next sync
    }
  }

  function handleDisconnect() {
    localStorage.removeItem(LS_KEY);
    onDisconnect();
  }

  function copyCode() {
    navigator.clipboard.writeText(syncCode).catch(() => {});
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <svg className="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="font-semibold text-sm">Mechanic Tracker</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync code badge */}
          <button
            onClick={copyCode}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-mono font-bold hover:bg-secondary transition-colors"
            title="Click to copy sync code"
          >
            <span className="text-muted-foreground">Code:</span>
            <span className="text-primary tracking-widest">{syncCode}</span>
            <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>

          {/* Sync status */}
          {lastSync && syncStatus === 'idle' && (
            <span className="text-xs text-muted-foreground hidden sm:inline">Synced {lastSync}</span>
          )}
          {syncStatus === 'ok' && (
            <span className="text-xs text-green-500 font-medium">Synced</span>
          )}
          {syncStatus === 'error' && (
            <span className="text-xs text-destructive font-medium">Sync failed</span>
          )}

          <button
            onClick={handleSync}
            disabled={syncStatus === 'syncing'}
            className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
          </button>

          <button
            onClick={handleDisconnect}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1.5"
            title="Disconnect"
          >
            Disconnect
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar: Vehicles ── */}
        <aside className="w-64 border-r border-border flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Vehicles
              {vehicles.length > 0 && (
                <span className="ml-2 text-muted-foreground/60">{vehicles.length}</span>
              )}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {isLoading && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading...</div>
            )}
            {isError && (
              <div className="px-4 py-4 text-center text-xs text-destructive">
                Room not found or connection error.
                <button onClick={() => refetch()} className="block mx-auto mt-2 text-primary hover:underline">Retry</button>
              </div>
            )}
            {!isLoading && !isError && vehicles.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No vehicles yet.
                <br />
                Add one from the mobile app.
              </div>
            )}
            {vehicles.map(v => {
              const jobCount = allJobs.filter(j => j.vehicleRegistration === v.registration).length;
              const isSelected = v.registration === selectedReg;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedReg(v.registration)}
                  className={`w-full text-left px-4 py-3 transition-colors group ${isSelected ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                >
                  <NumberPlate reg={v.registration} size="sm" />
                  <div className="mt-1.5 text-xs text-muted-foreground truncate">
                    {v.make} {v.model}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground/60">
                    {jobCount} {jobCount === 1 ? 'job' : 'jobs'}
                  </div>
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Main: Jobs ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedVehicle ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              {vehicles.length > 0 ? 'Select a vehicle' : 'No vehicles to show'}
            </div>
          ) : (
            <>
              {/* Vehicle header */}
              <div className="px-6 py-4 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <NumberPlate reg={selectedVehicle.registration} size="lg" />
                    <div className="mt-2 text-sm text-muted-foreground">
                      {selectedVehicle.make} {selectedVehicle.model}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      {lastWork && (
                        <span>
                          Last work: <span className="text-foreground">{lastWork.date ? new Date(lastWork.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                        </span>
                      )}
                      {lastService && (
                        <span>
                          Last service: <span className="text-green-500 font-medium">{lastService.date ? new Date(lastService.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                        </span>
                      )}
                      {vehicleJobs.length === 0 && <span>No jobs logged yet</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAddJob(true)}
                    className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Log Job
                  </button>
                </div>

                {/* Search */}
                <div className="mt-3 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="search"
                    className="w-full rounded-md border border-border bg-secondary pl-9 pr-4 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Search jobs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Jobs list */}
              <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
                {vehicleJobs.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {search ? 'No jobs match your search' : 'No jobs logged for this vehicle'}
                  </div>
                )}
                {vehicleJobs.map(job => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {showAddJob && (
        <AddJobModal
          vehicles={vehicles}
          defaultVehicleReg={selectedReg || undefined}
          onAdd={handleAddJob}
          onClose={() => setShowAddJob(false)}
        />
      )}
    </div>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────

function AppInner() {
  const [syncCode, setSyncCode] = useState<string | null>(null);

  useEffect(() => {
    // Check URL param first
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode) {
      const code = urlCode.toUpperCase();
      localStorage.setItem(LS_KEY, code);
      history.replaceState(null, '', window.location.pathname);
      setSyncCode(code);
      return;
    }
    // Fall back to localStorage
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setSyncCode(stored.toUpperCase());
  }, []);

  function handleConnect(code: string) {
    localStorage.setItem(LS_KEY, code);
    setSyncCode(code);
  }

  function handleDisconnect() {
    setSyncCode(null);
  }

  if (!syncCode) {
    return <PairingScreen onConnect={handleConnect} />;
  }

  return <WorkshopView key={syncCode} syncCode={syncCode} onDisconnect={handleDisconnect} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
