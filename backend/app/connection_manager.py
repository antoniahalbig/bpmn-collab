import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self.clients: dict[str, dict] = {}
        self.current_xml: str | None = None
        self.comments: list[dict] = []
        self.activities: list[dict] = []

    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        name: str,
        color: str,
    ) -> None:
        self.active_connections.append(websocket)
        self.clients[client_id] = {"name": name, "color": color}

    def disconnect(self, websocket: WebSocket, client_id: str) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        self.clients.pop(client_id, None)

    async def broadcast(
        self,
        message: dict,
        exclude: WebSocket | None = None,
    ) -> None:
        data = json.dumps(message)
        for connection in self.active_connections:
            if connection is exclude:
                continue
            await connection.send_text(data)

    def get_user_list(self) -> list[dict]:
        return [
            {"client_id": cid, "name": info["name"], "color": info["color"]}
            for cid, info in self.clients.items()
        ]

    # ── Comments ──────────────────────────────────────────────────────────────

    def add_comment(self, comment: dict) -> None:
        self.comments.append(comment)

    def delete_comment(self, comment_id: str) -> None:
        self.comments = [c for c in self.comments if c["id"] != comment_id]

    def get_comments(self) -> list[dict]:
        return list(self.comments)

    # ── Activities ────────────────────────────────────────────────────────────

    def add_activity(self, activity: dict) -> None:
        self.activities.append(activity)
        self.activities = self.activities[-20:]  # rolling window of 20

    def get_activities(self) -> list[dict]:
        return list(self.activities)
