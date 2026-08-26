import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useCreateSyncRoom, 
  useGetSyncRoom, 
  usePushSyncRoom, 
  getGetSyncRoomQueryKey,
  Job,
  Vehicle
} from '@workspace/api-client-react';

export function useSync() {
  const [syncCode, setSyncCode] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check URL first
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('code');
    
    if (codeFromUrl) {
      setSyncCode(codeFromUrl);
      localStorage.setItem('mechanic_desktop_sync_code', codeFromUrl);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    // Check localStorage
    const savedCode = localStorage.getItem('mechanic_desktop_sync_code');
    if (savedCode) {
      setSyncCode(savedCode);
    }
  }, []);

  const connect = useCallback((code: string) => {
    setSyncCode(code);
    localStorage.setItem('mechanic_desktop_sync_code', code);
  }, []);

  const disconnect = useCallback(() => {
    setSyncCode(null);
    localStorage.removeItem('mechanic_desktop_sync_code');
  }, []);

  const createRoomMutation = useCreateSyncRoom();
  const pushRoomMutation = usePushSyncRoom();

  const handleCreateRoom = useCallback(async () => {
    try {
      const data = await createRoomMutation.mutateAsync();
      if (data && data.code) {
        connect(data.code);
      }
    } catch (e) {
      console.error("Failed to create room", e);
    }
  }, [createRoomMutation, connect]);

  const { data: roomData, isLoading, isError, error } = useGetSyncRoom(syncCode || '', {
    query: {
      enabled: !!syncCode,
      queryKey: syncCode ? getGetSyncRoomQueryKey(syncCode) : ['syncRoom', 'none'],
      refetchInterval: 10000, // auto-refresh every 10s
    }
  });

  const pushData = useCallback(async (vehicles: Vehicle[], jobs: Job[]) => {
    if (!syncCode) return;
    try {
      await pushRoomMutation.mutateAsync({
        code: syncCode,
        data: { vehicles, jobs }
      });
      queryClient.invalidateQueries({ queryKey: getGetSyncRoomQueryKey(syncCode) });
    } catch (error) {
      console.error("Failed to push data", error);
    }
  }, [syncCode, pushRoomMutation, queryClient]);

  const addJob = useCallback(async (newJob: Job) => {
    if (!roomData) return;
    
    // Optimistic or direct push
    const newJobs = [...(roomData.jobs || []), newJob];
    const vehicles = (roomData.vehicles || []).map(vehicle =>
      vehicle.registration === newJob.vehicleRegistration && newJob.mileageAtService !== undefined
        ? { ...vehicle, mileage: newJob.mileageAtService }
        : vehicle,
    );
    
    // Update local cache optimistically
    queryClient.setQueryData(getGetSyncRoomQueryKey(syncCode!), (old: any) => {
      if (!old) return old;
      return { ...old, vehicles, jobs: newJobs };
    });

    await pushData(vehicles, newJobs);
  }, [roomData, pushData, queryClient, syncCode]);

  const addVehicle = useCallback(async (newVehicle: Vehicle) => {
    if (!roomData) return;
    const vehicles = [...(roomData.vehicles || []), newVehicle];
    const jobs = roomData.jobs || [];

    queryClient.setQueryData(getGetSyncRoomQueryKey(syncCode!), (old: any) => {
      if (!old) return old;
      return { ...old, vehicles };
    });

    await pushData(vehicles, jobs);
  }, [roomData, pushData, queryClient, syncCode]);

  return {
    syncCode,
    connect,
    disconnect,
    roomData,
    isLoading,
    isError,
    error,
    handleCreateRoom,
    isCreating: createRoomMutation.isPending,
    addJob,
    addVehicle,
    pushData,
    isPushing: pushRoomMutation.isPending,
  };
}
