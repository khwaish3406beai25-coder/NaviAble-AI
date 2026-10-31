import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { colors } from '../styles/theme';

function PreferenceCard({ title, detail, value }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`${title}. ${detail}${value ? ` ${value}.` : ''}`}>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDetail}>{detail}</Text>
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const { fontScale } = useWindowDimensions();
  const scaleLabel = `${fontScale.toFixed(1)}×`;

  return (
    <View style={styles.screen}>
      <AppHeader title="Settings" description="Accessibility preferences" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Reading and access</Text>
        <PreferenceCard
          title="Text size"
          detail="Text follows the size you choose in your device accessibility settings. NaviAble AI supports system text scaling."
          value={scaleLabel}
        />
        <PreferenceCard
          title="Screen reader"
          detail="The app screen navigation has spoken labels, selected states, and hints for TalkBack."
          value="Supported"
        />
        <PreferenceCard
          title="Motion"
          detail="The interface uses no decorative animations."
          value="Minimal"
        />
        <View style={styles.note}>
          <Text style={styles.noteTitle}>Your preferences stay with your device</Text>
          <Text style={styles.noteText}>Change text size or screen reader settings in Android Settings. The app responds to your system text size automatically.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 32, gap: 12, maxWidth: 650, width: '100%', alignSelf: 'center' },
  sectionTitle: { color: colors.text, fontSize: 20, lineHeight: 27, fontWeight: '700', marginBottom: 2 },
  card: { minHeight: 78, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  cardDetail: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: 4 },
  value: { color: colors.deepLavender, fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'right' },
  note: { borderRadius: 16, backgroundColor: colors.softLavender, padding: 16, marginTop: 4 },
  noteTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  noteText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, marginTop: 6 },
});
