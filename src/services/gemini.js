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

const MODEL = 'gemini-3.5-flash';

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

  return `You are an accessibility assistant for visually impaired users. Carefully examine this image and provide a structured, factual analysis. Only describe what is clearly visible. Do not guess, invent details, or fabricate distances or safety guarantees.

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
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Converts a URI to base64 using standard fetch/blob and FileReader.
 * Works across Web, Android, and iOS without needing native file-system packages.
 */
async function uriToBase64Fallback(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') {
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to parse image data'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sends the selected image to the Gemini vision API and returns a
 * structured analysis object.
 *
 * @param {object|string} imageInput - Either an ImagePicker asset { uri, base64, mimeType } or a uri string.
 * @param {object} [options] - Options such as { mode: 'general' | 'ocr' }
 */
export async function analyzeImageWithGemini(imageInput, options = {}) {
  const apiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'Gemini API key is not configured. Please save your API key in .env and restart Expo with `npx expo start -c`.',
    );
  }

  const uri = typeof imageInput === 'string' ? imageInput : imageInput?.uri;
  let base64 = typeof imageInput === 'object' ? imageInput?.base64 : null;
  const mimeType = getMimeType(imageInput);

  if (!base64 && uri) {
    try {
      base64 = await uriToBase64Fallback(uri);
    } catch {
      throw new Error('Could not read the selected image. Please try selecting it again.');
    }
  }

  if (!base64) {
    throw new Error('Could not read image data. Please choose another image.');
  }

  const mode = options?.mode || 'general';
  const promptText = getPrompt(mode);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
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
    } catch {}

    const sanitizedError = sanitizeMessage(rawError, apiKey);

    if (response.status === 429) {
      throw new Error('API quota exceeded. Please wait a moment and try again.');
    }
    if (response.status === 400 || response.status === 403) {
      if (
        sanitizedError.toLowerCase().includes('api key') ||
        sanitizedError.toLowerCase().includes('key not valid')
      ) {
        throw new Error(
          `Authentication error (HTTP ${response.status}): ${sanitizedError}. Check your key in .env and restart Expo.`
        );
      }
      throw new Error(
        sanitizedError || `Request rejected (HTTP ${response.status}). Check image format or prompt.`
      );
    }
    throw new Error(
      `Analysis failed (HTTP ${response.status}): ${sanitizedError || 'Service unavailable'}. Please try again.`
    );
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
