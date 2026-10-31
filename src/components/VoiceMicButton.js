/**
 * VoiceMicButton.js
 *
 * A floating action button that starts voice recognition on press.
 * Shows listening / error state via color and label.
 * Wires into the useVoiceCommands hook from voiceCommands.js.
 */
import { useCallback, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRef, useEffect } from 'react';
import { colors } from '../styles/theme';
import { useVoiceCommands, VoiceCommandType } from '../services/voiceCommands';

/**
 * @param {object} props
 * @param {() => void}   props.onOpenCamera    - called when "open camera" detected
 * @param {() => void}   props.onTakePicture   - called when "take a picture" detected
 * @param {() => void}   props.onRepeat        - called when "repeat" detected
 * @param {() => void}   props.onUploadImage   - called when "upload a picture" detected
 * @param {boolean}      props.disabled        - disables the button (e.g. during analysis)
 */
export function VoiceMicButton({ onOpenCamera, onTakePicture, onRepeat, onUploadImage, disabled }) {
  const [listening, setListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;
  const animRef = useRef(null);

  // Pulse animation while listening
  useEffect(() => {
    if (listening) {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      pulse.setValue(1);
    }
    return () => {
      animRef.current?.stop();
    };
  }, [listening, pulse]);

  const handleCommand = useCallback((cmd) => {
    setErrorMsg('');
    if (cmd === VoiceCommandType.OPEN_CAMERA) onOpenCamera?.();
    else if (cmd === VoiceCommandType.TAKE_PICTURE) onTakePicture?.();
    else if (cmd === VoiceCommandType.REPEAT) onRepeat?.();
    else if (cmd === VoiceCommandType.UPLOAD_IMAGE) onUploadImage?.();
  }, [onOpenCamera, onTakePicture, onRepeat, onUploadImage]);

  const handleError = useCallback((msg) => {
    setErrorMsg(msg);
    setListening(false);
  }, []);

  const handleListeningChange = useCallback((isListening) => {
    setListening(isListening);
    if (isListening) setErrorMsg('');
  }, []);

  const { start, stop, isSupported } = useVoiceCommands({
    onCommand: handleCommand,
    onError: handleError,
    onListeningChange: handleListeningChange,
  });

  const handlePress = useCallback(() => {
    setErrorMsg('');
    if (!isSupported) {
      Alert.alert(
        '🎙️ Voice Commands (Expo Go Mode)',
        'Live speech recognition requires a native build (APK) because Expo Go does not bundle speech recognition libraries.\n\nChoose a command to test:',
        [
          { text: '📷 "Open camera"', onPress: () => handleCommand(VoiceCommandType.OPEN_CAMERA) },
          { text: '📸 "Take a picture"', onPress: () => handleCommand(VoiceCommandType.TAKE_PICTURE) },
          { text: '🖼️ "Upload a picture"', onPress: () => handleCommand(VoiceCommandType.UPLOAD_IMAGE) },
          { text: '🔁 "Repeat"', onPress: () => handleCommand(VoiceCommandType.REPEAT) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (listening) {
      stop();
    } else {
      start();
    }
  }, [isSupported, listening, start, stop, handleCommand]);

  const bgColor = listening ? '#D32F2F' : colors.primary;
  const label = listening
    ? 'Listening…\nTap to stop'
    : isSupported
      ? '🎙️ Voice\nCommand'
      : '🎙️ Voice\n(Expo Go)';

  return (
    <View style={styles.wrapper}>
      {errorMsg ? (
        <View
          style={styles.errorBubble}
          accessible
          accessibilityRole="alert"
          accessibilityLabel={`Voice error: ${errorMsg}`}
        >
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {listening ? (
        <View style={styles.hintBubble} accessibilityElementsHidden>
          <Text style={styles.hintText}>
            Say: "Open camera", "Take a picture", "Upload a picture", or "Repeat"
          </Text>
        </View>
      ) : null}

      <Animated.View style={[styles.buttonWrap, { transform: [{ scale: pulse }] }]}>
        <Pressable
          onPress={handlePress}
          disabled={disabled && !listening}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Stop voice command listening' : 'Start voice command'}
          accessibilityHint={
            listening
              ? 'Tap to stop listening'
              : 'Tap then say: open camera, take a picture, upload a picture, or repeat'
          }
          style={({ pressed }) => [
            styles.micButton,
            { backgroundColor: bgColor },
            pressed && styles.pressed,
            disabled && !listening && styles.disabledBtn,
          ]}
        >
          <Text style={styles.micIcon}>{listening ? '⏹' : '🎙'}</Text>
          <Text style={styles.micLabel}>{label}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  hintBubble: {
    backgroundColor: '#EDF7EE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
    width: '100%',
  },
  hintText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBubble: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5C6C6',
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
  },
  buttonWrap: {
    width: '100%',
  },
  micButton: {
    height: 54,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 10,
  },
  micIcon: {
    fontSize: 22,
  },
  micLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  pressed: { opacity: 0.82 },
  disabledBtn: { opacity: 0.5 },
});
