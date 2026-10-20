from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "Semaforo Vital Backend"
    mongodb_uri: str | None = None
    mongodb_db: str = "semaforo_vital"
    app_timezone: str = "America/Bogota"
    jwt_secret_key: str = ""
    jwt_access_token_minutes: int = 30
    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", ".env"),
        extra="ignore",
    )


settings = Settings()
