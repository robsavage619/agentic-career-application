from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    jsearch_rapidapi_key: str = ""
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    obsidian_api_port: int = 27124
    database_url: str = "sqlite:///./career_command_center.db"


settings = Settings()
