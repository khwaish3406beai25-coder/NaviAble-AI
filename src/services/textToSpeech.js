import * as Speech from 'expo-speech';

const TARGET_MAX_WORDS = 40;

/**
 * Creates the shared concise response shown in VoiceAssistant and spoken by
 * TTS. The full structured analysis remains available in AnalysisResult.
 */
export function formatConciseAnalysis(result) {
  const scene = typeof result?.scene === 'string' ? result.scene.trim() : '';
  const observations = typeof result?.observations === 'string' ? result.observations.trim() : '';
  const objects = Array.isArray(result?.objects)
    ? result.objects.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
    : [];
  const signs = Array.isArray(result?.signsAndText)
    ? result.signsAndText.filter((item) => typeof item === 'string' && item.trim()).slice(0, 2)
    : [];

  const core = [scene, observations]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
  let optional = [];
  const countWords = (parts) => parts.join(' ').trim().split(/\s+/).filter(Boolean).length;

  // Preserve the scene and safety observations first. Add object and text
  // details only when they fit the concise speaking target.
  const details = [
    ...(objects.length ? [`Important objects: ${objects.join(', ')}.`] : []),
    ...(signs.length ? [`Relevant text: ${signs.join(', ')}.`] : []),
  ];
  for (const detail of details) {
    if (countWords([...core, ...optional, detail]) <= TARGET_MAX_WORDS) optional.push(detail);
  }

  return [...core, ...optional].join(' ');
}

/** Speak non-empty text and forward native speech lifecycle callbacks. */
export function speakText(text, callbacks = {}) {
  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText) throw new Error('There is no response available to speak.');

  Speech.speak(cleanText, {
    language: 'en-US',
    rate: 0.92,
    onStart: callbacks.onStart,
    onDone: callbacks.onDone,
    onStopped: callbacks.onStopped,
    onError: callbacks.onError,
  });
}

/** Stop the current utterance and clear any queued speech. */
export function stopSpeaking() {
  return Speech.stop();
}
