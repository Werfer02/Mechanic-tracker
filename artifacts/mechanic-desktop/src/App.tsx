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

function qrUrl(code: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=16&bgcolor=1A1D27&color=F0F0F5&data=${encodeURIComponent(code)}`;
}

// ── Shared UI helpers ────────────────────────────────────────────────────────

function NumberPlate({ reg, size = 'md' }: { reg: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1', lg: 'text-base px-4 py-1.5' };
  return (
    <span
      className={`inline-block font-bold rounded ${sizes[size]}`}
      style={{ background: '#FFF9C4', color: '#1A1A00', border: '2px solid #E6D800', letterSpacing: '0.15em' }}
    >
      {reg.toUpperCase()}
    </span>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-xl border shadow-2xl"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
      >
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
    <input
      className={`w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none ${className}`}
      {...props}
    />
  );
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-primary' : 'bg-secondary border border-border'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </label>
  );
}

function BtnPrimary({ className = '', children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function BtnSecondary({ className = '', children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Add Vehicle Modal ─────────────────────────────────────────────────────────

function AddVehicleModal({ onAdd, onClose }: { onAdd: (v: Vehicle) => void; onClose: () => void }) {
  const [reg, setReg] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = reg.trim().toUpperCase().replace(/\s+/g, '');
    if (!r) { setError('Registration is required'); return; }
    if (!make.trim()) { setError('Make is required'); return; }
    if (!model.trim()) { setError('Model is required'); return; }
    onAdd({ id: genId(), registration: r, make: make.trim(), model: model.trim(), createdAt: new Date().toISOString() });
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-5">Add Vehicle</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Registration</FieldLabel>
            <Input
              placeholder="e.g. AB12 CDE"
              value={reg}
              onChange={e => setReg(e.target.value.toUpperCase())}
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Make</FieldLabel>
              <Input placeholder="e.g. Ford" value={make} onChange={e => setMake(e.target.value)} required />
            </div>
            <div>
              <FieldLabel>Model</FieldLabel>
              <Input placeholder="e.g. Focus" value={model} onChange={e => setModel(e.target.value)} required />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 pt-1">
            <BtnSecondary type="button" onClick={onClose} className="flex-1">Cancel</BtnSecondary>
            <BtnPrimary type="submit" className="flex-1">Add Vehicle</BtnPrimary>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ── Add Job Modal ─────────────────────────────────────────────────────────────

function AddJobModal({ vehicles, defaultVehicleReg, onAdd, onClose }: {
  vehicles: Vehicle[];
  defaultVehicleReg?: string;
  onAdd: (job: Job) => void;
  onClose: () => void;
}) {
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
    onAdd({
      id: genId(), vehicleRegistration: vehicleReg,
      date, time, description: description.trim(), notes: notes.trim(), isService,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-5">Log Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Vehicle</FieldLabel>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-secondary border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={vehicleReg}
              onChange={e => setVehicleReg(e.target.value)}
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.registration}>{v.registration} — {v.make} {v.model}</option>
              ))}
            </select>
          </div>
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
          <div>
            <FieldLabel>Description</FieldLabel>
            <Input placeholder="e.g. Oil change, brake pads..." value={description} onChange={e => setDescription(e.target.value)} required autoFocus />
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <Textarea placeholder="Optional notes..." rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <Toggle checked={isService} onChange={setIsService} label="Full Service" sub="Mark this job as a complete service" />
          <div className="flex gap-3 pt-1">
            <BtnSecondary type="button" onClick={onClose} className="flex-1">Cancel</BtnSecondary>
            <BtnPrimary type="submit" className="flex-1">Log Job</BtnPrimary>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// ── QR Modal ─────────────────────────────────────────────────────────────────

function QrModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Modal onClose={onClose}>
      <div className="p-6 text-center">
        <h2 className="text-base font-semibold mb-1">Connect Mobile App</h2>
        <p className="text-xs text-muted-foreground mb-5">Scan the QR code with your phone camera, then enter the code in the Mechanic Tracker mobile app Sync tab.</p>
        <div className="flex justify-center mb-4">
          <img
            src={qrUrl(code)}
            alt="Sync code QR"
            width={200}
            height={200}
            className="rounded-xl"
            style={{ background: '#1A1D27' }}
          />
        </div>
        <div className="flex items-center justify-center gap-2 mb-5">
          <span className="text-3xl font-mono font-bold tracking-[0.5em] text-primary">{code}</span>
          <button onClick={copy} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Copy code">
            {copied
              ? <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            }
          </button>
        </div>
        <BtnSecondary onClick={onClose} className="w-full">Close</BtnSecondary>
      </div>
    </Modal>
  );
}

// ── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: Job }) {
  const dateStr = job.date
    ? new Date(job.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  return (
    <div className="flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-secondary/50" style={{ borderColor: 'hsl(var(--border))' }}>
      <div className="min-w-[90px] text-right shrink-0">
        <div className="text-xs text-muted-foreground">{dateStr}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{job.time}</div>
      </div>
      <div className="w-px self-stretch bg-border" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground leading-snug">{job.description}</span>
          {job.isService && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ background: 'hsl(142 71% 45% / 0.15)', color: '#22C55E', border: '1px solid hsl(142 71% 45% / 0.3)' }}>
              Service
            </span>
          )}
        </div>
        {job.notes && <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{job.notes}</p>}
      </div>
    </div>
  );
}

// ── Pairing Screen ────────────────────────────────────────────────────────────

function PairingScreen({ onConnect }: { onConnect: (code: string) => void }) {
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [freshCode, setFreshCode] = useState<string | null>(null);
  const createRoom = useCreateSyncRoom();

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 6) { setError('Code must be 6 characters'); return; }
    setError('');
    onConnect(code);
  }

  function handleNewRoom() {
    createRoom.mutate(undefined, {
      onSuccess: (data) => setFreshCode(data.code.toUpperCase()),
      onError: () => setError('Failed to create a sync room. Is the API server running?'),
    });
  }

  // ── Fresh room created → show QR step ──
  if (freshCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
                <GearIcon className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold tracking-tight">Mechanic Tracker</span>
            </div>
          </div>

          <div className="rounded-xl border p-6 text-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Your Sync Room is Ready</p>
            <p className="text-xs text-muted-foreground mb-5">Scan this QR code with your phone, then enter the code in the Mechanic Tracker app's Sync tab.</p>

            <div className="flex justify-center mb-4">
              <img src={qrUrl(freshCode)} alt="Sync code QR" width={200} height={200} className="rounded-xl" style={{ background: '#1A1D27' }} />
            </div>

            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="text-3xl font-mono font-bold tracking-[0.5em] text-primary">{freshCode}</span>
            </div>

            <p className="text-xs text-muted-foreground mb-5">Or enter this code manually in the mobile app's Sync tab → Join Existing Room.</p>

            <BtnPrimary onClick={() => onConnect(freshCode)} className="w-full">
              Open Workshop
            </BtnPrimary>
          </div>
        </div>
      </div>
    );
  }

  // ── Default: enter code / create room ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <GearIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Mechanic Tracker</span>
          </div>
          <p className="text-sm text-muted-foreground">Desktop companion — sync with your mobile app</p>
        </div>

        <div className="rounded-xl border p-6" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <FieldLabel>Enter Sync Code</FieldLabel>
              <input
                type="text"
                maxLength={6}
                className="w-full rounded-md border px-4 py-3 text-2xl font-mono font-bold uppercase tracking-[0.5em] text-center bg-secondary border-border text-foreground placeholder-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="XXXXXX"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">Open the Sync tab in the mobile app to get your code</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <BtnPrimary type="submit" className="w-full">Connect</BtnPrimary>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs text-muted-foreground bg-card px-2">or</div>
          </div>

          <BtnSecondary type="button" onClick={handleNewRoom} disabled={createRoom.isPending} className="w-full">
            {createRoom.isPending ? 'Creating...' : 'Create New Sync Room'}
          </BtnSecondary>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Start fresh — a QR code will appear for your mobile app to scan
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
}

// ── Workshop View ─────────────────────────────────────────────────────────────

function WorkshopView({ syncCode, onDisconnect }: { syncCode: string; onDisconnect: () => void }) {
  const queryClient = useQueryClient();
  const [selectedReg, setSelectedReg] = useState<string | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [localVehicles, setLocalVehicles] = useState<Vehicle[]>([]);
  const [localJobs, setLocalJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState('');
  const pushRoom = usePushSyncRoom();
  const hasInitialized = useRef(false);
  const hasAutoSynced = useRef(false);

  const { data, isLoading, isError, refetch } = useGetSyncRoom(syncCode, {
    query: { retry: 2, refetchOnWindowFocus: false, refetchInterval: 8000 },
  });

  const remoteVehicles: Vehicle[] = data?.vehicles || [];
  const remoteJobs: Job[] = data?.jobs || [];

  // Merge remote + local (union by id)
  const allVehicles = [
    ...remoteVehicles,
    ...localVehicles.filter(lv => !remoteVehicles.find(rv => rv.id === lv.id)),
  ];
  const allJobs = [
    ...remoteJobs,
    ...localJobs.filter(lj => !remoteJobs.find(rj => rj.id === lj.id)),
  ];

  useEffect(() => {
    if (!hasInitialized.current && allVehicles.length > 0) {
      setSelectedReg(allVehicles[0].registration);
      hasInitialized.current = true;
    }
  }, [allVehicles.length]);

  // Auto-sync once when the room first loads successfully
  useEffect(() => {
    if (hasAutoSynced.current || isLoading || isError || !data) return;
    hasAutoSynced.current = true;
    handleSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isError, data]);

  const selectedVehicle = allVehicles.find(v => v.registration === selectedReg) || null;
  const vehicleJobs = allJobs
    .filter(j => j.vehicleRegistration === selectedReg)
    .filter(j => !search || j.description.toLowerCase().includes(search.toLowerCase()) || j.notes.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

  const lastService = vehicleJobs.find(j => j.isService);
  const lastWork = vehicleJobs[0];

  async function pushMerged(vOverride?: Vehicle[], jOverride?: Job[]) {
    const v = vOverride ?? allVehicles;
    const j = jOverride ?? allJobs;
    await pushRoom.mutateAsync({ code: syncCode, data: { vehicles: v, jobs: j } });
    setLocalVehicles([]);
    setLocalJobs([]);
    queryClient.invalidateQueries({ queryKey: getGetSyncRoomQueryKey(syncCode) });
  }

  async function handleSync() {
    setSyncStatus('syncing');
    try {
      const latest = await refetch();
      const rv = latest.data?.vehicles || [];
      const rj = latest.data?.jobs || [];
      const mergedV = [...rv, ...localVehicles.filter(lv => !rv.find(rv2 => rv2.id === lv.id))];
      const mergedJ = [...rj, ...localJobs.filter(lj => !rj.find(rj2 => rj2.id === lj.id))];
      await pushRoom.mutateAsync({ code: syncCode, data: { vehicles: mergedV, jobs: mergedJ } });
      setLocalVehicles([]);
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

  async function handleAddVehicle(vehicle: Vehicle) {
    const updatedVehicles = [...localVehicles, vehicle];
    setLocalVehicles(updatedVehicles);
    setShowAddVehicle(false);
    setSelectedReg(vehicle.registration);
    try {
      await pushMerged(
        [...remoteVehicles, ...updatedVehicles.filter(lv => !remoteVehicles.find(rv => rv.id === lv.id))],
        allJobs,
      );
    } catch { /* stored locally, will push on next sync */ }
  }

  async function handleAddJob(job: Job) {
    const updatedJobs = [...localJobs, job];
    setLocalJobs(updatedJobs);
    setShowAddJob(false);
    if (!selectedReg) setSelectedReg(job.vehicleRegistration);
    try {
      await pushMerged(
        allVehicles,
        [...remoteJobs, ...updatedJobs.filter(lj => !remoteJobs.find(rj => rj.id === lj.id))],
      );
    } catch { /* stored locally */ }
  }

  function handleDisconnect() {
    localStorage.removeItem(LS_KEY);
    onDisconnect();
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <GearIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Mechanic Tracker</span>
        </div>

        <div className="flex items-center gap-2">
          {/* QR button */}
          <button
            onClick={() => setShowQr(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-mono font-bold hover:bg-secondary transition-colors"
            title="Show QR code for mobile"
          >
            <svg className="w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              <path d="M14 14h3v3m0 4v-4m4 4v-7h-4" />
            </svg>
            <span className="text-primary tracking-widest">{syncCode}</span>
          </button>

          {/* Sync status */}
          {lastSync && syncStatus === 'idle' && (
            <span className="text-xs text-muted-foreground hidden md:inline">Synced {lastSync}</span>
          )}
          {syncStatus === 'ok' && <span className="text-xs text-green-500 font-medium">Synced</span>}
          {syncStatus === 'error' && <span className="text-xs text-destructive font-medium">Sync failed</span>}

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

          <button onClick={handleDisconnect} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1.5">
            Disconnect
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-64 border-r border-border flex flex-col shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Vehicles
              {allVehicles.length > 0 && <span className="ml-1.5 text-muted-foreground/60">{allVehicles.length}</span>}
            </h2>
            <button
              onClick={() => setShowAddVehicle(true)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              title="Add vehicle"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {isLoading && <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading...</div>}
            {isError && (
              <div className="px-4 py-4 text-center text-xs text-destructive">
                Room not found or connection error.
                <button onClick={() => refetch()} className="block mx-auto mt-2 text-primary hover:underline">Retry</button>
              </div>
            )}
            {!isLoading && !isError && allVehicles.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No vehicles yet.
                <br />
                <button onClick={() => setShowAddVehicle(true)} className="text-primary hover:underline mt-1 block mx-auto">Add one here</button>
                <span className="block mt-1">or sync from mobile.</span>
              </div>
            )}
            {allVehicles.map(v => {
              const jobCount = allJobs.filter(j => j.vehicleRegistration === v.registration).length;
              const isSelected = v.registration === selectedReg;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedReg(v.registration)}
                  className={`relative w-full text-left px-4 py-3 transition-colors ${isSelected ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                >
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />}
                  <NumberPlate reg={v.registration} size="sm" />
                  <div className="mt-1.5 text-xs text-muted-foreground truncate">{v.make} {v.model}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground/60">{jobCount} {jobCount === 1 ? 'job' : 'jobs'}</div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedVehicle ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <p className="text-sm">{allVehicles.length > 0 ? 'Select a vehicle from the sidebar' : 'Add your first vehicle to get started'}</p>
              {allVehicles.length === 0 && (
                <BtnPrimary onClick={() => setShowAddVehicle(true)}>Add Vehicle</BtnPrimary>
              )}
            </div>
          ) : (
            <>
              {/* Vehicle header */}
              <div className="px-6 py-4 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <NumberPlate reg={selectedVehicle.registration} size="lg" />
                    <div className="mt-1.5 text-sm text-muted-foreground">{selectedVehicle.make} {selectedVehicle.model}</div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {lastWork && (
                        <span>Last work: <span className="text-foreground">{new Date(lastWork.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
                      )}
                      {lastService && (
                        <span>Last service: <span className="font-medium" style={{ color: '#22C55E' }}>{new Date(lastService.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
                      )}
                      {vehicleJobs.length === 0 && <span>No jobs logged yet</span>}
                    </div>
                  </div>
                  <BtnPrimary onClick={() => setShowAddJob(true)} className="shrink-0 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Log Job
                  </BtnPrimary>
                </div>
                <div className="mt-3 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
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
                {vehicleJobs.map(job => <JobCard key={job.id} job={job} />)}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {showAddVehicle && <AddVehicleModal onAdd={handleAddVehicle} onClose={() => setShowAddVehicle(false)} />}
      {showAddJob && (
        <AddJobModal
          vehicles={allVehicles}
          defaultVehicleReg={selectedReg || undefined}
          onAdd={handleAddJob}
          onClose={() => setShowAddJob(false)}
        />
      )}
      {showQr && <QrModal code={syncCode} onClose={() => setShowQr(false)} />}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function AppInner() {
  const [syncCode, setSyncCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode) {
      const code = urlCode.toUpperCase();
      localStorage.setItem(LS_KEY, code);
      history.replaceState(null, '', window.location.pathname);
      setSyncCode(code);
      return;
    }
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setSyncCode(stored.toUpperCase());
  }, []);

  function handleConnect(code: string) {
    localStorage.setItem(LS_KEY, code);
    setSyncCode(code);
  }

  if (!syncCode) return <PairingScreen onConnect={handleConnect} />;
  return <WorkshopView key={syncCode} syncCode={syncCode} onDisconnect={() => setSyncCode(null)} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
