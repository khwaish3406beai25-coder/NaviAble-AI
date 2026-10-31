# NaviAble AI

Phase 1 Expo frontend for an accessible visual assistance app. The dashboard and image gallery flow are implemented. Gemini-powered image analysis (object detection, sign reading, scene description) is now live.

## Features

- **Live Camera Capture:** Open the camera to aim at objects, signboards, or surroundings. Includes an accessible viewfinder guide, camera switching (rear/front), capture button, photo review, and retake/confirm flow.
- **Gallery Upload:** Select images from your device photo library.
- **Image Preview & Management:** View selected/captured images directly on the dashboard, with options to retake with camera, change from gallery, or remove.
- **Soft Sage & Warm Ivory Theme:**
  - Primary: `#315F4C`
  - Secondary: `#789985`
  - Background: `#F6F7F1`
  - Cards: `#FFFFFF`
  - Accent: `#E4EDE5`
  - Text: `#24352D`
- **Accessibility:** Screen-reader announcements (`AccessibilityInfo.announceForAccessibility`), accessible roles and labels on all camera and gallery controls.
- **Future Capabilities (Phase 1 Placeholders):** Object Detection, Text Reading (OCR), and Voice Assistance.

## Run the App

Navigate into the project directory and run:

```bash
cd NaviAble-AI
npm install
npx expo start
```

## Gemini API setup (required for image analysis)

1. Get a free API key at <https://aistudio.google.com/app/apikey>.
2. Copy `.env` in the project root and set your key:

```bash
# .env  — never commit this file
EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
```

3. Restart the Expo dev server (`Ctrl-C` then `npx expo start`).

> **Security note:** `EXPO_PUBLIC_` variables are embedded in the compiled app
> bundle at build time and are **not secret**. Anyone with the APK/IPA can read
> the value. For a production app, proxy all Gemini requests through your own
> backend so the key never ships to the client. This direct approach is
> acceptable for prototypes and local development only.

## Try it on Android

<<<<<<< HEAD
1. Install **Expo Go** on your Android device.
2. From this project folder, run `npx expo start`.
3. Connect your computer and phone to the same Wi-Fi network, then scan the QR code shown in the terminal with Expo Go.
4. Tap **Choose Image** and grant photo access. Select a photo to view its preview.
5. Tap **Analyse Image** to send the image to Gemini. Results appear below the image card once analysis completes.
6. Tap **Analyse Again** to re-analyse the same image, or **Change Image** to pick a new one.

## Structure

- `App.js` — dashboard, permission request, image selection, analysis trigger and state.
- `src/services/gemini.js` — Gemini API call: base64 encodes the image and returns structured JSON.
- `src/components/AnalysisResult.js` — displays analysis in four sections: Scene, Objects, Signs & Text, Observations.
- `src/components/FeatureCard.js` — reusable informational feature card.
- `src/styles/theme.js` — shared warm lavender palette.
- `app.json` — Expo app settings and photo permission copy.
- `.env` — API key (gitignored, never commit).

## Dependencies

- Expo SDK 58, React Native, React, and Expo Status Bar from the blank Expo template.
- `expo-image-picker` for device gallery access and base64 encoding.
- Google Gemini API (`gemini-3.5-flash`) via `fetch` — no extra npm package required.

## Known limitations

- The API key is embedded in the client bundle (see security note above).
- Image analysis requires an internet connection.
- Very large images may take several seconds to encode and transmit.
- Live camera analysis and voice output are not included in this phase.
