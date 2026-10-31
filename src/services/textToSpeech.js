import * as Speech from 'expo-speech';
import { finishVoiceStage, markVoiceEvent, startVoiceStage } from './voicePerformance';

const TARGET_MAX_WORDS = 40;

/**
 * Creates the shared concise response shown in VoiceAssistant and spoken by
 * TTS. The full structured analysis remains available in AnalysisResult.
 */
export function formatConciseAnalysis(result, options = {}) {
  const scene = typeof result?.scene === 'string' ? result.scene.trim() : '';
  const observations = typeof result?.observations === 'string' ? result.observations.trim() : '';
  const objects = Array.isArray(result?.objects)
    ? result.objects.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
    : [];
  const signs = Array.isArray(result?.signsAndText)
    ? result.signsAndText.filter((item) => typeof item === 'string' && item.trim()).slice(0, 2)
    : [];

  if (options.readText) {
    if (!signs.length) return 'I could not clearly read any text in this image.';
    return `I can read: ${signs.join('. ')}.`;
  }

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
  const label = callbacks.label || 'response';
  const queuedStage = `tts-queue:${label}`;
  const playbackStage = `tts-playback:${label}`;
  startVoiceStage(queuedStage, { characters: cleanText.length });

  Speech.speak(cleanText, {
    language: 'en-US',
    rate: label === 'acknowledgment' ? 1 : 0.92,
    onStart: () => {
      finishVoiceStage(queuedStage);
      startVoiceStage(playbackStage);
      markVoiceEvent(`${label} started`);
      callbacks.onStart?.();
    },
    onDone: () => {
      finishVoiceStage(playbackStage, { result: 'finished' });
      markVoiceEvent(`${label} finished`);
      callbacks.onDone?.();
    },
    onStopped: () => {
      finishVoiceStage(playbackStage, { result: 'stopped' });
      markVoiceEvent(`${label} finished`, { result: 'stopped' });
      callbacks.onStopped?.();
    },
    onError: (error) => {
      finishVoiceStage(playbackStage, { result: 'error', message: error?.message });
      markVoiceEvent(`${label} failed`, { message: error?.message });
      callbacks.onError?.(error);
    },
  });
}

/** Stop the current utterance and clear any queued speech. */
export function stopSpeaking() {
  return Speech.stop();
}
