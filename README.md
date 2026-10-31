# NaviAble AI

AI-powered visual assistance application designed to help visually impaired users understand their surroundings.

## Features

- **Live Camera Capture:** Open the camera to aim at objects, signboards, or surroundings. Includes an accessible viewfinder, front/rear camera switching, photo capture, review, retake, and confirmation.
- **Gallery Upload:** Select images from the device photo library.
- **Image Preview & Management:** Preview selected or captured images on the dashboard, change the image, retake it, or remove it.
- **Gemini Vision Analysis:**
  - **Scene & Object Analysis:** Structured identification of scene setting, clearly visible objects, and key observations for visually impaired navigation.
  - **Prioritized OCR & Signboard Reading:** Dedicated mode that extracts and presents readable signs, labels, and text verbatim, communicating uncertainty when text is blurred or obscured.
  - **Obstacle & Hazard Identification:** Reports visible nearby obstacles (e.g. stairs, curbs, wet floor) only when actually visible, avoiding fabricated distance or safety guarantees.
- **Text-to-Speech (TTS) Spoken Output:**
  - Powered by `expo-speech` (`~58.0.3`) across iOS, Android, and Web.
  - Accessible **"Listen to Result"** button to hear full analysis aloud.
  - **"Read Text"** button to hear recognized text and signboards verbatim.
  - Dedicated **"Stop Speaking"** control to interrupt and stop speech.
  - Overlap prevention and automatic speech cleanup on navigation or component unmount.
- **Voice Activation ("Hey NaviAble"):**
  - Microphone listening lifecycle manager with permission safeguards and app-backgrounding pause/resume.
  - Action selection when wake word is triggered: **Open Camera**, **Gallery**, **Analyse Image**, **Listen to Analysis**, and **Read Text**.
  - Strict safety: Never captures photos or calls Gemini without explicit user confirmation.
- **Soft Sage & Warm Ivory Theme:**
  - Primary: `#315F4C`
  - Secondary: `#789985`
  - Background: `#F6F7F1`
  - Cards: `#FFFFFF`
  - Accent: `#E4EDE5`
  - Text: `#24352D`
- **Accessibility:** Screen-reader announcements (`AccessibilityInfo.announceForAccessibility`), accessible roles and labels across all controls, and system text-size scaling.

## Run the App

From the project directory, run:

```bash
cd NaviAble-AI
npm install
npx expo start
```

### Run on Android / iOS (Expo Go)
1. Install **Expo Go** on your Android or iOS device.
2. Run `npx expo start`.
3. Scan the QR code displayed in the terminal using the Expo Go app (or device camera on iOS).
4. Tap **Open Camera** to capture an image, or **Upload Image** to select from your gallery.
5. Tap **Analyse Scene & Objects** or **Read Signs & Text** to run Gemini vision analysis.
6. Tap **Listen to Result** or **Read Text** to hear results read aloud via Text-to-Speech.
7. Tap **Enable** under Voice Assistance to activate voice activation controls.

### Run on Web
```bash
npx expo start --web
```
> Note: In web browsers, camera and microphone access require HTTPS or localhost as per standard browser security policies. Web Speech Recognition is natively supported in Chrome and Edge.

## Gemini API Setup (for Image Analysis)

1. Get a free API key at <https://aistudio.google.com/app/apikey>.
2. Create a `.env` file in `NaviAble-AI/` (use `.env.example` as a template):

```bash
EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
```

3. Restart the Expo server (`npx expo start -c`).

> **Security note:** Client-side environment variables (`EXPO_PUBLIC_`) are embedded in the compiled application bundle at build time and are accessible to anyone inspecting the client app binary. For production deployments, all Gemini requests should be proxied through a secure backend service so the API secret is never shipped to clients.

## Permissions & Configuration

The app uses `app.json` to manage permissions:
- `CAMERA` (`NSCameraUsageDescription` / Android `CAMERA` permission): For capturing surroundings, text, and objects.
- `RECORD_AUDIO` (`NSMicrophoneUsageDescription` / Android `RECORD_AUDIO` permission): For voice commands and wake-word activation.
- `READ_MEDIA_IMAGES` / Photos (`NSPhotoLibraryUsageDescription`): For selecting photos from gallery.

## Structure

- `App.js` — Main dashboard, image preview state, camera/gallery actions, analysis triggers, and voice activation controls.
- `src/navigation/NavigationShell.js` — Accessible Home, Settings, and Help navigation shell.
- `src/components/ActionButton.js` — Reusable accessible navigation button.
- `src/components/AppHeader.js` — Shared page header for secondary screens.
- `src/screens/SettingsScreen.js` — System text scaling and accessibility settings.
- `src/screens/HelpScreen.js` — Getting started guide and feature roadmap.
- `src/services/speechService.js` — Text-to-Speech service using `expo-speech`, formatted speech builders, overlap prevention, and hooks.
- `src/services/gemini.js` — Gemini vision AI integration supporting general scene analysis and prioritized OCR text-reading modes.
- `src/components/AnalysisResult.js` — Accessible analysis display with TTS playback controls ("Listen to Result", "Read Text", "Stop Speaking").
- `src/components/VoiceActivationCard.js` — Voice assistant card with action choices ("Open Camera", "Gallery", "Analyse Image", "Listen to Analysis", "Read Text").
- `src/services/voiceActivation.js` — Wake-word detection lifecycle manager, permissions, and app backgrounding handler.
- `src/components/CameraModal.js` — Accessible camera viewfinder and review flow.
- `src/styles/theme.js` — Theme color definitions.
- `app.json` — Expo configuration with camera and microphone permissions.
