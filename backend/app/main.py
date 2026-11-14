from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.engines.script_processor import process_script_to_scenes
from app.schemas.manifest import ProjectManifest

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
PROJECTS_DIR = WORKSPACE_ROOT / os.getenv("PROJECTS_DIR", "projects")
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = PROJECTS_DIR / "engine.sqlite"

app = FastAPI(title="FrameForge Studio Python API", version="1.0.0")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


class CreateProjectRequest(BaseModel):
    project_id: str
    name: str
    description: str = ""
    topic: str = ""
    script: str = ""
    target_duration_seconds: float = 120.0
    visual_style: str = "cinematic painterly illustration"


@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "projects_dir": str(PROJECTS_DIR)}


@app.get("/api/projects")
def list_projects() -> Dict[str, Any]:
    with _conn() as conn:
        rows = conn.execute("SELECT manifest_json FROM projects ORDER BY updated_at DESC").fetchall()
    return {"projects": [json.loads(r["manifest_json"]) for r in rows]}


@app.post("/api/projects")
def create_project(req: CreateProjectRequest) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    scenes = process_script_to_scenes(req.script, req.target_duration_seconds, req.visual_style)
    manifest = ProjectManifest(
        project_id=req.project_id,
        name=req.name,
        description=req.description,
        topic=req.topic,
        script=req.script,
        target_duration_seconds=req.target_duration_seconds,
        created_at=now,
        updated_at=now,
        stage="script_processed" if scenes else "created",
        scenes=scenes,
    )
    proj_dir = PROJECTS_DIR / req.project_id
    proj_dir.mkdir(parents=True, exist_ok=True)
    (proj_dir / "manifest.json").write_text(manifest.model_dump_json(indent=2), encoding="utf-8")

    with _conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO projects (id, name, description, stage, manifest_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                manifest.project_id,
                manifest.name,
                manifest.description,
                manifest.stage,
                manifest.model_dump_json(),
                manifest.created_at,
                manifest.updated_at,
            ),
        )
        conn.commit()
    return {"project": manifest.model_dump()}


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> Dict[str, Any]:
    with _conn() as conn:
        row = conn.execute("SELECT manifest_json FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": json.loads(row["manifest_json"])}
