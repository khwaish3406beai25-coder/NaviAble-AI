import { useEffect, useRef, useState } from 'react';
import {
  AppState,
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
import { formatConciseAnalysis, speakText, stopSpeaking } from './src/services/textToSpeech';
import { detectObjectsWithYolo } from './src/services/yolo';
import { classifyVoiceCommand, normalizeVoiceCommand } from './src/services/voiceCommands';
import { finishVoiceStage, markVoiceEvent, startVoiceStage } from './src/services/voicePerformance';
import {
  getSpeechRecognitionModule,
  getVoiceSetupProblem,
  requestVoiceMicrophonePermission,
  startSpeechRecognition,
  stopSpeechRecognition,
} from './src/services/voiceInteraction';

const VOICE_MODES = Object.freeze({
  IDLE: 'idle',
  WAKE_LISTENING: 'wake',
  ACKNOWLEDGING: 'speaking-prompt',
  COMMAND_READY: 'command-ready',
  COMMAND_LISTENING: 'command',
  ROUTING_COMMAND: 'routing-command',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  RESUMING_WAKE: 'resuming-wake',
  WAKE_TRANSITION: 'wake-transition',
  OPENING_CAMERA: 'opening-camera',
  CAMERA_ERROR: 'camera-error',
  ERROR: 'error',
});

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
  const [voiceAssistanceActive, setVoiceAssistanceActive] = useState(false);
  const [cameraAutoCapture, setCameraAutoCapture] = useState(false);
  // YOLO detection state
  const [yoloResult, setYoloResult] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);
  const scrollRef = useRef(null);
  const speechRequestRef = useRef(0);
  const ttsActiveRef = useRef(false);
  const lastSpeechRef = useRef('');
  const voiceSessionRef = useRef(false);
  const voiceRunRef = useRef(0);
  const voiceModeRef = useRef(VOICE_MODES.IDLE);
  const voiceReadTextRef = useRef(false);
  const voiceActionRef = useRef('gemini');
  const speechResultHandledRef = useRef(false);
  const voiceEventHandlersRef = useRef({});
  const recognitionTimeoutRef = useRef(null);
  const recognitionStartTimeoutRef = useRef(null);
  const wakeRestartTimerRef = useRef(null);
  const recognitionRetryCountRef = useRef(0);
  const activationPhraseHandledRef = useRef(false);

  useEffect(() => () => {
    voiceSessionRef.current = false;
    speechRequestRef.current += 1;
    clearTimeout(recognitionTimeoutRef.current);
    clearTimeout(recognitionStartTimeoutRef.current);
    clearTimeout(wakeRestartTimerRef.current);
    stopSpeaking().catch(() => {});
    stopSpeechRecognition().catch(() => {});
  }, []);

  const cancelSpeech = () => {
    speechRequestRef.current += 1;
    stopSpeaking().catch(() => {});
    ttsActiveRef.current = false;
    if (voiceState === VOICE_ASSISTANT_STATES.SPEAKING) {
      setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
      setVoiceStatus('Speech stopped. Ready for another image.');
    }
  };

  const scheduleWakePhraseResume = (message, recognizerStopped = false) => {
    if (!voiceSessionRef.current) return;
    voiceModeRef.current = VOICE_MODES.RESUMING_WAKE;
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceStatus(message);
    clearTimeout(recognitionTimeoutRef.current);
    clearTimeout(recognitionStartTimeoutRef.current);
    const scheduleRestart = () => {
      clearTimeout(wakeRestartTimerRef.current);
      wakeRestartTimerRef.current = setTimeout(() => {
        if (voiceSessionRef.current && voiceModeRef.current === VOICE_MODES.RESUMING_WAKE) {
          voiceModeRef.current = VOICE_MODES.COMMAND_READY;
          startCommandListening();
        }
      }, 250);
    };
    if (recognizerStopped) scheduleRestart();
    else stopSpeechRecognition().finally(scheduleRestart);
  };

  const startCommandListening = () => {
    if (!voiceSessionRef.current) return;
    if (![VOICE_MODES.ACKNOWLEDGING, VOICE_MODES.COMMAND_READY].includes(voiceModeRef.current)) return;
    voiceModeRef.current = VOICE_MODES.COMMAND_LISTENING;
    speechResultHandledRef.current = false;
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceStatus('Starting speech recognition for your command.');
    startVoiceStage('command-recognition');
    try {
      startSpeechRecognition({ mode: 'command', interimResults: true });
      clearTimeout(recognitionStartTimeoutRef.current);
      recognitionStartTimeoutRef.current = setTimeout(() => {
        if (voiceModeRef.current === VOICE_MODES.COMMAND_LISTENING && voiceSessionRef.current) {
          finishVoiceStage('command-recognition', { result: 'start timeout' });
          failVoiceAssistance('Speech recognition did not start for the command. Check microphone permission and browser or device speech-service support.');
        }
      }, 8000);
      clearTimeout(recognitionTimeoutRef.current);
      recognitionTimeoutRef.current = setTimeout(() => {
        if (voiceModeRef.current === VOICE_MODES.COMMAND_LISTENING && voiceSessionRef.current && !speechResultHandledRef.current) {
          speechResultHandledRef.current = true;
          finishVoiceStage('command-listening', { result: 'timeout' });
          finishVoiceStage('command-recognition', { result: 'timeout' });
          scheduleWakePhraseResume('No command was heard. Listening again.');
        }
      }, 15000);
    } catch (error) {
      failVoiceAssistance(error.message || 'Could not start speech recognition for the command.');
    }
  };

  const startWakePhraseListening = () => {
    if (!voiceSessionRef.current) return;
    clearTimeout(recognitionTimeoutRef.current);
    clearTimeout(recognitionStartTimeoutRef.current);
    clearTimeout(wakeRestartTimerRef.current);
    voiceModeRef.current = VOICE_MODES.WAKE_LISTENING;
    activationPhraseHandledRef.current = false;
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceError('');
    setVoiceStatus('Starting Android speech recognition for the activation phrase.');
    try {
      startSpeechRecognition({ mode: 'wake', interimResults: true });
      clearTimeout(recognitionStartTimeoutRef.current);
      recognitionStartTimeoutRef.current = setTimeout(() => {
        if (voiceModeRef.current === VOICE_MODES.WAKE_LISTENING && voiceSessionRef.current) {
          failVoiceAssistance('Android speech recognition did not start. Check microphone permission and that a speech recognition service is enabled.');
        }
      }, 8000);
    } catch (error) {
      failVoiceAssistance(error.message || 'Android speech recognition could not start.');
    }
  };

  const finishSpeechAndResume = (requestId, statusMessage) => {
    if (requestId !== speechRequestRef.current) return;
    voiceModeRef.current = VOICE_MODES.COMMAND_READY;
    clearTimeout(recognitionTimeoutRef.current);
    clearTimeout(recognitionStartTimeoutRef.current);
    if (requestId !== speechRequestRef.current) return;
    if (voiceSessionRef.current) {
      setVoiceStatus(statusMessage);
      startCommandListening();
    } else {
      voiceModeRef.current = VOICE_MODES.IDLE;
      setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
      setVoiceStatus(statusMessage);
    }
  };

  const speakPromptAndThen = (text, afterSpeech) => {
    const requestId = ++speechRequestRef.current;
    voiceModeRef.current = VOICE_MODES.ACKNOWLEDGING;
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceError('');
    try {
      clearTimeout(recognitionTimeoutRef.current);
      clearTimeout(recognitionStartTimeoutRef.current);
      if (requestId !== speechRequestRef.current || !voiceSessionRef.current) return;
      let continuationHandled = false;
      const continueOnce = () => {
        if (continuationHandled || requestId !== speechRequestRef.current || !voiceSessionRef.current) return;
        continuationHandled = true;
        afterSpeech();
      };
      speakText(text, {
        label: text === 'How can I help you?' ? 'acknowledgment' : 'voice-prompt',
        onStart: () => {
          if (requestId !== speechRequestRef.current) return;
          ttsActiveRef.current = true;
          if (text === 'How can I help you?') finishVoiceStage('wake-to-acknowledgment');
          setVoiceState(VOICE_ASSISTANT_STATES.SPEAKING);
          setVoiceStatus(text);
        },
        onDone: () => {
          ttsActiveRef.current = false;
          continueOnce();
        },
        onStopped: () => {
          ttsActiveRef.current = false;
          continueOnce();
        },
        onError: () => {
          ttsActiveRef.current = false;
          if (requestId !== speechRequestRef.current) return;
          setVoiceModeError('Text-to-speech failed. Check the Android speech engine and try again.');
        },
      });
    } catch {
      if (requestId === speechRequestRef.current) {
        setVoiceModeError('Text-to-speech failed. Check the Android speech engine and try again.');
      }
    }
  };

  const setVoiceModeError = (message) => {
    voiceModeRef.current = VOICE_MODES.ERROR;
    setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
    setVoiceError(message);
    setVoiceStatus(message);
  };

  const failVoiceAssistance = (message) => {
    voiceSessionRef.current = false;
    voiceModeRef.current = VOICE_MODES.ERROR;
    setVoiceAssistanceActive(false);
    clearTimeout(recognitionTimeoutRef.current);
    clearTimeout(recognitionStartTimeoutRef.current);
    stopSpeechRecognition().catch(() => {});
    setVoiceModeError(message);
  };

  const speakVoiceFailure = (displayMessage, spokenMessage = displayMessage) => {
    failVoiceAssistance(displayMessage);
    try {
      speakText(spokenMessage, {
        label: 'assistant-error',
        onStart: () => {
          ttsActiveRef.current = true;
          setVoiceState(VOICE_ASSISTANT_STATES.SPEAKING);
          setVoiceStatus(displayMessage);
        },
        onDone: () => {
          ttsActiveRef.current = false;
          setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
        },
        onStopped: () => {
          ttsActiveRef.current = false;
          setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
        },
        onError: () => {
          ttsActiveRef.current = false;
          setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
        },
      });
    } catch {
      setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
    }
  };

  const handleWakeWordDetected = async () => {
    if (!voiceSessionRef.current || voiceModeRef.current !== VOICE_MODES.WAKE_LISTENING || activationPhraseHandledRef.current) return;
    activationPhraseHandledRef.current = true;
    finishVoiceStage('wake-recognition', { result: 'wake phrase detected' });
    markVoiceEvent('wake phrase detected');
    startVoiceStage('wake-to-acknowledgment');
    voiceModeRef.current = VOICE_MODES.WAKE_TRANSITION;
    clearTimeout(recognitionTimeoutRef.current);
    clearTimeout(recognitionStartTimeoutRef.current);
    await stopSpeechRecognition();
    if (!voiceSessionRef.current) return;
    speakPromptAndThen('How can I help you?', startCommandListening);
  };

  const speakResponse = async (text) => {
    const requestId = ++speechRequestRef.current;
    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (!cleanText) {
      setVoiceModeError('No readable description was available to speak.');
      return;
    }
    voiceModeRef.current = VOICE_MODES.SPEAKING;
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceStatus('Preparing the spoken response.');
    setVoiceError('');
    try {
      if (ttsActiveRef.current) {
        await stopSpeaking();
        ttsActiveRef.current = false;
      }
      clearTimeout(recognitionTimeoutRef.current);
      clearTimeout(recognitionStartTimeoutRef.current);
      clearTimeout(wakeRestartTimerRef.current);
      if (requestId !== speechRequestRef.current) return;
      speakText(cleanText, {
        onStart: () => {
          if (requestId !== speechRequestRef.current) return;
          ttsActiveRef.current = true;
          voiceModeRef.current = VOICE_MODES.SPEAKING;
          setVoiceState(VOICE_ASSISTANT_STATES.SPEAKING);
          setVoiceStatus('Speaking the response. The microphone is paused; use Stop Speaking or Stop Assistance to interrupt.');
        },
        onDone: () => {
          ttsActiveRef.current = false;
          finishSpeechAndResume(requestId, 'Response finished. Listening for your next command.');
        },
        onStopped: () => {
          ttsActiveRef.current = false;
          finishSpeechAndResume(requestId, 'Speech stopped. Listening for your next command.');
        },
        onError: () => {
          ttsActiveRef.current = false;
          if (requestId === speechRequestRef.current) {
            setVoiceModeError('Text-to-speech failed. The Gemini response remains available on screen.');
          }
        },
      });
    } catch {
      if (requestId === speechRequestRef.current) setVoiceModeError('Text-to-speech failed. The Gemini response remains available on screen.');
    }
  };

  const repeatResponse = () => {
    if (lastSpeechRef.current.trim()) speakResponse(lastSpeechRef.current);
  };

  const handleStopSpeaking = async () => {
    speechRequestRef.current += 1;
    voiceModeRef.current = VOICE_MODES.RESUMING_WAKE;
    setVoiceError('');
    try {
      await stopSpeaking();
      ttsActiveRef.current = false;
      if (voiceSessionRef.current) {
        voiceModeRef.current = VOICE_MODES.COMMAND_READY;
        startCommandListening();
      } else {
        voiceModeRef.current = VOICE_MODES.IDLE;
        setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
        setVoiceStatus('Speech stopped. Ready for another image.');
      }
    } catch {
      setVoiceModeError('Unable to stop speech cleanly. Please stop assistance and try again.');
    }
  };

  const openCamera = async () => {
    if (voiceSessionRef.current) await stopVoiceAssistance();
    cancelSpeech();
    setCameraAutoCapture(false);
    setCameraVisible(true);
  };

  const startVoiceAssistance = async () => {
    const setupProblem = getVoiceSetupProblem();
    if (setupProblem) {
      setVoiceModeError(setupProblem);
      return;
    }
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
      setVoiceStatus('Requesting microphone access for one-step voice commands.');
    setVoiceError('');
    try {
      const permission = await requestVoiceMicrophonePermission();
      if (!permission?.granted) {
        voiceSessionRef.current = false;
        setVoiceAssistanceActive(false);
        setVoiceModeError('Microphone permission was denied. Allow microphone access in your browser or Android Settings, then try again.');
        return;
      }
      voiceSessionRef.current = true;
      setVoiceAssistanceActive(true);
      setVoiceResponse('');
      recognitionRetryCountRef.current = 0;
      voiceModeRef.current = VOICE_MODES.COMMAND_READY;
      setVoiceStatus('Listening for one voice command. Say “Detect my surroundings”, “Open camera”, or another request.');
      startCommandListening();
    } catch (error) {
      voiceSessionRef.current = false;
      setVoiceAssistanceActive(false);
      setVoiceModeError(error.message || 'Voice assistance could not start.');
    }
  };

  const stopVoiceAssistance = async () => {
    voiceSessionRef.current = false;
    voiceModeRef.current = VOICE_MODES.IDLE;
    voiceRunRef.current += 1;
    speechRequestRef.current += 1;
    clearTimeout(recognitionTimeoutRef.current);
    clearTimeout(recognitionStartTimeoutRef.current);
    clearTimeout(wakeRestartTimerRef.current);
    setVoiceAssistanceActive(false);
    setCameraVisible(false);
    setCameraAutoCapture(false);
    setAnalysing(false);
    setVoiceState(VOICE_ASSISTANT_STATES.IDLE);
    setVoiceStatus('Voice assistance stopped. The microphone is off.');
    setVoiceError('');
    await Promise.all([
      stopSpeaking().catch(() => {}),
      stopSpeechRecognition().catch(() => {}),
    ]);
    ttsActiveRef.current = false;
  };

  const handleVoiceCommand = async (transcripts) => {
    const candidates = (Array.isArray(transcripts) ? transcripts : [transcripts]).filter(Boolean);
    if (!candidates.length || !voiceSessionRef.current) return;

    if (voiceModeRef.current !== VOICE_MODES.COMMAND_LISTENING) return;
    voiceModeRef.current = VOICE_MODES.ROUTING_COMMAND;
    const transcript = candidates.find((candidate) => classifyVoiceCommand(candidate) !== 'unknown') || candidates[0];
    const action = classifyVoiceCommand(transcript);
    markVoiceEvent('command action selected', { action, normalized: normalizeVoiceCommand(transcript) });
    if (__DEV__) console.info('[VoiceCommand] recognized', { transcript, candidates, normalized: normalizeVoiceCommand(transcript), action });
    setVoiceStatus(`Command recognized: ${transcript}`);
    clearTimeout(recognitionTimeoutRef.current);
    await stopSpeechRecognition();
    if (!voiceSessionRef.current) return;

    markVoiceEvent('command action execution started', { action });
    if (__DEV__) console.info('[VoiceCommand] execution started', { action });
    if (action === 'stop-assistance') {
      await stopVoiceAssistance();
      if (__DEV__) console.info('[VoiceCommand] execution result', { action, success: true });
    } else if (action === 'stop-speaking') {
      await handleStopSpeaking();
      if (__DEV__) console.info('[VoiceCommand] execution result', { action, success: true });
    } else if (action === 'repeat') {
      if (lastSpeechRef.current.trim()) {
        await speakResponse(lastSpeechRef.current);
        if (__DEV__) console.info('[VoiceCommand] execution result', { action, success: true });
      } else {
        if (__DEV__) console.info('[VoiceCommand] execution result', { action, success: false, reason: 'no previous response' });
        speakPromptAndThen('There is no previous response to repeat.', startCommandListening);
      }
    } else if (action === 'read-text') {
      await openVoiceCamera('gemini', true, 'Opening the camera to capture text for Gemini reading.', true);
    } else if (action === 'yolo') {
      await openVoiceCamera('yolo', true, 'Opening the camera to capture an image for object detection.');
    } else if (action === 'open-camera') {
      await openVoiceCamera('gemini', false, 'Opening the camera. Capture a photo when ready.');
    } else if (action === 'start-listening') {
      voiceModeRef.current = VOICE_MODES.COMMAND_READY;
      startCommandListening();
    } else if (action === 'gemini') {
      voiceReadTextRef.current = false;
      await openVoiceCamera('gemini', true, 'Opening the camera to capture your surroundings.');
    } else {
      if (__DEV__) console.info('[VoiceCommand] execution failed', { action, reason: 'unrecognized command' });
      const heard = normalizeVoiceCommand(transcript);
      const clarification = heard
        ? `I heard “${heard}”, but did not match it to an action. Say “read text”, “detect objects”, or “detect my surroundings”.`
        : 'I did not understand that. Say “read text”, “detect objects”, or “detect my surroundings”.';
      setVoiceResponse(clarification);
      speakPromptAndThen(
        clarification,
        startCommandListening,
      );
    }
  };

  const openVoiceCamera = async (action, autoCapture, statusMessage, readText = false) => {
    if (!voiceSessionRef.current) return;
    voiceModeRef.current = VOICE_MODES.OPENING_CAMERA;
    voiceActionRef.current = action;
    voiceReadTextRef.current = readText;
    clearTimeout(recognitionTimeoutRef.current);
    if (!voiceSessionRef.current) return;
    setCameraAutoCapture(autoCapture);
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceStatus(statusMessage);
    setVoiceError('');
    setCameraVisible(true);
    if (__DEV__) console.info('[VoiceCommand] execution result', { action, success: true, result: autoCapture ? 'camera opened for automatic capture when ready' : 'camera opened for manual capture' });
  };

  const analyzeVoiceImage = async (capturedImage, readText = false) => {
    const runId = ++voiceRunRef.current;
    if (__DEV__) console.info('[VoiceCommand] execution started', { action: readText ? 'gemini-read-text' : 'gemini-analysis', hasImage: Boolean(capturedImage?.uri) });
    const displayImage = { ...capturedImage };
    delete displayImage.base64;
    setImage(displayImage);
    setAnalysis(null);
    setAnalysisError(null);
    setAnalysing(true);
    voiceModeRef.current = VOICE_MODES.PROCESSING;
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceStatus(readText ? 'Image captured. Asking Gemini to read visible text.' : 'Image captured. Sending it to Gemini for analysis.');
    setVoiceError('');
    startVoiceStage('gemini-analysis');
    try {
      const result = await analyzeImageWithGemini(capturedImage, { readText });
      if (!voiceSessionRef.current || runId !== voiceRunRef.current) return;
      setAnalysis(result);
      const conciseResponse = formatConciseAnalysis(result, { readText });
      if (!conciseResponse) {
        throw new Error('Gemini did not return a readable description for this image. Please try another capture.');
      }
      setVoiceResponse(conciseResponse);
      lastSpeechRef.current = conciseResponse;
      setVoiceStatus('Gemini analysis complete. Preparing the spoken response.');
      finishVoiceStage('gemini-analysis', { result: 'success' });
      if (__DEV__) console.info('[VoiceCommand] execution result', { action: readText ? 'gemini-read-text' : 'gemini-analysis', success: true });
      speakResponse(conciseResponse);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 380, animated: true }), 150);
    } catch (err) {
      if (!voiceSessionRef.current || runId !== voiceRunRef.current) return;
      const message = err.message ?? 'Gemini could not analyze the image. Please try again.';
      finishVoiceStage('gemini-analysis', { result: 'error', message });
      if (__DEV__) console.error('[VoiceCommand] execution result', { action: readText ? 'gemini-read-text' : 'gemini-analysis', success: false, message });
      setAnalysisError(message);
      setVoiceError(message);
      setVoiceStatus(message);
      speakVoiceFailure(message, 'I could not analyze that image. Check your Gemini connection and try again.');
    } finally {
      if (runId === voiceRunRef.current) setAnalysing(false);
    }
  };

  const detectVoiceImageObjects = async (capturedImage) => {
    const runId = ++voiceRunRef.current;
    const displayImage = { ...capturedImage };
    delete displayImage.base64;
    setImage(displayImage);
    setAnalysis(null);
    setAnalysisError(null);
    setYoloResult(null);
    setDetectError(null);
    setAnalysing(false);
    voiceModeRef.current = VOICE_MODES.PROCESSING;
    setVoiceState(VOICE_ASSISTANT_STATES.PROCESSING);
    setVoiceStatus('Image captured. Sending it to the YOLO object-detection backend.');
    setVoiceError('');
    if (__DEV__) console.info('[VoiceCommand] execution started', { action: 'yolo-detection', hasImage: Boolean(capturedImage?.uri) });
    startVoiceStage('yolo-analysis');
    try {
      const result = await detectObjectsWithYolo(capturedImage);
      if (!voiceSessionRef.current || runId !== voiceRunRef.current) return;
      setYoloResult(result);
      const response = result.summary?.trim()
        || (result.count ? `Detected ${result.count} objects.` : 'No objects detected with sufficient confidence.');
      setVoiceResponse(response);
      lastSpeechRef.current = response;
      setVoiceStatus('YOLO object detection complete. Preparing the spoken result.');
      finishVoiceStage('yolo-analysis', { result: 'success', count: result.count });
      if (__DEV__) console.info('[VoiceCommand] execution result', { action: 'yolo-detection', success: true, count: result.count, summary: response });
      speakResponse(response);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 500, animated: true }), 150);
    } catch (err) {
      if (!voiceSessionRef.current || runId !== voiceRunRef.current) return;
      const message = err.message || 'Object detection failed. Check that the YOLO backend is running and reachable.';
      finishVoiceStage('yolo-analysis', { result: 'error', message });
      if (__DEV__) console.error('[VoiceCommand] execution result', { action: 'yolo-detection', success: false, message });
      setDetectError(message);
      setVoiceError(message);
      setVoiceStatus(message);
      speakVoiceFailure(message, 'I could not complete object detection. Check that the detection backend is running and reachable.');
    }
  };

  const handleCaptureConfirmed = (capturedImage) => {
    if (voiceSessionRef.current) {
      setCameraAutoCapture(false);
      setCameraVisible(false);
      setYoloResult(null);
      setDetectError(null);
      const readText = voiceReadTextRef.current;
      voiceReadTextRef.current = false;
      if (voiceActionRef.current === 'yolo') detectVoiceImageObjects(capturedImage);
      else analyzeVoiceImage(capturedImage, readText);
      return;
    }
    cancelSpeech();
    const displayImage = { ...capturedImage };
    delete displayImage.base64;
    setImage(displayImage);
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
    setVoiceResponse('');
    setVoiceError(message);
    setVoiceStatus(message);
    if (voiceSessionRef.current) {
      const spokenMessage = message.toLowerCase().includes('permission')
        ? 'Camera permission is needed for this request. Allow camera access and try again.'
        : message;
      speakVoiceFailure(message, spokenMessage);
    }
    else setVoiceState(VOICE_ASSISTANT_STATES.ERROR);
  };

  const handleCameraClosed = () => {
    setCameraVisible(false);
    setCameraAutoCapture(false);
    if (voiceSessionRef.current && voiceModeRef.current === VOICE_MODES.CAMERA_ERROR) {
      voiceModeRef.current = VOICE_MODES.COMMAND_READY;
      startCommandListening();
    } else if (voiceSessionRef.current && voiceModeRef.current === VOICE_MODES.OPENING_CAMERA) {
      setTimeout(() => {
        if (voiceSessionRef.current && voiceModeRef.current === VOICE_MODES.OPENING_CAMERA) {
          voiceModeRef.current = VOICE_MODES.COMMAND_READY;
          startCommandListening();
        }
      }, 0);
    }
  };

  // Gallery upload flow
  const chooseImage = async () => {
    if (busy) return;
    if (voiceSessionRef.current) await stopVoiceAssistance();
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
    if (voiceSessionRef.current) await stopVoiceAssistance();
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
      const conciseResponse = formatConciseAnalysis(result);
      setVoiceResponse(conciseResponse);
      lastSpeechRef.current = conciseResponse;
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

  voiceEventHandlersRef.current = {
    onSpeechStart: () => {
      if (__DEV__) console.info('[VoiceRecognition] recognizer started', { mode: voiceModeRef.current });
      markVoiceEvent('recognition started', { mode: voiceModeRef.current });
      clearTimeout(recognitionStartTimeoutRef.current);
      if (voiceModeRef.current === VOICE_MODES.WAKE_LISTENING) {
        startVoiceStage('wake-recognition');
        markVoiceEvent('wake listening started');
        setVoiceState(VOICE_ASSISTANT_STATES.LISTENING);
        setVoiceStatus('Speech recognition is active. Say Hey Navi or Hi Navi.');
      } else if (voiceModeRef.current === VOICE_MODES.COMMAND_LISTENING) {
        startVoiceStage('command-listening');
        markVoiceEvent('command listening started');
        setVoiceState(VOICE_ASSISTANT_STATES.LISTENING);
        setVoiceStatus('Speech recognition is active. Listening for your command.');
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = setTimeout(() => {
          if (voiceModeRef.current === VOICE_MODES.COMMAND_LISTENING && voiceSessionRef.current && !speechResultHandledRef.current) {
            speechResultHandledRef.current = true;
            finishVoiceStage('command-listening', { result: 'timeout' });
            finishVoiceStage('command-recognition', { result: 'timeout' });
            scheduleWakePhraseResume('No command was heard. Restarting voice command listening.');
          }
        }, 15000);
      }
    },
    onSpeechResult: (event) => {
      if (!voiceSessionRef.current) return;
      const transcripts = (event?.results || [])
        .map((result) => result?.transcript?.trim())
        .filter(Boolean);
      const transcript = transcripts[0];
      if (!transcript) return;
      recognitionRetryCountRef.current = 0;
      const resultKind = event.isFinal ? 'final' : 'partial';
      markVoiceEvent(`${resultKind} speech result`, { mode: voiceModeRef.current, transcript });
      if (__DEV__) console.info(`[VoiceRecognition] ${resultKind} result`, { mode: voiceModeRef.current, transcripts });
      if (voiceModeRef.current === VOICE_MODES.WAKE_LISTENING && event.isFinal) {
        const matchedTranscript = transcripts.find((candidate) => /\b(?:hey|hi)\s+(?:navi|navy|nav i)\b/.test(normalizeVoiceCommand(candidate)));
        if (matchedTranscript) {
          if (__DEV__) console.info('[VoiceRecognition] activation phrase matched', { transcript: matchedTranscript });
          handleWakeWordDetected();
        } else {
          setVoiceStatus(`Heard: ${transcript}. Say Hey Navi or Hi Navi to activate.`);
        }
      } else if (voiceModeRef.current === VOICE_MODES.COMMAND_LISTENING && event.isFinal) {
        if (speechResultHandledRef.current) return;
        speechResultHandledRef.current = true;
        finishVoiceStage('command-listening', { result: 'recognized', transcript });
        finishVoiceStage('command-recognition', { result: 'recognized', transcript });
        markVoiceEvent('command recognized', { transcript });
        handleVoiceCommand(transcripts);
      }
    },
    onSpeechNoMatch: () => {
      if (__DEV__) console.info('[VoiceRecognition] no-match event', { mode: voiceModeRef.current });
      if (voiceModeRef.current === VOICE_MODES.WAKE_LISTENING && voiceSessionRef.current) {
        setVoiceStatus('Android speech service could not match that audio. Listening again.');
      }
    },
    onAudioStart: () => {
      if (__DEV__) console.info('[VoiceRecognition] microphone audio capture started');
    },
    onSpeechEnd: () => {
      if (__DEV__) console.info('[VoiceRecognition] recognizer stopped', { mode: voiceModeRef.current });
      markVoiceEvent('recognition stopped', { mode: voiceModeRef.current });
      clearTimeout(recognitionStartTimeoutRef.current);
      clearTimeout(recognitionTimeoutRef.current);
      if (voiceModeRef.current === VOICE_MODES.WAKE_LISTENING && voiceSessionRef.current) {
        finishVoiceStage('wake-recognition', { result: 'recognition ended without wake phrase' });
        scheduleWakePhraseResume('Speech recognition ended. Restarting voice command listening.', true);
      } else if (voiceModeRef.current === VOICE_MODES.COMMAND_LISTENING && !speechResultHandledRef.current) {
        speechResultHandledRef.current = true;
        finishVoiceStage('command-listening', { result: 'ended without result' });
        finishVoiceStage('command-recognition', { result: 'ended without result' });
        scheduleWakePhraseResume('No command was recognized. Restarting voice command listening.', true);
      }
    },
    onSpeechError: (event) => {
      const code = event?.error || 'unknown';
      if (__DEV__) console.error('[VoiceRecognition] error', { mode: voiceModeRef.current, code, message: event?.message });
      markVoiceEvent('recognition error', { mode: voiceModeRef.current, code, message: event?.message });
      clearTimeout(recognitionStartTimeoutRef.current);
      if (code === 'aborted' || [VOICE_MODES.ROUTING_COMMAND, VOICE_MODES.RESUMING_WAKE, VOICE_MODES.WAKE_TRANSITION, VOICE_MODES.IDLE, VOICE_MODES.ERROR].includes(voiceModeRef.current)) return;
      if (['not-allowed', 'audio-capture', 'service-not-allowed', 'language-not-supported'].includes(code)) {
        const messages = {
          'not-allowed': 'Microphone permission was denied. Allow microphone access in Android Settings and try again.',
          'audio-capture': 'Android could not open the microphone. Close other apps using the microphone and try again.',
          'service-not-allowed': 'Android speech recognition is unavailable. Install or enable a speech recognition service in Android Settings.',
          'language-not-supported': 'The installed Android speech service does not support English (US). Check its language settings.',
        };
        failVoiceAssistance(event?.message || messages[code]);
        return;
      }
      if (voiceModeRef.current === VOICE_MODES.WAKE_LISTENING && ['no-speech', 'network', 'network-timeout', 'speech-timeout', 'busy', 'too-many-requests', 'client'].includes(code)) {
        if (code !== 'no-speech') recognitionRetryCountRef.current += 1;
        if (recognitionRetryCountRef.current > 4) {
          failVoiceAssistance(event?.message || 'Android speech recognition repeatedly disconnected. Check the speech service and network, then try again.');
          return;
        }
        scheduleWakePhraseResume(code === 'no-speech'
          ? 'No speech was detected. Restarting voice command listening.'
          : 'Speech recognition disconnected. Restarting voice command listening.');
        return;
      }
      if (voiceModeRef.current === VOICE_MODES.COMMAND_LISTENING && code === 'no-speech') {
        speechResultHandledRef.current = true;
        scheduleWakePhraseResume('No command was detected. Restarting voice command listening.');
        return;
      }
      if (voiceSessionRef.current) {
        failVoiceAssistance(event?.message || `Android speech recognition failed (${code}). Check microphone permission and the selected speech service.`);
      }
    },
  };
  useEffect(() => {
    const speechModule = getSpeechRecognitionModule();
    if (!speechModule?.addListener) return undefined;
    const subscriptions = [
      speechModule.addListener('start', () => voiceEventHandlersRef.current.onSpeechStart?.()),
      speechModule.addListener('audiostart', () => voiceEventHandlersRef.current.onAudioStart?.()),
      speechModule.addListener('nomatch', () => voiceEventHandlersRef.current.onSpeechNoMatch?.()),
      speechModule.addListener('result', (event) => voiceEventHandlersRef.current.onSpeechResult?.(event)),
      speechModule.addListener('error', (event) => voiceEventHandlersRef.current.onSpeechError?.(event)),
      speechModule.addListener('end', () => voiceEventHandlersRef.current.onSpeechEnd?.()),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && voiceSessionRef.current) stopVoiceAssistance();
    });
    return () => subscription.remove();
  }, []);

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
          assistanceActive={voiceAssistanceActive}
          onStartAssistance={startVoiceAssistance}
          onStopAssistance={voiceAssistanceActive ? stopVoiceAssistance : undefined}
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
        onClose={handleCameraClosed}
        onCaptureConfirmed={handleCaptureConfirmed}
        onCaptureError={handleCameraCaptureError}
        onChooseFromGallery={chooseImage}
        autoCapture={cameraAutoCapture}
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
