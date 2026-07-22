import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  setBaseUrl,
  createSyncRoom,
  getSyncRoom,
  pushSyncRoom,
} from '@workspace/api-client-react';

const queryClient = new QueryClient();

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  mileage?: number;
  createdAt: string;
  _deleted?: boolean;
  _deletedAt?: string;
}

interface Job {
  id: string;
  vehicleRegistration: string;
  date: string;
  time: string;
  description: string;
  notes: string;
  isService: boolean;
  mileageAtService?: number;
  createdAt: string;
  _deleted?: boolean;
  _deletedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const LS_VEHICLES  = 'mechanic_desktop_vehicles';
const LS_JOBS      = 'mechanic_desktop_jobs';
const LS_SYNC_CODE = 'mechanic_desktop_sync_code';
const LS_THEME      = 'mechanic_desktop_theme';
const LS_SERVER_URL = 'mechanic_desktop_api_url';

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=16&bgcolor=1A1D27&color=F0F0F5&data=${encodeURIComponent(data)}`;
}

/**
 * Build the string encoded inside the QR code.
 *
 * When the desktop has a server URL configured (e.g. http://192.168.1.x:8080)
 * we embed the full mobile-compatible API base plus the code as a query param:
 *   http://192.168.1.x:8080/api?code=ABC123
 *
 * The mobile QR scanner parses this URL, extracts the code *and* the server URL
 * in one step — zero manual configuration needed.
 *
 * When no server URL is set we fall back to just the plain code so existing
 * manual-entry flows keep working.
 */
function makeQrData(code: string, serverUrl: string): string {
  if (!serverUrl) return code;
  // Desktop convention: serverUrl has NO /api suffix (e.g. "http://x:8080").
  // Mobile convention: needs /api appended.  Avoid double-appending.
  const base = serverUrl.replace(/\/+$/, '');
  const mobileBase = base.endsWith('/api') ? base : `${base}/api`;
  return `${mobileBase}?code=${code}`;
}

function mergeById<T extends { id: string }>(remote: T[], local: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local)  map.set(item.id, item); // local wins same-id
  return Array.from(map.values());
}

const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Drop tombstones that are old enough that both devices have had time to sync them. */
function purgeOldTombstones<T extends { _deleted?: boolean; _deletedAt?: string }>(items: T[]): T[] {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  return items.filter(item => {
    if (!item._deleted) return true;                         // not a tombstone — keep
    if (!item._deletedAt) return false;                     // no timestamp — purge now
    return new Date(item._deletedAt).getTime() > cutoff;   // keep if still within TTL
  });
}

// ── useDesktopStore ───────────────────────────────────────────────────────────
// Persistent local store — uses IndexedDB (via idb) for vehicles/jobs.
import { loadVehicles, loadJobs, saveVehicles, saveJobs } from './db';

function useDesktopStore() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs,     setJobs]     = useState<Job[]>([]);

  // Load from IndexedDB on mount; migrate any existing localStorage data once.
  useEffect(() => {
    (async () => {
      try {
        let v = await loadVehicles() as Vehicle[];
        let j = await loadJobs() as Job[];
        // One-time migration from localStorage
        if (v.length === 0) {
          const lsV = localStorage.getItem(LS_VEHICLES);
          if (lsV) { v = JSON.parse(lsV); await saveVehicles(v); localStorage.removeItem(LS_VEHICLES); }
        }
        if (j.length === 0) {
          const lsJ = localStorage.getItem(LS_JOBS);
          if (lsJ) { j = JSON.parse(lsJ); await saveJobs(j); localStorage.removeItem(LS_JOBS); }
        }
        setVehicles(v);
        setJobs(j);
      } catch { /* ignore */ }
    })();
  }, []);

  // Persist to IndexedDB whenever state changes (fire-and-forget).
  useEffect(() => { saveVehicles(vehicles).catch(() => {}); }, [vehicles]);
  useEffect(() => { saveJobs(jobs).catch(() => {}); }, [jobs]);

  /** Upsert a vehicle by registration. Make/model are optional. Un-deletes if previously deleted. */
  const upsertVehicle = useCallback((reg: string, make = '', model = '', mileage?: number): Vehicle => {
    const r = reg.toUpperCase().trim().replace(/\s+/g, '');
    let result: Vehicle | undefined;
    setVehicles(prev => {
      const existing = prev.find(v => v.registration === r);
      if (existing) {
        const updated = prev.map(v =>
          v.registration === r
            ? { ...v, _deleted: undefined, make: make || v.make, model: model || v.model, ...(mileage !== undefined ? { mileage } : {}) }
            : v
        );
        result = updated.find(v => v.registration === r);
        return updated;
      }
      const newV: Vehicle = { id: genId(), registration: r, make, model, ...(mileage !== undefined ? { mileage } : {}), createdAt: new Date().toISOString() };
      result = newV;
      return [...prev, newV];
    });
    return result ?? { id: genId(), registration: r, make, model, createdAt: new Date().toISOString() };
  }, []);

  const addJob = useCallback((data: Omit<Job, 'id' | 'createdAt'>): Job => {
    const job: Job = { ...data, id: genId(), createdAt: new Date().toISOString() };
    setJobs(prev => [job, ...prev]);
    return job;
  }, []);

  const deleteVehicle = useCallback((reg: string) => {
    const now = new Date().toISOString();
    setVehicles(prev => prev.map(v => v.registration === reg ? { ...v, _deleted: true, _deletedAt: now } : v));
    setJobs(prev => prev.map(j => j.vehicleRegistration === reg ? { ...j, _deleted: true, _deletedAt: now } : j));
  }, []);

  const deleteJob = useCallback((id: string) => {
    const now = new Date().toISOString();
    setJobs(prev => prev.map(j => j.id === id ? { ...j, _deleted: true, _deletedAt: now } : j));
  }, []);

  const updateJob = useCallback((id: string, changes: Partial<Omit<Job, 'id' | 'vehicleRegistration' | 'createdAt'>>) => {
    setJobs(prev => prev.map(j => j.id === id && !j._deleted ? { ...j, ...changes } : j));
  }, []);

  /** Overwrite all data — used by sync merge. */
  const replaceAll = useCallback((newV: Vehicle[], newJ: Job[]) => {
    setVehicles(newV);
    setJobs(newJ);
  }, []);

  // Filtered views for UI (tombstones hidden); raw arrays go to sync
  const visibleVehicles = vehicles.filter(v => !v._deleted);
  const visibleJobs     = jobs.filter(j => !j._deleted);

  return {
    vehicles: visibleVehicles,
    jobs: visibleJobs,
    syncVehicles: vehicles,
    syncJobs: jobs,
    upsertVehicle, addJob, updateJob, deleteVehicle, deleteJob, replaceAll,
  };
}

// ── useSyncDesktop ────────────────────────────────────────────────────────────
// Optional sync room connection. Polls every 8 s when connected.

type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error';

function useSyncDesktop(
  vehicles: Vehicle[],
  jobs: Job[],
  replaceAll: (v: Vehicle[], j: Job[]) => void,
) {
  const [syncCode,   setSyncCode]   = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [syncError,  setSyncError]  = useState<string | null>(null);
  const syncingRef = useRef(false);

  // Keep refs current so intervals don't capture stale values
  const vehiclesRef   = useRef(vehicles);
  const jobsRef       = useRef(jobs);
  const replaceAllRef = useRef(replaceAll);
  useEffect(() => { vehiclesRef.current   = vehicles;   }, [vehicles]);
  useEffect(() => { jobsRef.current       = jobs;       }, [jobs]);
  useEffect(() => { replaceAllRef.current = replaceAll; }, [replaceAll]);

  // Load saved code on mount
  useEffect(() => {
    const stored = localStorage.getItem(LS_SYNC_CODE);
    if (stored) setSyncCode(stored.toUpperCase());
  }, []);

  const doSync = useCallback(async (code: string) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const remote = await getSyncRoom(code);
      const mergedV = purgeOldTombstones(mergeById(remote.vehicles as Vehicle[], vehiclesRef.current));
      const mergedJ = purgeOldTombstones(mergeById(remote.jobs     as Job[],     jobsRef.current));
      await pushSyncRoom(code, { vehicles: mergedV, jobs: mergedJ });
      replaceAllRef.current(mergedV, mergedJ);
      setLastSynced(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      setSyncStatus('ok');
      setTimeout(() => setSyncStatus(s => s === 'ok' ? 'idle' : s), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
      setSyncStatus('error');
      setSyncError(msg);
      setTimeout(() => setSyncStatus(s => s === 'error' ? 'idle' : s), 5000);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Auto-poll every 8 s when connected
  useEffect(() => {
    if (!syncCode) return;
    const id = setInterval(() => doSync(syncCode), 8000);
    return () => clearInterval(id);
  }, [syncCode, doSync]);

  const connect = useCallback(async (code: string): Promise<{ ok: boolean; error?: string }> => {
    const upper = code.toUpperCase().trim();
    // Validate the room exists first
    try {
      await getSyncRoom(upper);
    } catch {
      return { ok: false, error: 'Room not found — check the code and try again.' };
    }
    localStorage.setItem(LS_SYNC_CODE, upper);
    setSyncCode(upper);
    // Immediate sync using the returned code (state update is async)
    await doSync(upper);
    return { ok: true };
  }, [doSync]);

  const createAndConnect = useCallback(async (): Promise<{ code: string } | { error: string }> => {
    try {
      const res = await createSyncRoom();
      const code = res.code.toUpperCase();
      localStorage.setItem(LS_SYNC_CODE, code);
      setSyncCode(code);
      await doSync(code);
      return { code };
    } catch {
      return { error: 'Could not create sync room. Is the API server running?' };
    }
  }, [doSync]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(LS_SYNC_CODE);
    setSyncCode(null);
    setSyncStatus('idle');
    setSyncError(null);
    setLastSynced(null);
  }, []);

  const syncNow = useCallback(() => {
    if (syncCode) doSync(syncCode);
  }, [syncCode, doSync]);

  return { syncCode, syncStatus, lastSynced, syncError, connect, createAndConnect, disconnect, syncNow };
}

// ── useTheme ──────────────────────────────────────────────────────────────────
// Persists light/dark choice to localStorage and toggles `.dark` on <html>.

function useTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(LS_THEME);
    const dark = stored ? stored === 'dark' : true; // default: dark workshop
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggle = useCallback(() => {
    setIsDark(d => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem(LS_THEME, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return { isDark, toggle };
}

// ── useServerUrl ──────────────────────────────────────────────────────────────
// Persists the API server base URL to localStorage and keeps setBaseUrl() in sync.
// When url is empty, setBaseUrl(null) is called so the client uses relative paths
// (works with the Vite dev proxy, or when desktop is served from same origin as API).

function useServerUrl() {
  const [serverUrl, setServerUrlState] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(LS_SERVER_URL);
    // When no URL has ever been saved, default to the current page origin.
    // In Docker this is http://192.168.1.x:8080 — nginx there already proxies
    // /api/ to the API container, so mobile can hit the same host:port.
    // The user can still override it manually if needed.
    const url = (stored !== null && stored !== '') ? stored : window.location.origin;
    setServerUrlState(url);
    setBaseUrl(url || null);
  }, []);

  const updateServerUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    localStorage.setItem(LS_SERVER_URL, trimmed);
    setServerUrlState(trimmed);
    setBaseUrl(trimmed || null);
  }, []);

  return { serverUrl, updateServerUrl };
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function NumberPlate({ reg, size = 'md' }: { reg: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1', lg: 'text-base px-4 py-1.5' };
  return (
    <span className={`inline-block font-bold rounded ${sz[size]}`}
      style={{ background: '#FFF9C4', color: '#1A1A00', border: '2px solid #E6D800', letterSpacing: '0.15em' }}>
      {reg.toUpperCase()}
    </span>
  );
}

function Modal({ onClose, children, maxW = 'max-w-md' }: { onClose: () => void; children: React.ReactNode; maxW?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full ${maxW} rounded-xl border shadow-2xl`}
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{children}</label>;
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={`w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${className}`} {...props} />
  );
}

