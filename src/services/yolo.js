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

const DEFAULT_URL = 'http://127.0.0.1:8000';

/**
 * Returns the base backend URL, trimming any trailing slash.
 */
function getBackendUrl() {
  const raw = (process.env.EXPO_PUBLIC_YOLO_URL || DEFAULT_URL).trim();
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/**
 * Converts an image URI to a base64 string (no data-URL prefix).
 * Reuses the same fetch/blob/FileReader approach used by gemini.js.
 *
 * @param {string} uri
 * @returns {Promise<string>} raw base64 string
 */
async function uriToBase64(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') {
        // Strip "data:<mime>;base64," prefix
        resolve(dataUrl.split(',')[1]);
      } else {
        reject(new Error('Failed to parse image data'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

  // Prefer pre-computed base64 (from gallery pick); fall back to fetch conversion.
  let base64 = typeof imageInput === 'object' ? imageInput?.base64 ?? null : null;
  const mimeType =
    imageInput?.mimeType ||
    (uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg');

  if (!base64) {
    try {
      base64 = await uriToBase64(uri);
    } catch {
      throw new Error('Could not read image data for object detection.');
    }
  }

  const url = `${getBackendUrl()}/detect`;

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
    });
  } catch {
    throw new Error(
      `Cannot reach the YOLO backend at ${getBackendUrl()}. ` +
        'Make sure the FastAPI server is running and EXPO_PUBLIC_YOLO_URL is set to your laptop\'s LAN IP in .env.'
    );
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
