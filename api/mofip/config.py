from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/mofip"
    api_title: str = "Maison Obsidian Fragrance Intelligence Platform"
    model_config = SettingsConfigDict(env_prefix="MOFIP_", env_file=".env", extra="ignore")


settings = Settings()
