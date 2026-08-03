import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const router = Router();

const DATA_DIR  = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "mechanic-desktop.json");

// ── Write serialisation ───────────────────────────────────────────────────────
// The desktop app's two useEffect hooks (vehicles + jobs) fire concurrently on
// every sync, causing two simultaneous PUTs that race and corrupt the file.
// A simple promise-chain lock ensures writes are queued and never overlap.

let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(fn: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(fn, fn); // chain even if previous write failed
  return writeQueue;
}

// ── Atomic file write ─────────────────────────────────────────────────────────
// Write to a temp file beside the target, then rename — rename is atomic on
// POSIX filesystems so a crash mid-write never leaves a partial/corrupt file.

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const dir  = path.dirname(filePath);
  const tmp  = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmp, content, "utf-8");
  await fs.rename(tmp, filePath);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readData(): Promise<{ vehicles: unknown[]; jobs: unknown[] }> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as { vehicles: unknown[]; jobs: unknown[] };
  } catch {
    // File missing or corrupt — return empty state; next PUT will repair it
    return { vehicles: [], jobs: [] };
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/desktop-data", async (_req, res) => {
  try {
    res.json(await readData());
  } catch (err) {
    res.status(500).json({ error: "Failed to read desktop data" });
  }
});

router.put("/desktop-data", async (req, res) => {
  const { vehicles, jobs } = req.body as { vehicles: unknown[]; jobs: unknown[] };
  try {
    await enqueueWrite(() =>
      writeAtomic(
        DATA_FILE,
        JSON.stringify({ vehicles: vehicles ?? [], jobs: jobs ?? [] }, null, 2),
      )
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save desktop data" });
  }
});

export default router;
