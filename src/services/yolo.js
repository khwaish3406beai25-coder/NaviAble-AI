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
 *   Leave it unset to use the localhost default (for emulators only).
 */

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const YOLO_MAX_DIMENSION = 800; // YOLOv8n natively processes 640x640; 800px provides crisp detail with tiny payloads (<80KB)
const REQUEST_TIMEOUT_MS = 10000; // 10s timeout to prevent infinite loading

/**
 * Returns the base backend URL, trimming any trailing slash.
 */
function getBackendUrl() {
  let raw = (process.env.EXPO_PUBLIC_YOLO_URL || '').trim();
  if (!raw) {
    return DEFAULT_URL;
  }
  // If running in a web browser on desktop, 10.0.2.2 cannot be reached.
  if (Platform.OS === 'web' && raw.includes('10.0.2.2')) {
    return 'http://localhost:8000';
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/**
 * Converts an image URI to a compressed, optimized base64 string.
 * Resizes large camera photos to <= 800px so transfer is near-instant (<100ms vs 20s+).
 */
async function prepareImageForYolo(imageInput) {
  const uri = typeof imageInput === 'string' ? imageInput : imageInput?.uri;
  if (!uri) throw new Error('No image URI provided.');

  try {
    const width = Number(imageInput?.width) || 0;
    const height = Number(imageInput?.height) || 0;
    const longestSide = Math.max(width, height);
    const actions = [];

    if (longestSide > YOLO_MAX_DIMENSION && width > 0 && height > 0) {
      const scale = YOLO_MAX_DIMENSION / longestSide;
      actions.push({
        resize: {
          width: Math.round(width * scale),
          height: Math.round(height * scale),
        },
      });
    } else if (longestSide === 0) {
      // If dimensions are unknown, constrain max width to 800px
      actions.push({ resize: { width: YOLO_MAX_DIMENSION } });
    }

    const manipResult = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });

    if (manipResult.base64) {
      return { base64: manipResult.base64, mimeType: 'image/jpeg' };
    }
  } catch (err) {
    // If ImageManipulator fails (e.g. certain web blobs), fallback to fetch/FileReader
  }

  // Fallback: direct base64 from imageInput or blob
  if (typeof imageInput === 'object' && imageInput?.base64) {
    return {
      base64: imageInput.base64.replace(/^data:[^,]+,/, '').replace(/\s/g, ''),
      mimeType: imageInput.mimeType || 'image/jpeg',
    };
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') {
        resolve(dataUrl.split(',')[1]);
      } else {
        reject(new Error('Failed to parse image data'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { base64, mimeType: 'image/jpeg' };
}

/**
 * Sends an image to the YOLO backend for object detection.
 *
 * @param {object|string} imageInput - ImagePicker asset { uri, base64, mimeType } or URI string.
 * @returns {Promise<{ detections: Detection[], count: number, summary: string }>}
 */
export async function detectObjectsWithYolo(imageInput) {
  const uri = typeof imageInput === 'string' ? imageInput : imageInput?.uri;
  if (!uri) {
    throw new Error('No image provided for YOLO detection.');
  }

  const { base64, mimeType } = await prepareImageForYolo(imageInput);

  const url = `${getBackendUrl()}/detect`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        mime_type: mimeType,
        confidence: 0.35,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(
        `Connection timed out reaching YOLO backend at ${getBackendUrl()}. ` +
        'Please check that your laptop and phone are on the same Wi-Fi network.'
      );
    }
    throw new Error(
      `Cannot reach the YOLO backend at ${getBackendUrl()}. ` +
        "Make sure the FastAPI server is running and EXPO_PUBLIC_YOLO_URL in .env matches your laptop's IP."
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson?.detail || '';
    } catch { }
    throw new Error(`Detection failed (HTTP ${response.status}): ${detail || 'Server error'}`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error('Unexpected response from detection server.');
  }

  return {
    detections: json.detections ?? [],
    count: json.count ?? 0,
    summary: json.summary ?? 'Detection complete.',
  };
}

