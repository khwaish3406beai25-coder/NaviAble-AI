import { useEffect, useState } from 'react';
import * as Speech from 'expo-speech';
import { AccessibilityInfo } from 'react-native';

/**
 * Builds a natural, accessible spoken summary from the structured analysis.
 */
export function formatAnalysisForSpeech(analysis) {
  if (!analysis) return 'No analysis result available to read.';

  const parts = [];

  if (analysis.scene) {
    parts.push(`Scene: ${analysis.scene}`);
  }

  if (Array.isArray(analysis.objects) && analysis.objects.length > 0) {
    parts.push(`Detected objects: ${analysis.objects.join(', ')}.`);
  }

  if (Array.isArray(analysis.signsAndText) && analysis.signsAndText.length > 0) {
    parts.push(`Recognized signs and text: ${analysis.signsAndText.join(', ')}.`);
  }

  if (Array.isArray(analysis.hazards) && analysis.hazards.length > 0) {
    parts.push(`Visible obstacles and hazards: ${analysis.hazards.join(', ')}.`);
  }

  if (analysis.observations) {
    parts.push(`Important observations: ${analysis.observations}`);
  }

  if (parts.length === 0) {
    return 'Analysis completed, but no descriptive details were found.';
  }

  return parts.join(' ');
}

/**
 * Formats recognized text only for verbatim reading.
 */
export function formatTextOnlyForSpeech(analysis) {
  if (!analysis) return 'No image analysis result available to read.';

  const texts = Array.isArray(analysis.signsAndText) ? analysis.signsAndText : [];

  if (texts.length === 0) {
    if (analysis.textNotes) {
      return `Text reading: ${analysis.textNotes}`;
    }
    return 'No readable signs or printed text were identified in this image.';
  }

  const spoken = `Recognized text: ${texts.join('. ')}.`;
  if (analysis.textNotes) {
    return `${spoken} Additional note: ${analysis.textNotes}`;
  }
  return spoken;
}

class SpeechManager {
  constructor() {
    this.isSpeaking = false;
    this.speakingMode = null; // null | 'analysis' | 'text_only'
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback({ isSpeaking: this.isSpeaking, speakingMode: this.speakingMode });
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.subscribers.forEach((cb) =>
      cb({ isSpeaking: this.isSpeaking, speakingMode: this.speakingMode })
    );
  }

  async stop() {
    try {
      await Speech.stop();
    } catch {}
    this.isSpeaking = false;
    this.speakingMode = null;
    this.notify();
    AccessibilityInfo.announceForAccessibility('Speech stopped.');
  }

  async speak(textToSpeak, mode = 'analysis') {
    if (!textToSpeak || typeof textToSpeak !== 'string' || textToSpeak.trim().length === 0) {
      AccessibilityInfo.announceForAccessibility('No text available to read.');
      return;
    }

    // Stop any in-progress speech to prevent overlapping utterances
    await this.stop();

    this.isSpeaking = true;
    this.speakingMode = mode;
    this.notify();

    AccessibilityInfo.announceForAccessibility(
      mode === 'text_only' ? 'Reading recognized text.' : 'Reading analysis result.'
    );

    try {
      Speech.speak(textToSpeak, {
        language: 'en-US',
        rate: 0.95,
        pitch: 1.0,
        onStart: () => {
          this.isSpeaking = true;
          this.speakingMode = mode;
          this.notify();
        },
        onDone: () => {
          this.isSpeaking = false;
          this.speakingMode = null;
          this.notify();
        },
        onStopped: () => {
          this.isSpeaking = false;
          this.speakingMode = null;
          this.notify();
        },
        onError: () => {
          this.isSpeaking = false;
          this.speakingMode = null;
          this.notify();
          AccessibilityInfo.announceForAccessibility('An error occurred during speech output.');
        },
      });
    } catch (err) {
      this.isSpeaking = false;
      this.speakingMode = null;
      this.notify();
    }
  }

  async speakAnalysis(analysis) {
    const text = formatAnalysisForSpeech(analysis);
    return this.speak(text, 'analysis');
  }

  async speakTextOnly(analysis) {
    const text = formatTextOnlyForSpeech(analysis);
    return this.speak(text, 'text_only');
  }
}

export const speechManager = new SpeechManager();

/**
 * Custom React hook for Text-to-Speech playback.
 * Automatically stops speech when the hosting component unmounts.
 */
export function useSpeech() {
  const [speechState, setSpeechState] = useState({
    isSpeaking: speechManager.isSpeaking,
    speakingMode: speechManager.speakingMode,
  });

  useEffect(() => {
    const unsub = speechManager.subscribe(setSpeechState);
    return () => {
      unsub();
      // Ensure speech is stopped on unmount
      speechManager.stop();
    };
  }, []);

  return {
    isSpeaking: speechState.isSpeaking,
    speakingMode: speechState.speakingMode,
    speakAnalysis: (analysis) => speechManager.speakAnalysis(analysis),
    speakTextOnly: (analysis) => speechManager.speakTextOnly(analysis),
    stopSpeaking: () => speechManager.stop(),
  };
}

