import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useSync } from '../hooks/use-sync';
import { Wrench, MonitorSmartphone, RefreshCw, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function PairingScreen() {
  const { handleCreateRoom, connect, isCreating } = useSync();
  const [codeInput, setCodeInput] = useState('');

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.trim().length < 6) {
      toast.error('Please enter a valid 6-character code');
      return;
    }
    connect(codeInput.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[40%] bg-primary/10 blur-[100px] rounded-full"></div>
      </div>

      <div className="z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center border border-border shadow-lg mb-6">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Mechanic Tracker</h1>
          <p className="text-muted-foreground">Desktop Companion Command Center</p>
        </div>

        <Card className="border-border shadow-xl bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-primary" />
              Connect to Mobile
            </CardTitle>
            <CardDescription>
              Enter the 6-character sync code from your mobile app, or create a new room to start fresh.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input 
                    type="text" 
                    placeholder="Enter sync code (e.g. A1B2C3)" 
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    className="pl-10 h-12 text-lg uppercase font-mono tracking-widest bg-background/50"
                    maxLength={10}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-md font-semibold" disabled={!codeInput.trim()}>
                Connect <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full h-12"
              onClick={handleCreateRoom}
              disabled={isCreating}
            >
              {isCreating ? (
                <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Generating Code...</>
              ) : (
                <><RefreshCw className="mr-2 w-4 h-4" /> Start New Session</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
