# bpmn-collab

A real-time collaborative BPMN editor. Built with `bpmn-js`, React and FastAPI.

## What it does

### Live Diagram Sync
- A user's edits appear on everyone else's screen immediately.
- When a remote change comes in, the affected elements briefly flash in that user's color so you can see what was changed and by who.

### Comments
- A user can comment on individual elements. Click any element and leave a note in the sidebar.
- Comments show as numbered badges directly on the diagram.
- Clicking a badge or the element opens that element's thread.

### User Activity
- User list shows who's currently connected (each user has an ID and a color)
- Activity feed tracks recent actions (added a task, moved a gateway, etc.) with each user's color

Everything is in-memory, i.e., no database, no persistence. The diagram resets when the backend restarts.

## Running it

You'll need Docker (>= 24) and Docker Compose v2. Node.js / npm only needed once to install frontend deps.

**1. Install frontend dependencies** (only needed the first time):
```bash
cd frontend
npm install
```

**2. Start everything from the repo root:**
```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) and try it in a couple of tabs.

## How it works under the hood

Each client connects to the backend over a WebSocket. On any diagram change the frontend serializes the BPMN to XML and sends it up. The backend stores the latest version and broadcasts it to everyone else. New connections get the current diagram immediately on join so they're never out of sync.

User identities are ephemeral: a random UUID + color is generated fresh on each page load.

## Code layout

```
backend/
  app/main.py               — WebSocket endpoint, message routing
  app/connection_manager.py — in-memory state (XML, users, comments, activity)

frontend/src/
  hooks/useCollaboration.ts — all WebSocket logic, user identity, message handling
  components/BpmnEditor.tsx — modeler setup, remote XML import, overlay badges
  components/CommentPanel.tsx
  components/UserList.tsx
  components/ActivityFeed.tsx
  lib/                      — pure utilities (describeCommand, relativeTime, bpmnTypes)
  styles/tokens.ts          — shared design constants
  App.tsx                   — wires everything together
```

## Linting

```bash
cd frontend
npm run lint
```
