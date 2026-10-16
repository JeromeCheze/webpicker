from typing import Any
from fastapi import WebSocket

from app.model import ActivityData, ChatData, WSAbstractMessage, WSActivityResponse, WSChatResponse, WSUpdateEventResponse
from app.redis_pubsub import RedisPubSub

class ConnectionManager:
    def __init__(self, pubsub):
        self.ws: dict[str, WebSocket] = {}
        self.activity: dict[str, ActivityData] = {}
        self.pubsub: RedisPubSub = pubsub

    async def subscribe_redis(self):
        async def on_redis_message(data: WSAbstractMessage):
            if data.type == 'activity':
                await self.update_activity(ActivityData(**data.data))
            elif data.type == 'chat':
                chat_data = ChatData(**data.data)
                if chat_data.broadcast:
                    await self.broadcast_message(WSChatResponse(data=chat_data).model_dump())
                else:
                    await self.send_to_user(chat_data.recipient, WSChatResponse(data=chat_data).model_dump())
            elif data.type == 'updateEvent':
                await self.broadcast_message(WSUpdateEventResponse(data=data.data).model_dump())
            elif data.type == 'disconnect':
                await self.close_connections([data.data])

        await self.pubsub.subscribe(on_redis_message)

    async def unsubscribe_redis(self):
        if self.pubsub:
            await self.pubsub.unsubscribe()

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.ws[user_id] = websocket

    async def close_connections(self, user_ids: list[str]):
        for user_id in user_ids:
            if user_id in self.ws:
                del self.ws[user_id]
            if user_id in self.activity:
                del self.activity[user_id]
        await self.broadcast_activity()

    async def broadcast_message(self, msg: Any):
        dead: list[str] = []
        for user_id, ws in self.ws.items():
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(user_id)
        if len(dead) > 0:
            await self.close_connections(dead)

    async def send_to_user(self, user_id: str, msg: Any):
        if user_id in self.ws:
            try:
                await self.ws[user_id].send_json(msg)
            except Exception:
                await self.close_connections([user_id])

    async def broadcast_activity(self):
        response = WSActivityResponse(data=[x for x in self.activity.values()]).model_dump()
        await self.broadcast_message(response)

    async def update_activity(self, data: ActivityData):
        self.activity[data.id] = data
        await self.broadcast_activity()

