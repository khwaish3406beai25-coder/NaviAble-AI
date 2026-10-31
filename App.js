import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from './src/styles/theme';
import { FeatureCard } from './src/components/FeatureCard';

export default function App() {
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);

  const chooseImage = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Gallery access needed',
          'Allow photo access in your device settings to choose an image for visual assistance.',
          [{ text: 'OK' }],
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]?.uri) setImage(result.assets[0]);
    } catch (error) {
      Alert.alert('Unable to open gallery', 'Please try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.brandMarkText}>◉</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>NaviAble AI</Text>
            <Text style={styles.brandSubtitle}>Your AI-powered visual companion.</Text>
          </View>
        </View>

        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>A LITTLE MORE CLARITY, EVERY DAY</Text>
          <Text style={styles.title}>See the world{ '\n' }differently.</Text>
          <Text style={styles.intro}>An intelligent companion to help you understand the world around you.</Text>
        </View>

        <View style={styles.uploadCard}>
          <View style={styles.uploadIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.uploadIconText}>▧</Text>
          </View>
          <Text style={styles.cardTitle}>{image ? 'Your Image' : 'Upload an Image'}</Text>
          <Text style={styles.cardBody}>
            {image ? 'Your image is ready for visual assistance.' : 'Choose an image to get started with visual assistance.'}
          </Text>
          {image ? (
            <>
              <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" accessibilityLabel="Selected image preview" />
              <View style={styles.imageActions}>
                <Pressable onPress={chooseImage} disabled={busy} accessibilityRole="button" accessibilityLabel="Change selected image" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <Text style={styles.secondaryButtonText}>Change Image</Text>
                </Pressable>
                <Pressable onPress={() => setImage(null)} accessibilityRole="button" accessibilityLabel="Remove selected image" style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={chooseImage} disabled={busy} accessibilityRole="button" accessibilityLabel="Choose an image from your photo gallery" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Opening gallery…' : 'Choose Image'}</Text>
              <Text style={styles.buttonArrow} accessibilityElementsHidden>›</Text>
            </Pressable>
          )}
          <Text style={styles.privacyNote}>Your photos stay on your device.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>WHAT’S AHEAD</Text>
            <Text style={styles.sectionTitle}>More ways to explore</Text>
          </View>
          <View style={styles.phasePill}><Text style={styles.phaseText}>PHASE 1</Text></View>
        </View>
        <View style={styles.features}>
          <FeatureCard icon="⌕" title="Object Detection" description="Identify objects around you." />
          <FeatureCard icon="Aa" title="Read Text" description="Extract text from images and signboards." />
          <FeatureCard icon="◖" title="Voice Assistance" description="Interact with the app using voice commands." />
        </View>

        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <Text style={styles.footerText}>Designed to make visual assistance more accessible.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 32, maxWidth: 600, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 35 },
  brandMark: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.softLavender, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  brandMarkText: { color: colors.primary, fontSize: 28, fontWeight: '700' },
  brandCopy: { flex: 1 },
  brandName: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  brandSubtitle: { fontSize: 13, lineHeight: 19, color: colors.secondaryText },
  welcome: { marginBottom: 24 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.4, fontWeight: '700', color: colors.primary, marginBottom: 10 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.1, color: colors.text },
  intro: { marginTop: 11, maxWidth: 330, fontSize: 16, lineHeight: 24, color: colors.secondaryText },
  uploadCard: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.border, padding: 22, alignItems: 'flex-start', shadowColor: '#3C2B55', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  uploadIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.softLavender, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  uploadIconText: { fontSize: 26, lineHeight: 31, color: colors.primary, fontWeight: '600' },
  cardTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', letterSpacing: -0.35, color: colors.text },
  cardBody: { fontSize: 15, lineHeight: 22, color: colors.secondaryText, marginTop: 5, marginBottom: 19 },
  primaryButton: { height: 54, borderRadius: 15, paddingHorizontal: 18, width: '100%', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  buttonArrow: { position: 'absolute', right: 17, color: colors.white, fontSize: 25, lineHeight: 29 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.7 },
  privacyNote: { alignSelf: 'center', color: colors.secondaryText, fontSize: 12, marginTop: 13 },
  preview: { width: '100%', height: 220, borderRadius: 15, backgroundColor: colors.softLavender, marginTop: 2 },
  imageActions: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 12, gap: 10 },
  secondaryButton: { flex: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 15, fontWeight: '700', color: colors.deepLavender },
  removeButton: { minHeight: 48, minWidth: 82, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F5FA' },
  removeButtonText: { fontSize: 15, fontWeight: '600', color: colors.secondaryText },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 34, marginBottom: 14 },
  sectionEyebrow: { color: colors.primary, fontWeight: '700', fontSize: 10, letterSpacing: 1.3, lineHeight: 16 },
  sectionTitle: { color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  phasePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.softLavender, marginBottom: 3 },
  phaseText: { fontSize: 10, letterSpacing: 0.7, fontWeight: '700', color: colors.deepLavender },
  features: { gap: 10 },
  footer: { marginTop: 28, alignItems: 'center' },
  footerRule: { width: 36, height: 3, borderRadius: 2, backgroundColor: colors.border, marginBottom: 13 },
  footerText: { maxWidth: 250, color: colors.secondaryText, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
