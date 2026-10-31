import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { finishVoiceStage, startVoiceStage } from './voicePerformance';

/**
 * yolo.js — NaviAble AI YOLO object detection service.
 *
 * Sends an image to the local FastAPI backend running YOLOv8n and
 * returns the detection results.
 *
 * Configuration:
 *   Set EXPO_PUBLIC_YOLO_URL in your .env file to your laptop's LAN IP.
 *   Example: EXPO_PUBLIC_YOLO_URL=http://192.168.1.42:8000
 *
 *   Leave it unset to use the Android Emulator host alias (emulators only).
 */

// Android Emulator host loopback. Physical devices must set EXPO_PUBLIC_YOLO_URL
// to the development machine's reachable LAN address.
const DEFAULT_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:8000'
  : 'http://127.0.0.1:8000';

/**
 * Returns the base backend URL, trimming any trailing slash.
 */
export function getYoloBackendUrl() {
  let raw = (
    Constants.expoConfig?.extra?.naviable?.yoloUrl
    || process.env.EXPO_PUBLIC_YOLO_URL
    || DEFAULT_URL
  ).trim();
  // 10.0.2.2 is a host alias available to the Android emulator only. On web,
  // when using that default development URL, the backend is on this browser's
  // host instead.
  if (Platform.OS === 'web' && /^https?:\/\/10\.0\.2\.2(?::\d+)?(?:\/|$)/i.test(raw)) {
    raw = raw.replace('10.0.2.2', '127.0.0.1');
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/**
 * Uses Expo's native image pipeline for camera/gallery file URIs.
 *
 * @param {string} uri
 * @returns {Promise<string>} raw base64 string
 */
async function uriToBase64(uri) {
  const prepared = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.9,
    base64: true,
  });
  if (!prepared.base64) throw new Error('Image conversion returned no data.');
  return prepared.base64.replace(/\s/g, '');
}

/**
 * Sends an image to the YOLO backend for object detection.
 *
 * @param {object|string} imageInput - ImagePicker asset { uri, base64, mimeType } or URI string.
 * @returns {Promise<{ detections: Detection[], count: number, summary: string }>}
 *
 * @typedef {{ label: string, confidence: number, bbox: number[] }} Detection
 */
export async function detectObjectsWithYolo(imageInput) {
  const uri = typeof imageInput === 'string' ? imageInput : imageInput?.uri;

  if (!uri) {
    throw new Error('No image URI provided for YOLO detection.');
  }

  // Prefer pre-computed base64 (from gallery pick); otherwise prepare the file natively.
  let base64 = typeof imageInput === 'object' ? imageInput?.base64 ?? null : null;
  let mimeType =
    imageInput?.mimeType ||
    (uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg');

  if (!base64) {
    try {
      base64 = await uriToBase64(uri);
      mimeType = 'image/jpeg';
    } catch {
      throw new Error('Could not prepare the captured image for object detection. Please capture it again.');
    }
  }

  const backendUrl = getYoloBackendUrl();
  const url = `${backendUrl}/detect`;
  if (__DEV__) console.info('[YOLO] POST /detect', { backendUrl, imagePrepared: Boolean(base64), mimeType });

  let response;
  const requestController = new AbortController();
  const requestTimeout = setTimeout(() => requestController.abort(), 30000);
  startVoiceStage('yolo-request', { backendUrl, imageBytes: Math.round(base64.length * 0.75) });
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        mime_type: mimeType,
        confidence: 0.35,
      }),
      signal: requestController.signal,
    });
  } catch (error) {
    finishVoiceStage('yolo-request', { result: 'network error' });
    if (error?.name === 'AbortError') {
      throw new Error('The YOLO backend did not respond within 30 seconds. Check its status and try again.');
    }
    throw new Error(
      `Cannot reach the YOLO backend at ${backendUrl}. ` +
        'Start the FastAPI server. For a physical phone, set EXPO_PUBLIC_YOLO_URL to your computer\'s LAN IP in the NaviAble app project .env file.'
    );
  } finally {
    clearTimeout(requestTimeout);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson?.detail || '';
    } catch { }
    if (__DEV__) console.error('[YOLO] request failed', { status: response.status, detail });
    finishVoiceStage('yolo-request', { result: 'http error', status: response.status });
    throw new Error(`Detection failed (HTTP ${response.status}): ${detail || 'Server error'}`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    finishVoiceStage('yolo-request', { result: 'invalid response', status: response.status });
    throw new Error('Unexpected response from detection server.');
  }

  const result = {
    detections: json.detections ?? [],
    count: json.count ?? 0,
    summary: json.summary ?? 'Detection complete.',
  };
  if (__DEV__) console.info('[YOLO] request succeeded', { count: result.count, summary: result.summary });
  finishVoiceStage('yolo-request', { result: 'success', status: response.status, count: result.count });
  return result;
}

