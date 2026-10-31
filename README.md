# NaviAble AI

Phase 1 Expo frontend for an accessible visual assistance app. The dashboard and image gallery flow are implemented; object detection, text reading, and voice assistance are informational placeholders for future phases.

## Run the app

```bash
npm install
npx expo start
```

## Try it on Android

1. Install **Expo Go** on your Android device.
2. From this project folder, run `npx expo start`.
3. Connect your computer and phone to the same Wi-Fi network, then scan the QR code shown in the terminal with Expo Go.
4. Use the **Home**, **Settings**, and **Help** tabs to move between screens.
5. In Settings, confirm the displayed text scale follows Android's system setting. For TalkBack, navigate the tabs and confirm the selected tab is announced.
6. From Home, tap **Choose Image** and grant photo access. Select a photo to view its preview; use **Change Image** or **Remove** to manage it.
7. To check denial handling, deny the photo access prompt and tap **Choose Image** again. The app explains why access is needed.
8. Cancel the system picker to return to the dashboard without changing the current selection.

On Android, the permission prompt and native gallery are provided by Expo Image Picker. A simulator or Expo Go session is required to exercise that native flow; this workspace has no attached Android device.

## Structure

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
