/**
 * Gemini vision analysis service.
 *
 * SECURITY NOTE: EXPO_PUBLIC_ variables are embedded in the client
 * bundle at build time and are NOT secret. Anyone who has the app
 * binary can extract this key. For a production app, proxy all
 * Gemini requests through your own backend so the key never ships
 * to the client. This direct approach is acceptable for prototypes
 * and local development only.
 *
 * Required env variable (create a .env file in the project root):
 *   EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
 */
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';
import { finishVoiceStage, startVoiceStage } from './voicePerformance';

const MODEL = 'gemini-3.5-flash';
const MAX_IMAGE_DIMENSION = 3072;
const MAX_INLINE_IMAGE_BYTES = 18 * 1024 * 1024;

const PROMPT = `You are an accessibility assistant for a person who is blind or has low vision. Give a brief, useful account of what matters in this image. Use simple everyday English. Report only details that are clearly visible; never guess or present uncertainty as fact.

Keep the spoken response to about 30-40 words and roughly 10-15 seconds. Start with one short sentence summarizing the scene. Prioritize nearby safety issues, especially clearly visible obstacles, stairs, vehicles, or other hazards; do not omit an important warning to meet the word target. Mention at most 3 important objects, using their position in the scene when clear. Include readable text only when it matters for navigation or safety, and at most 2 short items. Avoid decorative details and unnecessary descriptions of colour, texture, shape, or background. Give up to 5 short, important observations; include fewer when fewer useful facts are clearly visible.

Respond in the following JSON format only, with no markdown fences or extra text. Keep the field names and types unchanged:
{
  "scene": "One short sentence summarizing the scene.",
  "objects": ["Up to 3 important visible objects, with position when clear; use an empty array if none matter."],
  "signsAndText": ["Up to 2 readable text items relevant to navigation or safety; use an empty array if none matter."],
  "observations": "Up to 5 short, useful facts, with clearly visible safety concerns first. Use simple words and do not repeat details unnecessarily."
}`;

const READ_TEXT_INSTRUCTION = `The user specifically asked to read visible text. Prioritize accurately transcribing clearly readable signs, labels, and short text in signsAndText. If no text is clearly readable, say so in observations. Do not infer text that is not visible.`;

/**
 * Sanitizes an error message to prevent accidental credential leakage.
 */
function sanitizeMessage(message, apiKey) {
  if (!message || typeof message !== 'string') return '';
  if (apiKey && apiKey.length > 5) {
    return message.split(apiKey).join('[REDACTED_KEY]');
  }
  return message;
}

/**
 * Derives a MIME type from a URI string or asset.
 */