function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none ${className}`} {...props} />
  );
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-primary' : 'bg-secondary border border-border'}`}
        onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </label>
  );
}

function Btn({ variant = 'primary', className = '', children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const base = 'rounded-md px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 inline-flex items-center gap-1.5';
  const styles = {
    primary:   'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'border border-border text-foreground hover:bg-secondary',
    ghost:     'text-muted-foreground hover:text-foreground hover:bg-secondary',
    danger:    'text-destructive hover:bg-destructive/10 border border-destructive/30',
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const GearIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const SyncIcon = ({ spin }: { spin?: boolean }) => (
  <svg className={`w-3.5 h-3.5 ${spin ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const QrIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    <path d="M14 14h3v3m0 4v-4m4 4v-7h-4" />
  </svg>
);

const SunIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4" />
    <path strokeLinecap="round" d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// ── ConfirmModal ──────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal onClose={onCancel}>
      <div className="p-6">
        <h2 className="text-base font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex gap-3">
          <Btn variant="secondary" onClick={onCancel} className="flex-1">Cancel</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="flex-1">{confirmLabel}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── AddVehicleModal ───────────────────────────────────────────────────────────

function AddVehicleModal({ onAdd, onClose }: {
  onAdd: (reg: string, make: string, model: string) => void;
  onClose: () => void;
}) {
  const [reg, setReg] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = reg.trim().toUpperCase().replace(/\s+/g, '');
    if (!r) { setError('Registration is required'); return; }
    onAdd(r, make.trim(), model.trim());
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-5">Add Vehicle</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <FieldLabel>Registration <span className="text-destructive">*</span></FieldLabel>
            <Input placeholder="e.g. AB12 CDE" value={reg} onChange={e => setReg(e.target.value.toUpperCase())} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Make <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></FieldLabel>
              <Input placeholder="e.g. Ford" value={make} onChange={e => setMake(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Model <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span></FieldLabel>
              <Input placeholder="e.g. Focus" value={model} onChange={e => setModel(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 pt-1">
            <Btn variant="secondary" type="button" onClick={onClose} className="flex-1">Cancel</Btn>
            <Btn variant="primary" type="submit" className="flex-1">Add Vehicle</Btn>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ── AddJobModal ───────────────────────────────────────────────────────────────

function AddJobModal({ vehicles, defaultReg, onAdd, onClose }: {
  vehicles: Vehicle[];
  defaultReg?: string;
  onAdd: (reg: string, make: string, model: string, job: Omit<Job, 'id' | 'createdAt' | 'vehicleRegistration'>) => void;
  onClose: () => void;
}) {
  const today   = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [regInput, setRegInput]     = useState(defaultReg || (vehicles[0]?.registration ?? ''));
  const [make, setMake]             = useState('');
  const [model, setModel]           = useState('');
  const [date, setDate]             = useState(today);
  const [time, setTime]             = useState(nowTime);
  const [description, setDesc]      = useState('');
  const [notes, setNotes]           = useState('');
  const [isService, setIsService]   = useState(false);
  const [mileageInput, setMileageInput] = useState('');
  const [showNewVehicle, setShowNew] = useState(false);

  const reg = regInput.trim().toUpperCase().replace(/\s+/g, '');
  const existingVehicle = vehicles.find(v => v.registration === reg);
  const isNewVehicle = reg.length > 0 && !existingVehicle;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reg || !description.trim()) return;
    const mileage = mileageInput.trim() ? parseInt(mileageInput.trim(), 10) : undefined;
    onAdd(reg, make.trim(), model.trim(), {
      date, time,
      description: description.trim(),
      notes: notes.trim(),
      isService,
      ...(mileage !== undefined ? { mileageAtService: mileage } : {}),
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-5">Log Job</h2>
        <form onSubmit={submit} className="space-y-4">

          {/* Vehicle */}
          <div>
            <FieldLabel>Vehicle Registration <span className="text-destructive">*</span></FieldLabel>
            {vehicles.length > 0 ? (
              <div className="space-y-2">
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  value={existingVehicle ? reg : '__new__'}
                  onChange={e => {
                    if (e.target.value === '__new__') { setRegInput(''); setShowNew(true); }
                    else { setRegInput(e.target.value); setShowNew(false); }
                  }}
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.registration}>
                      {v.registration}{v.make ? ` — ${v.make} ${v.model}`.trim() : ''}
                    </option>
                  ))}
                  <option value="__new__">+ New vehicle…</option>
                </select>
                {showNewVehicle && (
                  <div className="rounded-md border border-border p-3 space-y-2" style={{ background: 'hsl(var(--background))' }}>
                    <Input
                      placeholder="Registration (e.g. AB12 CDE)"
                      value={regInput}
                      onChange={e => setRegInput(e.target.value.toUpperCase())}
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Make (optional)" value={make} onChange={e => setMake(e.target.value)} />
                      <Input placeholder="Model (optional)" value={model} onChange={e => setModel(e.target.value)} />
                    </div>
                    {isNewVehicle && (
                      <p className="text-xs text-muted-foreground">
                        Vehicle <strong className="text-foreground">{reg}</strong> will be created automatically.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Registration (e.g. AB12 CDE)"
                  value={regInput}
                  onChange={e => setRegInput(e.target.value.toUpperCase())}
                  autoFocus
                  required
                />
                {isNewVehicle && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Make (optional)" value={make} onChange={e => setMake(e.target.value)} />
                    <Input placeholder="Model (optional)" value={model} onChange={e => setModel(e.target.value)} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Date</FieldLabel>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div>
              <FieldLabel>Time</FieldLabel>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
            </div>
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description <span className="text-destructive">*</span></FieldLabel>
            <Input placeholder="e.g. Oil change, brake pads..." value={description} onChange={e => setDesc(e.target.value)} required />
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Notes</FieldLabel>
            <Textarea placeholder="Optional notes..." rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Full Service toggle */}
          <Toggle checked={isService} onChange={setIsService} label="Full Service" sub="Mark this job as a complete service" />

          {/* Mileage at Service — only shown when Full Service is toggled */}
          {isService && (
            <div>
              <FieldLabel>Mileage at Service (optional)</FieldLabel>
              <Input
                type="number"
                placeholder="e.g. 45000 km"
                value={mileageInput}
                onChange={e => setMileageInput(e.target.value)}
                min={0}
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Btn variant="secondary" type="button" onClick={onClose} className="flex-1">Cancel</Btn>
            <Btn variant="primary" type="submit" className="flex-1" disabled={!reg || !description.trim()}>Log Job</Btn>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ── EditVehicleModal ──────────────────────────────────────────────────────────

function EditVehicleModal({ vehicle, onSave, onClose }: {
  vehicle: Vehicle;
  onSave: (make: string, model: string, mileage?: number) => void;
  onClose: () => void;
}) {
  const [make, setMake]         = useState(vehicle.make);
  const [model, setModel]       = useState(vehicle.model);
  const [mileageInput, setMileage] = useState(vehicle.mileage?.toString() ?? '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mileage = mileageInput.trim() ? parseInt(mileageInput.trim(), 10) : undefined;
    onSave(make.trim(), model.trim(), mileage);
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Edit Vehicle</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <NumberPlate reg={vehicle.registration} size="sm" />
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Make</FieldLabel>
              <Input placeholder="e.g. Ford" value={make} onChange={e => setMake(e.target.value)} autoFocus />
            </div>
            <div>
              <FieldLabel>Model</FieldLabel>
              <Input placeholder="e.g. Focus" value={model} onChange={e => setModel(e.target.value)} />
            </div>
          </div>
          <div>
            <FieldLabel>Mileage (optional)</FieldLabel>
            <Input
              type="number"
              placeholder="e.g. 45000"
              value={mileageInput}
              onChange={e => setMileage(e.target.value)}
              min={0}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Btn variant="secondary" type="button" onClick={onClose} className="flex-1">Cancel</Btn>
            <Btn variant="primary" type="submit" className="flex-1">Save Changes</Btn>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ── EditJobModal ──────────────────────────────────────────────────────────────

function EditJobModal({ job, onSave, onClose }: {
  job: Job;
  onSave: (id: string, changes: Partial<Omit<Job, 'id' | 'vehicleRegistration' | 'createdAt'>>) => void;
  onClose: () => void;
}) {
  const [date, setDate]               = useState(job.date);
  const [time, setTime]               = useState(job.time);
  const [description, setDesc]        = useState(job.description);
  const [notes, setNotes]             = useState(job.notes);
  const [isService, setIsService]     = useState(job.isService);
  const [mileageInput, setMileageInput] = useState(job.mileageAtService?.toString() ?? '');
  const [showDiscard, setShowDiscard] = useState(false);

  const isDirty =
    date !== job.date ||
    time !== job.time ||
    description.trim() !== job.description ||
    notes.trim() !== job.notes ||
    isService !== job.isService ||
    mileageInput.trim() !== (job.mileageAtService?.toString() ?? '');

  // Guard backdrop-click and Escape against unsaved changes
  const handleClose = () => {
    if (isDirty) { setShowDiscard(true); } else { onClose(); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    const mileage = mileageInput.trim() ? parseInt(mileageInput.trim(), 10) : undefined;
    onSave(job.id, {
      date, time,
      description: description.trim(),
      notes: notes.trim(),
      isService,
      mileageAtService: mileage,
    });
  }

  return (
    <>
      <Modal onClose={handleClose}>
        <div className="p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Edit Job</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vehicle: <NumberPlate reg={job.vehicleRegistration} size="sm" />
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Date</FieldLabel>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <FieldLabel>Time</FieldLabel>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
              </div>
            </div>
            {/* Description */}
            <div>
              <FieldLabel>Description <span className="text-destructive">*</span></FieldLabel>
              <Input
                placeholder="e.g. Oil change, brake pads..."
                value={description}
                onChange={e => setDesc(e.target.value)}
                required
                autoFocus
              />
            </div>
            {/* Notes */}
            <div>
              <FieldLabel>Notes</FieldLabel>
              <Textarea placeholder="Optional notes..." rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            {/* Full Service toggle */}
            <Toggle checked={isService} onChange={setIsService} label="Full Service" sub="Mark this job as a complete service" />
            {/* Mileage at Service */}
            {isService && (
              <div>
                <FieldLabel>Mileage at Service (optional)</FieldLabel>
                <Input
                  type="number"
                  placeholder="e.g. 45000 km"
                  value={mileageInput}
                  onChange={e => setMileageInput(e.target.value)}
                  min={0}
                />
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <Btn variant="secondary" type="button" onClick={handleClose} className="flex-1">Cancel</Btn>
              <Btn variant="primary" type="submit" className="flex-1" disabled={!description.trim()}>Save Changes</Btn>
            </div>
          </form>
        </div>
      </Modal>
      {showDiscard && (
        <ConfirmModal
          title="Discard changes?"
          message="Your edits haven't been saved. Go back anyway?"
          confirmLabel="Discard"
          danger={false}
          onConfirm={onClose}
          onCancel={() => setShowDiscard(false)}
        />
      )}
    </>
  );
}

// ── QrModal ───────────────────────────────────────────────────────────────────

function QrModal({ code, apiServerUrl, onClose }: { code: string; apiServerUrl: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const hasServerUrl = Boolean(apiServerUrl);
  function copy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Modal onClose={onClose}>
      <div className="p-6 text-center">
        <h2 className="text-base font-semibold mb-1">Connect Mobile App</h2>
        <p className="text-xs text-muted-foreground mb-5">
          {hasServerUrl
            ? 'Scan with the Mechanic Tracker app — server URL and code are embedded automatically.'
            : 'Scan with your phone, then enter the code in the Mechanic Tracker app\'s Sync tab. Set an API Server URL in Connect settings to auto-configure mobile.'}
        </p>
        <div className="flex justify-center mb-4">
          <img src={qrUrl(makeQrData(code, apiServerUrl))} alt="Sync QR" width={200} height={200} className="rounded-xl" style={{ background: '#1A1D27' }} />
        </div>
        <div className="flex items-center justify-center gap-2 mb-5">
          <span className="text-3xl font-mono font-bold tracking-[0.5em] text-primary">{code}</span>
          <button onClick={copy} className="p-1.5 rounded hover:bg-secondary transition-colors">
            {copied
              ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            }
          </button>
        </div>
        {!hasServerUrl && (
          <p className="text-[11px] text-amber-500/80 mb-4 text-left border border-amber-500/20 rounded-md p-2.5 bg-amber-500/5">
            ⚠ No API Server URL set — QR contains only the room code. Open "Connect to mobile", scroll to API Server URL, and enter the address you use to open this app (e.g. <span className="font-mono">http://192.168.1.x:8080</span>) so the QR auto-configures mobile.
          </p>
        )}
        <Btn variant="secondary" onClick={onClose} className="w-full justify-center">Close</Btn>
      </div>
    </Modal>
  );
}

// ── ConnectModal ──────────────────────────────────────────────────────────────

function ConnectModal({ onConnect, onClose, serverUrl, onServerUrlChange }: {
  onConnect: (code: string, isNew: boolean) => Promise<void>;
  onClose: () => void;
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
}) {
  const [tab, setTab]                       = useState<'join' | 'create'>('join');
  const [codeInput, setCode]                = useState('');
  const [busy, setBusy]                     = useState(false);
  const [error, setError]                   = useState('');
  const [freshCode, setFresh]               = useState<string | null>(null);
  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);
  const [urlSaved, setUrlSaved]             = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 6) { setError('Code must be 6 characters'); return; }
    setError(''); setBusy(true);
    await onConnect(code, false);
    setBusy(false);
  }

  async function handleCreate() {
    setError(''); setBusy(true);
    // We call onConnect with empty string to signal "create" — but we need
    // the result. Use createSyncRoom directly here for the QR preview step.
    try {
      const res = await createSyncRoom();
      const code = res.code.toUpperCase();
      setFresh(code);
    } catch {
      setError('Could not create sync room. Is the API server running?');
    } finally {
      setBusy(false);
    }
  }

  // After room is created, show QR step before connecting
  if (freshCode) {
    return (
      <Modal onClose={onClose}>
        <div className="p-6 text-center">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sync Room Created</p>
          <p className="text-xs text-muted-foreground mb-5">
            {serverUrl
              ? 'Scan with the Mechanic Tracker app — server URL and code are auto-embedded in the QR.'
              : 'Scan the QR code with your phone, then enter the code in the Sync tab — or connect now.'}
          </p>
          <div className="flex justify-center mb-4">
            <img src={qrUrl(makeQrData(freshCode, serverUrl))} alt="Sync QR" width={180} height={180} className="rounded-xl" style={{ background: '#1A1D27' }} />
          </div>
          <div className="text-2xl font-mono font-bold tracking-[0.5em] text-primary mb-6">{freshCode}</div>
          <Btn variant="primary" className="w-full justify-center mb-2" disabled={busy}
            onClick={async () => { setBusy(true); await onConnect(freshCode, true); setBusy(false); }}>
            {busy ? 'Connecting…' : 'Open Workshop'}
          </Btn>
          <Btn variant="ghost" className="w-full justify-center" onClick={onClose}>Maybe later</Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">Connect to Mobile</h2>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden mb-5 text-sm">
          {(['join', 'create'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2 font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
              {t === 'join' ? 'Enter Code' : 'New Room'}
            </button>
          ))}
        </div>

        {tab === 'join' ? (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <FieldLabel>6-character sync code</FieldLabel>
              <input
                type="text" maxLength={6} autoFocus
                className="w-full rounded-md border px-4 py-3 text-2xl font-mono font-bold uppercase tracking-[0.5em] text-center bg-secondary border-border text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="XXXXXX"
                value={codeInput}
                onChange={e => setCode(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground mt-2">Open the Sync tab in the mobile app to get your code</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Btn variant="primary" type="submit" className="w-full justify-center" disabled={busy}>
              {busy ? 'Connecting…' : 'Connect'}
            </Btn>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Create a fresh sync room. A QR code will appear so your mobile app can connect.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Btn variant="primary" className="w-full justify-center" disabled={busy} onClick={handleCreate}>
              {busy ? 'Creating…' : 'Create Sync Room'}
            </Btn>
          </div>
        )}

        {/* ── API Server URL ── */}
        <div className="mt-5 pt-4 border-t border-border">
          <FieldLabel>API Server URL</FieldLabel>
          <input
            type="text"
            className="w-full rounded-md border px-3 py-2 text-sm font-mono bg-secondary border-border text-foreground placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="http://192.168.1.x:8080"
            value={localServerUrl}
            onChange={e => setLocalServerUrl(e.target.value)}
          />
          <div className="flex items-center gap-2 mt-2">
            <Btn
              variant="secondary"
              className="text-xs py-1.5 px-3"
              onClick={() => {
                onServerUrlChange(localServerUrl);
                setUrlSaved(true);
                setTimeout(() => setUrlSaved(false), 2000);
              }}
            >
              {urlSaved ? '✓ Saved' : 'Save'}
            </Btn>
            <p className="text-xs text-muted-foreground">
              The address you use to open this app, e.g. <span className="font-mono">http://192.168.1.x:8080</span>. Auto-filled from your browser URL — only change if needed. The QR code uses this to auto-configure the mobile app.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── JobCard ───────────────────────────────────────────────────────────────────

function JobCard({ job, onDelete, onEdit }: { job: Job; onDelete: () => void; onEdit: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dateStr = job.date ? fmtDate(job.date) : '—';

  return (
    <>
      <div className="group flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-secondary/40"
        style={{ borderColor: 'hsl(var(--border))' }}>
        <div className="min-w-[90px] text-right shrink-0">
          <div className="text-xs text-muted-foreground">{dateStr}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{job.time}</div>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium leading-snug">{job.description}</span>
            {job.isService && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{ background: 'hsl(142 71% 45% / 0.15)', color: '#22C55E', border: '1px solid hsl(142 71% 45% / 0.3)' }}>
                Service{job.mileageAtService !== undefined ? ` · ${job.mileageAtService.toLocaleString()} km` : ''}
              </span>
            )}
          </div>
          {job.notes && <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{job.notes}</p>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            title="Edit job">
            <PencilIcon />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Delete job">
            <TrashIcon />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete job?"
          message={`"${job.description}" on ${dateStr} will be permanently deleted.`}
          onConfirm={() => { onDelete(); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

// ── WorkshopView ──────────────────────────────────────────────────────────────

function WorkshopView() {
  const store     = useDesktopStore();
  const sync      = useSyncDesktop(store.syncVehicles, store.syncJobs, store.replaceAll);
  const theme     = useTheme();
  const serverCfg = useServerUrl();

  const { vehicles, jobs, upsertVehicle, addJob, updateJob, deleteVehicle, deleteJob } = store;
  const { syncCode, syncStatus, lastSynced, connect, createAndConnect, disconnect, syncNow } = sync;

  const [selectedReg, setSelectedReg]     = useState<string | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddJob, setShowAddJob]         = useState(false);
  const [showConnect, setShowConnect]       = useState(false);
  const [showQr, setShowQr]               = useState(false);
  const [connectError, setConnectError]   = useState('');
  const [confirmDeleteVehicle, setConfirmDeleteVehicle] = useState<Vehicle | null>(null);
  const [editingJob, setEditingJob]       = useState<Job | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [search, setSearch]               = useState('');
  const hasAutoSelected = useRef(false);

  // Auto-select first vehicle when list populates
  useEffect(() => {
    if (!hasAutoSelected.current && vehicles.length > 0) {
      setSelectedReg(vehicles[0].registration);
      hasAutoSelected.current = true;
    }
  }, [vehicles.length]);

  // If selected vehicle was deleted, reset
  useEffect(() => {
    if (selectedReg && !vehicles.find(v => v.registration === selectedReg)) {
      setSelectedReg(vehicles[0]?.registration ?? null);
    }
  }, [vehicles, selectedReg]);

  const selectedVehicle = vehicles.find(v => v.registration === selectedReg) ?? null;

  const vehicleJobs = jobs
    .filter(j => j.vehicleRegistration === selectedReg)
    .filter(j => !search || j.description.toLowerCase().includes(search.toLowerCase()) || j.notes.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

  const lastWork    = vehicleJobs[0] ?? null;
  const lastService = vehicleJobs.find(j => j.isService) ?? null;

  function handleAddVehicle(reg: string, make: string, model: string) {
    upsertVehicle(reg, make, model);
    setSelectedReg(reg);
    setShowAddVehicle(false);
  }

  function handleAddJob(reg: string, make: string, model: string, jobData: Omit<Job, 'id' | 'createdAt' | 'vehicleRegistration'>) {
    // Upsert vehicle — also updates mileage when a service with mileage is logged
    upsertVehicle(reg, make, model, jobData.mileageAtService);
    addJob({ ...jobData, vehicleRegistration: reg });
    setSelectedReg(reg);
    setShowAddJob(false);
  }

  async function handleConnect(code: string, _isNew: boolean) {
    setConnectError('');
    const result = await connect(code);
    if ('error' in result && result.error) {
      setConnectError(result.error);
      return;
    }
    setShowConnect(false);
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0 gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <GearIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Mechanic Tracker</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={theme.toggle}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme.isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          {syncCode ? (
            <>
              {/* Sync status */}
              {syncStatus === 'syncing' && <span className="text-xs text-primary animate-pulse font-medium">Syncing…</span>}
              {syncStatus === 'ok'      && <span className="text-xs font-medium" style={{ color: '#22C55E' }}>Synced</span>}
              {syncStatus === 'error'   && <span className="text-xs text-destructive font-medium">Sync failed</span>}
              {syncStatus === 'idle' && lastSynced && (
                <span className="text-xs text-muted-foreground hidden md:inline">Synced {lastSynced}</span>
              )}

              {/* QR / code badge */}
              <button onClick={() => setShowQr(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-mono font-bold hover:bg-secondary transition-colors"
                title="Show QR for mobile">
                <QrIcon /><span className="text-primary tracking-widest">{syncCode}</span>
              </button>

              <Btn variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={syncNow} disabled={syncStatus === 'syncing'}>
                <SyncIcon spin={syncStatus === 'syncing'} />
                <span className="hidden sm:inline">Sync</span>
              </Btn>

              <Btn variant="ghost" className="px-2.5 py-1.5 text-xs text-muted-foreground" onClick={disconnect}>
                Disconnect
              </Btn>
            </>
          ) : (
            <Btn variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => { setConnectError(''); setShowConnect(true); }}>
              <SyncIcon />
              Connect to mobile
            </Btn>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside className="w-64 border-r border-border flex flex-col shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Vehicles{vehicles.length > 0 && <span className="ml-1.5 opacity-60">{vehicles.length}</span>}
            </h2>
            <button onClick={() => setShowAddVehicle(true)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {vehicles.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="text-xs text-muted-foreground mb-3">No vehicles yet.</p>
                <button onClick={() => setShowAddVehicle(true)} className="text-xs text-primary hover:underline">Add your first vehicle</button>
              </div>
            )}
            {vehicles.map(v => {
              const jobCount = jobs.filter(j => j.vehicleRegistration === v.registration).length;
              const isSelected = v.registration === selectedReg;
              return (
                <div key={v.id} className={`group relative transition-colors ${isSelected ? 'bg-secondary' : 'hover:bg-secondary/50'}`}>
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />}
                  <button className="w-full text-left px-4 py-3" onClick={() => setSelectedReg(v.registration)}>
                    <NumberPlate reg={v.registration} size="sm" />
                    {(v.make || v.model) && (
                      <div className="mt-1.5 text-xs text-muted-foreground truncate">{v.make} {v.model}</div>
                    )}
                    <div className="mt-0.5 text-[10px] text-muted-foreground/60">{jobCount} {jobCount === 1 ? 'job' : 'jobs'}</div>
                  </button>
                  <button
                    onClick={() => setConfirmDeleteVehicle(v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Delete vehicle">
                    <TrashIcon />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedVehicle ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <GearIcon className="w-12 h-12 opacity-10" />
              <p className="text-sm">{vehicles.length > 0 ? 'Select a vehicle' : 'Add your first vehicle to get started'}</p>
              {vehicles.length === 0 && (
                <Btn variant="primary" onClick={() => setShowAddVehicle(true)}><PlusIcon /> Add Vehicle</Btn>
              )}
            </div>
          ) : (
            <>
              {/* Vehicle header */}
              <div className="px-6 py-4 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <NumberPlate reg={selectedVehicle.registration} size="lg" />
                      <button
                        onClick={() => setEditingVehicle(selectedVehicle)}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                        title="Edit vehicle">
                        <PencilIcon />
                      </button>
                    </div>
                    {(selectedVehicle.make || selectedVehicle.model) && (
                      <div className="mt-1.5 text-sm text-muted-foreground">
                        {selectedVehicle.make} {selectedVehicle.model}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-5 text-xs text-muted-foreground flex-wrap">
                      {lastWork && (
                        <span>Last work: <span className="text-foreground">{fmtDate(lastWork.date)}</span></span>
                      )}
                      {lastService && (
                        <span>Last service: <span className="font-medium" style={{ color: '#22C55E' }}>{fmtDate(lastService.date)}</span></span>
                      )}
                      {lastService?.mileageAtService !== undefined && (
                        <span>Service mileage: <span className="text-foreground">{lastService.mileageAtService.toLocaleString()} km</span></span>
                      )}
                      {selectedVehicle.mileage !== undefined && (
                        <span>Current mileage: <span className="text-foreground">{selectedVehicle.mileage.toLocaleString()} km</span></span>
                      )}
                      {vehicleJobs.length === 0 && !search && (
                        <span>No jobs logged yet</span>
                      )}
                    </div>
                  </div>
                  <Btn variant="primary" onClick={() => setShowAddJob(true)} className="shrink-0">
                    <PlusIcon /> Log Job
                  </Btn>
                </div>

                {/* Search */}
                <div className="mt-3 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                  </svg>
                  <input type="search"
                    className="w-full rounded-md border border-border bg-secondary pl-9 pr-4 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>

              {/* Job list */}
              <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
                {vehicleJobs.length === 0 && (
                  <div className="py-14 text-center text-sm text-muted-foreground">
                    {search ? 'No jobs match your search' : (
                      <div className="space-y-3">
                        <p>No jobs logged for this vehicle yet.</p>
                        <button onClick={() => setShowAddJob(true)} className="text-primary hover:underline text-sm">Log the first job</button>
                      </div>
                    )}
                  </div>
                )}
                {vehicleJobs.map(job => (
                  <JobCard key={job.id} job={job} onDelete={() => deleteJob(job.id)} onEdit={() => setEditingJob(job)} />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {showAddVehicle && (
        <AddVehicleModal onAdd={handleAddVehicle} onClose={() => setShowAddVehicle(false)} />
      )}
      {showAddJob && (
        <AddJobModal
          vehicles={vehicles}
          defaultReg={selectedReg ?? undefined}
          onAdd={handleAddJob}
          onClose={() => setShowAddJob(false)}
        />
      )}
      {showConnect && (
        <ConnectModal
          onConnect={handleConnect}
          onClose={() => setShowConnect(false)}
          serverUrl={serverCfg.serverUrl}
          onServerUrlChange={serverCfg.updateServerUrl}
        />
      )}
      {showQr && syncCode && (
        <QrModal code={syncCode} apiServerUrl={serverCfg.serverUrl} onClose={() => setShowQr(false)} />
      )}
      {confirmDeleteVehicle && (
        <ConfirmModal
          title="Delete vehicle?"
          message={`${confirmDeleteVehicle.registration} and all its jobs will be permanently deleted.`}
          onConfirm={() => { deleteVehicle(confirmDeleteVehicle.registration); setConfirmDeleteVehicle(null); }}
          onCancel={() => setConfirmDeleteVehicle(null)}
        />
      )}
      {editingVehicle && (
        <EditVehicleModal
          vehicle={editingVehicle}
          onSave={(make, model, mileage) => {
            upsertVehicle(editingVehicle.registration, make, model, mileage);
            setEditingVehicle(null);
          }}
          onClose={() => setEditingVehicle(null)}
        />
      )}
      {editingJob && (
        <EditJobModal
          job={editingJob}
          onSave={(id, changes) => {
            updateJob(id, changes);
            // Update vehicle mileage when a service mileage is edited
            if (changes.isService && changes.mileageAtService !== undefined) {
              upsertVehicle(editingJob.vehicleRegistration, '', '', changes.mileageAtService);
            }
            setEditingJob(null);
          }}
          onClose={() => setEditingJob(null)}
        />
      )}

      {connectError && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-destructive/50 bg-card px-4 py-3 text-sm text-destructive shadow-lg max-w-xs">
          {connectError}
          <button onClick={() => setConnectError('')} className="ml-3 text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkshopView />
    </QueryClientProvider>
  );
}
