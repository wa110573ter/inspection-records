"use client";

import { useEffect } from "react";

const TARGET_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2560;
const MIN_IMAGE_EDGE = 1600;

const inputProcessing = new WeakMap<HTMLInputElement, Promise<void>>();
const waitingForms = new WeakSet<HTMLFormElement>();

function enablePhotoLibrary(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement>('input[type="file"][capture]').forEach((input) => {
    input.removeAttribute("capture");
  });
}

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

function getStatusNode(input: HTMLInputElement) {
  const container = input.closest("label") || input.parentElement;
  if (!container) return null;

  let status = container.querySelector<HTMLSpanElement>("[data-image-optimization-status]");
  if (!status) {
    status = document.createElement("span");
    status.dataset.imageOptimizationStatus = "true";
    status.style.display = "block";
    status.style.marginTop = "6px";
    status.style.fontSize = "0.72rem";
    status.style.fontWeight = "800";
    status.style.lineHeight = "1.45";
    status.style.color = "#51647d";
    container.appendChild(status);
  }
  return status;
}

function isHeifImage(file: File) {
  return /image\/(heic|heif)/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
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

async function optimizeImage(file: File) {
  const heif = isHeifImage(file);
  if (!file.type.startsWith("image/") && !heif) return file;
  if (file.size <= TARGET_IMAGE_SIZE && !heif) return file;

  const image = await decodeImage(file);
  try {
    if (!image.width || !image.height) return file;

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

    if (!smallest) return file;
    if (!heif && smallest.size >= file.size) return file;

    const jpegName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([smallest], `${jpegName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    image.cleanup();
  }
}

async function optimizeInputFiles(input: HTMLInputElement) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  const imageFiles = files.filter((file) => file.type.startsWith("image/") || isHeifImage(file));
  if (!imageFiles.length) return;

  const status = getStatusNode(input);
  if (status) {
    status.textContent = "正在自動偵測並最佳化照片，完成後會自動繼續…";
    status.style.color = "#1557b0";
  }
  input.setAttribute("aria-busy", "true");

  try {
    const optimizedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          return await optimizeImage(file);
        } catch {
          return file;
        }
      }),
    );

    const transfer = new DataTransfer();
    optimizedFiles.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;

    const originalSize = files.reduce((total, file) => total + file.size, 0);
    const optimizedSize = optimizedFiles.reduce((total, file) => total + file.size, 0);
    const changedCount = optimizedFiles.filter((file, index) => file !== files[index]).length;

    if (status) {
      if (changedCount > 0) {
        status.textContent = `已自動最佳化 ${changedCount} 張：${formatFileSize(originalSize)} → ${formatFileSize(optimizedSize)}`;
        status.style.color = "#237244";
      } else {
        status.textContent = "照片大小合適，將直接上傳原檔。";
        status.style.color = "#51647d";
      }
    }
  } catch {
    if (status) {
      status.textContent = "此裝置無法自動壓縮，將改以上傳原始檔案。";
      status.style.color = "#9a5a12";
    }
  } finally {
    input.removeAttribute("aria-busy");
  }
}

export default function MobileUploadFix() {
  useEffect(() => {
    enablePhotoLibrary(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          if (node.matches('input[type="file"][capture]')) {
            node.removeAttribute("capture");
          }
          enablePhotoLibrary(node);
        }
      }
    });

    const handleChange = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;

      const task = optimizeInputFiles(input).finally(() => {
        inputProcessing.delete(input);
      });
      inputProcessing.set(input, task);
    };

    const handleSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const pending = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]'))
        .map((input) => inputProcessing.get(input))
        .filter((task): task is Promise<void> => Boolean(task));
      if (!pending.length) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (waitingForms.has(form)) return;
      waitingForms.add(form);

      const submitter = event instanceof SubmitEvent ? event.submitter : null;
      void Promise.all(pending).finally(() => {
        waitingForms.delete(form);
        if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
          form.requestSubmit(submitter);
        } else {
          form.requestSubmit();
        }
      });
    };

    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", handleChange, true);
    document.addEventListener("submit", handleSubmit, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("change", handleChange, true);
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return null;
}
