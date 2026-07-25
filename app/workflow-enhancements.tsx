"use client";

import { useEffect } from "react";

type FollowUp = {
  date: string;
  followUpDate: string;
};

type InspectionCase = {
  id: string;
  waterNumber: string;
  customerName?: string;
  reason?: string;
  receivedDate: string;
  status: string;
  records: FollowUp[];
};

const reasonGroups: Record<string, string[]> = {
  抄表異常: ["抄表人員未抄到指針", "指針疑似誤抄", "指針異常", "換表後指針不符"],
  無法抄表: ["2期未抄到", "3期未抄到", "表位不明", "門鎖無法進入", "水表遭遮蔽", "用戶拒絕進入"],
  用水量異常: ["用水量徒增", "用水量突減", "連續零度", "用水量與現場情形不符"],
  客訴案件: ["電話客訴", "臨櫃客訴", "1910錄案（重要）", "陳情案件"],
  漏水案件: ["疑似表後漏水", "漏水已修", "申請漏水減免", "修繕資料待補"],
  水表異常: ["水表疑似故障", "要求換表檢驗", "水表遺失或遭竊", "表位或表箱異常"],
  其他: [],
};

const contactPersonOptions = ["用戶本人", "家屬", "店長", "管理人員", "鄰居", "里長", "其他"];
const contactResultOptions = ["已接聽", "未接", "空號", "關機", "稍後回電", "已讀未回", "已取得聯繫"];
const customerResponseOptions = [
  "已知漏水",
  "尚未檢查",
  "已安排修繕",
  "已修繕完成",
  "不認同用水量",
  "要求換表檢驗",
  "同意後續觀察用水",
  "其他",
];

const trackingOptions = [
  ["all", "全部追蹤狀態"],
  ["today", "今日要追蹤"],
  ["overdue", "已逾期"],
  ["threeDays", "3日內要追蹤"],
  ["noDate", "未設定追蹤日期"],
  ["inactive7", "最近7天未處理"],
  ["closed", "已結案"],
] as const;

