"use client";

import { useEffect } from "react";

function cleanMeterNumber(value: string) {
  return value.trim().replace(/^[：:\s]+|[：:\s]+$/g, "");
}

function extractMeterNumber(text: string) {
  const patterns = [
    /水\s*表\s*號\s*碼\s*[：:]?\s*(?:\r?\n\s*)?([A-Za-z0-9-]+)/i,
    /水\s*表\s*編\s*號\s*[：:]?\s*(?:\r?\n\s*)?([A-Za-z0-9-]+)/i,
    /量\s*水\s*器\s*號\s*碼\s*[：:]?\s*(?:\r?\n\s*)?([A-Za-z0-9-]+)/i,
    /表\s*號\s*[：:]?\s*(?:\r?\n\s*)?([A-Za-z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanMeterNumber(match?.[1] || "");
    if (value) return value;
  }
  return "";
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findSourceText(button: HTMLElement) {
  const section = button.closest("section, .form-section, form") || document;
  const textareas = Array.from(section.querySelectorAll<HTMLTextAreaElement>("textarea"));
  const likely = textareas.find((textarea) =>
    /31|手提抄表|用戶資料/.test(`${textarea.placeholder} ${textarea.getAttribute("aria-label") || ""}`),
  );
  return (likely || textareas[0])?.value || "";
}

function fillMeterNumber(button: HTMLElement) {
  const sourceText = findSourceText(button);
  const meterNumber = extractMeterNumber(sourceText);
  if (!meterNumber) return;

  const form = button.closest("form") || document;
  const input = form.querySelector<HTMLInputElement>('input[name="meterNumber"]')
    || document.querySelector<HTMLInputElement>('input[name="meterNumber"]');
  if (!input) return;
  setReactInputValue(input, meterNumber);
}

export default function MeterNumberImportFix() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("button");
      if (!button || !button.textContent?.includes("自動擷取並帶入")) return;

      [0, 50, 200, 500].forEach((delay) => {
        window.setTimeout(() => fillMeterNumber(button), delay);
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
