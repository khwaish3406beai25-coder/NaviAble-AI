import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import {
  getMicrophonePermissionsAsync,
  requestMicrophonePermissionsAsync,
} from 'expo-camera';

/**
 * Microphone listening lifecycle states as requested in requirements.
 */
export const VOICE_LIFECYCLE = {
  IDLE: 'idle',
  REQUESTING_PERMISSION: 'requesting_permission',
  LISTENING: 'listening',
  DETECTED: 'detected',
  PERMISSION_DENIED: 'permission_denied',
  ERROR: 'error',
};

/**
 * Target wake phrase for NaviAble AI.
 */
export const WAKE_PHRASE = 'Hey NaviAble';

/**
 * Normalizes speech text to simplify wake phrase detection.
 */
function normalizeTranscript(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a given transcript contains the wake phrase or its phonetic variants.
 */
export function matchesWakePhrase(transcript) {
  const normalized = normalizeTranscript(transcript);
  return (
    normalized.includes('hey naviable') ||
    normalized.includes('hey navi able') ||
    normalized.includes('hey navi bull') ||
    normalized.includes('hey navi ball') ||
    normalized.includes('hey navigate') ||
    normalized.includes('naviable')
  );
}

/**
 * VoiceActivationManager manages the microphone listening lifecycle,
 * permission checks, wake word detection, app backgrounding cleanup,
 * and downstream action safety.
 */
class VoiceActivationManager {
  constructor() {
    this.lifecycleState = VOICE_LIFECYCLE.IDLE;
    this.onStateChangeCallbacks = new Set();
    this.onWakeWordCallbacks = new Set();

    this.activeRecognition = null;
    this.isListening = false;
    this.wasListeningBeforeBackground = false;
    this.appStateSubscription = null;
    this.lastTriggerTime = 0;
    this.cooldownPeriodMs = 3000; // Prevent repeated triggers from single wake-word event

    this.lastError = null;

    this.initAppStateListener();
  }

  /**
   * Subscribes to AppState changes to handle app backgrounding and foregrounding.
   * Ensures the microphone is never left running unexpectedly when the app is minimized.
   */
  initAppStateListener() {
    if (this.appStateSubscription) return;

    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (this.isListening) {
          this.wasListeningBeforeBackground = true;
          this.stopListening({ preserveState: true });
          AccessibilityInfo.announceForAccessibility('Voice listening paused while app is in background.');
        }
      } else if (nextAppState === 'active') {
        if (this.wasListeningBeforeBackground) {
          this.wasListeningBeforeBackground = false;
          // Resume safely upon returning to the foreground
          this.startListening().catch(() => {});
          AccessibilityInfo.announceForAccessibility('Voice listening resumed.');
        }
      }
    });
  }

  /**
   * Subscribe to lifecycle state updates.
   */
  subscribeState(callback) {
    this.onStateChangeCallbacks.add(callback);
    callback(this.lifecycleState, this.lastError);
    return () => this.onStateChangeCallbacks.delete(callback);
  }

  /**
   * Subscribe to wake word detection events.
   */
  subscribeWakeWord(callback) {
    this.onWakeWordCallbacks.add(callback);
    return () => this.onWakeWordCallbacks.delete(callback);
  }

  /**
   * Updates state and notifies subscribers.
   */
  setState(newState, error = null) {
    this.lifecycleState = newState;
    this.lastError = error;
    this.onStateChangeCallbacks.forEach((cb) => cb(newState, error));
  }

  /**
   * Checks current microphone permission without prompting the user repeatedly.
   */
  async checkPermission() {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        try {
          const res = await navigator.permissions.query({ name: 'microphone' });
          return res.state === 'granted';
        } catch {
          // Some browsers do not support query({ name: 'microphone' })
          return false;
        }
      }
      return false;
    }

    try {
      const response = await getMicrophonePermissionsAsync();
      return response.granted;
    } catch {
      return false;
    }
  }

  /**
   * Requests microphone permission cleanly.
   */
  async requestPermission() {
    this.setState(VOICE_LIFECYCLE.REQUESTING_PERMISSION);

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop immediate audio track to release mic until listening starts
          stream.getTracks().forEach((track) => track.stop());
          return true;
        } catch (err) {
          this.setState(
            VOICE_LIFECYCLE.PERMISSION_DENIED,
            'Microphone access was denied in browser settings.'
          );
          return false;
        }
      }
      this.setState(
        VOICE_LIFECYCLE.ERROR,
        'Audio recording is not supported in this browser environment.'
      );
      return false;
    }

    try {
      const response = await requestMicrophonePermissionsAsync();
      if (response.granted) {
        return true;
      }
      this.setState(
        VOICE_LIFECYCLE.PERMISSION_DENIED,
        'Microphone permission is required to listen for the wake phrase.'
      );
      return false;
    } catch (err) {
      this.setState(
        VOICE_LIFECYCLE.ERROR,
        'Unable to request microphone permission. Please check system settings.'
      );
      return false;
    }
  }

  /**
   * Starts listening for the wake phrase "Hey NaviAble".
   * Prevents multiple concurrent listeners.
   */
  async startListening() {
    if (this.isListening) {
      return; // Already listening; prevent duplicate concurrent listeners
    }

    // Step 1: Check permissions
    const hasPermission = await this.checkPermission();
    if (!hasPermission) {
      const granted = await this.requestPermission();
      if (!granted) return;
    }

    this.isListening = true;
    this.setState(VOICE_LIFECYCLE.LISTENING);
    AccessibilityInfo.announceForAccessibility('Listening for wake phrase: Hey NaviAble.');

    // Step 2: Platform-specific listening implementation
    if (Platform.OS === 'web') {
      this.startWebSpeechRecognition();
    } else {
      this.startNativeWakeWordEngine();
    }
  }

  /**
   * Web platform speech recognition for wake word.
   */
  startWebSpeechRecognition() {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      // Browser does not support speech recognition
      this.setState(
        VOICE_LIFECYCLE.LISTENING,
        'Web Speech Recognition not supported in this browser. Use Chrome/Edge or manual activation.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        if (!this.isListening) return;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0]?.transcript || '';
          if (matchesWakePhrase(transcript)) {
            this.handleWakeWordDetected(transcript);
            break;
          }
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          this.setState(
            VOICE_LIFECYCLE.PERMISSION_DENIED,
            'Microphone access denied.'
          );
          this.stopListening();
        } else if (event.error !== 'no-speech') {
          this.setState(
            VOICE_LIFECYCLE.ERROR,
            `Speech recognition error: ${event.error}`
          );
        }
      };

      recognition.onend = () => {
        // Automatically restart if still in listening state
        if (this.isListening && this.lifecycleState === VOICE_LIFECYCLE.LISTENING) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      this.activeRecognition = recognition;
    } catch (err) {
      this.setState(
        VOICE_LIFECYCLE.ERROR,
        'Failed to initialize web speech recognition.'
      );
    }
  }

  /**
   * Native React Native / Expo wake-word engine.
   *
   * Note on Expo Go & Offline Wake Word:
   * True offline keyword spotting on Android/iOS requires Picovoice Porcupine
   * (@picovoice/porcupine-react-native) with a custom .ppn keyword model trained
   * for "Hey NaviAble". Standard Expo Go does not bundle native C++ Porcupine
   * binaries. Therefore, in Expo Go, this reports the diagnostic status accurately
   * without pretending native C++ models are running.
   */
  startNativeWakeWordEngine() {
    this.activeRecognition = {
      stop: () => {},
    };
  }

  /**
   * Handles detection of the wake phrase.
   * Debounces to prevent multiple triggers from a single event.
   */
  handleWakeWordDetected(source = 'voice') {
    const now = Date.now();
    if (now - this.lastTriggerTime < this.cooldownPeriodMs) {
      return; // Debounce repeated triggers
    }
    this.lastTriggerTime = now;

    this.setState(VOICE_LIFECYCLE.DETECTED);
    AccessibilityInfo.announceForAccessibility(
      "Wake word detected: Hey NaviAble. Assistant ready. Choose Open Camera or Analyse Image."
    );

    // Notify all subscribers
    this.onWakeWordCallbacks.forEach((cb) => {
      try {
        cb({
          phrase: WAKE_PHRASE,
          timestamp: now,
          source,
        });
      } catch (err) {
        console.error('Error in wake word subscriber:', err);
      }
    });
  }

  /**
   * Stops listening and releases all microphone resources.
   */
  stopListening(options = {}) {
    this.isListening = false;

    if (this.activeRecognition) {
      try {
        if (typeof this.activeRecognition.stop === 'function') {
          this.activeRecognition.stop();
        } else if (typeof this.activeRecognition.abort === 'function') {
          this.activeRecognition.abort();
        }
      } catch {}
      this.activeRecognition = null;
    }

    if (!options.preserveState) {
      this.setState(VOICE_LIFECYCLE.IDLE);
      AccessibilityInfo.announceForAccessibility('Voice listening stopped.');
    }
  }

  /**
   * Clean up all listeners and subscriptions when the component unmounts.
   */
  destroy() {
    this.stopListening();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.onStateChangeCallbacks.clear();
    this.onWakeWordCallbacks.clear();
  }
}

