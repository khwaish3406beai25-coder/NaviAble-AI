import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';
import { useSpeech } from '../services/speechService';

/**
 * Renders a single labelled section of the analysis result.
 */
function Section({ label, children, accessibilityLabel }) {
  return (
    <View
      style={styles.section}
      accessible
      accessibilityLabel={accessibilityLabel || label}
    >
      <Text style={styles.sectionLabel} accessibilityElementsHidden>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

/**
 * Renders an array of strings as a bulleted list.
 */
function BulletList({ items, emptyText }) {
  if (!items || items.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletRow}>
          <Text style={styles.bullet} accessibilityElementsHidden>
            •
          </Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Displays the full Gemini analysis result with:
 *  1. Scene Description
 *  2. Detected Objects
 *  3. Signs & Text (Verbatim OCR extraction)
 *  4. Visible Obstacles / Hazards (when detected)
 *  5. Important Observations & Uncertainty Notes
 *  6. Text-to-Speech playback controls ("Listen to Result", "Read Text", "Stop Speaking")
 */
export function AnalysisResult({ result }) {
  const { isSpeaking, speakingMode, speakAnalysis, speakTextOnly, stopSpeaking } = useSpeech();

  if (!result) return null;

  const { scene, objects, signsAndText, textNotes, hazards, observations } = result;
  const hasRecognizedText = Array.isArray(signsAndText) && signsAndText.length > 0;
  const hasHazards = Array.isArray(hazards) && hazards.length > 0;

  return (
    <View style={styles.container}>
      {/* Header and Spoken Playback Controls */}
      <View style={styles.header}>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerIcon} accessibilityElementsHidden>◉</Text>
          <Text style={styles.headerTitle}>Analysis Result</Text>
        </View>

        {/* Global Stop Button if speaking */}
        {isSpeaking && (
          <Pressable
            onPress={stopSpeaking}
            accessibilityRole="button"
            accessibilityLabel="Stop speaking"
            accessibilityHint="Interrupts and stops the current audio playback"
            style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
          >
            <Text style={styles.stopButtonText}>⏹ Stop</Text>
          </Pressable>
        )}
      </View>

      {/* Primary Audio Action Bar */}
      <View style={styles.audioBar}>
        <Pressable
          onPress={() => {
            if (isSpeaking && speakingMode === 'analysis') {
              stopSpeaking();
            } else {
              speakAnalysis(result);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={
            isSpeaking && speakingMode === 'analysis'
              ? 'Stop speaking analysis result'
              : 'Listen to full analysis result'
          }
          accessibilityHint="Reads the scene description, objects, and observations aloud"
          style={({ pressed }) => [
            styles.audioButton,
            isSpeaking && speakingMode === 'analysis' ? styles.audioButtonActive : null,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.audioButtonText,
              isSpeaking && speakingMode === 'analysis' ? styles.audioButtonTextActive : null,
            ]}
          >
            {isSpeaking && speakingMode === 'analysis' ? '⏹ Stop Speaking' : '🔊 Listen to Result'}
          </Text>
        </Pressable>

        {hasRecognizedText && (
          <Pressable
            onPress={() => {
              if (isSpeaking && speakingMode === 'text_only') {
                stopSpeaking();
              } else {
                speakTextOnly(result);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={
              isSpeaking && speakingMode === 'text_only'
                ? 'Stop reading recognized text'
                : 'Read recognized text aloud'
            }
            accessibilityHint="Speaks only the verbatim extracted text and signboards aloud"
            style={({ pressed }) => [
              styles.audioButtonSecondary,
              isSpeaking && speakingMode === 'text_only' ? styles.audioButtonActive : null,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.audioButtonSecondaryText,
                isSpeaking && speakingMode === 'text_only' ? styles.audioButtonTextActive : null,
              ]}
            >
              {isSpeaking && speakingMode === 'text_only' ? '⏹ Stop Reading' : '📖 Read Text'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* 1. Scene */}
      <Section
        label="Scene"
        accessibilityLabel={`Scene: ${scene || 'No description available'}`}
      >
        <Text style={styles.bodyText}>
          {scene || 'No scene description available.'}
        </Text>
      </Section>

      {/* 2. Detected Objects */}
      <Section
        label="Detected Objects"
        accessibilityLabel={
          objects?.length
            ? `Detected objects: ${objects.join(', ')}`
            : 'No objects detected'
        }
      >
        <BulletList items={objects} emptyText="No objects detected." />
      </Section>

      {/* 3. Signs & Text (OCR Focus) */}
      <Section
        label="Signs & Text"
        accessibilityLabel={
          hasRecognizedText
            ? `Signs and text: ${signsAndText.join(', ')}`
            : 'No text or signs detected'
        }
      >
        {hasRecognizedText ? (
          <View style={styles.textContainer}>
            {signsAndText.map((sign, index) => (
              <View key={index} style={styles.textItem}>
                <Text style={styles.quoteMark} accessibilityElementsHidden>“</Text>
                <Text style={styles.verbatimText}>{sign}</Text>
                <Text style={styles.quoteMark} accessibilityElementsHidden>”</Text>
              </View>
            ))}
            {Boolean(textNotes) && (
              <Text style={styles.textNotes}>{textNotes}</Text>
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>No text or signs detected in this image.</Text>
        )}
      </Section>

      {/* 4. Visible Obstacles / Hazards (when detected) */}
      {hasHazards && (
        <Section
          label="Visible Obstacles"
          accessibilityLabel={`Visible obstacles: ${hazards.join(', ')}`}
        >
          <View style={styles.hazardBox}>
            <BulletList items={hazards} emptyText="" />
          </View>
        </Section>
      )}

      {/* 5. Observations */}
      {observations ? (
        <Section
          label="Important Observations"
          accessibilityLabel={`Important observations: ${observations}`}
        >
          <Text style={styles.bodyText}>{observations}</Text>
        </Section>
      ) : null}

      <Text style={styles.disclaimer}>
        This analysis is AI-assisted and may not detect all obstacles. Do not rely exclusively on it for safety decisions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: '#24352D',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  stopButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  stopButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  audioBar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  audioButton: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  audioButtonActive: {
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  audioButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  audioButtonTextActive: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  audioButtonSecondary: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  audioButtonSecondaryText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  list: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 22,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  textContainer: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  textItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  quoteMark: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 22,
  },
  verbatimText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  textNotes: {
    marginTop: 6,
    fontSize: 13,
    color: colors.secondaryText,
    fontStyle: 'italic',
  },
  hazardBox: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFE082',
    borderRadius: 12,
    padding: 10,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.secondaryText,
    fontStyle: 'italic',
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.secondaryText,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  pressed: {
    opacity: 0.82,
  },
});
