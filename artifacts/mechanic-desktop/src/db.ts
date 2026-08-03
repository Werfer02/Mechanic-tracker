const API_BASE = '/api';

export async function loadAll(): Promise<{ vehicles: unknown[]; jobs: unknown[] }> {
  const res = await fetch(`${API_BASE}/desktop-data`);
  if (!res.ok) throw new Error(`Failed to load data: ${res.status}`);
  return res.json();
}

/** Save vehicles and jobs together in one PUT — never reads first, no race condition. */
export async function saveAll(vehicles: unknown[], jobs: unknown[]) {
  const res = await fetch(`${API_BASE}/desktop-data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicles, jobs }),
  });
  if (!res.ok) throw new Error(`Failed to save data: ${res.status}`);
}