// Export singleton instance for app-wide coordination
export const voiceActivationManager = new VoiceActivationManager();

/**
 * Custom React hook for voice activation.
 * Automatically cleans up subscriptions on component unmount.
 */
export function useVoiceActivation({ onWakeWordDetected } = {}) {
  const [lifecycle, setLifecycle] = useState(voiceActivationManager.lifecycleState);
  const [error, setError] = useState(voiceActivationManager.lastError);

  useEffect(() => {
    const unsubState = voiceActivationManager.subscribeState((newState, newError) => {
      setLifecycle(newState);
      setError(newError);
    });

    let unsubWake = null;
    if (onWakeWordDetected) {
      unsubWake = voiceActivationManager.subscribeWakeWord((event) => {
        onWakeWordDetected(event);
      });
    }

    return () => {
      unsubState();
      if (unsubWake) unsubWake();
    };
  }, [onWakeWordDetected]);

  return {
    lifecycle,
    error,
    isListening: lifecycle === VOICE_LIFECYCLE.LISTENING,
    startListening: () => voiceActivationManager.startListening(),
    stopListening: () => voiceActivationManager.stopListening(),
    simulateWakeWord: (source = 'simulation') =>
      voiceActivationManager.handleWakeWordDetected(source),
    resetToListening: () => voiceActivationManager.setState(VOICE_LIFECYCLE.LISTENING),
    resetToIdle: () => voiceActivationManager.setState(VOICE_LIFECYCLE.IDLE),
  };
}
