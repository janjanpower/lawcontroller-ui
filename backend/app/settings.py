from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    s3_api_base: str = "http://law_s3_api:8000"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    class Config:
        env_file = ".env"

settings = Settings()