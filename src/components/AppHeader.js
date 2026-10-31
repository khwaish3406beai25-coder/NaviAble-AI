import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../styles/theme';

export function AppHeader({ title, description }) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>NaviAble AI</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  brand: { color: colors.deepLavender, fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: '700', letterSpacing: -0.5 },
  description: { color: colors.secondaryText, fontSize: 16, lineHeight: 23, marginTop: 5 },
});
