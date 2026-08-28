import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Job, Vehicle } from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const formSchema = z.object({
  vehicleRegistration: z.string().min(1, 'Registration is required'),
  date: z.string().min(1, 'Date is required'),
  timeStarted: z.string().min(1, 'Start time is required'),
  timeFinished: z.string().min(1, 'Finish time is required'),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
  isService: z.boolean().default(false),
  mileage: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (job: Job) => void;
  vehicles: Vehicle[];
  prefilledRegistration?: string;
}

export function AddJobDialog({ open, onOpenChange, onAdd, vehicles, prefilledRegistration }: AddJobDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleRegistration: prefilledRegistration || '',
      date: new Date().toISOString().split('T')[0],
      timeStarted: new Date().toTimeString().substring(0, 5),
      timeFinished: new Date().toTimeString().substring(0, 5),
      description: '',
      notes: '',
      isService: false,
      mileage: '',
    },
  });

  // Reset form when opened with new prefilled registration
  React.useEffect(() => {
    if (open) {
      form.reset({
        vehicleRegistration: prefilledRegistration || '',
        date: new Date().toISOString().split('T')[0],
        timeStarted: new Date().toTimeString().substring(0, 5),
        timeFinished: new Date().toTimeString().substring(0, 5),
        description: '',
        notes: '',
        isService: false,
        mileage: '',
      });
    }
  }, [open, prefilledRegistration, form]);

  const onSubmit = (data: FormValues) => {
    const newJob: Job = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      vehicleRegistration: data.vehicleRegistration,
      date: data.date,
      timeStarted: data.timeStarted,
      timeFinished: data.timeFinished,
      description: data.description,
      notes: data.notes || '',
      isService: data.isService,
      ...(data.mileage?.trim() ? { mileageAtService: parseInt(data.mileage, 10) } : {}),
      createdAt: new Date().toISOString(),
    };
    onAdd(newJob);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Job</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="vehicleRegistration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration</FormLabel>
                  <FormControl>
                    <Input placeholder="AB12 CDE" {...field} className="uppercase font-mono tracking-wider" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timeStarted"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time started</FormLabel>
                    <FormControl>
                      <Input type="time" step={60} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timeFinished"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time finished</FormLabel>
                    <FormControl>
                      <Input type="time" step={60} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Brake pad replacement" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mileage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mileage (optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} placeholder="e.g. 45000 km" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Requires specific tool..." className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isService"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Mark as Full Service
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-2">
              <Button type="submit">Save Job</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
