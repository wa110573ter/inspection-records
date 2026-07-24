"use client";

import { useEffect } from "react";

function enablePhotoLibrary(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement>('input[type="file"][capture]').forEach((input) => {
    input.removeAttribute("capture");
  });
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

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
