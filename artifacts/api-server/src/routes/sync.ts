import { Router } from "express";
import { db, syncRooms } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode() {
  return Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
}

router.post("/sync/rooms", async (req, res) => {
  let code = genCode();
  for (let i = 0; i < 5; i++) {
    const rows = await db
      .select({ code: syncRooms.code })
      .from(syncRooms)
      .where(eq(syncRooms.code, code));
    if (!rows.length) break;
    code = genCode();
  }
  await db.insert(syncRooms).values({ code });
  req.log.info({ code }, "sync room created");
  res.status(201).json({ code });
});

router.get("/sync/rooms/:code", async (req, res) => {
  const [room] = await db
    .select()
    .from(syncRooms)
    .where(eq(syncRooms.code, req.params.code.toUpperCase()));
  if (!room) return void res.status(404).json({ error: "Room not found" });
  res.json({
    vehicles: room.vehicles ?? [],
    jobs: room.jobs ?? [],
    updatedAt: room.updatedAt,
  });
});

router.put("/sync/rooms/:code", async (req, res) => {
  const { vehicles, jobs } = req.body as {
    vehicles: unknown[];
    jobs: unknown[];
  };
  const [updated] = await db
    .update(syncRooms)
    .set({ vehicles, jobs, updatedAt: new Date() })
    .where(eq(syncRooms.code, req.params.code.toUpperCase()))
    .returning({ updatedAt: syncRooms.updatedAt });
  if (!updated) return void res.status(404).json({ error: "Room not found" });
  res.json({ updatedAt: updated.updatedAt });
});

export default router;
