/**
 * Optional Local AI-Assisted Story-to-Script & Scene Breakdown Service.
 * Uses local Ollama if reachable; otherwise uses a structured deterministic narrative outline generator.
 * Zero paid APIs required.
 */
export async function generateProjectDraftFromTopic(input: {
  topic: string;
  targetDurationSeconds: number;
  language: string;
  visualStyle: string;
}): Promise<{
  source: 'ollama-local' | 'structured-outline';
  script: string;
  suggestedCharacters: Array<{ name: string; appearance: string; clothing: string }>;
  suggestedEnvironments: Array<{ name: string; description: string; lighting: string }>;
}> {
  const ollamaUrl = (process.env.OLLAMA_API_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const ping = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);

    if (ping.ok) {
      const prompt = `Create a structured 4-scene video narration script in ${input.language} for a ${input.targetDurationSeconds}-second video about: "${input.topic}".
Visual style: ${input.visualStyle}.
Format strictly with headers "SCENE 1: Title - Location", "[MOTION: camera instruction]", and narration paragraphs. Keep total length proportional to ${input.targetDurationSeconds} seconds.`;

      const genRes = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
      });

      if (genRes.ok) {
        const data = (await genRes.json()) as { response?: string };
        if (data.response && data.response.trim().length > 40) {
          return {
            source: 'ollama-local',
            script: data.response.trim(),
            suggestedCharacters: [
              {
                name: 'Protagonist',
                appearance: 'Expressive central figure aligned with the narrative theme',
                clothing: 'Period-accurate or domain-authentic attire',
              },
            ],
            suggestedEnvironments: [
              {
                name: 'Opening Setting',
                description: `Wide atmospheric backdrop establishing ${input.topic}`,
                lighting: 'Golden hour cinematic rim lighting',
              },
            ],
          };
        }
      }
    }
  } catch {
    // Graceful fallback below
  }

  const topicClean = input.topic.trim() || 'A New Documentary Story';
  const script = `SCENE 1: Introduction - Opening Vista
[MOTION: Slow zoom-in across wide horizon with soft light rays]
NARRATOR: Every remarkable journey begins with a moment of stillness. Today we explore ${topicClean}, tracing the forces and turning points that shaped its legacy.

SCENE 2: Rising Tension - Central Chamber
[MOTION: Slow pan right with subtle fog and warm glow]
NARRATOR: Beneath the surface, contrasting ambitions and unspoken challenges begin to converge. Each decision carries weight as circumstances shift toward conflict.

SCENE 3: Turning Point - Storm Ridge
[MOTION: Slow push-in with dramatic lightning flash and storm atmosphere]
NARRATOR: At the decisive hour, resolve is tested against overwhelming odds. Through perseverance and clarity of purpose, a new balance begins to emerge.

SCENE 4: Resolution - Dawn Horizon
[MOTION: Slow zoom-out revealing tranquil wide vista with warm light rays]
NARRATOR: As the storm clears, the lasting impact of ${topicClean} comes into focus—reminding us how enduring stories continue to inspire generations.`;

  return {
    source: 'structured-outline',
    script,
    suggestedCharacters: [
      {
        name: 'Narrator Focus Subject',
        appearance: 'Distinctive silhouette and expressive posture suited to the story',
        clothing: 'Detailed thematic attire with clear color contrast',
      },
    ],
    suggestedEnvironments: [
      {
        name: 'Opening Vista',
        description: `Atmospheric establishing landscape for ${topicClean}`,
        lighting: 'Warm directional sunlight with soft atmospheric haze',
      },
      {
        name: 'Storm Ridge',
        description: 'High-contrast dramatic ridge under gathering clouds',
        lighting: 'Cool slate shadows broken by sharp amber highlights',
      },
    ],
  };
}
