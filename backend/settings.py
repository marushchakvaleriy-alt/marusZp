import json
import os
from pydantic import BaseModel

SETTINGS_FILE = "settings.json"
DEFAULT_SETTINGS = {
    "storage_path": "C:\\TechPay_Projects"
}

class Settings(BaseModel):
    storage_path: str

def load_settings() -> Settings:
    if not os.path.exists(SETTINGS_FILE):
        save_settings(Settings(**DEFAULT_SETTINGS))
        return Settings(**DEFAULT_SETTINGS)
    
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return Settings(**data)
    except Exception as e:
        print(f"Error loading settings: {e}")
        return Settings(**DEFAULT_SETTINGS)

def save_settings(settings: Settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings.dict(), f, indent=4, ensure_ascii=False)
            
        # Ensure directory exists
        if not os.path.exists(settings.storage_path):
            try:
                os.makedirs(settings.storage_path)
            except Exception as e:
                print(f"Error creating storage directory: {e}")
                
    except Exception as e:
        print(f"Error saving settings: {e}")
