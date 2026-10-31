import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { FeatureCard } from '../components/FeatureCard';
import { colors } from '../styles/theme';

export default function HelpScreen() {
  return (
    <View style={styles.screen}>
      <AppHeader title="Help" description="What NaviAble AI can do today" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Getting started</Text>
          <Text style={styles.body}>Use the Home screen to choose a photo. The app can show a preview of your selected image. Image understanding is not available yet, so it will not describe or analyze the photo.</Text>
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>Planned features</Text>
        <View style={styles.features}>
          <FeatureCard icon="⌕" title="Object Detection" description="Identify objects around you." />
          <FeatureCard icon="Aa" title="Read Text" description="Extract text from images and signboards." />
          <FeatureCard icon="◖" title="Voice Assistance" description="Interact with the app using voice commands." />
        </View>
        <Text style={styles.footer}>These features are marked Coming Soon and are not active in this version.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 32, gap: 14, maxWidth: 650, width: '100%', alignSelf: 'center' },
  introCard: { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.white },
  introTitle: { color: colors.text, fontSize: 19, lineHeight: 26, fontWeight: '700', marginBottom: 7 },
  body: { color: colors.secondaryText, fontSize: 16, lineHeight: 24 },
  sectionTitle: { color: colors.text, fontSize: 20, lineHeight: 27, fontWeight: '700', marginTop: 4 },
  features: { gap: 10 },
  footer: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, marginTop: 2 },
});
