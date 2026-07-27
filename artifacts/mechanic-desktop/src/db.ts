const API_BASE = '/api';

export async function loadVehicles() {
  const res = await fetch(`${API_BASE}/desktop-data`);
  if (!res.ok) throw new Error(`Failed to load vehicles: ${res.status}`);
  const data = await res.json() as { vehicles: unknown[]; jobs: unknown[] };
  return data.vehicles;
}
export async function loadJobs() {
  const res = await fetch(`${API_BASE}/desktop-data`);
  if (!res.ok) throw new Error(`Failed to load jobs: ${res.status}`);
  const data = await res.json() as { vehicles: unknown[]; jobs: unknown[] };
  return data.jobs;
}
export async function saveVehicles(vehicles: unknown[]) {
  await saveData(vehicles, await loadJobs());
}
export async function saveJobs(jobs: unknown[]) {
  await saveData(await loadVehicles(), jobs);
}

async function saveData(vehicles: unknown[], jobs: unknown[]) {
  const res = await fetch(`${API_BASE}/desktop-data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicles, jobs }),
  });
  if (!res.ok) throw new Error(`Failed to save data: ${res.status}`);
}
