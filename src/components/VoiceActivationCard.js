import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../styles/theme';
import {
  VOICE_LIFECYCLE,
  WAKE_PHRASE,
  useVoiceActivation,
} from '../services/voiceActivation';

/**
 * VoiceActivationCard integrates wake-word listening ("Hey NaviAble")
 * and assistant action choices into the NaviAble AI interface.
 *
 * User can explicitly choose:
 *  - Open Camera
 *  - Select Image from Gallery
 *  - Analyse Image
 *  - Listen to Analysis
 *  - Read Text from Image
 */
export function VoiceActivationCard({
  hasImage,
  hasAnalysis,
  hasRecognizedText,
  onOpenCamera,
  onChooseGallery,
  onAnalyseImage,
  onListenAnalysis,
  onReadText,
}) {
  const {
    lifecycle,
    error,
    isListening,
    startListening,
    stopListening,
    simulateWakeWord,
    resetToListening,
    resetToIdle,
  } = useVoiceActivation();

  const handleAction = (actionFn) => {
    resetToIdle();
    if (typeof actionFn === 'function') {
      actionFn();
    }
  };

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="region"
      accessibilityLabel={`Voice Assistance: ${
        lifecycle === VOICE_LIFECYCLE.LISTENING
          ? 'Listening for ' + WAKE_PHRASE
          : lifecycle === VOICE_LIFECYCLE.DETECTED
          ? 'Wake word detected. Assistant ready.'
          : 'Idle. Tap to activate.'
      }`}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.iconBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.icon}>◖</Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>Voice Assistance</Text>
          <Text style={styles.subtitle}>
            {lifecycle === VOICE_LIFECYCLE.LISTENING
              ? `Listening for "${WAKE_PHRASE}"…`
              : lifecycle === VOICE_LIFECYCLE.DETECTED
              ? `"${WAKE_PHRASE}" detected!`
              : `Wake phrase: "${WAKE_PHRASE}"`}
          </Text>
        </View>

        {/* State Pill / Toggle Button */}
        {lifecycle === VOICE_LIFECYCLE.REQUESTING_PERMISSION ? (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>Requesting</Text>
          </View>
        ) : isListening ? (
          <Pressable
            onPress={stopListening}
            accessibilityRole="button"
            accessibilityLabel="Stop listening for wake word"
            accessibilityHint="Deactivates the microphone"
            style={({ pressed }) => [styles.activePill, pressed && styles.pressed]}
          >
            <View style={styles.activeDot} />
            <Text style={styles.activePillText}>Listening (Stop)</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={startListening}
            accessibilityRole="button"
            accessibilityLabel="Enable voice activation"
            accessibilityHint={`Starts microphone to listen for "${WAKE_PHRASE}"`}
            style={({ pressed }) => [styles.enableButton, pressed && styles.pressed]}
          >
            <Text style={styles.enableButtonText}>Enable</Text>
          </Pressable>
        )}
      </View>

      {/* Wake Word Detected Action Prompt */}
      {lifecycle === VOICE_LIFECYCLE.DETECTED && (
        <View style={styles.promptBox} accessible accessibilityRole="alert">
          <View style={styles.promptHeader}>
            <Text style={styles.promptIcon} accessibilityElementsHidden>✓</Text>
            <Text style={styles.promptTitle}>How can NaviAble help you?</Text>
          </View>
          <Text style={styles.promptBody}>
            Choose an action below, or dismiss to resume listening.
          </Text>

          <View style={styles.actionRow}>
            {/* If analysis exists, provide Listen to Analysis */}
            {hasAnalysis && (
              <Pressable
                onPress={() => handleAction(onListenAnalysis)}
                accessibilityRole="button"
                accessibilityLabel="Listen to analysis result"
                style={({ pressed }) => [styles.actionBtn, styles.primaryActionBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryActionBtnText}>🔊 Listen to Analysis</Text>
              </Pressable>
            )}

            {/* If text exists in analysis, provide Read Text */}
            {hasAnalysis && hasRecognizedText && (
              <Pressable
                onPress={() => handleAction(onReadText)}
                accessibilityRole="button"
                accessibilityLabel="Read recognized text from image"
                style={({ pressed }) => [styles.actionBtn, styles.secondaryActionBtn, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryActionBtnText}>📖 Read Text</Text>
              </Pressable>
            )}

            {/* If image exists, allow Analyze Image */}
            {hasImage && !hasAnalysis && (
              <Pressable
                onPress={() => handleAction(onAnalyseImage)}
                accessibilityRole="button"
                accessibilityLabel="Analyse current image with AI"
                style={({ pressed }) => [styles.actionBtn, styles.primaryActionBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryActionBtnText}>Analyse Image</Text>
              </Pressable>
            )}

            {/* Open Camera */}
            <Pressable
              onPress={() => handleAction(onOpenCamera)}
              accessibilityRole="button"
              accessibilityLabel="Open Camera to capture surroundings"
              style={({ pressed }) => [styles.actionBtn, styles.secondaryActionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryActionBtnText}>📷 Open Camera</Text>
            </Pressable>

            {/* Gallery */}
            <Pressable
              onPress={() => handleAction(onChooseGallery)}
              accessibilityRole="button"
              accessibilityLabel="Select Image from Gallery"
              style={({ pressed }) => [styles.actionBtn, styles.secondaryActionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryActionBtnText}>▧ Gallery</Text>
            </Pressable>

            {/* Dismiss */}
            <Pressable
              onPress={resetToListening}
              accessibilityRole="button"
              accessibilityLabel="Dismiss prompt and continue listening"
              style={({ pressed }) => [styles.actionBtn, styles.dismissActionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.dismissActionBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Permission Denied Message */}
      {lifecycle === VOICE_LIFECYCLE.PERMISSION_DENIED && (
        <View style={styles.noticeBox} accessible accessibilityRole="alert">
          <Text style={styles.noticeText}>
            {error || 'Microphone access is required to listen for the wake phrase.'}
          </Text>
          <Pressable
            onPress={startListening}
            accessibilityRole="button"
            accessibilityLabel="Retry microphone permission"
            style={({ pressed }) => [styles.retryLink, pressed && styles.pressed]}
          >
            <Text style={styles.retryLinkText}>Grant Permission</Text>
          </Pressable>
        </View>
      )}

      {/* General Error Message */}
      {lifecycle === VOICE_LIFECYCLE.ERROR && error && (
        <View style={styles.noticeBox} accessible accessibilityRole="alert">
          <Text style={styles.noticeText}>{error}</Text>
          <Pressable
            onPress={startListening}
            accessibilityRole="button"
            accessibilityLabel="Retry voice activation"
            style={({ pressed }) => [styles.retryLink, pressed && styles.pressed]}
          >
            <Text style={styles.retryLinkText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {/* Test simulation button during listening mode */}
      {isListening && (
        <View style={styles.testFooter}>
          <Pressable
            onPress={() => simulateWakeWord('test_button')}
            accessibilityRole="button"
            accessibilityLabel={`Simulate saying ${WAKE_PHRASE}`}
            accessibilityHint="Triggers the assistant flow as if the wake phrase was detected"
            style={({ pressed }) => [styles.simButton, pressed && styles.pressed]}
          >
            <Text style={styles.simButtonText}>Test "{WAKE_PHRASE}" Trigger</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.accent,
    marginRight: 12,
  },
  icon: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  copy: {
    flex: 1,
    paddingRight: 6,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  enableButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  enableButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.accent,
    gap: 6,
  },
  statusText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  activePillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  promptBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  promptIcon: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '800',
    marginRight: 6,
  },
  promptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  promptBody: {
    fontSize: 12,
    color: colors.secondaryText,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtn: {
    backgroundColor: colors.primary,
  },
  primaryActionBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryActionBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  dismissActionBtn: {
    backgroundColor: 'transparent',
  },
  dismissActionBtnText: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  noticeBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#8A5300',
  },
  retryLink: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  retryLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  testFooter: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    alignItems: 'center',
  },
  simButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  simButtonText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.8,
  },
});
