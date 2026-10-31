# NaviAble AI

AI-powered visual assistance application designed to help visually impaired users understand their surroundings.

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

### Run on Android / iOS (Expo Go)
1. Install **Expo Go** on your Android or iOS device.
2. Run `npx expo start`.
3. Scan the QR code displayed in the terminal using the Expo Go app (or device camera on iOS).
4. Tap **Open Camera** to grant camera permissions and capture an image, or **Upload Image** to select from your gallery.

### Run on Web
```bash
npx expo start --web
```
> Note: In web browsers, camera access requires HTTPS or localhost as per standard browser security policies.

## Permissions & Configuration

The app uses `app.json` to manage permissions:
- `CAMERA` (`NSCameraUsageDescription` / Android `CAMERA` permission): For capturing surroundings, text, and objects.
- `READ_MEDIA_IMAGES` / Photos (`NSPhotoLibraryUsageDescription`): For selecting photos from gallery.

## Structure

- `App.js` — Main dashboard, image preview state, and selection options.
- `src/components/CameraModal.js` — Accessible in-app camera viewfinder, capture, retake, and confirmation controls.
- `src/components/FeatureCard.js` — Reusable informational cards for roadmap features.
- `src/styles/theme.js` — Soft Sage & Warm Ivory theme tokens.
- `app.json` — Expo configuration with permissions for camera and gallery.
