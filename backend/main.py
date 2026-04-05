from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from migrate_auth import migrate
from routes import router

app = FastAPI(title="TechPay Pro")

origins = [
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4174",
    "http://127.0.0.1:4174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://maruszp-frontend.onrender.com", # Production Frontend (Old)
    "https://maruszp.onrender.com", # Production Backend (Old)
    "https://maruszp-frontend.fly.dev", # Production Frontend (New)
    "https://maruszp-backend.fly.dev", # Production Backend (New)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    # Run migration on startup unless explicitly disabled.
    try:
        run_migration = os.environ.get("RUN_STARTUP_MIGRATION", "true").lower() in {"1", "true", "yes"}
        if run_migration:
            migrate()
    except Exception as e:
        print(f"Startup migration error: {e}")

app.include_router(router)

@app.get("/")
def read_root():
    return {"message": "TechPay Pro Backend is running"}
