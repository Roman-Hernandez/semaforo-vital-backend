import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings


@asynccontextmanager
async def redis_lifespan(app: FastAPI):
    client: Redis | None = None

    if settings.redis_url:
        try:
            client = Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )

            client.ping()

        except RedisError:
            client = None

    app.state.redis = client

    try:
        yield
    finally:
        if client is not None:
            client.close()


def get_redis_from_request(request: Request) -> Redis | None:
    return getattr(
        request.app.state,
        "redis",
        None,
    )


def build_semaforo_estado_key(albergue_id: str) -> str:
    return (
        f"{settings.redis_key_prefix}:"
        f"{albergue_id}"
    )


def cache_get_json(
    client: Redis | None,
    key: str,
) -> dict[str, Any] | None:
    if client is None:
        return None

    try:
        value = client.get(key)

        if value is None:
            return None

        data = json.loads(value)

        if not isinstance(data, dict):
            return None

        return data

    except (RedisError, json.JSONDecodeError, TypeError):
        return None


def cache_set_json(
    client: Redis | None,
    key: str,
    value: dict[str, Any],
) -> bool:
    if client is None:
        return False

    try:
        client.setex(
            key,
            settings.redis_ttl_seconds,
            json.dumps(
                value,
                ensure_ascii=False,
                default=str,
            ),
        )

        return True

    except (RedisError, TypeError, ValueError):
        return False


def cache_delete(
    client: Redis | None,
    key: str,
) -> bool:
    if client is None:
        return False

    try:
        client.delete(key)
        return True

    except RedisError:
        return False