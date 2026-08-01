export const TARGET_IMAGE_SIZE = 4 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2560;
export const MIN_IMAGE_EDGE = 1600;

const imageTypesByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

export function inferredImageType(file: File) {
  const match = file.name.toLowerCase().match(/\.[^.]+$/);
  return match ? imageTypesByExtension[match[0]] || "" : "";
}

export function isHeifImage(file: File) {
  return /image\/(heic|heif)/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function isOptimizableImage(file: File) {
  return file.type.startsWith("image/") || Boolean(inferredImageType(file));
}

function needsTypeNormalization(file: File) {
  return !file.type.startsWith("image/") && Boolean(inferredImageType(file));
}

export function needsOptimization(file: File) {
  return (
    isOptimizableImage(file) &&
    (file.size > TARGET_IMAGE_SIZE || isHeifImage(file) || needsTypeNormalization(file))
  );
}

function normalizeImageType(file: File) {
  const inferredType = inferredImageType(file);
  if (file.type.startsWith("image/") || !inferredType) return file;

  return new File([file], file.name, {
    type: inferredType,
    lastModified: file.lastModified,
  });
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Safari 對部分 HEIC 檔案會改由 img 元素解碼。
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("無法讀取照片"));
    };
    image.src = objectUrl;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("照片壓縮失敗"));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function renderJpeg(
  image: DecodedImage,
  longestEdge: number,
  quality: number,
) {
  const originalLongestEdge = Math.max(image.width, image.height);
  const scale = Math.min(1, longestEdge / originalLongestEdge);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("瀏覽器無法處理照片");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image.source, 0, 0, width, height);
  return canvasToJpeg(canvas, quality);
}

export async function optimizeImage(file: File) {
  if (!isOptimizableImage(file)) return file;

  const normalizedFile = normalizeImageType(file);
  const heif = isHeifImage(normalizedFile);
  if (normalizedFile.size <= TARGET_IMAGE_SIZE && !heif) return normalizedFile;

  const image = await decodeImage(normalizedFile);
  try {
    if (!image.width || !image.height) return normalizedFile;

    const originalLongestEdge = Math.max(image.width, image.height);
    const attempts = [
      { edge: Math.min(originalLongestEdge, MAX_IMAGE_EDGE), quality: 0.88 },
      { edge: Math.min(originalLongestEdge, MAX_IMAGE_EDGE), quality: 0.8 },
      { edge: Math.min(originalLongestEdge, 2048), quality: 0.8 },
      { edge: Math.min(originalLongestEdge, MIN_IMAGE_EDGE), quality: 0.76 },
    ];

    let smallest: Blob | null = null;
    for (const attempt of attempts) {
      const blob = await renderJpeg(image, attempt.edge, attempt.quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= TARGET_IMAGE_SIZE) {
        smallest = blob;
        break;
      }
    }

    if (!smallest) return normalizedFile;
    if (!heif && smallest.size >= normalizedFile.size) return normalizedFile;

    const jpegName = normalizedFile.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([smallest], `${jpegName}.jpg`, {
      type: "image/jpeg",
      lastModified: normalizedFile.lastModified,
    });
  } finally {
    image.cleanup();
  }
}

export type OptimizationResult = {
  files: File[];
  changedCount: number;
  failedCount: number;
  originalImageSize: number;
  optimizedImageSize: number;
};

export async function optimizeFiles(files: File[]): Promise<OptimizationResult> {
  const optimizedFiles: File[] = [];
  let changedCount = 0;
  let failedCount = 0;
  let originalImageSize = 0;
  let optimizedImageSize = 0;

  for (const file of files) {
    if (!isOptimizableImage(file)) {
      optimizedFiles.push(file);
      continue;
    }

    originalImageSize += file.size;
    const shouldOptimize = needsOptimization(file);
    let optimized = file;
    try {
      optimized = await optimizeImage(file);
    } catch {
      optimized = file;
    }

    optimizedFiles.push(optimized);
    optimizedImageSize += optimized.size;
    if (optimized !== file) changedCount += 1;
    else if (shouldOptimize) failedCount += 1;
  }

  return {
    files: optimizedFiles,
    changedCount,
    failedCount,
    originalImageSize,
    optimizedImageSize,
  };
}
