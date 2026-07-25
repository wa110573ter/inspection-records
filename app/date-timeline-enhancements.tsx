"use client";

import { useEffect } from "react";

type FollowUp = {
  id: string;
  date: string;
  method: string;
  process: string;
  result: string;
  nextStep: string;
  followUpDate: string;
  createdAt?: string;
};

type InspectionCase = {
  id: string;
  waterNumber: string;
  receivedDate: string;
  status: string;
  records: FollowUp[];
};

const reasonOptions = [
  "抄表人員未抄到指針",
  "2期未抄到",
  "3期未抄到",
  "用水量徒增",
  "客訴案件－電話、臨櫃",
  "客訴案件－1910（重要，有錄案）",
];

const methodOptions = [
  "電話聯絡",
  "LINE聯繫",
  "現場勘查",
  "現場複查",
  "查詢資料",
  "收到用戶資料",
  "內部處理",
  "內部簽辦",
  "其他",
];

const processOptions = [
  "電話聯繫用戶，說明案件情形。",
  "現場抄錄水表指針。",
  "核對前期抄表指數及用水量。",
  "檢查水表及表後管線是否有漏水情形。",
  "向用戶說明目前用水情形。",
  "收到用戶回傳的照片或資料。",
  "查詢3-1系統及相關資料。",
];

const resultOptions = [
  "已完成處理",
  "已向用戶說明並取得諒解",
  "確認抄表無誤",
  "發現表後漏水",
  "未發現漏水",
  "等待用戶檢查或修繕",
  "等待用戶回覆",
  "聯絡未果",
  "需再次現勘",
  "已結案",
];

const nextStepOptions = [
  "無，案件可結案",
  "再次電話聯繫",
  "等待用戶回覆",
  "等待用戶修繕",
  "請用戶提供修理前、中、後照片及收據",
  "安排現場勘查",
  "安排現場複查",
  "確認後續用水量",
  "辦理簽報或退費",
  "轉請相關單位處理",
];

const styles = `
  .quick-choice{width:100%;min-height:44px;border:1px solid #aebfd4;border-radius:12px;background:#f7faff;color:#17345d;padding:0 12px;font-weight:800}
  .quick-choice-hint{margin:-2px 0 0;color:#748197;font-size:.72rem;font-weight:600;line-height:1.45}
  .date-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 22px}
  .date-overview-item{padding:14px;border:1px solid #d7e1ee;border-radius:15px;background:#f8fbff}
  .date-overview-item span{display:block;color:#6a778c;font-size:.72rem;font-weight:800}
  .date-overview-item strong{display:block;margin-top:7px;color:#17345d;font-size:1rem;line-height:1.35}
  .date-overview-item small{display:block;margin-top:4px;color:#6a778c;font-size:.7rem;line-height:1.4}
  .date-overview-item.overdue{border-color:#efb4b7;background:#fff5f5}
  .date-overview-item.overdue strong{color:#b82f38}
  .timeline-date-divider{position:relative;z-index:2;display:flex;align-items:center;gap:10px;margin:4px 0 12px;padding:0 0 0 2px;color:#17345d;font-weight:900;font-size:1.02rem}
  .timeline-date-divider::before{content:"";width:12px;height:12px;border:4px solid #1263df;border-radius:999px;background:white;box-shadow:0 0 0 4px #e7f0fd}
  .timeline-date-divider::after{content:"";height:1px;flex:1;background:#dbe4ef}
  .record-created-at{display:block;margin-top:3px;color:#7b8799;font-size:.68rem;font-weight:700}
  .latest-action-summary{margin-top:12px;padding:10px 11px;border-radius:12px;background:#f4f8fd;color:#40506a;font-size:.75rem;line-height:1.45}
  .latest-action-summary strong{display:block;color:#17345d;font-size:.76rem}
  .latest-action-summary span{display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  @media (max-width:700px){
    .date-overview{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px}
    .date-overview-item{padding:12px}
    .timeline-date-divider{font-size:.96rem;margin-top:8px}
  }
`;

function normalizeWaterNumber(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const normalized = value.trim().replaceAll("/", "-");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: match[2], day: match[3], iso: normalized };
}

function rocDate(value: string, withWeekday = false) {
  const parsed = parseDate(value);
  if (!parsed) return value || "未設定";
  const rocYear = parsed.year - 1911;
  if (!withWeekday) return `${rocYear}/${parsed.month}/${parsed.day}`;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[new Date(`${parsed.iso}T00:00:00`).getDay()];
  return `${rocYear}/${parsed.month}/${parsed.day}（${weekday}）`;
}

function createdAtLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const rocYear = date.getFullYear() - 1911;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `建檔：${rocYear}/${month}/${day} ${hour}:${minute}`;
}

