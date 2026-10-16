import json
import asyncio
from app import utils
from typing import Any
import redis.asyncio as aioredis
from app.model import WSAbstractMessage


class RedisPubSub:
    def __init__(self, redis_url: str, redis_channel: str):
        self.redis_url = redis_url
        self.redis_channel = redis_channel
        self.redis: aioredis.Redis | None = None
        self.task: asyncio.Task | None = None

    async def connect(self):
        self.redis = aioredis.from_url(self.redis_url, decode_responses=True)

    async def close(self):
        if self.redis:
            await self.redis.close()

    async def publish(self, data: Any):
        if self.redis is not None:
            await self.redis.publish(self.redis_channel, json.dumps(data))

    async def subscribe(self, callback):
        if self.redis is not None:
            pubsub = self.redis.pubsub()
            await pubsub.subscribe(self.redis_channel)

            async def _listener():
                try:
                    async for msg in pubsub.listen():
                        if msg['type'] == 'message':
                            try:
                                await callback(WSAbstractMessage(**json.loads(msg['data'])))
                            except Exception:
                                utils.logger.warn(f'Failed to parse redis message: {msg["data"]}')
                except asyncio.CancelledError:
                    await pubsub.unsubscribe(self.redis_channel)
                    await pubsub.close()

            self.task = asyncio.create_task(_listener())

    async def unsubscribe(self):
        # await self.publish({'type': 'unsubscribe', 'data': user_id})
        if self.task:
            self.task.cancel()
