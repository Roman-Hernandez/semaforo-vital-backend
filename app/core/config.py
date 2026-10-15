from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Semaforo Vital Backend"

    mongodb_uri: str | None = None
    mongodb_db: str = "semaforo_vital"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()