import * as ImagePicker from 'expo-image-picker';
import { CaptureError } from './upload-file-store.ts';
import type { SelectedImage } from './upload-file-store.ts';
export async function chooseImage(
  source: 'camera' | 'gallery',
): Promise<SelectedImage | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new CaptureError('capture_camera_denied');
  }
  // Android's system photo picker grants access to the chosen item without broad gallery permission.
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: false,
    base64: false,
  };
  try {
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return null;
    const image = result.assets[0];
    if (!image) throw new CaptureError('capture_selection_failed');
    return { uri: image.uri, width: image.width, height: image.height };
  } catch (error) {
    throw error instanceof CaptureError
      ? error
      : new CaptureError('capture_selection_failed');
  }
}
