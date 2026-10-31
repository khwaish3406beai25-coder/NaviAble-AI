import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

export function FeatureCard({ icon, title, description }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`${title}. ${description} Coming soon.`}>
      <View style={styles.iconBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.status}><View style={styles.dot} /><Text style={styles.statusText}>Coming Soon</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 15, minHeight: 86 },
  iconBox: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent, marginRight: 12 },
  icon: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  copy: { flex: 1, paddingRight: 6 },
  title: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  description: { color: colors.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F5F1F8' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginRight: 5 },
  statusText: { color: colors.deepLavender, fontSize: 9, lineHeight: 12, fontWeight: '700' },
});
