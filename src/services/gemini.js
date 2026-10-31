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

const MODEL = 'gemini-3.5-flash';
const MAX_IMAGE_DIMENSION = 3072;
const MAX_INLINE_IMAGE_BYTES = 18 * 1024 * 1024;

/**
 * Returns a tailored prompt depending on whether the user requested
 * a general scene analysis or a prioritized OCR / signboard reading.
 */
function getPrompt(mode = 'general') {
  if (mode === 'ocr' || mode === 'text_focus') {
    return `You are an accessibility visual assistant for visually impaired users. Your primary task is to read all visible signs, text, signboards, labels, and printed or handwritten text in this image.

Extract and transcribe all readable text verbatim, preserving original wording. Do not invent, hallucinate, or guess words that are illegible. If text is partially obscured, blurry, or cutoff, state what is clearly readable and explicitly communicate uncertainty for unclear parts.

Respond in the following JSON format only, with no markdown fences or extra text:
{
  "scene": "A concise sentence describing where this text or signboard appears.",
  "objects": ["List of clearly visible objects in the scene."],
  "signsAndText": ["Exact verbatim wording of each readable sign, label, or text block."],
  "textNotes": "Factual note describing text legibility, whether any text is partially cut off or blurry, or note that no readable text was found.",
  "hazards": ["Any clearly visible obstacles or hazards directly near the pathway. Empty array if none."],
  "observations": "1-2 sentences on what a visually impaired person needs to know about this text and setting. Communicate uncertainty if lighting or angle impairs reading."
}`;
  }

  return `You are an accessibility assistant for a person who is blind or has low vision. Give a brief, useful account of what matters in this image. Use simple everyday English. Report only details that are clearly visible; never guess or present uncertainty as fact.

Keep the spoken response to about 30-40 words and roughly 10-15 seconds. Start with one short sentence summarizing the scene. Prioritize nearby safety issues, especially clearly visible obstacles, stairs, vehicles, or other hazards; do not omit an important warning to meet the word target. Mention at most 3 important objects, using their position in the scene when clear. Include readable text only when it matters for navigation or safety, and at most 2 short items. Avoid decorative details and unnecessary descriptions of colour, texture, shape, or background. Give up to 5 short, important observations; include fewer when fewer useful facts are clearly visible.

Respond in the following JSON format only, with no markdown fences or extra text:
{
  "scene": "A single concise factual sentence describing the overall scene or setting.",
  "objects": ["List each clearly visible object as a short phrase."],
  "signsAndText": ["List each clearly readable sign, label, or text verbatim. Empty array if none."],
  "textNotes": "Brief factual note on text clarity or uncertainty if text is blurry or distant. Empty string if text is clear or absent.",
  "hazards": ["List any clearly visible immediate obstacles or hazards (such as steps, curbs, wet floor, or blocked paths) only when actually visible. Empty array if none."],
  "observations": "2-3 sentences describing what a visually impaired person most needs to know about this scene to understand surroundings. Communicate uncertainty if lighting, blur, or distance obscures details."
}`;
}

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
 * @param {object} options - Options object, e.g. { mode: 'general' | 'ocr' }.
 */
export async function analyzeImageWithGemini(imageInput, options = {}) {
  const apiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'Gemini API key is not configured. Please save your API key in .env and restart Expo with `npx expo start -c`.',
    );
  }

  const { base64, mimeType } = await prepareImageForGemini(imageInput);
  const mode = options?.mode || 'general';
  const promptText = getPrompt(mode);
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
          { text: promptText },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error. Check your internet connection and try again.');
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
      textNotes: '',
      hazards: [],
      observations: '',
      mode,
    };
  }

  return {
    scene: typeof parsed.scene === 'string' ? parsed.scene : '',
    objects: Array.isArray(parsed.objects) ? parsed.objects : [],
    signsAndText: Array.isArray(parsed.signsAndText) ? parsed.signsAndText : [],
    textNotes: typeof parsed.textNotes === 'string' ? parsed.textNotes : '',
    hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [],
    observations: typeof parsed.observations === 'string' ? parsed.observations : '',
    mode,
  };
}