const styles = `
  .quick-choice[data-quick-choice="reason"],.quick-choice-hint[data-quick-choice-hint="reason"]{display:none!important}
  .reason-structure,.contact-helper{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px;border:1px solid #d7e1ee;border-radius:15px;background:#f8fbff}
  .contact-helper{grid-template-columns:repeat(3,minmax(0,1fr))}
  .helper-field{display:flex;flex-direction:column;gap:7px;color:#40506a;font-size:.76rem;font-weight:800}
  .helper-field select{width:100%;min-height:44px;border:1px solid #bdcad9;border-radius:11px;background:#fff;color:#17253d;padding:0 10px}
  .helper-title{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px}
  .helper-title strong{color:#17345d;font-size:.88rem}
  .helper-title small{color:#748197;font-size:.7rem;font-weight:600}
  .generate-record{grid-column:1/-1;min-height:44px;border:1px solid #8bb0e5;border-radius:11px;background:#eaf2fd;color:#1557b0;font-weight:900;cursor:pointer}
  .status-suggestion{grid-column:1/-1;display:none;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border:1px solid #f0cf7a;border-radius:12px;background:#fff9e8;color:#765610;font-size:.76rem;font-weight:800}
  .status-suggestion.visible{display:flex}
  .status-suggestion button{min-height:36px;border:0;border-radius:9px;background:#ad7c08;color:#fff;padding:0 12px;font-weight:900;cursor:pointer}
  .tracking-filter-bar{display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0}
  .tracking-filter-bar label{color:#40506a;font-size:.78rem;font-weight:900;white-space:nowrap}
  .tracking-filter-bar select{width:min(300px,100%);min-height:42px;border:1px solid #bdcad9;border-radius:11px;background:#fff;color:#17253d;padding:0 11px;font-weight:800}
  .duplicate-warning{display:none;margin-top:8px;padding:11px 12px;border:1px solid #efb46f;border-radius:12px;background:#fff7eb;color:#865217;font-size:.75rem;line-height:1.55;font-weight:700}
  .duplicate-warning.visible{display:block}
  .duplicate-warning strong{display:block;color:#9a4b12;font-size:.8rem}
  .duplicate-warning ul{margin:5px 0 0;padding-left:18px}
  .tracking-empty{display:none;padding:30px 15px;text-align:center;color:#65738a;font-weight:700}
  .tracking-empty.visible{display:block}
  @media (max-width:700px){
    .reason-structure,.contact-helper{grid-template-columns:1fr}
    .helper-title,.generate-record,.status-suggestion{grid-column:1}
    .helper-title{align-items:flex-start;flex-direction:column}
    .status-suggestion{align-items:flex-start;flex-direction:column}
    .status-suggestion button{width:100%}
    .tracking-filter-bar{align-items:stretch;flex-direction:column}
    .tracking-filter-bar select{width:100%}
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

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const normalized = value.trim().replaceAll("/", "-");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: match[2], day: match[3] };
}

function rocDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return value || "未設定";
  return `${parsed.year - 1911}/${parsed.month}/${parsed.day}`;
}

function rocChineseDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return value;
  return `${parsed.year - 1911}年${Number(parsed.month)}月${Number(parsed.day)}日`;
}

function fireValueEvents(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function appendOptions(select: HTMLSelectElement, values: readonly string[]) {
  const existing = new Set(Array.from(select.options).map((option) => option.value));
  for (const value of values) {
    if (existing.has(value)) continue;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function makeSelect(placeholder: string, values: readonly string[]) {
  const select = document.createElement("select");
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder;
  select.append(empty);
  appendOptions(select, values);
  return select;
}

function inferReason(value: string) {
  for (const [group, details] of Object.entries(reasonGroups)) {
    const detail = details.find((option) => value.includes(option));
    if (detail) return { group, detail };
  }
  return { group: value.trim() ? "其他" : "", detail: "" };
}

function enhanceReasonFields() {
  document.querySelectorAll<HTMLTextAreaElement>('textarea[name="reason"]').forEach((textarea) => {
    const label = textarea.closest("label");
    if (!label || label.querySelector(".reason-structure")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "reason-structure";
    wrapper.dataset.workflowEnhancement = "reason";

    const title = document.createElement("div");
    title.className = "helper-title";
    title.innerHTML = "<strong>案件原因快速分類</strong><small>選完會帶入下方欄位，仍可補充文字。</small>";

    const groupField = document.createElement("div");
    groupField.className = "helper-field";
    const groupText = document.createElement("span");
    groupText.textContent = "主原因";
    const groupSelect = makeSelect("選擇主原因", Object.keys(reasonGroups));
    groupField.append(groupText, groupSelect);

    const detailField = document.createElement("div");
    detailField.className = "helper-field";
    const detailText = document.createElement("span");
    detailText.textContent = "細項";
    const detailSelect = makeSelect("請先選主原因", []);
    detailField.append(detailText, detailSelect);

    const populateDetails = (selectedDetail = "") => {
      detailSelect.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = groupSelect.value === "其他" ? "自行在下方輸入" : "選擇細項";
      detailSelect.append(placeholder);
      appendOptions(detailSelect, reasonGroups[groupSelect.value] || []);
      const other = document.createElement("option");
      other.value = "__other__";
      other.textContent = "其他／自行輸入";
      detailSelect.append(other);
      detailSelect.disabled = groupSelect.value === "其他";
      if (selectedDetail) detailSelect.value = selectedDetail;
    };

    const applyReason = () => {
      const group = groupSelect.value;
      const detail = detailSelect.value;
      if (!group) return;
      if (group === "其他" || detail === "__other__") {
        textarea.focus();
        return;
      }
      textarea.value = detail ? `${group}－${detail}` : group;
      fireValueEvents(textarea);
    };

    const inferred = inferReason(textarea.value);
    groupSelect.value = inferred.group;
    populateDetails(inferred.detail);
    groupSelect.addEventListener("change", () => {
      populateDetails();
      applyReason();
    });
    detailSelect.addEventListener("change", applyReason);

    wrapper.append(title, groupField, detailField);
    label.insertBefore(wrapper, textarea);
    if (!textarea.placeholder) textarea.placeholder = "可補充案件原因、來源或特殊情形";
  });
}

function recommendedStatus(form: HTMLFormElement) {
  const result = form.querySelector<HTMLTextAreaElement>('textarea[name="result"]')?.value || "";
  const nextStep = form.querySelector<HTMLTextAreaElement>('textarea[name="nextStep"]')?.value || "";
  const contactResult = form.querySelector<HTMLSelectElement>('select[data-contact="result"]')?.value || "";
  const combined = `${result} ${nextStep} ${contactResult}`;
  if (combined.includes("結案")) return "已結案";
  if (combined.includes("聯絡未果") || combined.includes("未接") || combined.includes("關機") || combined.includes("已讀未回")) return "聯絡未果";
  if (combined.includes("複查")) return "待複查";
  if (combined.includes("現勘")) return "待現勘";
  if (combined.includes("等待用戶") || combined.includes("修繕") || combined.includes("回覆")) return "待用戶回覆";
  return "處理中";
}

function buildFormalProcess(form: HTMLFormElement) {
  const date = form.querySelector<HTMLInputElement>('input[name="date"]')?.value || localToday();
  const method = form.querySelector<HTMLSelectElement>('select[name="method"]')?.value || "處理";
  const pointer = form.querySelector<HTMLInputElement>('input[name="pointer"]')?.value.trim() || "";
  const person = form.querySelector<HTMLSelectElement>('select[data-contact="person"]')?.value || "";
  const contactResult = form.querySelector<HTMLSelectElement>('select[data-contact="result"]')?.value || "";
  const response = form.querySelector<HTMLSelectElement>('select[data-contact="response"]')?.value || "";
  const result = form.querySelector<HTMLTextAreaElement>('textarea[name="result"]')?.value.trim() || "";
  const nextStep = form.querySelector<HTMLTextAreaElement>('textarea[name="nextStep"]')?.value.trim() || "";
  const followUpDate = form.querySelector<HTMLInputElement>('input[name="followUpDate"]')?.value || "";

  const parts: string[] = [`${rocChineseDate(date)}${method}`];
  if (person) parts[0] += `，聯繫${person}`;
  if (contactResult) parts[0] += `，聯絡結果為${contactResult}`;
  if (response && response !== "其他") parts.push(`用戶表示${response}`);
  if (pointer) parts.push(`現場抄得水表指針為${pointer}度`);
  if (result) parts.push(result.replace(/[。]+$/g, ""));
  if (nextStep) parts.push(`後續${nextStep.replace(/[。]+$/g, "")}`);
  if (followUpDate) parts.push(`預計於${rocChineseDate(followUpDate)}追蹤`);
  return `${parts.filter(Boolean).join("。 ")}。`;
}

function applyStructuredRecord(form: HTMLFormElement, askBeforeReplace: boolean) {
  const process = form.querySelector<HTMLTextAreaElement>('textarea[name="process"]');
  if (!process) return;
  const generated = buildFormalProcess(form);
  if (askBeforeReplace && process.value.trim() && process.value.trim() !== generated) {
    if (!window.confirm("將依選單重新產生「處理經過」，原文字會被取代。確定繼續嗎？")) return;
  }
  process.value = generated;
  fireValueEvents(process);
}

function updateStatusSuggestion(form: HTMLFormElement) {
  const panel = form.querySelector<HTMLElement>(".status-suggestion");
  const text = panel?.querySelector<HTMLElement>("span");
  if (!panel || !text) return;
  const status = recommendedStatus(form);
  panel.dataset.status = status;
  text.textContent = `依本次結果，建議案件狀態改為「${status}」`;
  panel.classList.add("visible");
}

function enhanceContactFields() {
  document.querySelectorAll<HTMLFormElement>("form.record-form, form.record-edit").forEach((form) => {
    const grid = form.querySelector<HTMLElement>(".field-grid");
    const process = form.querySelector<HTMLTextAreaElement>('textarea[name="process"]');
    const processLabel = process?.closest("label");
    if (!grid || !process || !processLabel || grid.querySelector(".contact-helper")) return;

    const helper = document.createElement("div");
    helper.className = "contact-helper";
    helper.dataset.workflowEnhancement = "contact";

    const title = document.createElement("div");
    title.className = "helper-title";
    title.innerHTML = "<strong>聯絡紀錄快速選擇</strong><small>未聯絡用戶時可留白。</small>";

    const createField = (label: string, key: string, options: string[]) => {
      const field = document.createElement("div");
      field.className = "helper-field";
      const span = document.createElement("span");
      span.textContent = label;
      const select = makeSelect(`選擇${label}`, options);
      select.dataset.contact = key;
      field.append(span, select);
      return { field, select };
    };

    const person = createField("聯絡對象", "person", contactPersonOptions);
    const result = createField("聯絡結果", "result", contactResultOptions);
    const response = createField("用戶回覆", "response", customerResponseOptions);

    const generate = document.createElement("button");
    generate.type = "button";
    generate.className = "generate-record";
    generate.textContent = "產生／更新正式處理紀錄";
    generate.addEventListener("click", () => applyStructuredRecord(form, true));

    const suggestion = document.createElement("div");
    suggestion.className = "status-suggestion";
    const suggestionText = document.createElement("span");
    const applyStatus = document.createElement("button");
    applyStatus.type = "button";
    applyStatus.textContent = "套用建議狀態";
    applyStatus.addEventListener("click", () => {
      const status = suggestion.dataset.status || recommendedStatus(form);
      const statusSelect = document.querySelector<HTMLSelectElement>(".detail-actions .status-select select");
      if (!statusSelect || !Array.from(statusSelect.options).some((option) => option.value === status)) return;
      statusSelect.value = status;
      fireValueEvents(statusSelect);
    });
    suggestion.append(suggestionText, applyStatus);

    helper.append(title, person.field, result.field, response.field, generate, suggestion);
    grid.insertBefore(helper, processLabel);

    const watched = [
      person.select,
      result.select,
      response.select,
      form.querySelector('textarea[name="result"]'),
      form.querySelector('textarea[name="nextStep"]'),
    ].filter((element): element is Element => Boolean(element));
    watched.forEach((element) => {
      element.addEventListener("input", () => updateStatusSuggestion(form));
      element.addEventListener("change", () => updateStatusSuggestion(form));
    });

    form.addEventListener("submit", () => {
      const hasSelection = Boolean(person.select.value || result.select.value || response.select.value);
      if (hasSelection && !process.value.trim()) applyStructuredRecord(form, false);
    });
    updateStatusSuggestion(form);
  });
}

function nextFollowUpDate(item: InspectionCase) {
  return item.records.find((record) => record.followUpDate)?.followUpDate || "";
}

function matchesTrackingFilter(item: InspectionCase, filter: string) {
  const today = localToday();
  const nextDate = nextFollowUpDate(item);
  const latestDate = item.records[0]?.date || item.receivedDate;
  if (filter === "all") return true;
  if (filter === "closed") return item.status === "已結案";
  if (item.status === "已結案") return false;
  if (filter === "today") return nextDate === today;
  if (filter === "overdue") return Boolean(nextDate && nextDate < today);
  if (filter === "threeDays") return Boolean(nextDate && nextDate >= today && nextDate <= addDays(today, 3));
  if (filter === "noDate") return !nextDate;
  if (filter === "inactive7") return Boolean(latestDate && latestDate < addDays(today, -7));
  return true;
}

function applyTrackingFilter(cases: InspectionCase[], filter: string) {
  let visible = 0;
  document.querySelectorAll<HTMLButtonElement>("button.case-card").forEach((card) => {
    const waterNumber = card.querySelector<HTMLElement>(".water-no")?.textContent || "";
    const item = cases.find((entry) => normalizeWaterNumber(entry.waterNumber) === normalizeWaterNumber(waterNumber));
    const show = Boolean(item && matchesTrackingFilter(item, filter));
    card.hidden = !show;
    if (show) visible += 1;
  });
  const count = document.querySelector<HTMLElement>(".case-list .section-heading > span");
  if (count) count.textContent = `${visible} 件`;
  const cards = document.querySelector<HTMLElement>(".case-list .cards");
  let empty = document.querySelector<HTMLElement>(".tracking-empty");
  if (cards && !empty) {
    empty = document.createElement("div");
    empty.className = "tracking-empty";
    empty.textContent = "這個追蹤條件目前沒有案件。";
    cards.insertAdjacentElement("afterend", empty);
  }
  empty?.classList.toggle("visible", visible === 0 && Boolean(cards));
}

function enhanceTrackingFilter(cases: InspectionCase[]) {
  const toolbar = document.querySelector<HTMLElement>(".toolbar");
  if (!toolbar) return;
  let bar = toolbar.querySelector<HTMLElement>(".tracking-filter-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "tracking-filter-bar";
    bar.dataset.workflowEnhancement = "tracking";
    const label = document.createElement("label");
    label.textContent = "追蹤篩選";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "追蹤篩選");
    select.dataset.trackingFilter = "true";
    trackingOptions.forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    });
    select.addEventListener("change", () => applyTrackingFilter(cases, select.value));
    bar.append(label, select);
    toolbar.append(bar);
  }
  const select = bar.querySelector<HTMLSelectElement>('select[data-tracking-filter="true"]');
  if (select) applyTrackingFilter(cases, select.value);
}

function enhanceDuplicateWarning(cases: InspectionCase[]) {
  const form = document.querySelector<HTMLFormElement>(".form-page form.data-form");
  const input = form?.querySelector<HTMLInputElement>('input[name="waterNumber"]');
  const label = input?.closest("label");
  if (!form || !input || !label) return;
  let warning = label.querySelector<HTMLElement>(".duplicate-warning");
  if (!warning) {
    warning = document.createElement("div");
    warning.className = "duplicate-warning";
    warning.dataset.workflowEnhancement = "duplicate";
    label.append(warning);
  }

  const update = () => {
    const waterNumber = normalizeWaterNumber(input.value);
    const matches = waterNumber ? cases.filter((item) => normalizeWaterNumber(item.waterNumber) === waterNumber) : [];
    warning?.replaceChildren();
    warning?.classList.toggle("visible", matches.length > 0);
    if (!warning || !matches.length) return;
    const strong = document.createElement("strong");
    strong.textContent = `此水號已有 ${matches.length} 筆歷史案件，請確認是否為不同原因。`;
    const list = document.createElement("ul");
    matches.slice(0, 4).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.customerName || "未填姓名"}｜${item.status}｜收件 ${rocDate(item.receivedDate)}${item.reason ? `｜${item.reason}` : ""}`;
      list.append(li);
    });
    const note = document.createElement("div");
    note.textContent = "仍可繼續建立，因為同一水號可能有不同案件原因。";
    warning.append(strong, list, note);
  };

  if (!input.dataset.duplicateEnhanced) {
    input.dataset.duplicateEnhanced = "true";
    input.addEventListener("input", update);
    input.addEventListener("change", update);
  }
  update();
}

export default function WorkflowEnhancements() {
  useEffect(() => {
    let cases: InspectionCase[] = [];
    let refreshTimer: number | null = null;
    let observer: MutationObserver | null = null;

    const enhance = () => {
      observer?.disconnect();
      enhanceReasonFields();
      enhanceContactFields();
      enhanceTrackingFilter(cases);
      enhanceDuplicateWarning(cases);
      observer?.observe(document.body, { childList: true, subtree: true });
    };

    const refreshCases = async () => {
      try {
        const response = await fetch("/api/cases", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { cases?: InspectionCase[] };
        cases = data.cases || [];
        enhance();
      } catch {
        // 增強功能失敗時不阻斷原網站及既有案件使用。
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshCases(), 900);
    };

    enhance();
    void refreshCases();
    observer = new MutationObserver(() => enhance());
    observer.observe(document.body, { childList: true, subtree: true });

    const actionListener = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("button, form")) scheduleRefresh();
    };
    document.addEventListener("click", actionListener, true);
    document.addEventListener("submit", scheduleRefresh, true);

    return () => {
      observer?.disconnect();
      document.removeEventListener("click", actionListener, true);
      document.removeEventListener("submit", scheduleRefresh, true);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, []);

  return <style>{styles}</style>;
}
