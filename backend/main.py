from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_db_and_tables
from migrate_auth import migrate
from routes import router

app = FastAPI(title="TechPay Pro")

origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",
    "https://maruszp-frontend.onrender.com", # Production Frontend
    "https://maruszp.onrender.com", # Production Backend
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
    # Run migration (create tables + check for new columns)
    try:
        migrate()
        print("\n\n 🔥🔥🔥 RELOADED WITH CRITICAL FIXES (v1.5) 🔥🔥🔥 \n\n")
    except Exception as e:
        print(f"Startup Error: {e}")

app.include_router(router)

@app.get("/")
def read_root():
    return {"message": "TechPay Pro Backend is running"}