function fireValueEvents(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function enhanceSelectOptions() {
  document.querySelectorAll<HTMLSelectElement>('select[name="method"]').forEach((select) => {
    const selected = select.value;
    const existing = new Set(Array.from(select.options).map((option) => option.value));
    for (const value of methodOptions) {
      if (existing.has(value)) continue;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
    select.value = selected;
  });
}

function addQuickChoice(
  textarea: HTMLTextAreaElement,
  key: string,
  placeholder: string,
  options: string[],
  mode: "replace" | "append",
) {
  const label = textarea.closest("label");
  if (!label || label.querySelector(`[data-quick-choice="${key}"]`)) return;

  const select = document.createElement("select");
  select.className = "quick-choice";
  select.dataset.quickChoice = key;
  select.setAttribute("aria-label", placeholder);

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = placeholder;
  select.append(emptyOption);

  for (const value of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }

  const otherOption = document.createElement("option");
  otherOption.value = "__other__";
  otherOption.textContent = "其他／自行輸入";
  select.append(otherOption);

  const hint = document.createElement("small");
  hint.className = "quick-choice-hint";
  hint.dataset.quickChoiceHint = key;
  hint.textContent = mode === "append" ? "選擇後會加入到原文字後面，仍可自行修改。" : "選擇後會自動帶入，仍可自行修改。";

  select.addEventListener("change", () => {
    const value = select.value;
    if (!value) return;
    if (value === "__other__") {
      textarea.focus();
      return;
    }

    if (mode === "append") {
      const current = textarea.value.trim();
      textarea.value = current ? `${current}\n${value}` : value;
    } else {
      textarea.value = value;
    }
    fireValueEvents(textarea);
  });

  label.insertBefore(select, textarea);
  label.insertBefore(hint, textarea);
}

function enhanceTextFields() {
  document.querySelectorAll<HTMLTextAreaElement>('textarea[name="reason"]').forEach((textarea) => {
    addQuickChoice(textarea, "reason", "選擇案件原因", reasonOptions, "replace");
    if (!textarea.placeholder) textarea.placeholder = "可補充案件原因或特殊情形";
  });

  document.querySelectorAll<HTMLTextAreaElement>('textarea[name="process"]').forEach((textarea) => {
    addQuickChoice(textarea, "process", "快速加入處理經過", processOptions, "append");
  });

  document.querySelectorAll<HTMLTextAreaElement>('textarea[name="result"]').forEach((textarea) => {
    addQuickChoice(textarea, "result", "選擇處理結果", resultOptions, "replace");
  });

  document.querySelectorAll<HTMLTextAreaElement>('textarea[name="nextStep"]').forEach((textarea) => {
    addQuickChoice(textarea, "next-step", "選擇下一步", nextStepOptions, "replace");
  });
}

function enhanceCustomStatus() {
  document.querySelectorAll<HTMLSelectElement>('select[name="status"]').forEach((select) => {
    const form = select.closest("form");
    const input = form?.querySelector<HTMLInputElement>('input[name="customStatus"]');
    const label = input?.closest("label") as HTMLElement | null;
    if (!input || !label) return;

    const update = () => {
      label.style.display = select.value === "其他" ? "flex" : "none";
    };

    if (!select.dataset.customStatusEnhanced) {
      select.dataset.customStatusEnhanced = "true";
      select.addEventListener("change", update);
    }
    update();
  });
}

function groupTimeline() {
  const timeline = document.querySelector<HTMLElement>(".timeline");
  if (!timeline) return;
  const articles = Array.from(timeline.querySelectorAll<HTMLElement>(":scope > article.timeline-item"));
  const dates = articles.map((article) => article.querySelector("time")?.textContent?.trim() || "");
  const signature = dates.join("|");
  if (timeline.dataset.dateGroupSignature === signature) return;
  timeline.dataset.dateGroupSignature = signature;

  timeline.querySelectorAll(".timeline-date-divider").forEach((divider) => divider.remove());
  let previous = "";
  articles.forEach((article, index) => {
    const date = dates[index];
    if (!date || date === previous) return;
    previous = date;
    const divider = document.createElement("div");
    divider.className = "timeline-date-divider";
    divider.dataset.enhancementOwned = "true";
    divider.textContent = rocDate(date, true);
    timeline.insertBefore(divider, article);
  });
}

function setOverviewItem(
  item: HTMLElement,
  label: string,
  value: string,
  note = "",
  overdue = false,
) {
  item.className = overdue ? "date-overview-item overdue" : "date-overview-item";
  item.replaceChildren();
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  valueNode.textContent = value;
  item.append(labelNode, valueNode);
  if (note) {
    const noteNode = document.createElement("small");
    noteNode.textContent = note;
    item.append(noteNode);
  }
}

function renderDateOverview(cases: InspectionCase[]) {
  const hero = document.querySelector<HTMLElement>(".detail-hero");
  const waterNumber = document.querySelector<HTMLElement>(".detail-tags span:nth-child(2)")?.textContent || "";
  if (!hero || !waterNumber) return;
  const item = cases.find((entry) => normalizeWaterNumber(entry.waterNumber) === normalizeWaterNumber(waterNumber));
  if (!item) return;

  let overview = document.querySelector<HTMLElement>(".date-overview");
  if (!overview) {
    overview = document.createElement("section");
    overview.className = "date-overview";
    overview.dataset.enhancementOwned = "true";
    for (let index = 0; index < 4; index += 1) {
      const block = document.createElement("div");
      block.className = "date-overview-item";
      overview.append(block);
    }
    hero.insertAdjacentElement("afterend", overview);
  }

  const blocks = Array.from(overview.children) as HTMLElement[];
  const latest = item.records[0];
  const nextDate = latest?.followUpDate || "";
  const overdue = Boolean(nextDate && nextDate < localToday() && item.status !== "已結案");

  setOverviewItem(blocks[0], "收件日期", rocDate(item.receivedDate));
  setOverviewItem(
    blocks[1],
    "最近處理",
    latest ? rocDate(latest.date) : "尚未處理",
    latest?.method || "",
  );
  setOverviewItem(
    blocks[2],
    "下次追蹤",
    nextDate ? rocDate(nextDate) : "未設定",
    overdue ? "已逾期，請優先處理" : "",
    overdue,
  );
  setOverviewItem(
    blocks[3],
    "結案日期",
    item.status === "已結案" && latest ? rocDate(latest.date) : "尚未結案",
  );
}

function renderCreatedTimes(cases: InspectionCase[]) {
  const waterNumber = document.querySelector<HTMLElement>(".detail-tags span:nth-child(2)")?.textContent || "";
  const item = cases.find((entry) => normalizeWaterNumber(entry.waterNumber) === normalizeWaterNumber(waterNumber));
  if (!item) return;

  const articles = Array.from(document.querySelectorAll<HTMLElement>(".timeline > article.timeline-item"));
  articles.forEach((article, index) => {
    const head = article.querySelector<HTMLElement>(".record-head");
    const record = item.records[index];
    if (!head || !record) return;
    let created = head.querySelector<HTMLElement>(".record-created-at");
    if (!created) {
      created = document.createElement("small");
      created.className = "record-created-at";
      created.dataset.enhancementOwned = "true";
      head.append(created);
    }
    created.textContent = createdAtLabel(record.createdAt);
  });
}

function renderCaseCardSummaries(cases: InspectionCase[]) {
  document.querySelectorAll<HTMLButtonElement>("button.case-card").forEach((card) => {
    const waterNumber = card.querySelector<HTMLElement>(".water-no")?.textContent || "";
    const item = cases.find((entry) => normalizeWaterNumber(entry.waterNumber) === normalizeWaterNumber(waterNumber));
    if (!item) return;
    const latest = item.records[0];

    let summary = card.querySelector<HTMLElement>(".latest-action-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "latest-action-summary";
      summary.dataset.enhancementOwned = "true";
      const meta = card.querySelector(".case-meta");
      card.insertBefore(summary, meta);
    }

    summary.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = latest
      ? `最近處理：${rocDate(latest.date)}・${latest.method}`
      : "最近處理：尚無紀錄";
    summary.append(title);
    if (latest?.process) {
      const detail = document.createElement("span");
      detail.textContent = latest.process.replace(/\s+/g, " ");
      summary.append(detail);
    }
  });
}

export default function DateTimelineEnhancements() {
  useEffect(() => {
    let cases: InspectionCase[] = [];
    let refreshTimer: number | null = null;

    const enhance = () => {
      enhanceSelectOptions();
      enhanceTextFields();
      enhanceCustomStatus();
      groupTimeline();
      renderDateOverview(cases);
      renderCreatedTimes(cases);
      renderCaseCardSummaries(cases);
    };

    const refreshCases = async () => {
      try {
        const response = await fetch("/api/cases", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { cases?: InspectionCase[] };
        cases = data.cases || [];
        enhance();
      } catch {
        // 原網站會顯示主要錯誤；此增強功能失敗時不阻斷使用。
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshCases(), 900);
    };

    enhance();
    void refreshCases();

    const observer = new MutationObserver(() => enhance());
    observer.observe(document.body, { childList: true, subtree: true });

    const actionListener = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("button, form")) scheduleRefresh();
    };

    document.addEventListener("click", actionListener, true);
    document.addEventListener("submit", scheduleRefresh, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", actionListener, true);
      document.removeEventListener("submit", scheduleRefresh, true);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, []);

  return <style>{styles}</style>;
}
