from __future__ import annotations

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field

MANIFEST_VERSION = "1.0.0"

AspectRatio = Literal["16:9", "9:16", "1:1"]
Resolution = Literal["720p", "1080p"]
JobStatus = Literal[
    "pending", "validating", "running", "completed", "failed", "cancelled", "waiting_approval"
]


class MotionSpec(BaseModel):
    raw_instruction: str = ""
    camera: Literal[
        "static",
        "zoom_in",
        "zoom_out",
        "pan_left",
        "pan_right",
        "tilt_up",
        "tilt_down",
        "parallax",
        "shake",
    ] = "zoom_in"
    camera_speed: Literal["slow", "medium", "fast"] = "slow"
    subject_motion: Literal["none", "minimal", "moderate", "dynamic"] = "minimal"
    camera_shake: bool = False
    parallax_depth: float = Field(default=0.25, ge=0.0, le=1.0)
    weather: Literal["none", "rain", "snow", "fog", "storm"] = "none"
    effects: List[
        Literal[
            "none",
            "fire",
            "smoke",
            "lightning",
            "light_rays",
            "glow",
            "particles",
            "golden_embers",
            "god_rays",
            "violet_aura",
            "ground_mist",
        ]
    ] = Field(default_factory=list)
    transition_in: Literal[
        "cut", "fade", "dissolve", "flash_white", "flash_violet", "diagonal_slice", "wipe_left", "slide_up", "circle_open"
    ] = "fade"
    transition_out: Literal[
        "cut", "fade", "dissolve", "flash_white", "flash_violet", "diagonal_slice", "wipe_left", "slide_up", "circle_open"
    ] = "dissolve"
    motion_blur: bool = False
    preserve_character_identity: bool = True


class Character(BaseModel):
    id: str
    name: str
    description: str = ""
    appearance: str = ""
    face_details: str = ""
    body_proportions: str = ""
    clothing: str = ""
    accessories: str = ""
    color_palette: List[str] = Field(default_factory=list)
    voice_identity: str = "default"
    reference_images: List[str] = Field(default_factory=list)
    negative_prompt: str = "blurry, deformed, watermark, text, extra limbs"
    style_info: str = ""
    fixed_seed: Optional[int] = None


class Environment(BaseModel):
    id: str
    name: str
    description: str = ""
    background_image: Optional[str] = None
    foreground_layer: Optional[str] = None
    lighting: str = "dramatic cinematic lighting"
    weather_default: Literal["none", "rain", "snow", "fog", "storm"] = "none"
    color_palette: List[str] = Field(default_factory=list)
    ambient_audio: Optional[str] = None


class Shot(BaseModel):
    id: str
    scene_id: str
    shot_number: int = Field(ge=1)
    start_time: float = Field(ge=0.0)
    end_time: float = Field(gt=0.0)
    duration: float = Field(gt=0.0)
    characters_present: List[str] = Field(default_factory=list)
    environment_id: str = ""
    reference_images: List[str] = Field(default_factory=list)
    image_asset_path: Optional[str] = None
    positive_prompt: str = ""
    negative_prompt: str = "low quality, blurry, watermark"
    motion_prompt: str = "Slow cinematic camera push-in"
    motion_spec: MotionSpec = Field(default_factory=MotionSpec)
    animation_model: str = "ffmpeg-deterministic-v1"
    generation_method: Literal[
        "deterministic", "generative_i2v", "generative_t2v", "hybrid"
    ] = "deterministic"
    narration_segment: str = ""
    narration_audio_path: Optional[str] = None
    sound_effects: List[str] = Field(default_factory=list)
    subtitle_segment: str = ""
    output_file: Optional[str] = None
    status: JobStatus = "pending"
    approved: bool = False
    seed: int = 42
    error: Optional[str] = None


class Scene(BaseModel):
    id: str
    scene_number: int = Field(ge=1)
    title: str
    summary: str = ""
    environment_id: str = ""
    narration_text: str = ""
    dialogue_lines: List[Dict[str, str]] = Field(default_factory=list)
    start_time: float = Field(ge=0.0)
    end_time: float = Field(ge=0.0)
    duration: float = Field(gt=0.0)
    ambient_audio_path: Optional[str] = None
    sfx_paths: List[str] = Field(default_factory=list)
    output_file: Optional[str] = None
    status: JobStatus = "pending"
    shots: List[Shot] = Field(default_factory=list)


class SubtitleEntry(BaseModel):
    index: int = Field(ge=1)
    start_time: float = Field(ge=0.0)
    end_time: float = Field(gt=0.0)
    text: str
    language: str = "en"


class ProjectManifest(BaseModel):
    manifest_version: str = MANIFEST_VERSION
    project_id: str
    name: str
    description: str = ""
    topic: str = ""
    script: str = ""
    target_duration_seconds: float = Field(default=120.0, ge=5.0, le=7200.0)
    created_at: str
    updated_at: str
    stage: str = "created"
    characters: List[Character] = Field(default_factory=list)
    environments: List[Environment] = Field(default_factory=list)
    scenes: List[Scene] = Field(default_factory=list)
    subtitles: List[SubtitleEntry] = Field(default_factory=list)
