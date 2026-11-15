from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "Semaforo Vital Backend"

    # MongoDB
    mongodb_uri: str | None = None
    mongodb_db: str = "semaforo_vital"

    # Redis
    redis_url: str | None = None
    redis_ttl_seconds: int = 900
    redis_key_prefix: str = "semaforo:estado"

    # Aplicación
    app_timezone: str = "America/Bogota"

    # Seguridad
    jwt_secret_key: str = ""
    jwt_access_token_minutes: int = 30

    # Rate limiting
    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", ".env"),
        extra="ignore",
    )


settings = Settings()