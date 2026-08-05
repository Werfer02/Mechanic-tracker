import type { Job } from '@/context/TrackerContext';

export function getTimeStarted(job: Pick<Job, 'timeStarted' | 'timeFinished' | 'time'>): string {
  return job.timeStarted ?? job.time ?? '';
}

export function getTimeFinished(job: Pick<Job, 'timeStarted' | 'timeFinished' | 'time'>): string {
  return job.timeFinished ?? job.timeStarted ?? job.time ?? '';
}

export function getJobSortTime(job: Pick<Job, 'date' | 'timeStarted' | 'timeFinished' | 'time'>): number {
  return new Date(`${job.date}T${getTimeStarted(job)}`).getTime();
}