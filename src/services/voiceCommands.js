/**
 * voiceCommands.js
 *
 * Thin wrapper around expo-speech-recognition for keyword matching.
 * Supports three commands: "open camera", "take a picture", "repeat".
 * Uses simple string matching — no LLM involved.
 */
import { useEffect, useRef, useCallback } from 'react';

let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = null;

try {
  const speechModule = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = speechModule.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speechModule.useSpeechRecognitionEvent;
} catch (e) {
  // Expo Go doesn't contain custom native modules. Fallback gracefully.
  console.log('[VoiceCommands] Native module unavailable (Expo Go). Using simulation fallback.');
}

const safeUseSpeechRecognitionEvent = useSpeechRecognitionEvent || ((_event, _callback) => {});

export const isVoiceRecognitionSupported = !!ExpoSpeechRecognitionModule;

export const VoiceCommandType = Object.freeze({
  OPEN_CAMERA: 'OPEN_CAMERA',
  TAKE_PICTURE: 'TAKE_PICTURE',
  REPEAT: 'REPEAT',
  UPLOAD_IMAGE: 'UPLOAD_IMAGE',
  UNKNOWN: 'UNKNOWN',
});

/** Maps a raw transcript string to one of our commands. */
export function matchCommand(transcript) {
  const t = (transcript || '').toLowerCase().trim();
  if (/open\s+camera/.test(t)) return VoiceCommandType.OPEN_CAMERA;
  if (/take\s+(a\s+)?picture|take\s+(a\s+)?photo|capture/.test(t)) return VoiceCommandType.TAKE_PICTURE;
  if (/repeat|again|say\s+again/.test(t)) return VoiceCommandType.REPEAT;
  if (/upload|choose\s+(a\s+)?photo|choose\s+(from\s+)?gallery|pick\s+(a\s+)?photo|from\s+gallery/.test(t)) return VoiceCommandType.UPLOAD_IMAGE;
  return VoiceCommandType.UNKNOWN;
}

/**
 * useVoiceCommands — React hook.
 *
 * @param {object} opts
 * @param {(cmd: string) => void} opts.onCommand   - called with a VoiceCommandType value
 * @param {(err: string) => void} opts.onError     - called with a human-readable error message
 * @param {(state: boolean) => void} opts.onListeningChange - called when listening state changes
 *
 * @returns {{ start: () => Promise<void>, stop: () => void, isSupported: boolean }}
 */
export function useVoiceCommands({ onCommand, onError, onListeningChange } = {}) {
  const onCommandRef = useRef(onCommand);
  const onErrorRef = useRef(onError);
  const onListeningChangeRef = useRef(onListeningChange);

  // Keep refs current so event handlers don't close over stale callbacks
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onListeningChangeRef.current = onListeningChange; }, [onListeningChange]);

  safeUseSpeechRecognitionEvent('start', () => {
    onListeningChangeRef.current?.(true);
  });

  safeUseSpeechRecognitionEvent('end', () => {
    onListeningChangeRef.current?.(false);
  });

  safeUseSpeechRecognitionEvent('result', (event) => {
    const transcript = event?.results?.[0]?.transcript ?? '';
    if (!transcript) return;
    const cmd = matchCommand(transcript);
    if (cmd !== VoiceCommandType.UNKNOWN) {
      onCommandRef.current?.(cmd);
    }
  });

  safeUseSpeechRecognitionEvent('error', (event) => {
    onListeningChangeRef.current?.(false);
    const code = event?.error ?? 'unknown';
    // "no-speech" is normal when the user stays silent; don't surface it as error
    if (code === 'no-speech') return;
    const messages = {
      'not-allowed': 'Microphone permission denied. Enable it in Settings.',
      'audio-capture': 'No microphone found or audio capture failed.',
      'network': 'Network error during speech recognition.',
      'service-not-allowed': 'Speech recognition service not permitted.',
    };
    onErrorRef.current?.(messages[code] ?? `Speech recognition error: ${code}`);
  });

  const start = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      onErrorRef.current?.('Voice recognition requires an APK build (not Expo Go).');
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        onErrorRef.current?.('Microphone permission denied. Enable it in Settings.');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: false,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
        },
      });
    } catch (err) {
      onErrorRef.current?.('Could not start voice recognition. Please try again.');
    }
  }, []);

  const stop = useCallback(() => {
    if (!ExpoSpeechRecognitionModule) return;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch { /* ignore if not running */ }
  }, []);

  return { start, stop, isSupported: !!ExpoSpeechRecognitionModule };
}
