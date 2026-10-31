import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
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
import { VoiceActivationCard } from './src/components/VoiceActivationCard';
import { AnalysisResult } from './src/components/AnalysisResult';

import { analyzeImageWithGemini } from './src/services/gemini';
import { speechManager } from './src/services/speechService';

export default function App() {
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  const [analysis, setAnalysis] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const scrollRef = useRef(null);

  // Open camera
  const openCamera = () => {
    if (busy || analysing) return;

    speechManager.stop();
    setCameraVisible(true);
  };

  // Handle confirmed camera capture
  const handleCaptureConfirmed = (capturedImage) => {
    speechManager.stop();

    setImage(capturedImage);
    setAnalysis(null);
    setAnalysisError(null);
    setCameraVisible(false);

    AccessibilityInfo.announceForAccessibility(
      'Captured photo selected successfully.'
    );
  };

  // Select an image from the gallery
  const chooseImage = async () => {
    if (busy || analysing) return;

    speechManager.stop();
    setBusy(true);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Gallery access needed',
          'Allow photo access in your device settings to select an image.',
          [{ text: 'OK' }]
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
        setAnalysis(null);
        setAnalysisError(null);

        AccessibilityInfo.announceForAccessibility(
          'Image selected from gallery.'
        );
      }
    } catch (error) {
      console.error('Gallery error:', error);

      Alert.alert(
        'Unable to open gallery',
        'Please try again in a moment.'
      );
    } finally {
      setBusy(false);
    }
  };

  // Analyse the selected image using Gemini
  const analyzeImage = async (mode = 'general') => {
    if (!image?.uri || analysing || busy) return;

    speechManager.stop();

    setAnalysing(true);
    setAnalysis(null);
    setAnalysisError(null);

    try {
      const result = await analyzeImageWithGemini(image, { mode });

      setAnalysis(result);

      AccessibilityInfo.announceForAccessibility(
        'Image analysis completed. Results are available below.'
      );

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (error) {
      console.error('Image analysis error:', error);

      setAnalysisError(
        error?.message ||
        'Unable to analyse this image. Please try again.'
      );
    } finally {
      setAnalysing(false);
    }
  };

  // Remove the selected image
  const handleRemoveImage = () => {
    speechManager.stop();

    setImage(null);
    setAnalysis(null);
    setAnalysisError(null);

    AccessibilityInfo.announceForAccessibility(
      'Selected image removed.'
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View
            style={styles.brandMark}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.brandMarkText}>◉</Text>
          </View>

          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>NaviAble AI</Text>

            <Text style={styles.brandSubtitle}>
              Your AI-powered visual companion.
            </Text>
          </View>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>
            A LITTLE MORE CLARITY, EVERY DAY
          </Text>

          <Text style={styles.title}>
            See the world{'\n'}differently.
          </Text>

          <Text style={styles.intro}>
            An intelligent companion to help you understand
            the world around you.
          </Text>
        </View>

        {/* Image Selection and Preview */}
        <View style={styles.uploadCard}>
          <View
            style={styles.uploadIcon}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.uploadIconText}>
              {image ? '◉' : '▧'}
            </Text>
          </View>

          <Text style={styles.cardTitle}>
            {image ? 'Your Image' : 'Select or Capture Image'}
          </Text>

          <Text style={styles.cardBody}>
            {image
              ? 'Your image is ready for visual assistance.'
              : 'Choose an image from your gallery or open the camera to capture your surroundings.'}
          </Text>

          {image ? (
            <>
              {/* Image Preview */}
              <Image
                source={{ uri: image.uri }}
                style={styles.preview}
                resizeMode="cover"
                accessibilityLabel="Selected image preview"
              />

              {/* Image Actions */}
              <View style={styles.imageActions}>
                <Pressable
                  onPress={openCamera}
                  disabled={busy || analysing}
                  accessibilityRole="button"
                  accessibilityLabel="Take a new photo"
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.cameraAction,
                    pressed && styles.pressed,
                    (busy || analysing) && styles.disabled,
                  ]}
                >
                  <Text style={styles.cameraActionText}>
                    Open Camera
                  </Text>
                </Pressable>

                <Pressable
                  onPress={chooseImage}
                  disabled={busy || analysing}
                  accessibilityRole="button"
                  accessibilityLabel="Change image from gallery"
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.galleryAction,
                    pressed && styles.pressed,
                    (busy || analysing) && styles.disabled,
                  ]}
                >
                  <Text style={styles.galleryActionText}>
                    Gallery
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleRemoveImage}
                  disabled={analysing}
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected image"
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed && styles.pressed,
                    analysing && styles.disabled,
                  ]}
                >
                  <Text style={styles.removeButtonText}>
                    Remove
                  </Text>
                </Pressable>
              </View>

              {/* Analysis Buttons */}
              <View style={styles.analyseButtonsContainer}>
                <Pressable
                  onPress={() => analyzeImage('general')}
                  disabled={analysing || busy}
                  accessibilityRole="button"
                  accessibilityLabel="Analyse scene and objects"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.analyseButton,
                    pressed && styles.pressed,
                    (analysing || busy) && styles.disabled,
                  ]}
                >
                  {analysing ? (
                    <>
                      <ActivityIndicator
                        color={colors.white}
                        size="small"
                      />

                      <Text style={styles.loadingText}>
                        Analysing image...
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {analysis?.mode === 'general'
                        ? 'Analyse Scene Again'
                        : 'Analyse Scene & Objects'}
                    </Text>
                  )}

                  {!analysing && (
                    <Text
                      style={styles.buttonArrow}
                      accessibilityElementsHidden
                    >
                      ›
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => analyzeImage('ocr')}
                  disabled={analysing || busy}
                  accessibilityRole="button"
                  accessibilityLabel="Read signs and text"
                  style={({ pressed }) => [
                    styles.ocrButton,
                    pressed && styles.pressed,
                    (analysing || busy) && styles.disabled,
                  ]}
                >
                  <Text
                    style={styles.ocrButtonIcon}
                    accessibilityElementsHidden
                  >
                    Aa
                  </Text>

                  <Text style={styles.ocrButtonText}>
                    {analysis?.mode === 'ocr'
                      ? 'Read Signs & Text Again'
                      : 'Read Signs & Text'}
                  </Text>
                </Pressable>
              </View>

              {/* Analysis Status */}
              {analysis && (
                <View
                  style={styles.resultsBadge}
                  accessibilityRole="text"
                  accessibilityLabel="Analysis completed successfully"
                >
                  <Text style={styles.resultsBadgeText}>
                    Analysis complete — results below
                  </Text>
                </View>
              )}

              {/* Analysis Error */}
              {analysisError && (
                <View
                  style={styles.errorBox}
                  accessibilityRole="alert"
                >
                  <Text style={styles.errorText}>
                    {analysisError}
                  </Text>
                </View>
              )}
            </>
          ) : (
            /* Initial Camera and Gallery Buttons */
            <View style={styles.buttonStack}>
              <Pressable
                onPress={openCamera}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Open Camera"
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <Text style={styles.buttonCameraIcon}>
                  Camera
                </Text>

                <Text style={styles.primaryButtonText}>
                  Open Camera
                </Text>

                <Text
                  style={styles.buttonArrow}
                  accessibilityElementsHidden
                >
                  ›
                </Text>
              </Pressable>

              <Pressable
                onPress={chooseImage}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Upload image from gallery"
                style={({ pressed }) => [
                  styles.outlineButton,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    color={colors.primary}
                    size="small"
                  />
                ) : (
                  <Text style={styles.outlineButtonIcon}>
                    ▧
                  </Text>
                )}

                <Text style={styles.outlineButtonText}>
                  {busy ? 'Opening gallery...' : 'Upload Image'}
                </Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.privacyNote}>
            Your photos stay on your device.
          </Text>
        </View>

        {/* Analysis Results */}
        {analysis && (
          <View style={styles.analysisSection}>
            <Text style={styles.sectionEyebrow}>
              YOUR RESULTS
            </Text>

            <Text style={styles.sectionTitle}>
              Understanding your surroundings
            </Text>

            <AnalysisResult result={analysis} />
          </View>
        )}

        {/* Feature Section */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>
              WHAT’S AHEAD
            </Text>

            <Text style={styles.sectionTitle}>
              More ways to explore
            </Text>
          </View>

          <View style={styles.phasePill}>
            <Text style={styles.phaseText}>PHASE 1</Text>
          </View>
        </View>

        <View style={styles.features}>
          <FeatureCard
            icon="⌕"
            title="Object Detection"
            description="Identify objects around you."
          />

          <FeatureCard
            icon="Aa"
            title="Read Text"
            description="Extract text from images and signboards."
          />

          <VoiceActivationCard
            hasImage={Boolean(image)}
            hasAnalysis={Boolean(analysis)}
            hasRecognizedText={Boolean(
              analysis?.signsAndText?.length > 0
            )}
            onOpenCamera={openCamera}
            onChooseGallery={chooseImage}
            onAnalyseImage={() => analyzeImage('general')}
            onListenAnalysis={() =>
              speechManager.speakAnalysis(analysis)
            }
            onReadText={() =>
              speechManager.speakTextOnly(analysis)
            }
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRule} />

          <Text style={styles.footerText}>
            Designed to make visual assistance more accessible.
          </Text>
        </View>
      </ScrollView>

      {/* Camera Modal */}
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
    backgroundColor: colors.white,
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
    minHeight: 54,
    borderRadius: 15,
    paddingHorizontal: 18,
    width: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },

  loadingText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 10,
  },

  buttonCameraIcon: {
    fontSize: 13,
    marginRight: 8,
    color: colors.white,
    fontWeight: '700',
  },

  buttonArrow: {
    position: 'absolute',
    right: 17,
    color: colors.white,
    fontSize: 25,
    lineHeight: 29,
  },

  outlineButton: {
    minHeight: 52,
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
    marginLeft: 8,
  },

  pressed: {
    opacity: 0.82,
  },

  disabled: {
    opacity: 0.6,
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
    paddingHorizontal: 8,
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },

  galleryAction: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },

  galleryActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  removeButton: {
    minHeight: 46,
    minWidth: 64,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },

  removeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },

  analyseButtonsContainer: {
    width: '100%',
    marginTop: 12,
    gap: 10,
  },

  analyseButton: {
    width: '100%',
  },

  ocrButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 12,
  },

  ocrButtonIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 8,
  },

  ocrButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },

  resultsBadge: {
    marginTop: 10,
    width: '100%',
    backgroundColor: '#EDF7EE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultsBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },

  errorBox: {
    marginTop: 10,
    width: '100%',
    backgroundColor: colors.errorBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    padding: 12,
  },

  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.error,
  },

  analysisSection: {
    marginTop: 28,
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