"use client";

import { useEffect } from "react";
import {
  formatFileSize,
  isOptimizableImage,
  optimizeFiles,
} from "./image-optimizer";

type ProcessingEntry = {
  token: symbol;
  promise: Promise<void>;
};

const inputProcessing = new WeakMap<HTMLInputElement, ProcessingEntry>();
const waitingForms = new WeakSet<HTMLFormElement>();

function enablePhotoLibrary(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement>('input[type="file"][capture]').forEach((input) => {
    input.removeAttribute("capture");
  });
}

function findStatusNode(input: HTMLInputElement) {
  const container = input.closest("label") || input.parentElement;
  return container?.querySelector<HTMLSpanElement>("[data-image-optimization-status]") || null;
}

function clearOptimizationState(input: HTMLInputElement) {
  input.removeAttribute("aria-busy");
  const status = findStatusNode(input);
  if (status) status.remove();
}

function getStatusNode(input: HTMLInputElement) {
  const container = input.closest("label") || input.parentElement;
  if (!container) return null;

  let status = findStatusNode(input);
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

async function optimizeInputFiles(
  input: HTMLInputElement,
  isCurrent: () => boolean,
) {
  const files = Array.from(input.files || []);
  if (!files.length || !files.some(isOptimizableImage)) {
    if (isCurrent()) clearOptimizationState(input);
    return;
  }

  const status = getStatusNode(input);
  if (status && isCurrent()) {
    status.textContent = "正在自動偵測並最佳化照片，完成後會自動繼續…";
    status.style.color = "#1557b0";
  }
  input.setAttribute("aria-busy", "true");

  try {
    const result = await optimizeFiles(files);
    if (!isCurrent()) return;

    if (typeof DataTransfer === "undefined") {
      throw new Error("此瀏覽器不支援替換上傳檔案");
    }

    const transfer = new DataTransfer();
    result.files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;

    if (!status) return;
    if (result.changedCount > 0 && result.failedCount > 0) {
      status.textContent = `已自動處理 ${result.changedCount} 張：${formatFileSize(result.originalImageSize)} → ${formatFileSize(result.optimizedImageSize)}；另有 ${result.failedCount} 張保留原檔。`;
      status.style.color = "#9a5a12";
    } else if (result.changedCount > 0) {
      status.textContent = `已自動處理 ${result.changedCount} 張：${formatFileSize(result.originalImageSize)} → ${formatFileSize(result.optimizedImageSize)}`;
      status.style.color = "#237244";
    } else if (result.failedCount > 0) {
      status.textContent = `有 ${result.failedCount} 張照片無法縮小，將改用原始檔案上傳。`;
      status.style.color = "#9a5a12";
    } else {
      status.textContent = "照片大小合適，將直接上傳原檔。";
      status.style.color = "#51647d";
    }
  } catch {
    if (status && isCurrent()) {
      status.textContent = "此裝置無法自動壓縮，將改以上傳原始檔案。";
      status.style.color = "#9a5a12";
    }
  } finally {
    if (isCurrent()) input.removeAttribute("aria-busy");
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

      const token = Symbol("image-optimization");
      const isCurrent = () => inputProcessing.get(input)?.token === token;
      const promise = Promise.resolve()
        .then(() => optimizeInputFiles(input, isCurrent))
        .finally(() => {
          if (isCurrent()) inputProcessing.delete(input);
        });

      inputProcessing.set(input, { token, promise });
    };

    const handleSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const pending = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]'))
        .map((input) => inputProcessing.get(input)?.promise)
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
