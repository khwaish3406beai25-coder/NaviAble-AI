import { Platform } from 'react-native';
import { markVoiceEvent } from './voicePerformance';

// Browser fallback: the native Expo module is unavailable on web. Use the
// browser's real Web Speech API where the browser provides it (Chrome/Edge).
const browserSpeechListeners = new Map();
let browserRecognizer = null;
let browserSpeechState = 'inactive';
let browserListenerId = 0;

function getBrowserSpeechModule() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;
  const emit = (type, event) => {
    browserSpeechListeners.forEach((listener) => listener(type, event));
  };
  return {
    isRecognitionAvailable: () => true,
    getSpeechRecognitionServices: () => ['Browser Web Speech API'],
    getDefaultRecognitionService: () => ({ packageName: 'Browser Web Speech API' }),
    addListener(type, listener) {
      const id = ++browserListenerId;
      browserSpeechListeners.set(id, (eventType, event) => { if (eventType === type) listener(event); });
      return { remove: () => browserSpeechListeners.delete(id) };
    },
    async requestMicrophonePermissionsAsync() {
      if (!navigator.mediaDevices?.getUserMedia) return { granted: false };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return { granted: true };
    },
    getStateAsync: async () => browserSpeechState,
    start(options = {}) {
      if (browserSpeechState !== 'inactive') throw new Error('Speech recognition is already active.');
      const recognition = new Recognition();
      browserRecognizer = recognition;
      recognition.lang = options.lang || 'en-US';
      recognition.interimResults = Boolean(options.interimResults);
      recognition.continuous = true;
      recognition.maxAlternatives = options.maxAlternatives || 1;
      recognition.onstart = () => { browserSpeechState = 'active'; emit('start', {}); };
      recognition.onaudiostart = () => emit('audiostart', {});
      recognition.onresult = (event) => {
        const results = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          for (let alternative = 0; alternative < result.length; alternative += 1) {
            const candidate = result[alternative];
            if (candidate?.transcript?.trim()) {
              results.push({ transcript: candidate.transcript, confidence: candidate.confidence, isFinal: result.isFinal });
            }
          }
        }
        const latest = results[results.length - 1];
        if (latest) emit('result', { results, isFinal: Boolean(latest.isFinal) });
      };
      recognition.onerror = (event) => emit('error', { error: event.error, message: event.message });
      recognition.onend = () => {
        browserSpeechState = 'inactive';
        browserRecognizer = null;
        emit('end', {});
      };
      browserSpeechState = 'starting';
      recognition.start();
    },
    stop() { browserRecognizer?.stop(); },
    abort() { browserRecognizer?.abort(); },
  };
}

const logVoice = (event, details) => {
  if (__DEV__) console.info(`[VoiceRecognition] ${event}`, details || '');
};

/**
 * Load the native module lazily so the rest of the app remains usable in
 * Expo Go. Voice assistance itself requires the Android development build.
 */
export function getSpeechRecognitionModule() {
  const browserModule = getBrowserSpeechModule();
  if (browserModule) return browserModule;
  try {
    return require('expo-speech-recognition').ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}

export function getVoiceSetupProblem() {
  const speechModule = getSpeechRecognitionModule();
  if (!speechModule?.start || !speechModule?.addListener) {
    logVoice('module unavailable');
    if (Platform.OS === 'web') return 'Voice recognition is not supported by this browser. Open NaviAble in Chrome or Edge and allow microphone access.';
    return 'Voice assistance requires the NaviAble Android development build. Expo Go does not include the native speech-recognition module.';
  }
  const available = Boolean(speechModule.isRecognitionAvailable?.());
  let services = [];
  let defaultService = '';
  try {
    services = speechModule.getSpeechRecognitionServices?.() || [];
    defaultService = speechModule.getDefaultRecognitionService?.()?.packageName || '';
  } catch (error) {
    logVoice('could not list speech services', error?.message);
  }
  logVoice('engine check', { available, services, defaultService });
  if (!available) {
    if (Platform.OS === 'web') return 'This browser does not provide speech recognition. Use Chrome or Edge and allow microphone access.';
    return 'Android speech recognition is unavailable. Enable a speech-recognition service in Android Settings and try again.';
  }
  return '';
}

export async function requestVoiceMicrophonePermission() {
  const speechModule = getSpeechRecognitionModule();
  if (!speechModule) {
    throw new Error('Speech recognition is unavailable in this app build. Install and open the Android development build.');
  }
  if (Platform.OS === 'ios') {
    const permission = await speechModule.requestPermissionsAsync();
    logVoice('permission result', permission);
    return permission;
  }
  if (!speechModule.requestMicrophonePermissionsAsync) {
    throw new Error('Microphone permission is unavailable in this app build. Rebuild NaviAble and try again.');
  }
  const permission = await speechModule.requestMicrophonePermissionsAsync();
  logVoice('microphone permission result', permission);
  return permission;
}

/** Start Android's real SpeechRecognizer; no wake-word simulation is used. */
export function startSpeechRecognition({ mode = 'wake', interimResults = true } = {}) {
  const speechModule = getSpeechRecognitionModule();
  if (!speechModule) {
    throw new Error('Speech recognition is unavailable. Rebuild and open the Android development app.');
  }
  // Android 13+ supports real segmented continuous sessions. Older Android
  // releases use one-shot recognition and App restarts the recognizer on end.
  // Keep the language aligned with the app's Indian English audience.
  const continuous = Platform.OS === 'android' && Number(Platform.Version) >= 33;
  logVoice('start requested', { mode, platform: Platform.OS, api: Platform.Version, interimResults, continuous });
  markVoiceEvent('recognition start requested', { mode, continuous });
  speechModule.start({
    lang: 'en-IN',
    interimResults,
    continuous,
    maxAlternatives: 3,
    contextualStrings: ['Hey Navi', 'Detect my surroundings', 'Read text', 'Repeat', 'Stop speaking', 'Stop assistance'],
    androidIntentOptions: {
      EXTRA_LANGUAGE_MODEL: 'free_form',
      EXTRA_PARTIAL_RESULTS: interimResults,
      EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1600,
      EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1200,
    },
  });
}

/** Abort microphone capture and wait briefly for Android's end event. */
export async function stopSpeechRecognition({ abort = true } = {}) {
  const speechModule = getSpeechRecognitionModule();
  if (!speechModule) return;

  let state = 'unknown';
  try {
    state = await speechModule.getStateAsync?.() || state;
  } catch {
    // Fall back to the native stop call when the module cannot report state.
  }
  if (state === 'inactive') {
    logVoice('stop skipped; recognizer already inactive');
    return;
  }
  const shouldAbort = abort && state !== 'stopping';

  logVoice('stop requested', { state, abort: shouldAbort });

  await new Promise((resolve) => {
    let finished = false;
    let endSubscription;
    let timeout;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      endSubscription?.remove();
      resolve();
    };
    endSubscription = speechModule.addListener('end', finish);
    timeout = setTimeout(finish, 500);
    try {
      if (shouldAbort) speechModule.abort();
      else speechModule.stop();
    } catch {
      finish();
    }
  });
}
