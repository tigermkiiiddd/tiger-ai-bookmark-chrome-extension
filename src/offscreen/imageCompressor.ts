/**
 * Offscreen Image Compressor
 * Service Worker 中无法使用 Image/Canvas，通过 offscreen document 执行图片压缩
 */

export {};

interface CompressRequest {
  type: 'COMPRESS_IMAGE';
  payload: {
    dataUrl: string;
    maxWidth: number;
    maxHeight: number;
    quality: number;
    mimeType: string;
  };
  requestId: string;
}

async function compressImage(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  mimeType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to get canvas context'));
      }

      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          } else {
            reject(new Error('Canvas to Blob conversion failed'));
          }
        },
        mimeType,
        quality
      );
    };
    img.onerror = (error) => reject(error);
  });
}

chrome.runtime.onMessage.addListener((message: CompressRequest, _sender, sendResponse) => {
  if (message.type === 'COMPRESS_IMAGE') {
    const { dataUrl, maxWidth, maxHeight, quality, mimeType } = message.payload;
    compressImage(dataUrl, maxWidth, maxHeight, quality, mimeType)
      .then((result) => {
        sendResponse({ success: true, data: result, requestId: message.requestId });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Compression failed',
          requestId: message.requestId
        });
      });
    return true; // 异步响应
  }
  return false;
});
