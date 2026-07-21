import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Vehicle } from '@workspace/api-client-react';

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const formSchema = z.object({
  registration: z.string().min(1, 'Registration is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
});

type FormValues = z.infer<typeof formSchema>;

interface AddVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (vehicle: Vehicle) => void;
}

export function AddVehicleDialog({ open, onOpenChange, onAdd }: AddVehicleDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      registration: '',
      make: '',
      model: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        registration: '',
        make: '',
        model: '',
      });
    }
  }, [open, form]);

  const onSubmit = (data: FormValues) => {
    const newVehicle: Vehicle = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      registration: data.registration.toUpperCase(),
      make: data.make,
      model: data.model,
      createdAt: new Date().toISOString(),
    };
    onAdd(newVehicle);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="registration"
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
            <FormField
              control={form.control}
              name="make"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Make</FormLabel>
                  <FormControl>
                    <Input placeholder="Ford" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <Input placeholder="Focus" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-2">
              <Button type="submit">Save Vehicle</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
