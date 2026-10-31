# Foreground voice assistance on Android

NaviAble's voice session uses Android's SpeechRecognizer through `expo-speech-recognition`. Press **Start Voice Assistance** to grant microphone permission and begin foreground listening for the spoken phrase “Hey Navi”. This is phrase recognition performed by Android's speech service; it is not an offline keyword engine, does not guarantee always-on detection, and stops when NaviAble moves to the background or the screen session ends. Android's speech service may require network access and availability varies by device/provider.

## Android development build

Expo Go does not contain the native speech-recognition module. Build and install the project's Expo development app on an Android device:

```powershell
npm install
npx expo install --check
npx expo prebuild --platform android
npx expo run:android --device
```

On a later source change that affects native configuration, rebuild the app with `npx expo run:android --device`. Start Metro for the development client with `npx expo start --dev-client`.

Android asks for microphone permission when voice assistance starts and camera permission only after a recognized surroundings/read-text command opens the camera. If either permission is denied, allow it in Android Settings before retrying. The app's Android manifest declares `RECORD_AUDIO` and `CAMERA`; no background microphone service is configured.

## Demo sequence

1. Open NaviAble and tap **Start Voice Assistance**. Confirm the microphone permission prompt. The card announces that it is listening for “Hey Navi”.
2. Say “Hey Navi” or “Hi Navi”. Android recognition must return that phrase; NaviAble then speaks “How can I help you?” and starts command recognition as soon as the acknowledgment finishes.
3. Say a command after the prompt. “Open camera” opens the camera for manual capture. “Take a picture”, “Capture image”, “Detect my surroundings”, “Describe my surroundings”, “What is in front of me?”, and “What do you see?” automatically capture when the camera is ready and send the image to Gemini.
4. “Detect objects”, “Find objects”, “Identify objects around me”, or “What objects are nearby?” automatically capture and call the YOLO backend. Start it from `backend` with `uvicorn main:app --host 0.0.0.0 --port 8000`. For a physical phone, set `EXPO_PUBLIC_YOLO_URL` in the workspace `.env` to `http://<computer-LAN-IP>:8000`, then restart Metro. The `10.0.2.2` default works only from Android Emulator.
5. “Read text”, “Read this document”, “Read the sign”, or “What is written here?” captures an image and asks Gemini Vision to read visible text; the app has no separate OCR engine. The real Gemini response or YOLO detection summary appears on screen and is spoken by Expo Speech.
6. After a spoken result, NaviAble listens for another command without requiring another wake phrase. This command window ends after 15 seconds of silence, after which wake phrase listening resumes. Say “Start listening again” to reopen the command listener. Use **Repeat Response**, **Stop Speaking**, or speak “Stop assistance”.

Use **Stop Assistance** to end the session. Leaving the foreground ends microphone use; users must explicitly tap Start again when they return. Voice recognition is provider dependent and should be verified on the intended Android phone before a live demo. AI descriptions can be wrong and are not navigation or road-crossing instructions.
