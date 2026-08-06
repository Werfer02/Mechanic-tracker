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

export function getJobDurationMinutes(job: Pick<Job, 'timeStarted' | 'timeFinished' | 'time'>): number {
  const started = getTimeStarted(job);
  const finished = getTimeFinished(job);
  const [startedHours, startedMinutes] = started.split(':').map(Number);
  const [finishedHours, finishedMinutes] = finished.split(':').map(Number);

  if (
    !Number.isFinite(startedHours) || !Number.isFinite(startedMinutes) ||
    !Number.isFinite(finishedHours) || !Number.isFinite(finishedMinutes)
  ) {
    return 0;
  }

  const startTotal = startedHours * 60 + startedMinutes;
  const finishTotal = finishedHours * 60 + finishedMinutes;
  return (finishTotal - startTotal + 24 * 60) % (24 * 60);
}

export function formatJobDuration(job: Pick<Job, 'timeStarted' | 'timeFinished' | 'time'>): string {
  const started = getTimeStarted(job);
  const finished = getTimeFinished(job);
  if (started && started === finished) return started;

  const minutes = getJobDurationMinutes(job);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

export function formatJobTimeSummary(job: Pick<Job, 'timeStarted' | 'timeFinished' | 'time'>): string {
  const started = getTimeStarted(job);
  const finished = getTimeFinished(job);
  return started && started === finished
    ? started
    : `Time taken ${formatJobDuration(job)}`;
}