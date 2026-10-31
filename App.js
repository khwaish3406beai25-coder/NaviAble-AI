import { useEffect, useRef, useState } from 'react';
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
import { detectObjectsWithYolo } from './src/services/yolo';

export default function App() {
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  // Gemini analysis state
  const [analysis, setAnalysis] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  // YOLO detection state
  const [yoloResult, setYoloResult] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);

  const scrollRef = useRef(null);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      speechManager.stop();
    };
  }, []);

  // Open camera
  const openCamera = () => {
    if (busy || analysing || detecting) return;

    speechManager.stop();
    setCameraVisible(true);
  };

  // Handle confirmed camera capture
  const handleCaptureConfirmed = (capturedImage) => {
    speechManager.stop();

    setImage(capturedImage);
    setAnalysis(null);
    setAnalysisError(null);
    setYoloResult(null);
    setDetectError(null);
    setCameraVisible(false);

    AccessibilityInfo.announceForAccessibility(
      'Captured photo selected successfully.'
    );
  };

  // Select an image from the gallery
  const chooseImage = async () => {
    if (busy || analysing || detecting) return;

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
        setYoloResult(null);
        setDetectError(null);

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

  // Detect objects with YOLOv8 backend
  const detectObjects = async () => {
    if (!image?.uri || detecting || busy) return;

    speechManager.stop();
    setDetecting(true);
    setYoloResult(null);
    setDetectError(null);

    try {
      const result = await detectObjectsWithYolo(image);
      setYoloResult(result);

      AccessibilityInfo.announceForAccessibility(
        `Object detection completed. ${result.summary}`
      );

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (err) {
      console.error('YOLO detection error:', err);
      setDetectError(err.message ?? 'Object detection failed. Please try again.');
    } finally {
      setDetecting(false);
    }
  };

  // Remove the selected image
  const handleRemoveImage = () => {
    speechManager.stop();

    setImage(null);
    setAnalysis(null);
    setAnalysisError(null);
    setYoloResult(null);
    setDetectError(null);

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
            <View style={styles.brandIcon}>
              <Text style={styles.brandSymbol}>◎</Text>
            </View>
            <View>
              <Text style={styles.brandName}>NaviAble</Text>
              <Text style={styles.brandSubtitle}>
                Your AI-powered visual companion.
              </Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>A LITTLE MORE CLARITY, EVERY DAY</Text>
          <Text style={styles.title}>See the world{'\n'}differently.</Text>
          <Text style={styles.intro}>
            An intelligent companion designed to help you navigate,
            explore, and understand your surroundings with confidence.
          </Text>
        </View>

        {/* Upload / Capture Card */}
        <View style={styles.uploadCard}>
          <View
            style={styles.uploadIcon}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.uploadIconText}>✦</Text>
          </View>
          <Text style={styles.cardTitle}>Explore an image</Text>
          <Text style={styles.cardBody}>
            Point your camera or choose a photo to hear what is around you.
          </Text>

          {image ? (
            <>
              <Image
                source={{ uri: image.uri }}
                style={styles.preview}
                resizeMode="cover"
                accessible
                accessibilityRole="image"
                accessibilityLabel="Selected image preview"
              />

              <View style={styles.imageActions}>
                <Pressable
                  onPress={openCamera}
                  disabled={busy || analysing || detecting}
                  accessibilityRole="button"
                  accessibilityLabel="Retake with camera"
                  accessibilityHint="Opens the camera to capture a new photo"
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.cameraAction,
                    (busy || analysing || detecting) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cameraActionText}>Retake Photo</Text>
                </Pressable>

                <Pressable
                  onPress={chooseImage}
                  disabled={busy || analysing || detecting}
                  accessibilityRole="button"
                  accessibilityLabel="Change image from gallery"
                  accessibilityHint="Opens your photo library to select a different image"
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.galleryAction,
                    (busy || analysing || detecting) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.galleryActionText}>Change Image</Text>
                </Pressable>

                <Pressable
                  onPress={handleRemoveImage}
                  disabled={busy || analysing || detecting}
                  accessibilityRole="button"
                  accessibilityLabel="Remove image"
                  accessibilityHint="Clears the current photo selection"
                  style={({ pressed }) => [
                    styles.removeButton,
                    (busy || analysing || detecting) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>

              {/* Analysis & Detection Action Buttons */}
              <View style={styles.analyseButtonsContainer}>
                {/* 1. General Scene & Object Analysis */}
                <Pressable
                  onPress={() => analyzeImage('general')}
                  disabled={busy || analysing || detecting}
                  accessibilityRole="button"
                  accessibilityLabel={
                    analysing
                      ? 'Analysing scene and objects, please wait'
                      : 'Analyse scene and objects'
                  }
                  accessibilityHint="Sends image to Gemini for scene and object description"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.analyseButton,
                    (busy || analysing || detecting) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {analysing ? (
                    <>
                      <ActivityIndicator
                        color={colors.white}
                        size="small"
                        accessibilityElementsHidden
                      />
                      <Text style={styles.loadingText}>Analysing Scene...</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.buttonCameraIcon}>◎</Text>
                      <Text style={styles.primaryButtonText}>
                        Analyse Scene & Objects
                      </Text>
                      <Text style={styles.buttonArrow}>→</Text>
                    </>
                  )}
                </Pressable>

                {/* 2. OCR / Signboard Reading */}
                <Pressable
                  onPress={() => analyzeImage('ocr')}
                  disabled={busy || analysing || detecting}
                  accessibilityRole="button"
                  accessibilityLabel={
                    analysing
                      ? 'Reading signs and text, please wait'
                      : 'Read signs and text'
                  }
                  accessibilityHint="Prioritizes reading visible text, labels, and signboards verbatim"
                  style={({ pressed }) => [
                    styles.ocrButton,
                    (busy || analysing || detecting) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.ocrButtonIcon}>Aa</Text>
                  <Text style={styles.ocrButtonText}>Read Signs & Text</Text>
                </Pressable>

                {/* 3. YOLO Object Detection */}
                <Pressable
                  onPress={detectObjects}
                  disabled={busy || analysing || detecting}
                  accessibilityRole="button"
                  accessibilityLabel={
                    detecting
                      ? 'Detecting objects with YOLO, please wait'
                      : 'Detect objects in image'
                  }
                  accessibilityHint="Sends the image to the YOLO model to identify and locate objects"
                  style={({ pressed }) => [
                    styles.detectButton,
                    (busy || analysing || detecting) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {detecting ? (
                    <View style={styles.detectButtonInner}>
                      <ActivityIndicator
                        color={colors.primary}
                        size="small"
                        accessibilityElementsHidden
                      />
                      <Text style={styles.detectButtonText}>Detecting Objects...</Text>
                    </View>
                  ) : (
                    <View style={styles.detectButtonInner}>
                      <Text style={styles.ocrButtonIcon}>⌕</Text>
                      <Text style={styles.detectButtonText}>Detect Objects (YOLO)</Text>
                    </View>
                  )}
                </Pressable>
              </View>

              {/* Status Badges */}
              {analysis && (
                <View
                  style={styles.resultsBadge}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel="Analysis ready. Results are displayed below."
                >
                  <Text style={styles.resultsBadgeText}>
                    ✓ Analysis Ready (See Below)
                  </Text>
                </View>
              )}

              {/* Gemini Error Message */}
              {analysisError && (
                <View
                  style={styles.errorBox}
                  accessible
                  accessibilityRole="alert"
                  accessibilityLabel={`Analysis error: ${analysisError}`}
                >
                  <Text style={styles.errorText}>{analysisError}</Text>
                </View>
              )}

              {/* YOLO Error Message */}
              {detectError && (
                <View
                  style={styles.errorBox}
                  accessible
                  accessibilityRole="alert"
                  accessibilityLabel={`Detection error: ${detectError}`}
                >
                  <Text style={styles.errorText}>{detectError}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.buttonStack}>
              {/* Camera Button */}
              <Pressable
                onPress={openCamera}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Open camera"
                accessibilityHint="Opens the camera to take a photo for visual assistance"
                style={({ pressed }) => [
                  styles.primaryButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.buttonCameraIcon}>📷</Text>
                <Text style={styles.primaryButtonText}>Open Camera</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </Pressable>

              {/* Gallery Button */}
              <Pressable
                onPress={chooseImage}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={busy ? 'Opening gallery, please wait' : 'Upload Image'}
                accessibilityHint="Opens your photo library to choose an image for visual assistance"
                style={({ pressed }) => [
                  styles.outlineButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.outlineButtonIcon}>📁</Text>
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

        {/* Gemini Analysis Results */}
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

        {/* YOLO Detection Results */}
        {yoloResult && (
          <View style={styles.yoloCard}>
            <View style={styles.yoloHeader}>
              <Text style={styles.yoloHeaderIcon} accessibilityElementsHidden>⌕</Text>
              <Text style={styles.yoloHeaderTitle}>Object Detection</Text>
              <View style={styles.yoloBadge}>
                <Text style={styles.yoloBadgeText}>{yoloResult.count} found</Text>
              </View>
            </View>
            <Text
              style={styles.yoloSummary}
              accessible
              accessibilityLabel={yoloResult.summary}
            >
              {yoloResult.summary}
            </Text>
            {yoloResult.detections?.length > 0 && (
              <View style={styles.yoloList}>
                {yoloResult.detections.map((d, idx) => (
                  <View key={idx} style={styles.yoloItem}>
                    <Text style={styles.yoloLabel}>{d.label}</Text>
                    <Text style={styles.yoloConf}>{Math.round(d.confidence * 100)}%</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.yoloDisclaimer}>
              Powered by YOLOv8n · Results may vary by image quality.
            </Text>
          </View>
        )}

        {/* Voice Assistance & Roadmap Section */}
        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>
              VOICE & FEATURES
            </Text>
            <Text style={styles.sectionTitle}>
              More ways to explore
            </Text>
          </View>
          <View style={styles.phasePill}>
            <Text style={styles.phaseText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.features}>
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

          <FeatureCard
            icon="⌕"
            title="Real-Time Detection"
            description="Identify objects, signs, and hazards in your environment."
          />
          <FeatureCard
            icon="Aa"
            title="Read Text"
            description="Extract text from signboards, menus, and labels."
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

      {/* Accessible Camera Modal */}
      <CameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onCapture={handleCaptureConfirmed}
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
    paddingTop: 8,
    paddingBottom: 40,
  },

  header: {
    marginTop: 10,
    marginBottom: 24,
  },

  brandMark: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    gap: 12,
  },

  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandSymbol: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: '700',
  },

  brandName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.primary,
  },

  brandSubtitle: {
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 1,
  },

  eyebrow: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  title: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.9,
    color: colors.text,
    fontWeight: '700',
    marginBottom: 13,
  },

  intro: {
    color: colors.secondaryText,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },

  uploadCard: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    shadowColor: '#24352D',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
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
    gap: 12,
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
    fontSize: 18,
    marginRight: 10,
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

  detectButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 12,
  },

  detectButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  detectButtonText: {
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

  yoloCard: {
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

  yoloHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },

  yoloHeaderIcon: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },

  yoloHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    flex: 1,
  },

  yoloBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  yoloBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.4,
  },

  yoloSummary: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 14,
  },

  yoloList: {
    gap: 6,
    marginBottom: 14,
  },

  yoloItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  yoloLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },

  yoloConf: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  yoloDisclaimer: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.secondaryText,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
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
