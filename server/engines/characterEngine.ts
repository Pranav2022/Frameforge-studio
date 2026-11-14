import { Character, Environment, ProjectManifest, Shot } from '../types/manifest.ts';

/**
 * Character & Environment Consistency Engine.
 * Enriches every shot with locked character descriptors, clothing/accessories,
 * environment lighting, reference images, negative prompts, and deterministic seeds.
 */
export function applyCharacterAndEnvironmentConsistency(manifest: ProjectManifest): ProjectManifest {
  const charMap = new Map<string, Character>();
  for (const ch of manifest.characters) {
    charMap.set(ch.id, ch);
  }

  const envMap = new Map<string, Environment>();
  for (const env of manifest.environments) {
    envMap.set(env.id, env);
  }

  const updatedScenes = manifest.scenes.map((scene) => {
    const sceneEnv = envMap.get(scene.environmentId);

    const updatedShots: Shot[] = scene.shots.map((shot) => {
      const env = envMap.get(shot.environmentId || scene.environmentId) || sceneEnv;
      const presentChars = shot.charactersPresent
        .map((id) => charMap.get(id))
        .filter((c): c is Character => Boolean(c));

      const charBlocks = presentChars.map((ch) => {
        const parts = [
          ch.name,
          ch.appearance,
          ch.faceDetails ? `face: ${ch.faceDetails}` : '',
          ch.clothing ? `wearing ${ch.clothing}` : '',
          ch.accessories ? `with ${ch.accessories}` : '',
          ch.colorPalette.length > 0 ? `palette: ${ch.colorPalette.join(', ')}` : '',
        ].filter(Boolean);
        return parts.join(', ');
      });

      const envBlock = env
        ? `Environment: ${env.name}, ${env.description}, lighting: ${env.lighting}`
        : '';

      const refImages = Array.from(
        new Set([
          ...shot.referenceImages,
          ...presentChars.flatMap((c) => c.referenceImages),
          ...(env?.backgroundImage ? [env.backgroundImage] : []),
        ])
      );

      const combinedNegatives = Array.from(
        new Set([
          shot.negativePrompt,
          ...presentChars.map((c) => c.negativePrompt).filter(Boolean),
        ])
      )
        .filter(Boolean)
        .join(', ');

      const primarySeed =
        presentChars[0]?.fixedSeed ?? shot.seed ?? manifest.generationSettings.defaultSeed;

      const basePrompt = shot.positivePrompt.split('| Consistency:')[0].trim();
      const consistencySuffix = [...charBlocks, envBlock].filter(Boolean).join('; ');

      return {
        ...shot,
        referenceImages: refImages,
        negativePrompt: combinedNegatives || 'low quality, blurry, watermark',
        seed: primarySeed,
        positivePrompt: consistencySuffix
          ? `${basePrompt} | Consistency: ${consistencySuffix}`
          : basePrompt,
      };
    });

    return {
      ...scene,
      shots: updatedShots,
    };
  });

  return {
    ...manifest,
    scenes: updatedScenes,
  };
}
