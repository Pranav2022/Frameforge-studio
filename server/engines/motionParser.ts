import { MotionSpec, MotionSpecSchema, VisualEffect, WeatherEffect } from '../types/manifest.ts';

/**
 * Converts natural-language animation instructions into a structured, deterministic MotionSpec.
 * Generic: works with any subject, camera direction, weather, VFX overlay, or transition cue.
 */
export function parseMotionInstruction(instruction: string): MotionSpec {
  const text = (instruction || '').toLowerCase();

  let camera: MotionSpec['camera'] = 'zoom_in';
  if (/\b(zoom[\s-]?out|pull[\s-]?back|widen|reveal wide)\b/.test(text)) {
    camera = 'zoom_out';
  } else if (/\b(pan[\s-]?left|move[\s-]?left|sweep[\s-]?left)\b/.test(text)) {
    camera = 'pan_left';
  } else if (/\b(pan[\s-]?right|move[\s-]?right|sweep[\s-]?right|track across)\b/.test(text)) {
    camera = 'pan_right';
  } else if (/\b(tilt[\s-]?up|rise|ascend|pan[\s-]?up)\b/.test(text)) {
    camera = 'tilt_up';
  } else if (/\b(tilt[\s-]?down|descend|pan[\s-]?down)\b/.test(text)) {
    camera = 'tilt_down';
  } else if (/\b(parallax|depth|foreground|layers)\b/.test(text)) {
    camera = 'parallax';
  } else if (/\b(static|still|locked|fixed camera|tripod)\b/.test(text)) {
    camera = 'static';
  } else if (/\b(push[\s-]?in|zoom[\s-]?in|moves?\s+toward|close[\s-]?up|approach)\b/.test(text)) {
    camera = 'zoom_in';
  }

  let cameraSpeed: MotionSpec['cameraSpeed'] = 'slow';
  if (/\b(fast|rapid|quick|urgent|whip)\b/.test(text)) {
    cameraSpeed = 'fast';
  } else if (/\b(medium|steady|moderate|smooth)\b/.test(text)) {
    cameraSpeed = 'medium';
  }

  let weather: WeatherEffect = 'none';
  if (/\b(storm|thunderstorm|tempest)\b/.test(text)) weather = 'storm';
  else if (/\b(rain|downpour|drizzle)\b/.test(text)) weather = 'rain';
  else if (/\b(snow|blizzard|snowfall|flakes)\b/.test(text)) weather = 'snow';
  else if (/\b(fog|mist|haze)\b/.test(text)) weather = 'fog';

  const effects: VisualEffect[] = [];
  if (/\b(lightning|thunder|bolt)\b/.test(text)) effects.push('lightning');
  if (/\b(fire|flames?|blaze|inferno)\b/.test(text)) effects.push('fire');
  if (/\b(embers?|firefly|fireflies|sparks?|golden particles?|magic dust)\b/.test(text)) effects.push('golden_embers');
  if (/\b(god[\s-]?rays?|sunbeams?|light[\s-]?rays?|pillar of light|beams?|halo)\b/.test(text)) effects.push('god_rays');
  if (/\b(violet|purple aura|magenta energy|mystic aura)\b/.test(text)) effects.push('violet_aura');
  if (/\b(ground mist|low fog|smoke|ash)\b/.test(text)) effects.push('ground_mist');
  if (/\b(glow|radiance|aura|shimmer|luminous)\b/.test(text)) effects.push('glow');
  if (/\b(particles?|floating)\b/.test(text)) effects.push('particles');

  const cameraShake = /\b(shake|tremble|earthquake|impact|vibration|quake|shatter|roar)\b/.test(text);
  const motionBlur = /\b(blur|streak|speed)\b/.test(text);

  let transitionIn: MotionSpec['transitionIn'] = 'fade';
  if (/\b(cut in|hard cut)\b/.test(text)) transitionIn = 'cut';
  else if (/\b(dissolve)\b/.test(text)) transitionIn = 'dissolve';

  let transitionOut: MotionSpec['transitionOut'] = 'dissolve';
  if (/\b(flash[\s-]?white|white flash|light burst)\b/.test(text)) transitionOut = 'flash_white';
  else if (/\b(violet flash|purple flash|energy flash)\b/.test(text)) transitionOut = 'flash_violet';
  else if (/\b(diagonal|slice|split wipe|saber wipe)\b/.test(text)) transitionOut = 'diagonal_slice';
  else if (/\b(wipe left|wipe)\b/.test(text)) transitionOut = 'wipe_left';
  else if (/\b(slide up)\b/.test(text)) transitionOut = 'slide_up';
  else if (/\b(circle|iris)\b/.test(text)) transitionOut = 'circle_open';

  return MotionSpecSchema.parse({
    rawInstruction: instruction,
    camera,
    cameraSpeed,
    subjectMotion: /\b(dynamic|battle|run|fight|action|roar)\b/.test(text) ? 'moderate' : 'minimal',
    cameraShake,
    parallaxDepth: camera === 'parallax' ? 0.55 : 0.25,
    weather,
    effects,
    transitionIn,
    transitionOut,
    motionBlur,
    preserveCharacterIdentity: true,
  });
}
