"use client";

import { useEffect } from "react";

function cleanMeterNumber(value: string) {
  return value.trim().replace(/^[：:\s]+|[：:\s]+$/g, "");
}

function extractMeterNumber(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const sameLine = line.match(/水\s*表\s*(?:號\s*碼|編\s*號)\s*[：:]?\s*([A-Za-z0-9-]+)/i);
    if (sameLine?.[1]) return cleanMeterNumber(sameLine[1]);

    if (/水\s*表\s*(?:號\s*碼|編\s*號)\s*[：:]?\s*$/i.test(line)) {
      for (let next = index + 1; next < Math.min(lines.length, index + 4); next += 1) {
        const candidate = cleanMeterNumber(lines[next]);
        const match = candidate.match(/^([A-Za-z0-9-]+)$/i);
        if (match?.[1]) return match[1];
      }
    }
  }

  const fallback = text.match(/(?:水\s*表\s*(?:號\s*碼|編\s*號)|量\s*水\s*器\s*號\s*碼|表\s*號)\s*[：:]?\s*(?:\r?\n\s*)?([A-Za-z0-9-]+)/i);
  return cleanMeterNumber(fallback?.[1] || "");
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.setAttribute("value", value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true }));
}

function findSourceTextarea() {
  const textareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea"));
  return textareas.find((textarea) => {
    const description = `${textarea.placeholder} ${textarea.getAttribute("aria-label") || ""} ${textarea.closest("section")?.textContent || ""}`;
    return /31|手提抄表|用戶資料維護/.test(description) && /水\s*表\s*號\s*碼/.test(textarea.value);
  }) || textareas.find((textarea) => /水\s*表\s*號\s*碼/.test(textarea.value));
}

function findMeterInput() {
  const named = document.querySelector<HTMLInputElement>('input[name="meterNumber"]');
  if (named) return named;

  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  const label = labels.find((item) => /表號/.test(item.textContent || ""));
  return label?.querySelector<HTMLInputElement>('input[type="text"], input:not([type])') || null;
}

function fillMeterNumber() {
  const textarea = findSourceTextarea();
  const input = findMeterInput();
  if (!textarea || !input) return false;

  const meterNumber = extractMeterNumber(textarea.value);
  if (!meterNumber) return false;
  setReactInputValue(input, meterNumber);
  return input.value === meterNumber;
}

export default function MeterNumberImportFix() {
  useEffect(() => {
    const scheduleFill = () => {
      [0, 50, 150, 350, 800, 1500].forEach((delay) => {
        window.setTimeout(() => fillMeterNumber(), delay);
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("button");
      if (button?.textContent?.includes("自動擷取並帶入")) scheduleFill();
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && /水\s*表\s*號\s*碼/.test(target.value)) {
        window.setTimeout(() => fillMeterNumber(), 0);
      }
    };

    const observer = new MutationObserver(() => {
      if (findSourceTextarea() && findMeterInput()) fillMeterNumber();
    });

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleFill();

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
