import React, { useState } from 'react';
import { useSync } from '../hooks/use-sync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  LogOut, 
  RefreshCw, 
  Plus, 
  Car, 
  Wrench, 
  Calendar, 
  Clock, 
  AlignLeft, 
  AlertCircle,
  CheckCircle2,
  ServerCrash
} from 'lucide-react';
import { Job, Vehicle } from '@workspace/api-client-react';
import { UKNumberPlate } from '../components/UKNumberPlate';
import { AddJobDialog } from '../components/AddJobDialog';
import { AddVehicleDialog } from '../components/AddVehicleDialog';
import { toast } from 'sonner';

function formatJobDuration(job: Pick<Job, 'timeStarted' | 'timeFinished' | 'time'>) {
  const started = job.timeStarted ?? job.time ?? '';
  const finished = job.timeFinished ?? job.timeStarted ?? job.time ?? '';
  if (started && started === finished) return started;

  const [startedHours, startedMinutes] = started.split(':').map(Number);
  const [finishedHours, finishedMinutes] = finished.split(':').map(Number);

  if (
    !Number.isFinite(startedHours) || !Number.isFinite(startedMinutes) ||
    !Number.isFinite(finishedHours) || !Number.isFinite(finishedMinutes)
  ) {
    return '0 min';
  }

  const startTotal = startedHours * 60 + startedMinutes;
  const finishTotal = finishedHours * 60 + finishedMinutes;
  const minutes = (finishTotal - startTotal + 24 * 60) % (24 * 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

export default function WorkshopView() {
  const { 
    syncCode, 
    disconnect, 
    roomData, 
    isLoading, 
    isError, 
    pushData, 
    isPushing, 
    addJob, 
    addVehicle 
  } = useSync();

  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [prefilledReg, setPrefilledReg] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const handleSync = async () => {
    if (!roomData) return;
    try {
      await pushData(roomData.vehicles || [], roomData.jobs || []);
      toast.success('Synced successfully');
    } catch (e) {
      toast.error('Failed to sync');
    }
  };

  const handleAddJobForVehicle = (reg: string) => {
    setPrefilledReg(reg);
    setIsAddJobOpen(true);
  };

  if (isLoading && !roomData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p>Connecting to workspace...</p>
        </div>
      </div>
    );
  }

  if (isError && !roomData) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
        <ServerCrash className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connection Failed</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          Could not connect to room <span className="font-mono text-foreground bg-muted px-1 rounded">{syncCode}</span>. The code might be expired or invalid.
        </p>
        <Button onClick={disconnect} variant="outline">
          <LogOut className="w-4 h-4 mr-2" /> Return to pairing
        </Button>
      </div>
    );
  }

  const vehicles = roomData?.vehicles || [];
  const jobs = roomData?.jobs || [];

  // Group jobs by vehicle if a vehicle is selected, otherwise show all recent jobs
  const displayJobs = selectedVehicle 
    ? jobs.filter(j => j.vehicleRegistration === selectedVehicle).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [...jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-screen w-full bg-background flex flex-col">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
            <Wrench className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none mb-1">Mechanic Command Center</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1 text-emerald-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Connected
              </span>
              <span className="text-border mx-1">|</span>
              Room: <span className="text-foreground bg-muted px-1.5 py-0.5 rounded border border-border">{syncCode}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={isPushing}
            className="border-border hover:bg-muted"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isPushing ? 'animate-spin' : ''}`} />
            {isPushing ? 'Syncing...' : 'Sync Now'}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={disconnect}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Sidebar: Vehicles */}
        <aside className="w-full md:w-80 lg:w-96 border-r border-border bg-card/30 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-card flex items-center justify-between sticky top-0 z-10">
            <h2 className="font-semibold flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              Active Vehicles
              <Badge variant="secondary" className="ml-2 font-mono text-xs">{vehicles.length}</Badge>
            </h2>
            <Button size="icon" variant="ghost" onClick={() => setIsAddVehicleOpen(true)} className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <button
              onClick={() => setSelectedVehicle(null)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedVehicle === null 
                  ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20' 
                  : 'bg-card border-border hover:border-primary/50'
              }`}
            >
              <div className="font-medium">All Jobs Overview</div>
              <div className="text-xs text-muted-foreground mt-1">Show activity across all vehicles</div>
            </button>

            {vehicles.map(v => (
              <div 
                key={v.id} 
                onClick={() => setSelectedVehicle(v.registration)}
                className={`w-full text-left p-4 rounded-lg border transition-all cursor-pointer group ${
                  selectedVehicle === v.registration 
                    ? 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(249,115,22,0.15)] ring-1 ring-primary/50' 
                    : 'bg-card border-border hover:border-primary/50 hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <UKNumberPlate registration={v.registration} />
                </div>
                <div className="font-medium text-foreground text-lg">{v.make} {v.model}</div>
                <div className="mt-4 flex gap-2">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="w-full text-xs h-8 bg-muted/50 hover:bg-primary hover:text-primary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddJobForVehicle(v.registration);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Job
                  </Button>
                </div>
              </div>
            ))}

            {vehicles.length === 0 && (
              <div className="text-center p-8 border border-dashed border-border rounded-lg bg-card/50 text-muted-foreground">
                <Car className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No vehicles added yet</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content: Jobs */}
        <section className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="p-4 border-b border-border bg-card flex items-center justify-between sticky top-0 z-10">
            <h2 className="font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              {selectedVehicle ? `Jobs for ${selectedVehicle}` : 'Recent Workshop Activity'}
              <Badge variant="secondary" className="ml-2 font-mono text-xs">{displayJobs.length}</Badge>
            </h2>
            <Button onClick={() => {
              setPrefilledReg(selectedVehicle || '');
              setIsAddJobOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-2" /> New Job
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {displayJobs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <div className="bg-card w-24 h-24 rounded-full flex items-center justify-center border border-dashed border-border mb-6">
                  <AlertCircle className="w-10 h-10 opacity-50" />
                </div>
                <h3 className="text-xl font-medium text-foreground mb-2">No jobs found</h3>
                <p className="max-w-md text-center">
                  {selectedVehicle 
                    ? `There are no recorded jobs for vehicle ${selectedVehicle}.` 
                    : "Your workshop is quiet. Add a vehicle and start logging jobs."}
                </p>
                <Button 
                  className="mt-6" 
                  onClick={() => {
                    setPrefilledReg(selectedVehicle || '');
                    setIsAddJobOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" /> Log First Job
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-max">
                {displayJobs.map(job => (
                  <Card key={job.id} className="border-border shadow-sm hover:shadow-md transition-shadow bg-card overflow-hidden">
                    {job.isService && (
                      <div className="h-1 w-full bg-[#22C55E]"></div>
                    )}
                    <CardHeader className="pb-3 pt-5 flex flex-row items-start justify-between space-y-0">
                      <div>
                        {!selectedVehicle && (
                          <div className="mb-3 inline-block">
                            <UKNumberPlate registration={job.vehicleRegistration} className="scale-75 origin-left" />
                          </div>
                        )}
                        <CardTitle className="text-lg leading-tight flex items-center gap-2">
                          {job.description}
                        </CardTitle>
                      </div>
                      {job.isService && (
                        <Badge className="bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 border border-[#22C55E]/30 shrink-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> SERVICE
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border border-border">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="font-medium text-foreground">
                            {format(new Date(job.date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="font-mono">
                             Time taken {formatJobDuration(job)}
                          </span>
                        </div>
                      </div>

                      {job.notes && (
                        <div className="flex gap-3">
                          <AlignLeft className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {job.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <AddJobDialog 
        open={isAddJobOpen} 
        onOpenChange={setIsAddJobOpen} 
        onAdd={addJob} 
        vehicles={vehicles}
        prefilledRegistration={prefilledReg}
      />

      <AddVehicleDialog
        open={isAddVehicleOpen}
        onOpenChange={setIsAddVehicleOpen}
        onAdd={addVehicle}
        existingVehicles={vehicles}
      />
    </div>
  );
}
