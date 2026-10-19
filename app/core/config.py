from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Semaforo Vital Backend"
    mongodb_uri: str | None = None
    mongodb_db: str = "semaforo_vital"
    app_timezone: str = "America/Bogota"
    jwt_secret_key: str = ""
    jwt_access_token_minutes: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
