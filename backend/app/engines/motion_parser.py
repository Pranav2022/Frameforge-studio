import re
from app.schemas.manifest import MotionSpec


def parse_motion_instruction(instruction: str) -> MotionSpec:
    text = (instruction or "").lower()

    camera = "zoom_in"
    if re.search(r"\b(zoom[\s-]?out|pull[\s-]?back|widen|reveal wide)\b", text):
        camera = "zoom_out"
    elif re.search(r"\b(pan[\s-]?left|move[\s-]?left|sweep[\s-]?left)\b", text):
        camera = "pan_left"
    elif re.search(r"\b(pan[\s-]?right|move[\s-]?right|sweep[\s-]?right|track across)\b", text):
        camera = "pan_right"
    elif re.search(r"\b(tilt[\s-]?up|rise|ascend)\b", text):
        camera = "tilt_up"
    elif re.search(r"\b(tilt[\s-]?down|descend)\b", text):
        camera = "tilt_down"
    elif re.search(r"\b(parallax|depth|foreground|layers)\b", text):
        camera = "parallax"
    elif re.search(r"\b(static|still|locked|fixed camera)\b", text):
        camera = "static"

    speed = "slow"
    if re.search(r"\b(fast|rapid|quick|urgent)\b", text):
        speed = "fast"
    elif re.search(r"\b(medium|steady|moderate)\b", text):
        speed = "medium"

    weather = "none"
    if re.search(r"\b(storm|thunderstorm|tempest)\b", text):
        weather = "storm"
    elif re.search(r"\b(rain|downpour|drizzle)\b", text):
        weather = "rain"
    elif re.search(r"\b(snow|blizzard|snowfall)\b", text):
        weather = "snow"
    elif re.search(r"\b(fog|mist|haze)\b", text):
        weather = "fog"

    effects = []
    if re.search(r"\b(lightning|thunder|flash)\b", text):
        effects.append("lightning")
    if re.search(r"\b(fire|flame|ember|blaze)\b", text):
        effects.append("fire")
    if re.search(r"\b(smoke|ash|dust)\b", text):
        effects.append("smoke")
    if re.search(r"\b(ray|sunbeam|godray|beam)\b", text):
        effects.append("light_rays")
    if re.search(r"\b(glow|radiance|aura|shimmer)\b", text):
        effects.append("glow")

    return MotionSpec(
        raw_instruction=instruction,
        camera=camera,
        camera_speed=speed,
        camera_shake=bool(re.search(r"\b(shake|tremble|earthquake|impact)\b", text)),
        weather=weather,
        effects=effects,
    )
