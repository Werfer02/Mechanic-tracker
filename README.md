# Mechanic Tracker

A vehicle service logging system with three components:

- **API Server** — Express + PostgreSQL, handles sync rooms shared between desktop and mobile
- **Mechanic Desktop** — React/Vite web app for the workshop PC; works fully offline, optional mobile sync
- **Mechanic Tracker** — Expo/React Native mobile app for mechanics on the floor

Desktop and mobile sync over a 6-character room code. The desktop generates a QR code; the mobile scans it. Data merges automatically every 8 seconds when connected.

---

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- PostgreSQL database

---

## Setup

```bash
git clone https://github.com/Werfer02/Mechanic-tracker.git
cd Mechanic-tracker
pnpm install
```

---

## Environment variables

Create a `.env` file (or export these in your shell) before running anything:

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | API server, DB push | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/mechanic` |
| `SESSION_SECRET` | API server | Any random string, used to sign sessions |
| `PORT` | API server, Desktop | Port to listen on |

---

## Database setup

Run once to create the tables (requires `DATABASE_URL`):

```bash
DATABASE_URL=postgresql://... pnpm --filter @workspace/db run push
```

---

## Running the API server

```bash
PORT=3001 DATABASE_URL=postgresql://... SESSION_SECRET=changeme \
  pnpm --filter @workspace/api-server run dev
```

The server builds and starts on the given port. API routes are mounted under `/api`.

---

## Running the Desktop app

The desktop expects to be served from the **same origin** as the API (it uses relative `/api/…` paths). The easiest local setup is to add a Vite proxy. Add this to `artifacts/mechanic-desktop/vite.config.ts` inside the `server: { … }` block:

```ts
proxy: {
  '/api': 'http://localhost:3001',
},
```

Then run:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/mechanic-desktop run dev
```

Open `http://localhost:5173` in a browser. The app works standalone (all data in `localStorage`) — the API is only needed if you want mobile sync.

---

## Running the Mobile app

The mobile app uses `EXPO_PUBLIC_DOMAIN` to locate the API server. Set it to your machine's local IP or hostname (without protocol):

```bash
cd artifacts/mechanic-tracker
EXPO_PUBLIC_DOMAIN=192.168.1.x:3001 npx expo start
```

> **Note:** the app constructs `https://${EXPO_PUBLIC_DOMAIN}/api` — for plain HTTP on a local network, edit `hooks/useSyncRoom.ts` line 22 to use `http://` instead.

Scan the QR code in the Expo Go app or run on a simulator.

---

## Syncing desktop ↔ mobile

1. On the desktop, click **Connect to mobile** in the header → **New Room**
2. A QR code and 6-character code appear
3. On the mobile app, open the **Sync** tab → **Join Room** → scan or type the code
4. Both sides sync automatically every 8 seconds while connected

---

## Tech stack

| Layer | Stack |
|---|---|
| API | Express 5, Pino logging, Zod validation |
| Database | PostgreSQL + Drizzle ORM |
| Desktop | React 19, Vite, Tailwind CSS v4, TanStack Query |
| Mobile | Expo (SDK 53), Expo Router, React Native |
| Monorepo | pnpm workspaces |
