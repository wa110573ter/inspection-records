"use client";

import { useEffect } from "react";

const STORAGE_KEY = "inspection-records:new-case-31-raw";

function normalizeText(value: string) {
  return value.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim();
    if (value) return value;
  }
  return "";
}

function parse31(raw: string) {
  const text = normalizeText(raw);
  return {
    waterNumber: firstMatch(text, [
      /^\s*水\s*號\s*[：:]?\s*(?:\n\s*)?([0-9A-Z-]+)/mi,
      /^\s*用戶水號\s*[：:]?\s*(?:\n\s*)?([0-9A-Z-]+)/mi,
    ]).replace(/[\s-]/g, "").toUpperCase(),
    customerName: firstMatch(text, [
      /用戶姓名\s*[：:]?\s*([^\t\n]+?)(?=\s*(?:用戶電話|電話|加退污水費)\s*[：:]|$)/i,
      /^\s*(?:戶名|姓名)\s*[：:]?\s*(?:\n\s*)?([^\t\n]+)/mi,
    ]),
    phone: firstMatch(text, [
      /用戶電話\s*[：:]?\s*([0-9()#extEXT\-\s]+)/i,
      /(?:行動電話|手機|電話)\s*[：:]?\s*([0-9()#extEXT\-\s]+)/i,
    ]).replace(/\s+/g, ""),
    address: firstMatch(text, [
      /^\s*(?:用水地址|住址|地址)\s*[：:]?\s*(?:\n\s*)?([^\t\n]+)/mi,
    ]),
    meterNumber: firstMatch(text, [
      /^\s*(?:水表號碼|水表編號|量水器號碼|表號)\s*[：:]?\s*(?:\n\s*)?([0-9A-Z-]+)/mi,
    ]).replace(/\s+/g, "").toUpperCase(),
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  if (!value) return;
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function findNewCaseForm() {
  const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form.data-form"));
  return forms.find((form) => form.closest("main")?.textContent?.includes("新增稽查案件")) || null;
}

function installPanel() {
  const form = findNewCaseForm();
  if (!form || form.querySelector("[data-case-31-import]")) return;
  const firstSection = form.querySelector<HTMLElement>(".form-section");
  if (!firstSection) return;

  const section = document.createElement("div");
  section.className = "form-section";
  section.dataset.case31Import = "true";
  section.innerHTML = `
    <h3>31畫面全文擷取</h3>
    <p style="margin:0 0 12px;color:#65738a;line-height:1.6;font-size:.84rem">在31畫面按 Ctrl+A、Ctrl+C，再把完整內容貼到下方。建立案件後會把完整原文另存為第一筆處理紀錄。</p>
    <label style="display:block;color:#40506a;font-size:.82rem;font-weight:800">
      31畫面完整文字
      <textarea data-case-31-text rows="10" placeholder="請貼上手提抄表機系統31畫面的完整文字" style="display:block;width:100%;margin-top:7px;padding:12px;border:1px solid #cfd8e4;border-radius:12px;resize:vertical;font:400 .78rem/1.55 ui-monospace,SFMono-Regular,Consolas,monospace"></textarea>
    </label>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button type="button" data-case-31-parse class="secondary">自動擷取並帶入</button>
      <span data-case-31-message style="color:#65738a;font-size:.78rem;font-weight:700"></span>
    </div>
  `;
  form.insertBefore(section, firstSection);

  const textarea = section.querySelector<HTMLTextAreaElement>("[data-case-31-text]");
  const button = section.querySelector<HTMLButtonElement>("[data-case-31-parse]");
  const message = section.querySelector<HTMLElement>("[data-case-31-message]");
  const saved = sessionStorage.getItem(STORAGE_KEY) || "";
  if (textarea && saved) textarea.value = saved;

  button?.addEventListener("click", () => {
    const raw = textarea?.value.trim() || "";
    if (!raw) {
      if (message) message.textContent = "請先貼上31畫面完整文字。";
      return;
    }
    const parsed = parse31(raw);
    const names = ["waterNumber", "customerName", "phone", "address", "meterNumber"] as const;
    let count = 0;
    for (const name of names) {
      const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      const value = parsed[name];
      if (input && value) {
        setInputValue(input, value);
        count += 1;
      }
    }
    sessionStorage.setItem(STORAGE_KEY, raw);
    if (message) message.textContent = `已帶入 ${count} 個欄位，請核對後再建立案件。`;
  });

  textarea?.addEventListener("input", () => {
    sessionStorage.setItem(STORAGE_KEY, textarea.value);
  });
}

export default function Case31Import() {
  useEffect(() => {
    installPanel();
    const observer = new MutationObserver(installPanel);
    observer.observe(document.body, { childList: true, subtree: true });

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.endsWith("/api/cases") && method === "POST" && typeof init?.body === "string") {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          const raw31 = sessionStorage.getItem(STORAGE_KEY)?.trim() || "";
          if (raw31) {
            init = { ...init, body: JSON.stringify({ ...body, raw31 }) };
          }
        } catch {
          // Keep the original request when the body is not JSON.
        }
      }
      const response = await originalFetch(input, init);
      if (url.endsWith("/api/cases") && method === "POST" && response.ok) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      return response;
    };

    return () => {
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
