// Test script to verify photo upload fix
import { compressImageForUpload, createDataUri, getImageSizeInfo, validateImageSize } from './utils/imageCompression';

export const testPhotoUpload = async () => {
  console.log('=== Testing Photo Upload Fix ===');
  
  try {
    // Test 1: Test image compression utility
    console.log('Testing image compression utility...');
    const compressedImage = await compressImageForUpload({
      maxSizeBytes: 8 * 1024 * 1024, // 8MB
      initialQuality: 0.8,
      maxAttempts: 3,
      aspect: [1, 1],
      allowsEditing: true
    });
    
    if (compressedImage) {
      console.log('✅ Image compression successful');
      
      // Test 2: Test data URI creation
      const dataUri = createDataUri(compressedImage);
      console.log('✅ Data URI created successfully');
      console.log('Data URI length:', dataUri.length);
      
      // Test 3: Test size validation
      const sizeInfo = getImageSizeInfo(compressedImage.base64);
      console.log('Image size info:', sizeInfo);
      
      const validation = validateImageSize(compressedImage.base64, 8 * 1024 * 1024);
      console.log('Size validation:', validation);
      
      if (validation.isValid) {
        console.log('✅ Image size is within limits');
      } else {
        console.log('❌ Image size exceeds limits');
      }
      
      return {
        success: true,
        compressedImage,
        dataUri,
        sizeInfo,
        validation
      };
    } else {
      console.log('❌ Image compression failed or user cancelled');
      return { success: false, error: 'Compression failed or user cancelled' };
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
};

export const testSizeValidation = () => {
  console.log('=== Testing Size Validation ===');
  
  // Test with different base64 sizes
  const testCases = [
    { name: 'Small image', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' },
    { name: 'Medium image', base64: 'A'.repeat(1000000) }, // ~750KB
    { name: 'Large image', base64: 'A'.repeat(10000000) }, // ~7.5MB
    { name: 'Very large image', base64: 'A'.repeat(15000000) }, // ~11.25MB
  ];
  
  testCases.forEach(testCase => {
    const validation = validateImageSize(testCase.base64, 8 * 1024 * 1024);
    console.log(`${testCase.name}: ${validation.isValid ? '✅ Valid' : '❌ Invalid'} (${validation.sizeInfo.estimatedMB}MB)`);
  });
};

export default testPhotoUpload;
