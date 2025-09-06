from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    s3_api_base: str = "http://law_s3_api:8000"
    jwt_secret: str = "your-super-secret-jwt-key-change-this-in-production"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    class Config:
        env_file = ".env"

settings = Settings()