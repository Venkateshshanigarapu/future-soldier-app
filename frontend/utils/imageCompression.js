import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/**
 * Compress and validate image for upload
 * @param {Object} options - Configuration options
 * @param {number} options.minSizeBytes - Minimum size in bytes (default: 10KB)
 * @param {number} options.maxSizeBytes - Maximum size in bytes (default: 100KB)
 * @param {number} options.initialQuality - Initial compression quality (default: 0.7)
 * @param {number} options.maxAttempts - Maximum compression attempts (default: 5)
 * @param {Array}  options.aspect - Image aspect ratio (default: [1, 1])
 * @param {boolean} options.allowsEditing - Allow user to edit image (default: true)
 * @returns {Promise<Object|null>} - Compressed image asset or null if cancelled/failed
 */
export const compressImageForUpload = async (options = {}) => {
  const {
    minSizeBytes = 10 * 1024,   // 10 KB default minimum
    maxSizeBytes = 50 * 1024,   // 50 KB default maximum
    initialQuality = 0.7,
    maxAttempts = 5,
    aspect = [1, 1],
    allowsEditing = true
  } = options;

  try {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need access to your photo library to select an image.');
      return null;
    }

    let quality = initialQuality;
    let selectedAsset = null;

    // --- Step 1: Pick image at current quality ---
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing,
      aspect,
      quality,
      base64: true,
    });

    if (result.canceled) return null;

    selectedAsset = result.assets && result.assets[0];
    if (!selectedAsset || !selectedAsset.base64) {
      Alert.alert('Error', 'Could not read selected image.');
      return null;
    }

    // --- Step 2: Check minimum size ---
    const initialBytes = (selectedAsset.base64.length * 3) / 4;
    const initialKB = Math.round(initialBytes / 1024);

    if (initialBytes < minSizeBytes) {
      Alert.alert(
        'Image Too Small',
        `The selected image is too small (${initialKB} KB). Please select an image that is at least ${Math.round(minSizeBytes / 1024)} KB.`
      );
      return null;
    }

    // --- Step 3: Iteratively reduce quality until within maxSizeBytes ---
    let attempts = 0;
    let compressedAsset = selectedAsset;

    while (attempts < maxAttempts) {
      const base64Bytes = (compressedAsset.base64.length * 3) / 4;
      const sizeKB = Math.round(base64Bytes / 1024);

      console.log(`[ImageCompression] Attempt ${attempts + 1}: quality=${quality.toFixed(2)}, size=${sizeKB} KB`);

      if (base64Bytes <= maxSizeBytes) {
        // Within limit — final check for minimum
        if (base64Bytes < minSizeBytes) {
          Alert.alert(
            'Image Too Small After Compression',
            `The image became too small (${sizeKB} KB) after compression. Please choose a higher-quality source image between ${Math.round(minSizeBytes / 1024)} KB and ${Math.round(maxSizeBytes / 1024)} KB.`
          );
          return null;
        }
        return compressedAsset;
      }

      // Still too large — reduce quality and re-pick
      quality = Math.max(0.1, quality - 0.15);
      attempts++;

      if (attempts < maxAttempts) {
        const newResult = await ImagePicker.launchImageLibraryAsync({
          allowsEditing,
          aspect,
          quality,
          base64: true,
        });

        if (newResult.canceled) return null;
        compressedAsset = newResult.assets && newResult.assets[0];
        if (!compressedAsset || !compressedAsset.base64) {
          Alert.alert('Error', 'Could not read selected image.');
          return null;
        }
      }
    }

    // After all attempts, still too large
    const finalBytes = (compressedAsset.base64.length * 3) / 4;
    const finalKB = Math.round(finalBytes / 1024);
    Alert.alert(
      'Image Too Large',
      `Could not compress the image to under ${Math.round(maxSizeBytes / 1024)} KB (current: ${finalKB} KB). Please choose a smaller or lower-resolution photo.`
    );
    return null;

  } catch (error) {
    console.error('[ImageCompression] Error:', error);
    Alert.alert('Error', 'Failed to process image. Please try again.');
    return null;
  }
};

/**
 * Create data URI from image asset
 * @param {Object} asset - Image asset from ImagePicker
 * @returns {string} - Data URI string
 */
export const createDataUri = (asset) => {
  const mime = asset.mimeType || 'image/jpeg';
  return `data:${mime};base64,${asset.base64}`;
};

/**
 * Get image size information
 * @param {string} base64 - Base64 string
 * @returns {Object} - Size information
 */
export const getImageSizeInfo = (base64) => {
  const base64Size = base64.length;
  const estimatedSizeBytes = (base64Size * 3) / 4;
  const estimatedSizeKB = Math.round(estimatedSizeBytes / 1024);
  const estimatedSizeMB = Math.round(estimatedSizeBytes / 1024 / 1024 * 100) / 100;

  return {
    base64Length: base64Size,
    estimatedBytes: estimatedSizeBytes,
    estimatedKB: estimatedSizeKB,
    estimatedMB: estimatedSizeMB
  };
};

/**
 * Validate image size before upload
 * @param {string} base64 - Base64 string
 * @param {number} minSizeBytes - Minimum allowed size in bytes (default: 10KB)
 * @param {number} maxSizeBytes - Maximum allowed size in bytes (default: 100KB)
 * @returns {Object} - Validation result { isValid, reason, sizeInfo }
 */
export const validateImageSize = (base64, minSizeBytes = 10 * 1024, maxSizeBytes = 50 * 1024) => {
  const sizeInfo = getImageSizeInfo(base64);
  const tooSmall = sizeInfo.estimatedBytes < minSizeBytes;
  const tooLarge = sizeInfo.estimatedBytes > maxSizeBytes;
  const isValid = !tooSmall && !tooLarge;

  return {
    isValid,
    reason: tooSmall ? 'too_small' : tooLarge ? 'too_large' : null,
    sizeInfo,
    minSizeBytes,
    maxSizeBytes,
  };
};

export default {
  compressImageForUpload,
  createDataUri,
  getImageSizeInfo,
  validateImageSize
};
