# bpmn-collab

Collaborative BPMN Diagram Editor.

## Prerequisites
- Docker >= 24
- Docker Compose v2

## Run
First in the frontend folder, run: 
```bash
npm install
```

Then in the root folder, run:
```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) in two browser tabs to see live collaboration.

## How it works
Each client connects via WebSocket. On every diagram change the full BPMN XML is exported and broadcast to all other connected clients, who re-import it. User identity is ephemeral (random UUID per session). Diagram state is held in server memory and resets on restart.

## Structure
- `backend/` — FastAPI WebSocket server
- `frontend/` — React + Vite app using bpmn-js
