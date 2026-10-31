import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../styles/theme';

export const VOICE_ASSISTANT_STATES = Object.freeze({
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR',
});

const STATE_CONTENT = {
  [VOICE_ASSISTANT_STATES.IDLE]: {
    title: 'Waiting',
    message: 'Ready. Choose or capture an image to hear a description.',
    icon: '○',
  },
  [VOICE_ASSISTANT_STATES.LISTENING]: {
    title: 'Listening',
    message: 'Listening for your request.',
    icon: '●',
  },
  [VOICE_ASSISTANT_STATES.PROCESSING]: {
    title: 'Processing',
    message: 'Preparing a response.',
    icon: '…',
  },
  [VOICE_ASSISTANT_STATES.SPEAKING]: {
    title: 'Speaking',
    message: 'Speaking the image description now.',
    icon: '♫',
  },
  [VOICE_ASSISTANT_STATES.ERROR]: {
    title: 'Something went wrong',
    message: 'The voice assistant could not complete that request.',
    icon: '!',
  },
};

/**
 * Controlled voice-assistant UI. A speech integration owns the state and
 * supplies response text and callbacks; this component never records audio
 * or creates a response itself.
 */
export function VoiceAssistant({
  state = VOICE_ASSISTANT_STATES.IDLE,
  responseText = '',
  errorMessage = '',
  statusAnnouncement = '',
  canRepeatResponse = Boolean(responseText),
  onRepeatResponse,
  onStopSpeaking,
}) {
  // Start conservatively; the listening pulse remains off until the system
  // preference has been read.
  const [reduceMotion, setReduceMotion] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;
  const knownState = Object.prototype.hasOwnProperty.call(STATE_CONTENT, state);
  const content = knownState ? STATE_CONTENT[state] : STATE_CONTENT[VOICE_ASSISTANT_STATES.ERROR];
  const isError = state === VOICE_ASSISTANT_STATES.ERROR || !knownState;
  const canRepeat = canRepeatResponse && typeof onRepeatResponse === 'function';
  const canStop = state === VOICE_ASSISTANT_STATES.SPEAKING && typeof onStopSpeaking === 'function';

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (state !== VOICE_ASSISTANT_STATES.LISTENING || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 850,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion, state]);

  const statusMessage = statusAnnouncement || (isError && errorMessage ? errorMessage : content.message);

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>Voice Assistant</Text>
      <View
        accessible
        accessibilityRole={isError ? 'alert' : 'text'}
        accessibilityLabel={`Voice assistant. ${content.title}. ${statusMessage}`}
        accessibilityLiveRegion={isError ? 'assertive' : 'polite'}
        style={styles.status}
      >
        <Animated.View style={[styles.indicator, { transform: [{ scale: pulse }] }]}>
          <Text accessibilityElementsHidden style={[styles.icon, isError && styles.errorIcon]}>{content.icon}</Text>
        </Animated.View>
        <View style={styles.statusCopy}>
          <Text style={styles.stateTitle}>{content.title}</Text>
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        </View>
      </View>

      {responseText ? (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Assistant response: ${responseText}`}
          accessibilityLiveRegion="polite"
          style={styles.response}
        >
          <Text style={styles.responseText}>{responseText}</Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Repeat Response"
          accessibilityHint={canRepeat ? 'Plays the most recent assistant response again.' : 'Available when voice output is connected and a response can be repeated.'}
          accessibilityState={{ disabled: !canRepeat }}
          disabled={!canRepeat}
          onPress={onRepeatResponse}
          style={({ pressed }) => [styles.button, styles.repeatButton, !canRepeat && styles.disabledButton, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, !canRepeat && styles.disabledButtonText]}>Repeat Response</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stop Speaking"
          accessibilityHint={canStop ? 'Stops the assistant from speaking.' : 'Available while the assistant is speaking and voice output is connected.'}
          accessibilityState={{ disabled: !canStop }}
          disabled={!canStop}
          onPress={onStopSpeaking}
          style={({ pressed }) => [styles.button, styles.stopButton, !canStop && styles.disabledButton, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, styles.stopButtonText, !canStop && styles.disabledButtonText]}>Stop Speaking</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  heading: { color: colors.text, fontSize: 20, lineHeight: 27, fontWeight: '700', marginBottom: 14 },
  status: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  indicator: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  icon: { color: colors.primary, fontSize: 25, lineHeight: 32, fontWeight: '700' },
  errorIcon: { color: colors.error },
  statusCopy: { flex: 1 },
  stateTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  statusMessage: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: 3 },
  response: { marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: colors.background },
  responseText: { color: colors.text, fontSize: 16, lineHeight: 24 },
  controls: { flexDirection: 'row', gap: 10, marginTop: 16 },
  button: { minHeight: 54, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 14, borderWidth: 1 },
  repeatButton: { borderColor: colors.primary, backgroundColor: colors.white },
  stopButton: { borderColor: colors.primary, backgroundColor: colors.primary },
  buttonText: { color: colors.primary, fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' },
  stopButtonText: { color: colors.white },
  disabledButton: { backgroundColor: colors.background, borderColor: colors.border },
  disabledButtonText: { color: colors.secondaryText },
  pressed: { opacity: 0.78 },
});
