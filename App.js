import { useEffect, useRef, useState } from 'react';
import {
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
import { AnalysisResult } from './src/components/AnalysisResult';
import { CameraModal } from './src/components/CameraModal';
import { VoiceAssistant, VOICE_ASSISTANT_STATES } from './src/components/VoiceAssistant';
import { analyzeImageWithGemini } from './src/services/gemini';
import { createSpokenAnalysis, speakText, stopSpeaking } from './src/services/textToSpeech';
import { detectObjectsWithYolo } from './src/services/yolo';

function formatGeminiResponse(result) {
  return [
    result.scene,
    result.objects?.length ? `Objects: ${result.objects.join(', ')}.` : '',
    result.signsAndText?.length ? `Text found: ${result.signsAndText.join(', ')}.` : '',
    result.observations,
  ].filter((part) => typeof part === 'string' && part.trim()).join(' ');
}

export default function App() {
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  // analysis: null | { scene, objects, signsAndText, observations }
  const [analysis, setAnalysis] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [voiceState, setVoiceState] = useState(VOICE_ASSISTANT_STATES.IDLE);
  const [voiceResponse, setVoiceResponse] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  // YOLO detection state
  const [yoloResult, setYoloResult] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);
  const scrollRef = useRef(null);
  const speechRequestRef = useRef(0);
  const lastSpeechRef = useRef('');

  useEffect(() => () => {
    speechRequestRef.current += 1;
    stopSpeaking().catch(() => {});
  }, []);

  const cancelSpeech = () => {
    speechRequestRef.current += 1;
    stopSpeaking().catch(() => {});
    if (voiceState === VOICE_ASSISTANT_STATES.SPEAKING) {
      setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
      setVoiceStatus('Speech stopped. Ready for another image.');
    }
  };

  const speakResponse = async (text) => {
    const requestId = ++speechRequestRef.current;
    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (!cleanText) {
      setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
      setVoiceError('No description was available to speak.');
      setVoiceStatus('No description was available to speak.');
      return;
    }

    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceStatus('Preparing the spoken description.');
    setVoiceError('');

    try {
      await stopSpeaking();
      if (requestId !== speechRequestRef.current) return;

      speakText(cleanText, {
        onStart: () => {
          if (requestId !== speechRequestRef.current) return;
          setVoiceState(VOICE_ASSISTANT_STATES.SPEAKING);
          setVoiceStatus('Speaking the image description now.');
        },
        onDone: () => {
          if (requestId !== speechRequestRef.current) return;
          setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
          setVoiceStatus('Description finished. Ready for another image.');
        },
        onStopped: () => {
          if (requestId !== speechRequestRef.current) return;
          setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
          setVoiceStatus('Speech stopped. Ready for another image.');
        },
        onError: () => {
          if (requestId !== speechRequestRef.current) return;
          const message = 'Text-to-speech is unavailable. You can still read the analysis on screen.';
          setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
          setVoiceError(message);
          setVoiceStatus(message);
        },
      });
    } catch {
      if (requestId !== speechRequestRef.current) return;
      const message = 'Text-to-speech is unavailable. You can still read the analysis on screen.';
      setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
      setVoiceError(message);
      setVoiceStatus(message);
    }
  };

  const repeatResponse = () => {
    if (lastSpeechRef.current.trim()) speakResponse(lastSpeechRef.current);
  };

  const handleStopSpeaking = async () => {
    speechRequestRef.current += 1;
    setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
    setVoiceStatus('Speech stopped. Ready for another image.');
    setVoiceError('');
    try {
      await stopSpeaking();
    } catch {
      const message = 'Unable to stop speech. Please try again.';
      setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
      setVoiceError(message);
      setVoiceStatus(message);
    }
  };

  const openCamera = () => {
    cancelSpeech();
    setCameraVisible(true);
  };

  const handleCaptureConfirmed = (capturedImage) => {
    cancelSpeech();
    setImage(capturedImage);
    setAnalysis(null);
    setAnalysisError(null);
    setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
    setVoiceResponse('');
    setVoiceError('');
    setVoiceStatus('');
    setYoloResult(null);
    setDetectError(null);
    setCameraVisible(false);
  };

  const handleCameraCaptureError = (message) => {
    cancelSpeech();
    setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
    setVoiceResponse('');
    setVoiceError(message);
    setVoiceStatus(message);
  };

  // Gallery upload flow
  const chooseImage = async () => {
    if (busy) return;
    cancelSpeech();
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
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setImage(result.assets[0]);
        // Clear previous analysis when a new image is picked.
        setAnalysis(null);
        setAnalysisError(null);
        setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
        setVoiceResponse('');
        setVoiceError('');
        setVoiceStatus('');
        setYoloResult(null);
        setDetectError(null);
      }
    } catch (error) {
      Alert.alert('Unable to open gallery', 'Please try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const analyzeImage = async () => {
    if (!image?.uri || analysing) return;
    cancelSpeech();
    setAnalysing(true);
    setAnalysis(null);
    setAnalysisError(null);
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceResponse('');
    setVoiceError('');
    setVoiceStatus('Analyzing the image.');
    try {
      const result = await analyzeImageWithGemini(image);
      setAnalysis(result);
      setVoiceResponse(formatGeminiResponse(result));
      lastSpeechRef.current = createSpokenAnalysis(result);
      speakResponse(lastSpeechRef.current);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 380, animated: true });
      }, 150);
    } catch (err) {
      const message = err.message ?? 'An unexpected error occurred. Please try again.';
      setAnalysisError(message);
      setVoiceError(message);
      setVoiceStatus(message);
      setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
    } finally {
      setAnalysing(false);
    }
  };

  const detectObjects = async () => {
    if (!image?.uri || detecting) return;
    setDetecting(true);
    setYoloResult(null);
    setDetectError(null);
    try {
      const result = await detectObjectsWithYolo(image);
      setYoloResult(result);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 500, animated: true });
      }, 150);
    } catch (err) {
      setDetectError(err.message ?? 'Object detection failed. Please try again.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <VoiceAssistant
          state={voiceState}
          responseText={voiceResponse}
          errorMessage={voiceError}
          statusAnnouncement={voiceStatus}
          canRepeatResponse={Boolean(voiceResponse.trim() && lastSpeechRef.current.trim())}
          onRepeatResponse={repeatResponse}
          onStopSpeaking={handleStopSpeaking}
        />

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
                <Pressable onPress={() => { cancelSpeech(); lastSpeechRef.current = ''; setImage(null); setAnalysis(null); setAnalysisError(null); setVoiceResponse(''); setVoiceState(VOICE_ASSISTANT_STATES.IDLE); setVoiceStatus(''); }} accessibilityRole="button" accessibilityLabel="Remove selected image" style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>

              {/* Analyse Image button */}
              <Pressable
                onPress={analyzeImage}
                disabled={analysing}
                accessibilityRole="button"
                accessibilityLabel="Analyse image with AI"
                accessibilityHint="Sends the selected image to Gemini for object and scene analysis"
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.analyseButton,
                  pressed && styles.pressed,
                  analysing && styles.disabled,
                ]}
              >
                {analysing ? (
                  <ActivityIndicator color={colors.white} size="small" accessibilityLabel="Analysing image, please wait" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {analysis ? 'Analyse Again' : 'Analyse Image'}
                  </Text>
                )}
                {!analysing && (
                  <Text style={styles.buttonArrow} accessibilityElementsHidden>›</Text>
                )}
              </Pressable>

              {/* Detect Objects (YOLO) button */}
              <Pressable
                onPress={detectObjects}
                disabled={detecting}
                accessibilityRole="button"
                accessibilityLabel="Detect objects in image"
                accessibilityHint="Sends the image to the YOLO model to identify objects"
                style={({ pressed }) => [
                  styles.outlineButton,
                  styles.detectButton,
                  pressed && styles.pressed,
                  detecting && styles.disabled,
                ]}
              >
                {detecting ? (
                  <ActivityIndicator color={colors.primary} size="small" accessibilityLabel="Detecting objects, please wait" />
                ) : (
                  <Text style={styles.outlineButtonText}>⌕ Detect Objects</Text>
                )}
              </Pressable>

              {/* YOLO detection error */}
              {detectError ? (
                <View style={styles.errorBox} accessible accessibilityRole="alert" accessibilityLabel={`Detection error: ${detectError}`}>
                  <Text style={styles.errorText}>{detectError}</Text>
                </View>
              ) : null}

              {/* Analysis success badge */}
              {analysis ? (
                <Pressable
                  onPress={() => scrollRef.current?.scrollTo({ y: 380, animated: true })}
                  accessibilityRole="button"
                  accessibilityLabel="Scroll down to view analysis results"
                  style={({ pressed }) => [styles.resultsBadge, pressed && styles.pressed]}
                >
                  <Text style={styles.resultsBadgeText}>✓ Analysis complete — View results below ↓</Text>
                </Pressable>
              ) : null}

              {/* Analysis error */}
              {analysisError ? (
                <View style={styles.errorBox} accessible accessibilityRole="alert" accessibilityLabel={`Error: ${analysisError}`}>
                  <Text style={styles.errorText}>{analysisError}</Text>
                </View>
              ) : null}
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

        {/* Analysis results rendered outside the upload card */}
        {analysis ? <AnalysisResult result={analysis} /> : null}

        {/* YOLO detection results */}
        {yoloResult ? (
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
            {yoloResult.detections.length > 0 && (
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
        ) : null}

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
        onCaptureError={handleCameraCaptureError}
        onChooseFromGallery={chooseImage}
      />
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
  buttonStack: { width: '100%', gap: 12 },
  buttonCameraIcon: { fontSize: 20, marginRight: 10 },
  outlineButton: { height: 54, borderRadius: 15, paddingHorizontal: 18, width: '100%', backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  outlineButtonIcon: { fontSize: 18, marginRight: 10, color: colors.primary },
  outlineButtonText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  actionButton: { flex: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cameraAction: { backgroundColor: colors.softLavender, borderWidth: 1, borderColor: colors.primary },
  cameraActionText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.7 },
  privacyNote: { alignSelf: 'center', color: colors.secondaryText, fontSize: 12, marginTop: 13 },
  preview: { width: '100%', height: 220, borderRadius: 15, backgroundColor: colors.softLavender, marginTop: 2 },
  imageActions: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 12, gap: 10 },
  secondaryButton: { flex: 1, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 15, fontWeight: '700', color: colors.deepLavender },
  removeButton: { minHeight: 48, minWidth: 82, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F5FA' },
  removeButtonText: { fontSize: 15, fontWeight: '600', color: colors.secondaryText },
  analyseButton: { marginTop: 12, width: '100%' },
  resultsBadge: { marginTop: 10, width: '100%', backgroundColor: '#EDF7EE', borderRadius: 12, borderWidth: 1, borderColor: '#C8E6C9', paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  resultsBadgeText: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  errorBox: { marginTop: 10, width: '100%', backgroundColor: '#FFF0F0', borderRadius: 12, borderWidth: 1, borderColor: '#F5C6C6', padding: 12 },
  errorText: { fontSize: 14, lineHeight: 20, color: '#C0392B' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 34, marginBottom: 14 },
  sectionEyebrow: { color: colors.primary, fontWeight: '700', fontSize: 10, letterSpacing: 1.3, lineHeight: 16 },
  sectionTitle: { color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  phasePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.softLavender, marginBottom: 3 },
  phaseText: { fontSize: 10, letterSpacing: 0.7, fontWeight: '700', color: colors.deepLavender },
  features: { gap: 10 },
  detectButton: { marginTop: 10, width: '100%' },
  yoloCard: { marginTop: 18, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20, shadowColor: '#3C2B55', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  yoloHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  yoloHeaderIcon: { color: colors.primary, fontSize: 20, fontWeight: '700' },
  yoloHeaderTitle: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.3, flex: 1 },
  yoloBadge: { backgroundColor: colors.softLavender, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  yoloBadgeText: { fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.4 },
  yoloSummary: { fontSize: 15, lineHeight: 22, color: colors.text, marginBottom: 14 },
  yoloList: { gap: 6, marginBottom: 14 },
  yoloItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.softLavender, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  yoloLabel: { fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  yoloConf: { fontSize: 13, fontWeight: '700', color: colors.primary },
  yoloDisclaimer: { fontSize: 11, lineHeight: 17, color: colors.secondaryText, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  footer: { marginTop: 28, alignItems: 'center' },
  footerRule: { width: 36, height: 3, borderRadius: 2, backgroundColor: colors.border, marginBottom: 13 },
  footerText: { maxWidth: 250, color: colors.secondaryText, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
