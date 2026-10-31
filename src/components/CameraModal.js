import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../styles/theme';

/**
 * CameraModal provides an accessible in-app camera interface.
 * Allows users to point the camera at surroundings, take a photo,
 * review/retake it, and confirm the photo to return to the home screen.
 */
export function CameraModal({ visible, onClose, onCaptureConfirmed, onCaptureError, onChooseFromGallery, takePhotoRef }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  const cameraRef = useRef(null);
  const captureErrorCallback = useRef(onCaptureError);
  captureErrorCallback.current = onCaptureError;

  const requestCameraPermission = async () => {
    try {
      const result = await requestPermission();
      if (!result?.granted) {
        captureErrorCallback.current?.('Camera permission is required to capture a photo.');
      }
    } catch {
      const message = 'Unable to request camera permission.';
      setCameraError(message);
      captureErrorCallback.current?.(message);
    }
  };

  // When modal visibility changes, reset state and announce to screen readers
  useEffect(() => {
    if (visible) {
      setCapturedPhoto(null);
      setCameraError(null);
      setIsCameraReady(false);

      AccessibilityInfo.announceForAccessibility(
        'Camera opened. Point your camera at an object, signboard, or surroundings, then tap Capture Image.'
      );

      // If permissions not yet granted, prompt for them
      if (!permission?.granted) {
        requestCameraPermission();
      }
    } else {
      // Clean up when modal closes
      setCapturedPhoto(null);
      setCameraError(null);
      setIsCameraReady(false);
    }
  }, [visible]);

  const handleClose = () => {
    setCapturedPhoto(null);
    setCameraError(null);
    setIsCameraReady(false);
    AccessibilityInfo.announceForAccessibility('Camera closed.');
    onClose();
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !isCameraReady || isCapturing) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo || !photo.uri) {
        throw new Error('No image data returned from camera.');
      }

      setCapturedPhoto(photo);
      AccessibilityInfo.announceForAccessibility(
        'Photo captured. Review your photograph. Tap Retake Photo to try again, or Use Photo to confirm.'
      );
    } catch (err) {
      onCaptureError?.('Could not capture photograph. Please point camera steadily and try again.');
      Alert.alert(
        'Capture Failed',
        'Could not capture photograph. Please point camera steadily and try again.'
      );
    } finally {
      setIsCapturing(false);
    }
  };

  // Expose takePhoto imperatively so voice commands can trigger capture
  useEffect(() => {
    if (takePhotoRef) takePhotoRef.current = takePhoto;
    return () => { if (takePhotoRef) takePhotoRef.current = null; };
  });

  const handleRetake = () => {
    setCapturedPhoto(null);
    setIsCameraReady(false);
    AccessibilityInfo.announceForAccessibility('Photo discarded. Live camera active.');
  };

  const handleConfirm = () => {
    if (!capturedPhoto) return;
    const confirmed = {
      uri: capturedPhoto.uri,
      width: capturedPhoto.width,
      height: capturedPhoto.height,
    };
    AccessibilityInfo.announceForAccessibility('Photo confirmed. Returned to home screen.');
    handleClose();
    onCaptureConfirmed(confirmed);
  };

  const handleGalleryFallback = () => {
    handleClose();
    if (onChooseFromGallery) {
      onChooseFromGallery();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      accessible={false}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* 1. Permission Denied or Not Yet Granted State */}
        {!permission?.granted && !cameraError && (
          <View style={styles.permissionCard}>
            <View style={styles.permissionIconBadge} accessibilityElementsHidden>
              <Text style={styles.permissionIconText}>📷</Text>
            </View>
            <Text style={styles.permissionTitle}>Camera Access Needed</Text>
            <Text style={styles.permissionBody}>
              NaviAble AI needs camera permission to capture objects, text, and surroundings for visual assistance.
            </Text>
            {Platform.OS === 'web' && (
              <Text style={styles.webNote}>
                Note: In web browsers, camera access requires HTTPS or localhost.
              </Text>
            )}

            <View style={styles.permissionActions}>
              <Pressable
                onPress={requestCameraPermission}
                accessibilityRole="button"
                accessibilityLabel="Grant Camera Permission"
                accessibilityHint="Asks device or browser for permission to use camera"
                style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
              >
                <Text style={styles.primaryActionText}>Grant Permission</Text>
              </Pressable>

              <Pressable
                onPress={handleGalleryFallback}
                accessibilityRole="button"
                accessibilityLabel="Choose from Gallery instead"
                accessibilityHint="Opens photo library instead of camera"
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryActionText}>Choose from Gallery</Text>
              </Pressable>

              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel and Close"
                style={({ pressed }) => [styles.cancelAction, pressed && styles.pressed]}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 2. Camera Error or Unsupported State */}
        {cameraError && (
          <View style={styles.permissionCard}>
            <View style={[styles.permissionIconBadge, { backgroundColor: '#FBEBEB' }]} accessibilityElementsHidden>
              <Text style={[styles.permissionIconText, { color: colors.error }]}>⚠</Text>
            </View>
            <Text style={styles.permissionTitle}>Camera Unavailable</Text>
            <Text style={styles.permissionBody}>{cameraError}</Text>
            {Platform.OS === 'web' && (
              <Text style={styles.webNote}>
                Tip: Ensure your browser has access to your webcam and that the app is running on localhost or HTTPS.
              </Text>
            )}

            <View style={styles.permissionActions}>
              <Pressable
                onPress={handleGalleryFallback}
                accessibilityRole="button"
                accessibilityLabel="Upload Image from Gallery"
                style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
              >
                <Text style={styles.primaryActionText}>Choose from Gallery</Text>
              </Pressable>

              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close Camera"
                style={({ pressed }) => [styles.cancelAction, pressed && styles.pressed]}
              >
                <Text style={styles.cancelActionText}>Close</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 3. Review Mode (Photo captured, awaiting user retake/confirm) */}
        {permission?.granted && !cameraError && capturedPhoto && (
          <View style={styles.reviewContainer}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>Review Photograph</Text>
              <Text style={styles.reviewSubtitle}>Confirm this image or retake it</Text>
            </View>

            <View style={styles.previewContainer}>
              <Image
                source={{ uri: capturedPhoto.uri }}
                style={styles.reviewImage}
                resizeMode="contain"
                accessibilityLabel="Captured photograph preview"
              />
            </View>

            <View style={styles.reviewActions}>
              <Pressable
                onPress={handleRetake}
                accessibilityRole="button"
                accessibilityLabel="Retake Photo"
                accessibilityHint="Discards this photo and returns to the live camera viewfinder"
                style={({ pressed }) => [styles.retakeButton, pressed && styles.pressed]}
              >
                <Text style={styles.retakeButtonText}>Retake Photo</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirm}
                accessibilityRole="button"
                accessibilityLabel="Use Photo"
                accessibilityHint="Confirms this photo and uses it on the home screen"
                style={({ pressed }) => [styles.usePhotoButton, pressed && styles.pressed]}
              >
                <Text style={styles.usePhotoButtonText}>Use Photo</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 4. Live Camera Viewfinder */}
        {permission?.granted && !cameraError && !capturedPhoto && (
          <View style={styles.cameraWrapper}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing={facing}
              mode="picture"
              onCameraReady={() => setIsCameraReady(true)}
              onMountError={(error) => {
                const message = 'Camera failed to start. Please verify device permissions and hardware.';
                setCameraError(message);
                onCaptureError?.(message);
              }}
            />

            {/* Top Bar with Controls */}
            <View style={styles.topBar}>
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close Camera"
                accessibilityHint="Returns to home screen without taking a photo"
                style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
              >
                <Text style={styles.topButtonIcon}>✕</Text>
                <Text style={styles.topButtonText}>Close</Text>
              </Pressable>

              <Pressable
                onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${facing === 'back' ? 'front' : 'back'} camera`}
                accessibilityHint="Toggles between rear and front facing camera"
                style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
              >
                <Text style={styles.topButtonIcon}>⇄</Text>
                <Text style={styles.topButtonText}>{facing === 'back' ? 'Front' : 'Back'}</Text>
              </Pressable>
            </View>

            {/* Viewfinder Target Frame Guide */}
            <View
              style={styles.reticleContainer}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View style={styles.reticleFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.guideBadge}>
                <Text style={styles.guideBadgeText}>Point at object, text, or surroundings</Text>
              </View>
            </View>

            {/* Bottom Controls with Shutter Button */}
            <View style={styles.bottomBar}>
              <Pressable
                onPress={takePhoto}
                disabled={!isCameraReady || isCapturing}
                accessibilityRole="button"
                accessibilityLabel="Capture Image"
                accessibilityHint="Takes a photograph of what the camera is pointing at"
                style={({ pressed }) => [
                  styles.shutterButton,
                  pressed && styles.shutterPressed,
                  (!isCameraReady || isCapturing) && styles.shutterDisabled,
                ]}
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.shutterInner} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    zIndex: 10,
  },
  topButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  topButtonIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 6,
    fontWeight: '700',
  },
  topButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  reticleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleFrame: {
    width: 260,
    height: 320,
    position: 'relative',
    borderRadius: 16,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  guideBadge: {
    marginTop: 22,
    backgroundColor: 'rgba(36, 53, 45, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(228, 237, 229, 0.3)',
  },
  guideBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomBar: {
    paddingBottom: 36,
    paddingTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 10,
  },
  shutterButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  shutterDisabled: {
    opacity: 0.5,
  },
  reviewContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  reviewHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
  },
  reviewTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  reviewSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 4,
  },
  previewContainer: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
  },
  retakeButton: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  usePhotoButton: {
    flex: 1,
    height: 52,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usePhotoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  permissionCard: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionIconText: {
    fontSize: 32,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.secondaryText,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 16,
  },
  webNote: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.secondaryText,
    textAlign: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 22,
    maxWidth: 320,
  },
  permissionActions: {
    width: '100%',
    maxWidth: 320,
    gap: 10,
  },
  primaryAction: {
    height: 52,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryAction: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelAction: {
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionText: {
    color: colors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
});

