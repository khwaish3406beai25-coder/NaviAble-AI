import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

/**
 * Renders a single labelled section of the analysis result.
 */
function Section({ label, accessibilityLabel, children }) {
  return (
    <View
      style={styles.section}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
    >
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Renders a bullet-list of string items. Shows a placeholder when empty.
 */
function BulletList({ items, emptyText }) {
  if (!items || items.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }
  return (
    <>
      {items.map((item, idx) => (
        <View key={idx} style={styles.bullet}>
          <Text style={styles.bulletDot} accessibilityElementsHidden>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

/**
 * Displays the full Gemini analysis result in four sections:
 *  1. Scene Description
 *  2. Detected Objects
 *  3. Signs and Text
 *  4. Important Observations
 *
 * Props:
 *  - result: { scene, objects, signsAndText, observations }
 */
export function AnalysisResult({ result }) {
  const { scene, objects, signsAndText, observations } = result;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon} accessibilityElementsHidden>◉</Text>
        <Text style={styles.headerTitle}>Analysis Complete</Text>
      </View>

      <Section
        label="Scene Description"
        accessibilityLabel={`Scene description: ${scene}`}
      >
        <Text style={styles.sceneText}>{scene || 'No scene description available.'}</Text>
      </Section>

      <Section
        label="Detected Objects"
        accessibilityLabel={
          objects.length
            ? `Detected objects: ${objects.join(', ')}`
            : 'Detected objects: none identified'
        }
      >
        <BulletList items={objects} emptyText="No objects identified." />
      </Section>

      <Section
        label="Signs & Text"
        accessibilityLabel={
          signsAndText.length
            ? `Signs and text: ${signsAndText.join(', ')}`
            : 'Signs and text: none detected'
        }
      >
        <BulletList items={signsAndText} emptyText="No signs or text detected." />
      </Section>

      {observations ? (
        <Section
          label="Important Observations"
          accessibilityLabel={`Important observations: ${observations}`}
        >
          <Text style={styles.observationsText}>{observations}</Text>
        </Section>
      ) : null}

      <Text style={styles.disclaimer}>
        This analysis is AI-generated and may not be fully accurate. Do not rely on it for safety decisions.
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
    shadowColor: '#3C2B55',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
  },
  headerIcon: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: colors.primary,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  sceneText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    fontWeight: '500',
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    color: colors.primary,
    fontSize: 16,
    lineHeight: 24,
    marginRight: 8,
    width: 12,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.secondaryText,
    fontStyle: 'italic',
  },
  observationsText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
  disclaimer: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
    color: colors.secondaryText,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
});
