import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .connection_manager import ConnectionManager

app = FastAPI()
manager = ConnectionManager()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()

    # Step 1: receive the join message
    join_data = await websocket.receive_json()
    client_id: str = join_data["client_id"]
    name: str = join_data["name"]
    color: str = join_data["color"]

    # Step 2: register the connection
    await manager.connect(websocket, client_id, name, color)

    # Step 3: send init to this client (includes current diagram, comments, activities)
    await websocket.send_json(
        {
            "type": "init",
            "xml": manager.current_xml,
            "users": manager.get_user_list(),
            "comments": manager.get_comments(),
            "activities": manager.get_activities(),
        }
    )

    # Step 4: broadcast user_joined to everyone else
    await manager.broadcast(
        {"type": "user_joined", "users": manager.get_user_list()},
        exclude=websocket,
    )

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "xml_update":
                manager.current_xml = data["xml"]
                await manager.broadcast(
                    {
                        "type": "xml_update",
                        "xml": data["xml"],
                        "color": data.get("color"),
                    },
                    exclude=websocket,
                )

            elif msg_type == "comment_add":
                comment = {
                    "id": str(uuid.uuid4()),
                    "element_id": data["element_id"],
                    "author": data["author"],
                    "color": data["color"],
                    "text": data["text"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                manager.add_comment(comment)
                await manager.broadcast(
                    {
                        "type": "comments_updated",
                        "comments": manager.get_comments(),
                    }
                )

            elif msg_type == "comment_delete":
                manager.delete_comment(data["comment_id"])
                await manager.broadcast(
                    {
                        "type": "comments_updated",
                        "comments": manager.get_comments(),
                    }
                )

            elif msg_type == "activity":
                activity = {
                    "id": str(uuid.uuid4()),
                    "user_name": data["user_name"],
                    "user_color": data["user_color"],
                    "action": data["action"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                manager.add_activity(activity)
                await manager.broadcast(
                    {
                        "type": "activity_update",
                        "activities": manager.get_activities(),
                    }
                )

            # all other message types are silently ignored

    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
        await manager.broadcast(
            {"type": "user_left", "users": manager.get_user_list()}
        )
