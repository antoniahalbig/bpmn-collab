import json
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self.clients: dict[str, dict] = {}
        self.current_xml: str | None = None

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
