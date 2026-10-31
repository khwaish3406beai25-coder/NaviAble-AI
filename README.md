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

<<<<<<< HEAD
1. Install **Expo Go** on your Android device.
2. From this project folder, run `npx expo start`.
3. Connect your computer and phone to the same Wi-Fi network, then scan the QR code shown in the terminal with Expo Go.
4. Use the **Home**, **Settings**, and **Help** tabs to move between screens.
5. In Settings, confirm the displayed text scale follows Android's system setting. For TalkBack, navigate the tabs and confirm the selected tab is announced.
6. From Home, tap **Choose Image** and grant photo access. Select a photo to view its preview; use **Change Image** or **Remove** to manage it.
7. To check denial handling, deny the photo access prompt and tap **Choose Image** again. The app explains why access is needed.
8. Cancel the system picker to return to the dashboard without changing the current selection.
=======
### Run on Web
```bash
npx expo start --web
```
> Note: In web browsers, camera access requires HTTPS or localhost as per standard browser security policies.
>>>>>>> origin/feature/image

## Permissions & Configuration

The app uses `app.json` to manage permissions:
- `CAMERA` (`NSCameraUsageDescription` / Android `CAMERA` permission): For capturing surroundings, text, and objects.
- `READ_MEDIA_IMAGES` / Photos (`NSPhotoLibraryUsageDescription`): For selecting photos from gallery.

## Structure

<<<<<<< HEAD
- `App.js` — dashboard, permission request, image selection and preview state.
- `src/navigation/NavigationShell.js` — accessible Home, Settings, and Help navigation.
- `src/components/ActionButton.js` — reusable accessible navigation button.
- `src/components/AppHeader.js` — shared page header for Settings and Help.
- `src/components/FeatureCard.js` — reusable informational feature card.
- `src/screens/SettingsScreen.js` — system text scaling and accessibility information.
- `src/screens/HelpScreen.js` — getting started and feature availability.
- `src/styles/theme.js` — shared warm lavender palette.
- `app.json` — Expo app settings and photo permission copy.

Text in the app follows Android's system text size. Settings shows the current system scale; app-specific text size preferences are not stored.

## Dependencies

- Expo SDK 58, React Native, React, and Expo Status Bar from the blank Expo template.
- `expo-image-picker` for device gallery access.

No backend or AI analysis is included in this phase. Selected images are previewed locally and no results are generated.
=======
- `App.js` — Main dashboard, image preview state, and selection options.
- `src/components/CameraModal.js` — Accessible in-app camera viewfinder, capture, retake, and confirmation controls.
- `src/components/FeatureCard.js` — Reusable informational cards for roadmap features.
- `src/styles/theme.js` — Soft Sage & Warm Ivory theme tokens.
- `app.json` — Expo configuration with permissions for camera and gallery.
>>>>>>> origin/feature/image