function getMimeType(imageInput) {
  if (imageInput?.mimeType) return imageInput.mimeType;
  const uri = typeof imageInput === 'string' ? imageInput : imageInput?.uri || '';
  const dataUriMimeType = uri.match(/^data:(image\/[\w.+-]+);base64,/i)?.[1];
  if (dataUriMimeType) return dataUriMimeType.toLowerCase();
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function getBase64FromDataUri(uri) {
  const comma = uri.indexOf(',');
  return comma >= 0 ? uri.slice(comma + 1).replace(/\s/g, '') : '';
}

/**
 * Reads local camera/gallery URIs through Expo's native image pipeline,
 * downsizes very large photos, and returns a JPEG payload for Gemini.
 */
async function prepareImageForGemini(imageInput) {
  const uri = typeof imageInput === 'string' ? imageInput : imageInput?.uri;
  const suppliedBase64 = typeof imageInput === 'object' ? imageInput?.base64 : null;

  if (uri?.startsWith('data:')) {
    const base64 = getBase64FromDataUri(uri);
    if (!base64) throw new Error('The selected image data is empty. Please choose the image again.');
    return { base64, mimeType: getMimeType(uri) };
  }

  // Camera/gallery callers already prepare high-quality JPEG base64 natively.
  // Reuse it when dimensions are within the existing API image limit, avoiding
  // a second decode/encode pass on the device.
  if (uri && suppliedBase64) {
    const width = Number(imageInput?.width) || 0;
    const height = Number(imageInput?.height) || 0;
    if (Math.max(width, height) <= MAX_IMAGE_DIMENSION) {
      const base64 = suppliedBase64.replace(/^data:[^,]+,/, '').replace(/\s/g, '');
      if (base64.length * 0.75 <= MAX_INLINE_IMAGE_BYTES) {
        return { base64, mimeType: getMimeType(imageInput) };
      }
    }
  }

  if (uri) {
    try {
      const width = Number(imageInput?.width) || 0;
      const height = Number(imageInput?.height) || 0;
      const longestSide = Math.max(width, height);
      const actions = [];
      if (longestSide > MAX_IMAGE_DIMENSION && width > 0 && height > 0) {
        const scale = MAX_IMAGE_DIMENSION / longestSide;
        actions.push({
          resize: {
            width: Math.round(width * scale),
            height: Math.round(height * scale),
          },
        });
      }

      const prepared = await ImageManipulator.manipulateAsync(uri, actions, {
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.9,
        base64: true,
      });
      const base64 = prepared.base64?.replace(/\s/g, '');
      if (!base64) throw new Error('Image conversion returned no data.');
      if (base64.length * 0.75 > MAX_INLINE_IMAGE_BYTES) {
        throw new Error('The prepared image is still too large to send. Please capture a smaller image.');
      }
      return { base64, mimeType: 'image/jpeg' };
    } catch (error) {
      if (error.message?.includes('still too large')) throw error;
      throw new Error('Could not read or prepare this image on the device. Please capture or select it again.');
    }
  }

  if (suppliedBase64) {
    const base64 = suppliedBase64.replace(/^data:[^,]+,/, '').replace(/\s/g, '');
    if (base64.length * 0.75 > MAX_INLINE_IMAGE_BYTES) {
      throw new Error('The image is too large to send. Please capture or select a smaller image.');
    }
    return { base64, mimeType: getMimeType(imageInput) };
  }

  throw new Error('No image data was provided. Please capture or select an image again.');
}

/**
 * Sends the selected image to the Gemini vision API and returns a
 * structured analysis object.
 *
 * @param {object|string} imageInput - Camera or ImagePicker asset with a local URI and optional dimensions/base64.
 */
export async function analyzeImageWithGemini(imageInput, options = {}) {
  const apiKey = (
    Constants.expoConfig?.extra?.naviable?.geminiApiKey
    || process.env.EXPO_PUBLIC_GEMINI_API_KEY
    || ''
  ).trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'Gemini API key is not configured. Please save your API key in .env and restart Expo with `npx expo start -c`.',
    );
  }

  startVoiceStage('gemini-image-preparation');
  let preparedImage;
  try {
    preparedImage = await prepareImageForGemini(imageInput);
    finishVoiceStage('gemini-image-preparation', { result: 'success' });
  } catch (error) {
    finishVoiceStage('gemini-image-preparation', { result: 'error', message: error?.message });
    throw error;
  }
  const { base64, mimeType } = preparedImage;
  if (__DEV__) console.info('[VoicePerf] Gemini image ready', { timestamp: new Date().toISOString(), imageBytes: Math.round(base64.length * 0.75), mimeType });
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          { text: options.readText ? `${PROMPT}\n\n${READ_TEXT_INSTRUCTION}` : PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  let response;
  const requestController = new AbortController();
  const requestTimeout = setTimeout(() => requestController.abort(), 25000);
  startVoiceStage('gemini-request', { model: MODEL, imageBytes: Math.round(base64.length * 0.75) });
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: requestController.signal,
    });
    finishVoiceStage('gemini-request', { status: response.status });
  } catch (error) {
    finishVoiceStage('gemini-request', { result: 'error', message: error?.message });
    if (error?.name === 'AbortError') {
      throw new Error('Gemini request timed out after 25 seconds. Check your connection and try again.');
    }
    throw new Error('Network error. Check your internet connection and try again.');
  } finally {
    clearTimeout(requestTimeout);
  }

  if (!response.ok) {
    let rawError = '';
    try {
      const errJson = await response.json();
      rawError = errJson?.error?.message || '';
    } catch { }

    const sanitizedError = sanitizeMessage(rawError, apiKey);
    const errorDetail = sanitizedError || response.statusText || 'No error details returned.';

    if (response.status === 429) {
      throw new Error(`API quota exceeded (HTTP 429): ${errorDetail}`);
    }
    if (response.status === 400 || response.status === 403) {
      if (errorDetail.toLowerCase().includes('api key') || errorDetail.toLowerCase().includes('key not valid')) {
        throw new Error(`Authentication error (HTTP ${response.status}): ${errorDetail}. Check your key in .env and restart Expo.`);
      }
      throw new Error(`Gemini rejected the request (HTTP ${response.status}): ${errorDetail}`);
    }
    throw new Error(`Analysis failed (HTTP ${response.status}): ${errorDetail}. Please try again.`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error('Received an unexpected response from the analysis service.');
  }

  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip any accidental markdown fences before parsing.
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Gemini occasionally returns prose instead of JSON.
    // Surface the whole response as the scene description.
    return {
      scene: cleaned || 'Analysis complete, but the result format was unexpected.',
      objects: [],
      signsAndText: [],
      observations: '',
    };
  }

  return {
    scene: typeof parsed.scene === 'string' ? parsed.scene : '',
    objects: Array.isArray(parsed.objects) ? parsed.objects : [],
    signsAndText: Array.isArray(parsed.signsAndText) ? parsed.signsAndText : [],
    observations: typeof parsed.observations === 'string' ? parsed.observations : '',
  };
}
