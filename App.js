import { useState } from 'react';
import {
  AccessibilityInfo,
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
import { CameraModal } from './src/components/CameraModal';

export default function App() {
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  // Gallery upload flow
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

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImage(result.assets[0]);
        AccessibilityInfo.announceForAccessibility('Image selected from gallery.');
      }
    } catch (error) {
      Alert.alert('Unable to open gallery', 'Please try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  // Open the in-app camera modal
  const openCamera = () => {
    if (busy) return;
    setCameraVisible(true);
  };

  // Handle image confirmed from camera capture
  const handleCaptureConfirmed = (capturedAsset) => {
    setImage(capturedAsset);
    AccessibilityInfo.announceForAccessibility('Captured photo set as current image.');
  };

  // Handle removing the image
  const handleRemoveImage = () => {
    setImage(null);
    AccessibilityInfo.announceForAccessibility('Image removed.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header / Brand */}
        <View style={styles.header}>
          <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.brandMarkText}>◉</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>NaviAble AI</Text>
            <Text style={styles.brandSubtitle}>Your AI-powered visual companion.</Text>
          </View>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>A LITTLE MORE CLARITY, EVERY DAY</Text>
          <Text style={styles.title}>See the world{'\n'}differently.</Text>
          <Text style={styles.intro}>An intelligent companion to help you understand the world around you.</Text>
        </View>

        {/* Image Selection / Preview Card */}
        <View style={styles.uploadCard}>
          <View style={styles.uploadIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.uploadIconText}>{image ? '◉' : '▧'}</Text>
          </View>
          <Text style={styles.cardTitle}>{image ? 'Your Image' : 'Select or Capture Image'}</Text>
          <Text style={styles.cardBody}>
            {image
              ? 'Your image is ready for visual assistance.'
              : 'Choose an image from your gallery or open the camera to capture your surroundings.'}
          </Text>

          {image ? (
            <>
              {/* Existing Image Preview Component */}
              <Image
                source={{ uri: image.uri }}
                style={styles.preview}
                resizeMode="cover"
                accessibilityLabel="Selected image preview"
              />

              {/* Action Buttons: Replace via Camera, Replace via Gallery, or Remove */}
              <View style={styles.imageActions}>
                <Pressable
                  onPress={openCamera}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Take new photo with camera"
                  accessibilityHint="Opens camera to replace current photo"
                  style={({ pressed }) => [styles.actionButton, styles.cameraAction, pressed && styles.pressed]}
                >
                  <Text style={styles.cameraActionText}>📷 Open Camera</Text>
                </Pressable>

                <Pressable
                  onPress={chooseImage}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Change image from photo gallery"
                  accessibilityHint="Opens photo library to choose a different image"
                  style={({ pressed }) => [styles.actionButton, styles.galleryAction, pressed && styles.pressed]}
                >
                  <Text style={styles.galleryActionText}>▧ Gallery</Text>
                </Pressable>

                <Pressable
                  onPress={handleRemoveImage}
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected image"
                  accessibilityHint="Clears current image"
                  style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.buttonStack}>
              {/* Option 1: Open Device Camera */}
              <Pressable
                onPress={openCamera}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Open Camera"
                accessibilityHint="Opens the device camera to point at objects or text and capture a live image"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
              >
                <Text style={styles.buttonCameraIcon}>📷</Text>
                <Text style={styles.primaryButtonText}>Open Camera</Text>
                <Text style={styles.buttonArrow} accessibilityElementsHidden>›</Text>
              </Pressable>

              {/* Option 2: Upload from Photo Gallery */}
              <Pressable
                onPress={chooseImage}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Upload Image from photo gallery"
                accessibilityHint="Opens device photo gallery to choose an image"
                style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed, busy && styles.disabled]}
              >
                <Text style={styles.outlineButtonIcon}>▧</Text>
                <Text style={styles.outlineButtonText}>{busy ? 'Opening gallery…' : 'Upload Image'}</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.privacyNote}>Your photos stay on your device.</Text>
        </View>

        {/* What's Ahead / Future Features */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>WHAT’S AHEAD</Text>
            <Text style={styles.sectionTitle}>More ways to explore</Text>
          </View>
          <View style={styles.phasePill}>
            <Text style={styles.phaseText}>PHASE 1</Text>
          </View>
        </View>
        <View style={styles.features}>
          <FeatureCard icon="⌕" title="Object Detection" description="Identify objects around you." />
          <FeatureCard icon="Aa" title="Read Text" description="Extract text from images and signboards." />
          <FeatureCard icon="◖" title="Voice Assistance" description="Interact with the app using voice commands." />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRule} />
          <Text style={styles.footerText}>Designed to make visual assistance more accessible.</Text>
        </View>
      </ScrollView>

      {/* Accessible Camera Modal */}
      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onCaptureConfirmed={handleCaptureConfirmed}
        onChooseFromGallery={chooseImage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 32,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 35,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandMarkText: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  brandCopy: {
    flex: 1,
  },
  brandName: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.secondaryText,
  },
  welcome: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1.1,
    color: colors.text,
  },
  intro: {
    marginTop: 11,
    maxWidth: 330,
    fontSize: 16,
    lineHeight: 24,
    color: colors.secondaryText,
  },
  uploadCard: {
    backgroundColor: colors.cards,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    alignItems: 'flex-start',
    shadowColor: '#24352D',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },
  uploadIconText: {
    fontSize: 26,
    lineHeight: 31,
    color: colors.primary,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.35,
    color: colors.text,
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.secondaryText,
    marginTop: 5,
    marginBottom: 19,
  },
  buttonStack: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    height: 54,
    borderRadius: 15,
    paddingHorizontal: 18,
    width: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonCameraIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  buttonArrow: {
    position: 'absolute',
    right: 17,
    color: colors.white,
    fontSize: 25,
    lineHeight: 29,
  },
  outlineButton: {
    height: 52,
    borderRadius: 15,
    paddingHorizontal: 18,
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  outlineButtonIcon: {
    fontSize: 18,
    color: colors.primary,
    marginRight: 8,
    fontWeight: '700',
  },
  outlineButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.7,
  },
  privacyNote: {
    alignSelf: 'center',
    color: colors.secondaryText,
    fontSize: 12,
    marginTop: 13,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 15,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  imageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraAction: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  cameraActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  galleryAction: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  galleryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  removeButton: {
    minHeight: 46,
    minWidth: 72,
    paddingHorizontal: 10,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 34,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.3,
    lineHeight: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  phasePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.accent,
    marginBottom: 3,
  },
  phaseText: {
    fontSize: 10,
    letterSpacing: 0.7,
    fontWeight: '700',
    color: colors.primary,
  },
  features: {
    gap: 10,
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerRule: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 13,
  },
  footerText: {
    maxWidth: 250,
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
