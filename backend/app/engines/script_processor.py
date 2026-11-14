import re
from typing import List
from app.engines.motion_parser import parse_motion_instruction
from app.schemas.manifest import Scene, Shot

SCENE_HEADER_RE = re.compile(r"^(?:SCENE\s+\d+[:.\-\s]*|INT\.|EXT\.|##+\s*)(.+)$", re.IGNORECASE)
MOTION_CUE_RE = re.compile(r"^\[(?:MOTION|CAMERA|ANIMATION)[:\s]+(.+)\]$", re.IGNORECASE)


def process_script_to_scenes(script: str, target_duration_seconds: float, visual_style: str = "cinematic") -> List[Scene]:
    lines = (script or "").splitlines()
    blocks = []
    current = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        m = SCENE_HEADER_RE.match(line)
        if m:
            if current and current["lines"]:
                blocks.append(current)
            parts = re.split(r"\s*[-–|@]\s*", m.group(1).strip(), maxsplit=1)
            current = {
                "title": parts[0] or f"Scene {len(blocks) + 1}",
                "location": parts[1] if len(parts) > 1 else "Primary Location",
                "lines": [],
                "motion": "Slow cinematic zoom-in",
            }
            continue
        if current is None:
            current = {
                "title": f"Scene {len(blocks) + 1}",
                "location": "Primary Location",
                "lines": [],
                "motion": "Slow cinematic zoom-in",
            }
        mm = MOTION_CUE_RE.match(line)
        if mm:
            current["motion"] = mm.group(1).strip()
            continue
        current["lines"].append(re.sub(r"^(NARRATOR|NARRATION|VOICEOVER):\s*", "", line, flags=re.IGNORECASE))

    if current and current["lines"]:
        blocks.append(current)

    if not blocks:
        return []

    total_words = sum(max(1, len(" ".join(b["lines"]).split())) for b in blocks)
    cursor = 0.0
    scenes: List[Scene] = []

    for idx, b in enumerate(blocks):
        narration = " ".join(b["lines"]).strip()
        words = max(1, len(narration.split()))
        is_last = idx == len(blocks) - 1
        dur = round(max(4.0, target_duration_seconds - cursor if is_last else (words / total_words) * target_duration_seconds), 2)
        sc_start = round(cursor, 2)
        sc_end = round(sc_start + dur, 2)
        cursor = sc_end
        scene_id = f"scene-{idx + 1}"
        shot_count = max(2, min(5, round(dur / 8.0)))
        shots: List[Shot] = []
        s_cursor = sc_start
        for s in range(shot_count):
            s_dur = round(max(2.0, sc_end - s_cursor if s == shot_count - 1 else dur / shot_count), 2)
            s_start = round(s_cursor, 2)
            s_end = round(s_start + s_dur, 2)
            s_cursor = s_end
            shots.append(
                Shot(
                    id=f"{scene_id}-shot-{s + 1}",
                    scene_id=scene_id,
                    shot_number=s + 1,
                    start_time=s_start,
                    end_time=s_end,
                    duration=s_dur,
                    positive_prompt=f"{visual_style}, {b['title']}, {b['location']}",
                    motion_prompt=b["motion"],
                    motion_spec=parse_motion_instruction(b["motion"]),
                    narration_segment=narration,
                    subtitle_segment=narration,
                )
            )
        scenes.append(
            Scene(
                id=scene_id,
                scene_number=idx + 1,
                title=b["title"],
                narration_text=narration,
                start_time=sc_start,
                end_time=sc_end,
                duration=dur,
                shots=shots,
            )
        )
    return scenes
