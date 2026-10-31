import * as Speech from 'expo-speech';

const MAX_SPOKEN_CHARACTERS = 600;

/**
 * Creates a short spoken version of Gemini's structured image analysis.
 * The complete response remains available in the UI for screen readers.
 */
export function createSpokenAnalysis(result) {
  const parts = [result?.scene];
  const objects = Array.isArray(result?.objects) ? result.objects.filter(Boolean).slice(0, 3) : [];
  const signs = Array.isArray(result?.signsAndText) ? result.signsAndText.filter(Boolean).slice(0, 2) : [];

  if (objects.length) parts.push(`Visible objects include ${objects.join(', ')}.`);
  if (signs.length) parts.push(`Readable text includes ${signs.join(', ')}.`);
  parts.push(result?.observations);

  const response = parts
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
    .join(' ');

  if (response.length <= MAX_SPOKEN_CHARACTERS) return response;
  const truncated = response.slice(0, MAX_SPOKEN_CHARACTERS);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : MAX_SPOKEN_CHARACTERS).replace(/[,.!?;:]?$/, '')}.`;
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
