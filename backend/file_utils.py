import os
import shutil
from settings import load_settings

# Define standard project subfolders
PROJECT_SUBFOLDERS = [
    "Проджекти",
    "Перекупні позиції",
    "Метал",
    "Креслення",
    "Погодження",
    "Фурнітура"
]

ALLOWED_FOLDER_CATEGORIES = set(PROJECT_SUBFOLDERS)

def ensure_project_structure(project_name: str, base_path: str):
    """Creates the project folder and all subfolders."""
    if not base_path:
        return
        
    project_path = os.path.join(base_path, sanitize_filename(project_name))
    
    if not os.path.exists(project_path):
        os.makedirs(project_path)
        
    for subfolder in PROJECT_SUBFOLDERS:
        sub_path = os.path.join(project_path, subfolder)
        if not os.path.exists(sub_path):
            os.makedirs(sub_path)

def sanitize_filename(name: str) -> str:
    """Removes illegal characters from filenames."""
    return "".join(c for c in name if c.isalnum() or c in (' ', '-', '_', '.')).strip()

def normalize_folder_category(folder_category: str) -> str:
    """Validates and normalizes folder category to known project subfolders only."""
    normalized = (folder_category or "").strip()
    if normalized not in ALLOWED_FOLDER_CATEGORIES:
        raise ValueError("Invalid folder category")
    return normalized

def get_file_path(project_name: str, folder_category: str, filename: str, base_path: str) -> str:
    """Constructs the absolute path for a file."""
    safe_project_name = sanitize_filename(project_name)
    safe_folder_category = normalize_folder_category(folder_category)
    safe_filename = sanitize_filename(filename)
    return os.path.join(base_path, safe_project_name, safe_folder_category, safe_filename)
