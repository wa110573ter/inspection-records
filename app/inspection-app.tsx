"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  category: string;
  url: string;
};

type FollowUp = {
  id: string;
  date: string;
  method: string;
  pointer: string;
  process: string;
  result: string;
  nextStep: string;
  followUpDate: string;
  createdAt?: string;
  attachments: Attachment[];
};

type InspectionCase = {
  id: string;
  waterNumber: string;
  customerName: string;
  phone: string;
  address: string;
  coordinates: string;
  meterNumber: string;
  reason: string;
  receivedDate: string;
  status: string;
  customStatus: string;
  updatedAt: string;
  attachments: Attachment[];
  records: FollowUp[];
};

const statuses = ["待處理", "處理中", "已結案"];

const progressOptions = [
  "尚未聯絡",
  "已聯絡，待用戶回覆",
  "聯絡未果",
  "待現場勘查",
  "現場勘查完成，待後續",
  "等待用戶自行檢查",
  "等待用戶修繕",
  "等待用戶提供資料",
  "待複查",
  "待內部簽辦",
  "待辦理改單／退費／扣抵",
  "等待後續用水量",
  "已轉相關單位",
  "持續處理中",
];

function normalizeCase(item: InspectionCase): InspectionCase {
  if (statuses.includes(item.status)) return item;
  return {
    ...item,
    status: "處理中",
    customStatus: item.customStatus || item.status,
  };
}

const methods = [
  "電話聯絡",
  "LINE聯繫",
  "現場勘查",
  "現場複查",
  "查詢資料",
  "收到用戶資料",
  "用戶回傳",
  "內部處理",
  "內部簽辦",
  "其他",
];

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

const processOptions = [
  "電話聯繫用戶，說明案件情形。",
  "已撥打用戶電話，惟未接聽。",
  "現場抄錄水表指針。",
  "現場無人在家，已留存現況。",
  "核對前期抄表指數及用水量。",
  "檢查水表及表後管線是否有漏水情形。",
  "向用戶說明目前用水情形。",
  "已請用戶自行檢查表後管線。",
  "已請用戶提供照片或修繕資料。",
  "收到用戶回傳的照片或資料。",
  "查詢3-1系統及相關資料。",
  "已完成內部簽辦或系統作業。",
];

const resultOptions = [
  "已完成處理",
  "已向用戶說明並取得諒解",
  "確認抄表無誤",
  "發現表後漏水",
  "未發現漏水",
  "用戶電話未接",
  "用戶電話空號",
  "已通知用戶自行檢查",
  "已請用戶安排修繕",
  "已收到修繕資料",
  "等待用戶檢查或修繕",
  "等待用戶回覆",
  "聯絡未果",
  "需再次現勘",
  "已完成複查",
  "已完成退費或下期扣抵",
  "已轉相關單位處理",
  "已結案",
];

const nextStepOptions = [
  "無，案件可結案",
  "再次電話聯繫",
  "等待用戶回覆",
  "等待用戶修繕",
  "等待用戶提供照片",
  "等待用戶提供修繕收據",
  "請用戶提供修理前、中、後照片及收據",
  "安排現場勘查",
  "安排現場複查",
  "確認後續用水量",
  "追蹤下一期用水量",
  "辦理改單",
  "辦理下期扣抵",
  "辦理簽報或退費",
  "轉請相關單位處理",
];

const trackingOptions = [
  ["all", "全部追蹤狀態"],
  ["open", "未結案"],
  ["today", "今日要追蹤"],
  ["overdue", "已逾期"],
  ["threeDays", "3日內要追蹤"],
  ["noDate", "未設定追蹤日期"],
  ["inactive7", "最近7天未處理"],
  ["closed", "已結案"],
] as const;

type TrackingFilter = (typeof trackingOptions)[number][0];

const extraStyles = `
  .detail-actions,.form-actions,.record-actions,.attachment-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .detail-actions{justify-content:flex-end}
  .secondary,.danger,.text-button{min-height:40px;padding:0 14px;border-radius:11px;font-weight:800;cursor:pointer}
  .secondary{border:1px solid #b9c8da;background:#fff;color:#26466f}
  .danger{border:1px solid #e5a7aa;background:#fff5f5;color:#b52e36}
  .text-button{border:0;background:transparent;color:#1263df;padding:0 6px}
  .text-button.danger-text{color:#bd3038}
  .secondary:disabled,.danger:disabled,.text-button:disabled{opacity:.55;cursor:not-allowed}
  .edit-panel{margin:18px 0;padding:20px;border:1px solid #cbd9ea;border-radius:18px;background:#f8fbff}
  .edit-panel h3{margin:0 0 16px}
  .form-actions{justify-content:flex-end;margin-top:18px}
  .attachment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .attachment-tile{position:relative;overflow:hidden;border:1px solid #dce4ed;border-radius:13px;background:#fff}
  .attachment-tile>a{display:block;color:inherit;text-decoration:none}
  .attachment-tile img,.attachment-tile video{display:block;width:100%;height:120px;object-fit:cover;background:#eef2f6}
  .attachment-tile .file-name{display:block;padding:16px 10px;overflow-wrap:anywhere}
  .attachment-tile small{display:block;padding:7px 10px;color:#65738a;font-weight:700}
  .attachment-tile button{position:absolute;right:6px;top:6px;border:0;border-radius:999px;background:rgba(15,30,50,.82);color:#fff;padding:6px 9px;font-size:.72rem;font-weight:800;cursor:pointer}
  .mini-upload{margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0}
  .mini-upload h4{margin:0 0 10px}
  .mini-upload .field-grid{gap:10px}
  .danger-zone{margin-top:20px;padding-top:18px;border-top:1px solid #f0d3d5}
  .record-edit{padding:2px 0}
  .record-head-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .record-head-actions .record-actions{justify-content:flex-end}
  .status-select.compact{min-width:150px}
  .field-hint{display:block;margin-top:7px;color:#65738a;font-size:.72rem;line-height:1.45;font-weight:700}
  .reason-picker,.contact-picker{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:14px;border:1px solid #d7e1ee;border-radius:15px;background:#f8fbff}
  .contact-picker{grid-template-columns:repeat(3,minmax(0,1fr))}
  .picker-title{grid-column:1/-1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .picker-title strong{color:#17345d;font-size:.88rem}
  .picker-title small{color:#748197;font-size:.7rem;line-height:1.45;font-weight:600}
  .duplicate-warning{grid-column:1/-1;margin-top:-2px;padding:11px 12px;border:1px solid #efb46f;border-radius:12px;background:#fff7eb;color:#865217;font-size:.75rem;line-height:1.55;font-weight:700}
  .duplicate-warning strong{display:block;color:#9a4b12;font-size:.8rem}
  .duplicate-warning ul{margin:5px 0;padding-left:18px}
  .quick-select{width:100%;min-height:44px;border:1px solid #b8c8dc;border-radius:11px;background:#f7faff;color:#17345d;padding:0 11px;font-weight:800}
  .generate-record{grid-column:1/-1;min-height:44px;border:1px solid #8bb0e5;border-radius:11px;background:#eaf2fd;color:#1557b0;font-weight:900;cursor:pointer}
  .status-suggestion{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border:1px solid #f0cf7a;border-radius:12px;background:#fff9e8;color:#765610;font-size:.76rem;font-weight:800}
  .status-suggestion button{min-height:36px;border:0;border-radius:9px;background:#ad7c08;color:#fff;padding:0 12px;font-weight:900;cursor:pointer}
  .tracking-filter-bar{display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0}
  .tracking-filter-bar label{color:#40506a;font-size:.78rem;font-weight:900;white-space:nowrap}
  .tracking-filter-bar select{width:min(310px,100%);min-height:44px;border:1px solid #bdcad9;border-radius:11px;background:#fff;color:#17253d;padding:0 11px;font-weight:800}
  .date-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 22px}
  .date-overview-item{padding:14px;border:1px solid #d7e1ee;border-radius:15px;background:#f8fbff}
  .date-overview-item span{display:block;color:#6a778c;font-size:.72rem;font-weight:800}
  .date-overview-item strong{display:block;margin-top:7px;color:#17345d;font-size:1rem;line-height:1.35}
  .date-overview-item small{display:block;margin-top:4px;color:#6a778c;font-size:.7rem;line-height:1.4}
  .date-overview-item.overdue{border-color:#efb4b7;background:#fff5f5}
  .date-overview-item.overdue strong{color:#b82f38}
  .timeline-date-divider{position:relative;z-index:2;display:flex;align-items:center;gap:10px;margin:10px 0 12px;padding-left:2px;color:#17345d;font-weight:900;font-size:1.02rem}
  .timeline-date-divider::before{content:"";width:12px;height:12px;border:4px solid #1263df;border-radius:999px;background:white;box-shadow:0 0 0 4px #e7f0fd}
  .timeline-date-divider::after{content:"";height:1px;flex:1;background:#dbe4ef}
  .record-created-at{display:block;margin-top:3px;color:#7b8799;font-size:.68rem;font-weight:700}
  .latest-action-summary{margin-top:12px;padding:10px 11px;border-radius:12px;background:#f4f8fd;color:#40506a;font-size:.75rem;line-height:1.45}
  .latest-action-summary strong{display:block;color:#17345d;font-size:.76rem}
  .latest-action-summary span{display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .case-progress{margin:9px 0 0;padding:7px 9px;border-radius:9px;background:#fff8e8;color:#805a0d;font-size:.72rem;font-weight:850}
  .detail-tags .progress-tag{background:#fff3ce;color:#77530b}
  @media (max-width:700px){
    .detail-actions{justify-content:flex-start;width:100%}
    .detail-hero{align-items:flex-start;flex-direction:column}
    .attachment-grid{grid-template-columns:1fr 1fr}
    .record-head-actions{align-items:flex-start;flex-direction:column}
    .form-actions>*{flex:1}
    .reason-picker,.contact-picker{grid-template-columns:1fr}
    .picker-title,.generate-record,.status-suggestion{grid-column:1}
    .picker-title,.status-suggestion{flex-direction:column}
    .status-suggestion button{width:100%}
    .tracking-filter-bar{align-items:stretch;flex-direction:column}
    .tracking-filter-bar select{width:100%}
    .date-overview{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px}
    .date-overview-item{padding:12px}
  }
`;

function today() {
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

function normalizeWaterNumber(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function parseDate(value: string) {
  const normalized = value.trim().replaceAll("/", "-");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: match[2], day: match[3], iso: normalized };
}

function formatDate(value: string, withWeekday = false) {
  const parsed = parseDate(value);
  if (!parsed) return value || "未設定";
  const dateText = `${parsed.year - 1911}/${parsed.month}/${parsed.day}`;
  if (!withWeekday) return dateText;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[new Date(`${parsed.iso}T00:00:00`).getDay()];
  return `${dateText}（${weekday}）`;
}

function formatChineseDate(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return value;
  return `${parsed.year - 1911}年${Number(parsed.month)}月${Number(parsed.day)}日`;
}

function createdAtLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear() - 1911;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `建檔：${year}/${month}/${day} ${hour}:${minute}`;
}

function isOverdue(value: string, status: string) {
  return Boolean(value && value < today() && status !== "已結案");
}

function activeFollowUpDate(item: InspectionCase) {
  return item.records.find((record) => record.followUpDate)?.followUpDate || "";
}

function latestActionDate(item: InspectionCase) {
  return item.records[0]?.date || item.receivedDate;
}

function matchesTrackingFilter(item: InspectionCase, trackingFilter: TrackingFilter) {
  const nextDate = activeFollowUpDate(item);
  const currentDate = today();
  if (trackingFilter === "all") return true;
  if (trackingFilter === "open") return item.status !== "已結案";
  if (trackingFilter === "closed") return item.status === "已結案";
  if (item.status === "已結案") return false;
  if (trackingFilter === "today") return nextDate === currentDate;
  if (trackingFilter === "overdue") return Boolean(nextDate && nextDate < currentDate);
  if (trackingFilter === "threeDays") {
    return Boolean(nextDate && nextDate >= currentDate && nextDate <= addDays(currentDate, 3));
  }
  if (trackingFilter === "noDate") return !nextDate;
  if (trackingFilter === "inactive7") return latestActionDate(item) < addDays(currentDate, -7);
  return true;
}

function mapCoordinates(value: string) {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return value;
  const [first, second] = parts;
  if (Math.abs(first) > 90 && Math.abs(second) <= 90) return `${second},${first}`;
  return `${first},${second}`;
}

function caseStatusLabel(item: InspectionCase) {
  return item.status;
}

function caseProgressLabel(item: InspectionCase) {
  return item.customStatus.trim();
}

function categoryLabel(category: string) {
  if (category === "system31") return "3-1 畫面";
  if (category === "gis") return "圖資畫面";
  return "處理附件";
}

function inferReason(value: string) {
  for (const [group, details] of Object.entries(reasonGroups)) {
    const detail = details.find((option) => value.includes(option));
    if (detail) return { group, detail };
  }
  return { group: value.trim() ? "其他" : "", detail: "" };
}

function recommendedStatus(result: string, nextStep: string, contactResult: string) {
  const combined = `${result} ${nextStep} ${contactResult}`.trim();
  if (!combined) return null;
  if (
    combined.includes("已結案") ||
    combined.includes("無，案件可結案") ||
    (result.trim().startsWith("已完成") && !nextStep.trim())
  ) {
    return "已結案";
  }
  return "處理中";
}

function recommendedProgress(result: string, nextStep: string, contactResult: string) {
  const combined = `${result} ${nextStep} ${contactResult}`.trim();
  if (!combined || recommendedStatus(result, nextStep, contactResult) === "已結案") return "";
  if (
    combined.includes("聯絡未果") ||
    combined.includes("未接") ||
    combined.includes("空號") ||
    combined.includes("關機") ||
    combined.includes("已讀未回")
  ) {
    return "聯絡未果";
  }
  if (combined.includes("複查")) return "待複查";
  if (combined.includes("現勘")) return "待現場勘查";
  if (combined.includes("後續用水量") || combined.includes("下一期用水量")) return "等待後續用水量";
  if (combined.includes("改單") || combined.includes("退費") || combined.includes("扣抵") || combined.includes("簽報")) {
    return "待辦理改單／退費／扣抵";
  }
  if (combined.includes("修繕")) return "等待用戶修繕";
  if (combined.includes("照片") || combined.includes("資料") || combined.includes("收據")) {
    return "等待用戶提供資料";
  }
  if (combined.includes("回覆")) return "已聯絡，待用戶回覆";
  return "持續處理中";
}

function stripTrailingPunctuation(value: string) {
  return value.trim().replace(/[。；;，,\s]+$/g, "");
}

function buildFormalProcess(values: {
  date: string;
  method: string;
  pointer: string;
  contactPerson: string;
  contactResult: string;
  customerResponse: string;
  result: string;
  nextStep: string;
  followUpDate: string;
}) {
  const parts: string[] = [`${formatChineseDate(values.date)}${values.method}`];
  if (values.contactPerson) parts[0] += `，聯繫${values.contactPerson}`;
  if (values.contactResult) parts[0] += `，聯絡結果為${values.contactResult}`;
  if (values.customerResponse && values.customerResponse !== "其他") {
    parts.push(`用戶表示${values.customerResponse}`);
  }
  if (values.pointer) parts.push(`現場抄得水表指針為${values.pointer}度`);
  if (values.result) parts.push(stripTrailingPunctuation(values.result));
  if (values.nextStep) parts.push(`後續${stripTrailingPunctuation(values.nextStep)}`);
  if (values.followUpDate) parts.push(`預計於${formatChineseDate(values.followUpDate)}追蹤`);
  return `${parts.filter(Boolean).join("。 ")}。`;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = (text ? JSON.parse(text) : {}) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "操作失敗，請稍後再試");
  return data;
}

function casePayload(data: FormData) {
  const status = String(data.get("status") || "待處理");
  return {
    waterNumber: normalizeWaterNumber(String(data.get("waterNumber") || "")),
    customerName: String(data.get("customerName") || ""),
    phone: String(data.get("phone") || ""),
    address: String(data.get("address") || ""),
    coordinates: String(data.get("coordinates") || ""),
    meterNumber: String(data.get("meterNumber") || ""),
    reason: String(data.get("reason") || ""),
    receivedDate: String(data.get("receivedDate") || ""),
    status,
    customStatus: status === "處理中" ? String(data.get("customStatus") || "") : "",
  };
}

function recordPayload(data: FormData) {
  return {
    date: String(data.get("date") || ""),
    method: String(data.get("method") || ""),
    pointer: String(data.get("pointer") || ""),
    process: String(data.get("process") || ""),
    result: String(data.get("result") || ""),
    nextStep: String(data.get("nextStep") || ""),
    followUpDate: String(data.get("followUpDate") || ""),
  };
}

function CaseFields({ item, cases }: { item?: InspectionCase; cases: InspectionCase[] }) {
  const inferred = inferReason(item?.reason || "");
  const [waterNumber, setWaterNumber] = useState(item?.waterNumber || "");
  const [reasonGroup, setReasonGroup] = useState(inferred.group);
  const [reasonDetail, setReasonDetail] = useState(inferred.detail);
  const [reasonText, setReasonText] = useState(item?.reason || "");

  const duplicateCases = useMemo(() => {
    const normalized = normalizeWaterNumber(waterNumber);
    if (!normalized) return [];
    return cases.filter(
      (existing) => existing.id !== item?.id && normalizeWaterNumber(existing.waterNumber) === normalized,
    );
  }, [cases, item?.id, waterNumber]);

  function changeReasonGroup(value: string) {
    setReasonGroup(value);
    setReasonDetail("");
    if (!value) return;
    if (value === "其他") {
      if (!reasonText || inferred.group !== "其他") setReasonText("");
      return;
    }
    setReasonText(value);
  }

  function changeReasonDetail(value: string) {
    setReasonDetail(value);
    if (!reasonGroup) return;
    if (value === "__other__") {
      setReasonText(`${reasonGroup}－`);
      return;
    }
    setReasonText(value ? `${reasonGroup}－${value}` : reasonGroup);
  }

  return (
    <>
      <div className="form-section">
        <h3>用戶與水表資料</h3>
        <div className="field-grid">
          <label>
            水號 <em>必填</em>
            <input
              name="waterNumber"
              required
              inputMode="text"
              value={waterNumber}
              onChange={(event) => setWaterNumber(event.target.value)}
            />
          </label>
          <label>
            姓名
            <input name="customerName" autoComplete="name" defaultValue={item?.customerName} />
          </label>
          {duplicateCases.length > 0 && (
            <div className="duplicate-warning">
              <strong>此水號已有 {duplicateCases.length} 筆歷史案件，請確認是否為不同原因。</strong>
              <ul>
                {duplicateCases.slice(0, 4).map((existing) => (
                  <li key={existing.id}>
                    {existing.customerName || "未填姓名"}｜{caseStatusLabel(existing)}｜收件 {formatDate(existing.receivedDate)}
                    {existing.reason ? `｜${existing.reason}` : ""}
                  </li>
                ))}
              </ul>
              <span>仍可繼續建立，不會阻止同一水號因不同原因分案。</span>
            </div>
          )}
          <label>
            電話
            <input name="phone" type="tel" autoComplete="tel" defaultValue={item?.phone} />
          </label>
          <label>
            表號
            <input name="meterNumber" defaultValue={item?.meterNumber} />
          </label>
          <label className="wide">
            地址
            <input name="address" autoComplete="street-address" defaultValue={item?.address} />
          </label>
          <label>
            座標
            <input
              name="coordinates"
              placeholder="120.000000,23.000000"
              defaultValue={item?.coordinates}
            />
            <small className="field-hint">可直接貼公司格式「經度,緯度」，開啟 Google 地圖時會自動轉換。</small>
          </label>
          <label>
            收件日期
            <input
              name="receivedDate"
              type="date"
              defaultValue={item?.receivedDate || today()}
            />
          </label>
        </div>
      </div>
      <div className="form-section">
        <h3>案件內容</h3>
        <div className="field-grid">
          <div className="reason-picker">
            <div className="picker-title">
              <strong>案件原因快速分類</strong>
              <small>先選主原因與細項，下方完整原因仍可補充。</small>
            </div>
            <label>
              主原因
              <select value={reasonGroup} onChange={(event) => changeReasonGroup(event.target.value)}>
                <option value="">請選擇主原因</option>
                {Object.keys(reasonGroups).map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            <label>
              細項
              <select
                value={reasonDetail}
                onChange={(event) => changeReasonDetail(event.target.value)}
                disabled={!reasonGroup || reasonGroup === "其他"}
              >
                <option value="">{reasonGroup === "其他" ? "請在下方自行輸入" : "請選擇細項"}</option>
                {(reasonGroups[reasonGroup] || []).map((detail) => (
                  <option key={detail} value={detail}>{detail}</option>
                ))}
                {reasonGroup && reasonGroup !== "其他" && <option value="__other__">其他／自行輸入</option>}
              </select>
            </label>
          </div>
          <label className="wide">
            完整案件原因
            <textarea
              name="reason"
              rows={4}
              value={reasonText}
              onChange={(event) => setReasonText(event.target.value)}
              placeholder="可補充案件來源、特殊情形或其他說明"
              required
            />
          </label>
          <label>
            案件狀態
            <select name="status" defaultValue={item?.status || "待處理"}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <small className="field-hint">只分成待處理、處理中及已結案三類。</small>
          </label>
          <label>
            目前進度（處理中）
            <select name="customStatus" defaultValue={item?.customStatus || ""}>
              <option value="">未設定</option>
              {progressOptions.map((progress) => (
                <option key={progress} value={progress}>{progress}</option>
              ))}
              {item?.customStatus && !progressOptions.includes(item.customStatus) && (
                <option value={item.customStatus}>{item.customStatus}</option>
              )}
            </select>
            <small className="field-hint">選擇細部進度，不必另外打字。</small>
          </label>
        </div>
      </div>
      <div className="form-section">
        <h3>{item ? "補傳系統畫面" : "系統畫面"}</h3>
        <div className="upload-grid">
          <label className="upload-box">
            <span className="upload-icon">▣</span>
            <strong>3-1 畫面</strong>
            <small>點一下拍照或選擇圖片</small>
            <input
              name="system31"
              type="file"
              accept="image/*"
              capture="environment"
              multiple={Boolean(item)}
            />
          </label>
          <label className="upload-box">
            <span className="upload-icon">⌖</span>
            <strong>圖資畫面</strong>
            <small>點一下拍照或選擇圖片</small>
            <input
              name="gis"
              type="file"
              accept="image/*"
              capture="environment"
              multiple={Boolean(item)}
            />
          </label>
        </div>
      </div>
    </>
  );
}

function RecordFields({
  record,
  currentStatus,
  busy = false,
  onApplySuggestedStatus,
}: {
  record?: FollowUp;
  currentStatus?: string;
  busy?: boolean;
  onApplySuggestedStatus?: (status: string, progress?: string) => void | Promise<void>;
}) {
  const [date, setDate] = useState(record?.date || today());
  const [method, setMethod] = useState(record?.method || "現場勘查");
  const [pointer, setPointer] = useState(record?.pointer || "");
  const [followUpDate, setFollowUpDate] = useState(record?.followUpDate || "");
  const [process, setProcess] = useState(record?.process || "");
  const [result, setResult] = useState(record?.result || "");
  const [nextStep, setNextStep] = useState(record?.nextStep || "");
  const [contactPerson, setContactPerson] = useState("");
  const [contactResult, setContactResult] = useState("");
  const [customerResponse, setCustomerResponse] = useState("");

  const statusSuggestion = useMemo(
    () => recommendedStatus(result, nextStep, contactResult),
    [contactResult, nextStep, result],
  );
  const progressSuggestion = useMemo(
    () => recommendedProgress(result, nextStep, contactResult),
    [contactResult, nextStep, result],
  );

  function applyQuickValue(
    value: string,
    setter: (value: string) => void,
    currentValue: string,
    append = false,
  ) {
    if (!value) return;
    setter(append && currentValue.trim() ? `${currentValue.trim()}\n${value}` : value);
  }

  function generateProcess() {
    const generated = buildFormalProcess({
      date,
      method,
      pointer,
      contactPerson,
      contactResult,
      customerResponse,
      result,
      nextStep,
      followUpDate,
    });
    if (process.trim() && process.trim() !== generated && !window.confirm("將依選單重新產生處理經過，原文字會被取代。確定繼續嗎？")) {
      return;
    }
    setProcess(generated);
  }

  return (
    <div className="field-grid">
      <label>
        日期
        <input name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <label>
        處理方式
        <select name="method" value={method} onChange={(event) => setMethod(event.target.value)}>
          {methods.map((methodOption) => (
            <option key={methodOption}>{methodOption}</option>
          ))}
        </select>
      </label>
      <label>
        現場指針
        <input
          name="pointer"
          inputMode="decimal"
          placeholder="例如 676"
          value={pointer}
          onChange={(event) => setPointer(event.target.value)}
        />
      </label>
      <label>
        下次追蹤日期
        <input
          name="followUpDate"
          type="date"
          value={followUpDate}
          onChange={(event) => setFollowUpDate(event.target.value)}
        />
      </label>

      <div className="contact-picker">
        <div className="picker-title">
          <strong>聯絡紀錄快速選擇</strong>
          <small>沒有聯絡用戶時可以全部留白。</small>
        </div>
        <label>
          聯絡對象
          <select value={contactPerson} onChange={(event) => setContactPerson(event.target.value)}>
            <option value="">未選擇</option>
            {contactPersonOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          聯絡結果
          <select value={contactResult} onChange={(event) => setContactResult(event.target.value)}>
            <option value="">未選擇</option>
            {contactResultOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          用戶回覆
          <select value={customerResponse} onChange={(event) => setCustomerResponse(event.target.value)}>
            <option value="">未選擇</option>
            {customerResponseOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <button type="button" className="generate-record" onClick={generateProcess}>
          產生／更新正式處理紀錄
        </button>
        {statusSuggestion && onApplySuggestedStatus && (statusSuggestion !== currentStatus || progressSuggestion) && (
          <div className="status-suggestion">
            <span>
              建議案件狀態改為「{statusSuggestion}」
              {progressSuggestion ? `，目前進度設為「${progressSuggestion}」` : ""}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onApplySuggestedStatus(statusSuggestion, progressSuggestion)}
            >
              一鍵套用
            </button>
          </div>
        )}
      </div>

      <label className="wide">
        處理經過
        <select
          className="quick-select"
          defaultValue=""
          onChange={(event) => {
            applyQuickValue(event.target.value, setProcess, process, true);
            event.target.value = "";
          }}
        >
          <option value="">帶入常用處理經過</option>
          {processOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <textarea name="process" rows={4} value={process} onChange={(event) => setProcess(event.target.value)} />
      </label>
      <label className="wide">
        處理結果
        <select
          className="quick-select"
          defaultValue=""
          onChange={(event) => {
            applyQuickValue(event.target.value, setResult, result);
            event.target.value = "";
          }}
        >
          <option value="">帶入常用處理結果</option>
          {resultOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <textarea name="result" rows={3} value={result} onChange={(event) => setResult(event.target.value)} />
      </label>
      <label className="wide">
        下一步
        <select
          className="quick-select"
          defaultValue=""
          onChange={(event) => {
            applyQuickValue(event.target.value, setNextStep, nextStep);
            event.target.value = "";
          }}
        >
          <option value="">帶入常用下一步</option>
          {nextStepOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <textarea name="nextStep" rows={3} value={nextStep} onChange={(event) => setNextStep(event.target.value)} />
      </label>
      <label className="wide media-input">
        照片或影片
        <input
          name="media"
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
        />
        <small>{record ? "可補傳新的附件；原附件會保留。" : "可直接拍照／錄影，也可從手機選擇多個檔案。"}</small>
      </label>
    </div>
  );
}

function AttachmentTiles({
  files,
  busy,
  onDelete,
}: {
  files: Attachment[];
  busy: boolean;
  onDelete: (file: Attachment) => void;
}) {
  if (!files.length) return null;
  return (
    <div className="attachment-grid">
      {files.map((file) => (
        <div className="attachment-tile" key={file.id}>
          <a href={file.url} target="_blank" rel="noreferrer">
            {file.contentType.startsWith("image/") ? (
              <img src={file.url} alt={file.filename} />
            ) : file.contentType.startsWith("video/") ? (
              <video src={file.url} muted playsInline />
            ) : (
              <span className="file-name">{file.filename}</span>
            )}
            <small>{categoryLabel(file.category)}</small>
          </a>
          <button type="button" onClick={() => onDelete(file)} disabled={busy}>
            刪除
          </button>
        </div>
      ))}
    </div>
  );
}

export default function InspectionApp({ userName }: { userName: string }) {
  const [cases, setCases] = useState<InspectionCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部");
  const [trackingFilter, setTrackingFilter] = useState<TrackingFilter>("all");
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingCase, setEditingCase] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordFormVersion, setRecordFormVersion] = useState(0);

  const selected = cases.find((item) => item.id === selectedId) ?? null;

  async function loadCases(selectId?: string) {
    try {
      setError("");
      const data = await api<{ cases: InspectionCase[] }>("/api/cases");
      setCases(data.cases.map(normalizeCase));
      if (selectId) setSelectedId(selectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法載入案件");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    api<{ cases: InspectionCase[] }>("/api/cases")
      .then((data) => {
        if (active) setCases(data.cases.map(normalizeCase));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "無法載入案件");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleCases = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/[\s-]/g, "");
    return cases.filter((item) => {
      const matchFilter = filter === "全部" || item.status === filter;
      const matchTracking = matchesTrackingFilter(item, trackingFilter);
      const haystack = [
        item.waterNumber,
        item.customerName,
        item.phone,
        item.address,
        item.meterNumber,
        item.reason,
        item.customStatus,
        ...item.records.flatMap((record) => [
          record.method,
          record.pointer,
          record.process,
          record.result,
          record.nextStep,
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .replace(/[\s-]/g, "");
      return matchFilter && matchTracking && (!needle || haystack.includes(needle));
    });
  }, [cases, filter, query, trackingFilter]);

  const counts = useMemo(
    () => ({
      pending: cases.filter((item) => item.status === "待處理").length,
      active: cases.filter((item) => item.status === "處理中").length,
      follow: cases.filter((item) => activeFollowUpDate(item) === today() && item.status !== "已結案").length,
      closed: cases.filter((item) => item.status === "已結案").length,
    }),
    [cases],
  );

  const trackingLabel = trackingOptions.find(([value]) => value === trackingFilter)?.[1] || "全部追蹤狀態";

  function openCase(id: string) {
    setSelectedId(id);
    setEditingCase(false);
    setEditingRecordId(null);
    setView("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadFiles(
    caseId: string,
    recordId: string | null,
    files: File[],
    category: string,
  ) {
    for (const file of files) {
      if (!file || file.size === 0) continue;
      const body = new FormData();
      body.set("caseId", caseId);
      if (recordId) body.set("recordId", recordId);
      body.set("category", category);
      body.set("file", file);
      await api("/api/uploads", { method: "POST", body });
    }
  }

  async function uploadCaseFormFiles(caseId: string, data: FormData) {
    await uploadFiles(caseId, null, data.getAll("system31") as File[], "system31");
    await uploadFiles(caseId, null, data.getAll("gis") as File[], "gis");
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await api<{ case: InspectionCase }>("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(casePayload(data)),
      });
      await uploadCaseFormFiles(result.case.id, data);
      await loadCases(result.case.id);
      setView("detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "案件建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api(`/api/cases/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(casePayload(data)),
      });
      await uploadCaseFormFiles(selected.id, data);
      await loadCases(selected.id);
      setEditingCase(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "案件修改失敗");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: string, progress?: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const customStatus = status === "處理中" ? (progress ?? selected.customStatus) : "";
      await api(`/api/cases/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, customStatus }),
      });
      await loadCases(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "狀態更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function updateProgress(progress: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const status = progress ? "處理中" : selected.status;
      await api(`/api/cases/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, customStatus: progress }),
      });
      await loadCases(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "進度更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await api<{ record: FollowUp }>(
        `/api/cases/${selected.id}/records`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(recordPayload(data)),
        },
      );
      await uploadFiles(selected.id, result.record.id, data.getAll("media") as File[], "record");
      form.reset();
      setRecordFormVersion((version) => version + 1);
      await loadCases(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "紀錄新增失敗");
    } finally {
      setBusy(false);
    }
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>, record: FollowUp) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api(`/api/cases/${selected.id}/records/${record.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(recordPayload(data)),
      });
      await uploadFiles(selected.id, record.id, data.getAll("media") as File[], "record");
      await loadCases(selected.id);
      setEditingRecordId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "紀錄修改失敗");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(record: FollowUp) {
    if (!selected || !window.confirm(`確定刪除 ${formatDate(record.date)} 的處理紀錄嗎？`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/cases/${selected.id}/records/${record.id}`, { method: "DELETE" });
      await loadCases(selected.id);
      setEditingRecordId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "紀錄刪除失敗");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAttachment(file: Attachment) {
    if (!selected || !window.confirm(`確定刪除「${file.filename}」嗎？`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/uploads/${file.id}`, { method: "DELETE" });
      await loadCases(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "附件刪除失敗");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCase() {
    if (!selected) return;
    const first = window.confirm(
      `確定要刪除 ${selected.customerName || "未填姓名"}（${selected.waterNumber}）整件案件嗎？\n處理紀錄、照片及影片也會一併刪除。`,
    );
    if (!first) return;
    const typed = window.prompt(`為避免誤刪，請輸入水號：${selected.waterNumber}`);
    if (normalizeWaterNumber(typed || "") !== selected.waterNumber) {
      window.alert("水號不符，已取消刪除。");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api(`/api/cases/${selected.id}`, { method: "DELETE" });
      setSelectedId(null);
      setEditingCase(false);
      setEditingRecordId(null);
      setView("list");
      await loadCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : "案件刪除失敗");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="center-screen">
        <div className="loader" />
        <p>正在載入案件…</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <style>{extraStyles}</style>
      <header className="topbar">
        <div>
          <p className="eyebrow">私人工作紀錄</p>
          <h1>稽查案件追蹤</h1>
        </div>
        <div className="account">
          <span>{userName}</span>
          <a href="/signout-with-chatgpt?return_to=/">登出</a>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="關閉">
            ×
          </button>
        </div>
      )}

      {view === "list" && (
        <>
          <section className="summary-grid" aria-label="案件摘要">
            <button
              className="summary-card blue"
              onClick={() => {
                setFilter("待處理");
                setTrackingFilter("all");
              }}
            >
              <span>待處理</span>
              <strong>{counts.pending}</strong>
            </button>
            <button
              className="summary-card amber"
              onClick={() => {
                setFilter("處理中");
                setTrackingFilter("all");
              }}
            >
              <span>處理中</span>
              <strong>{counts.active}</strong>
            </button>
            <button
              className="summary-card red"
              onClick={() => {
                setFilter("全部");
                setTrackingFilter("today");
              }}
            >
              <span>今日追蹤</span>
              <strong>{counts.follow}</strong>
            </button>
            <button
              className="summary-card green"
              onClick={() => {
                setFilter("已結案");
                setTrackingFilter("closed");
              }}
            >
              <span>已結案</span>
              <strong>{counts.closed}</strong>
            </button>
          </section>

          <section className="toolbar">
            <label className="search">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋水號、姓名、地址、進度或處理內容"
              />
            </label>
            <div className="filter-row">
              {["全部", ...statuses].map((status) => (
                <button
                  key={status}
                  className={filter === status ? "filter active" : "filter"}
                  onClick={() => {
                    setFilter(status);
                    setTrackingFilter(status === "已結案" ? "closed" : "all");
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="tracking-filter-bar">
              <label htmlFor="tracking-filter">追蹤篩選</label>
              <select
                id="tracking-filter"
                value={trackingFilter}
                onChange={(event) => setTrackingFilter(event.target.value as TrackingFilter)}
              >
                {trackingOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="case-list">
            <div className="section-heading">
              <div>
                <p className="eyebrow">案件清單</p>
                <h2>
                  {filter === "全部" ? "全部案件" : filter}
                  {trackingFilter !== "all" ? `｜${trackingLabel}` : ""}
                </h2>
              </div>
              <span>{visibleCases.length} 件</span>
            </div>

            {visibleCases.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">＋</div>
                <h3>{cases.length ? "找不到符合的案件" : "建立第一件稽查案件"}</h3>
                <p>
                  {cases.length
                    ? "請調整搜尋文字或案件狀態。"
                    : "水號、現場照片及每次處理經過都會集中保存在這裡。"}
                </p>
                {!cases.length && (
                  <button className="primary" onClick={() => setView("new")}>
                    新增案件
                  </button>
                )}
              </div>
            ) : (
              <div className="cards">
                {visibleCases.map((item) => {
                  const nextDate = activeFollowUpDate(item);
                  const latestRecord = item.records[0];
                  return (
                    <button key={item.id} className="case-card" onClick={() => openCase(item.id)}>
                      <div className="case-card-top">
                        <span className={`status status-${item.status}`}>{caseStatusLabel(item)}</span>
                        <span className="water-no">{item.waterNumber}</span>
                      </div>
                      <h3>{item.customerName || "未填姓名"}</h3>
                      <p className="address">{item.address || "未填地址"}</p>
                      {caseProgressLabel(item) && (
                        <p className="case-progress">目前進度：{caseProgressLabel(item)}</p>
                      )}
                      <div className="case-meta">
                        <span>收件 {formatDate(item.receivedDate)}</span>
                        {nextDate && (
                          <span className={isOverdue(nextDate, item.status) ? "due" : ""}>
                            追蹤 {formatDate(nextDate)}
                          </span>
                        )}
                      </div>
                      {latestRecord && (
                        <div className="latest-action-summary">
                          <strong>最近處理：{formatDate(latestRecord.date)}・{latestRecord.method}</strong>
                          <span>{latestRecord.process || latestRecord.result || "未填處理摘要"}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          <button className="fab" onClick={() => setView("new")}>
            <span>＋</span> 新增案件
          </button>
        </>
      )}

      {view === "new" && (
        <section className="form-page">
          <button className="back" onClick={() => setView("list")}>
            ← 返回案件清單
          </button>
          <div className="form-title">
            <p className="eyebrow">NEW CASE</p>
            <h2>新增稽查案件</h2>
            <p>先建立基本資料，之後可持續加入每次處理紀錄。</p>
          </div>
          <form onSubmit={createCase} className="data-form">
            <CaseFields cases={cases} />
            <button className="primary submit" disabled={busy}>
              {busy ? "正在建立…" : "建立案件"}
            </button>
          </form>
        </section>
      )}

      {view === "detail" && selected && (
        <section className="detail-page">
          <button className="back" onClick={() => setView("list")}>
            ← 返回案件清單
          </button>
          <div className="detail-hero">
            <div>
              <div className="detail-tags">
                <span className={`status status-${selected.status}`}>{caseStatusLabel(selected)}</span>
                {caseProgressLabel(selected) && <span className="progress-tag">{caseProgressLabel(selected)}</span>}
                <span>{selected.waterNumber}</span>
              </div>
              <h2>{selected.customerName || "未填姓名"}</h2>
              <p>{selected.reason || "尚未填寫案件原因"}</p>
            </div>
            <div className="detail-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditingCase((value) => !value)}
                disabled={busy}
              >
                {editingCase ? "取消編輯" : "編輯基本資料"}
              </button>
              <label className="status-select compact">
                更新狀態
                <select
                  value={selected.status}
                  onChange={(event) => void updateStatus(event.target.value)}
                  disabled={busy}
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="status-select compact">
                目前進度
                <select
                  value={selected.customStatus}
                  onChange={(event) => void updateProgress(event.target.value)}
                  disabled={busy}
                >
                  <option value="">未設定</option>
                  {progressOptions.map((progress) => (
                    <option key={progress} value={progress}>{progress}</option>
                  ))}
                  {selected.customStatus && !progressOptions.includes(selected.customStatus) && (
                    <option value={selected.customStatus}>{selected.customStatus}</option>
                  )}
                </select>
              </label>
            </div>
          </div>

          <div className="date-overview" aria-label="案件日期摘要">
            <div className="date-overview-item">
              <span>收件日期</span>
              <strong>{formatDate(selected.receivedDate)}</strong>
            </div>
            <div className="date-overview-item">
              <span>最近處理</span>
              <strong>{selected.records[0] ? formatDate(selected.records[0].date) : "尚無紀錄"}</strong>
              {selected.records[0] && <small>{selected.records[0].method}</small>}
            </div>
            <div className={isOverdue(activeFollowUpDate(selected), selected.status) ? "date-overview-item overdue" : "date-overview-item"}>
              <span>下次追蹤</span>
              <strong>{activeFollowUpDate(selected) ? formatDate(activeFollowUpDate(selected)) : "未設定"}</strong>
              {isOverdue(activeFollowUpDate(selected), selected.status) && <small>已逾期，請優先處理</small>}
            </div>
            <div className="date-overview-item">
              <span>結案日期</span>
              <strong>{selected.status === "已結案" && selected.records[0] ? formatDate(selected.records[0].date) : "未結案"}</strong>
            </div>
          </div>

          {editingCase && (
            <form key={selected.updatedAt} onSubmit={saveCase} className="edit-panel data-form">
              <h3>修改案件基本資料</h3>
              <CaseFields item={selected} cases={cases} />
              <div className="form-actions">
                <button type="button" className="secondary" onClick={() => setEditingCase(false)}>
                  取消
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "正在儲存…" : "儲存修改"}
                </button>
              </div>
            </form>
          )}

          <div className="detail-layout">
            <aside className="profile-card">
              <h3>案件基本資料</h3>
              <dl>
                <div>
                  <dt>電話</dt>
                  <dd>{selected.phone ? <a href={`tel:${selected.phone}`}>{selected.phone}</a> : "未填"}</dd>
                </div>
                <div>
                  <dt>地址</dt>
                  <dd>{selected.address || "未填"}</dd>
                </div>
                <div>
                  <dt>座標</dt>
                  <dd>
                    {selected.coordinates ? (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(mapCoordinates(selected.coordinates))}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selected.coordinates} ↗
                      </a>
                    ) : (
                      "未填"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>表號</dt>
                  <dd>{selected.meterNumber || "未填"}</dd>
                </div>
                <div>
                  <dt>收件日期</dt>
                  <dd>{formatDate(selected.receivedDate)}</dd>
                </div>
              </dl>

              <div className="system-images">
                <h4>系統畫面與案件附件</h4>
                {selected.attachments.length ? (
                  <AttachmentTiles files={selected.attachments} busy={busy} onDelete={deleteAttachment} />
                ) : (
                  <p>尚未上傳系統畫面。</p>
                )}
              </div>

              <div className="danger-zone">
                <button type="button" className="danger" onClick={deleteCase} disabled={busy}>
                  刪除整件案件
                </button>
              </div>
            </aside>

            <div className="timeline-column">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">處理歷程</p>
                  <h2>{selected.records.length} 次紀錄</h2>
                </div>
              </div>

              {selected.records.length === 0 ? (
                <div className="timeline-empty">尚無處理紀錄，請在下方新增第一次處理。</div>
              ) : (
                <div className="timeline">
                  {selected.records.map((record, index) => {
                    const previousDate = selected.records[index - 1]?.date;
                    return (
                      <Fragment key={record.id}>
                        {record.date !== previousDate && (
                          <div className="timeline-date-divider">{formatDate(record.date, true)}</div>
                        )}
                        <article className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-card">
                        {editingRecordId === record.id ? (
                          <form
                            className="record-edit"
                            onSubmit={(event) => void saveRecord(event, record)}
                          >
                            <div className="record-head-actions">
                              <strong>修改處理紀錄</strong>
                              <div className="record-actions">
                                <button
                                  type="button"
                                  className="text-button"
                                  onClick={() => setEditingRecordId(null)}
                                >
                                  取消
                                </button>
                                <button className="primary" disabled={busy}>
                                  {busy ? "儲存中…" : "儲存修改"}
                                </button>
                              </div>
                            </div>
                            <RecordFields record={record} currentStatus={selected.status} busy={busy} onApplySuggestedStatus={updateStatus} />
                            {record.attachments.length > 0 && (
                              <div className="mini-upload">
                                <h4>原有附件</h4>
                                <AttachmentTiles
                                  files={record.attachments}
                                  busy={busy}
                                  onDelete={deleteAttachment}
                                />
                              </div>
                            )}
                          </form>
                        ) : (
                          <>
                            <div className="record-head-actions">
                              <div className="record-head">
                                <strong>{record.method}</strong>
                                <time>{formatDate(record.date)}</time>
                                {createdAtLabel(record.createdAt) && (
                                  <small className="record-created-at">{createdAtLabel(record.createdAt)}</small>
                                )}
                              </div>
                              <div className="record-actions">
                                <button
                                  type="button"
                                  className="text-button"
                                  onClick={() => setEditingRecordId(record.id)}
                                  disabled={busy}
                                >
                                  編輯
                                </button>
                                <button
                                  type="button"
                                  className="text-button danger-text"
                                  onClick={() => void deleteRecord(record)}
                                  disabled={busy}
                                >
                                  刪除
                                </button>
                              </div>
                            </div>
                            {record.pointer && <p className="pointer">現場指針：{record.pointer} 度</p>}
                            <p>{record.process || "未填寫處理經過"}</p>
                            {record.result && (
                              <div className="record-block">
                                <span>處理結果</span>
                                <p>{record.result}</p>
                              </div>
                            )}
                            {record.nextStep && (
                              <div className="record-block next">
                                <span>下一步</span>
                                <p>{record.nextStep}</p>
                              </div>
                            )}
                            {record.followUpDate && (
                              <div
                                className={
                                  isOverdue(record.followUpDate, selected.status)
                                    ? "follow-date overdue"
                                    : "follow-date"
                                }
                              >
                                下次追蹤：{formatDate(record.followUpDate)}
                              </div>
                            )}
                            {record.attachments.length > 0 && (
                              <div className="mini-upload">
                                <AttachmentTiles
                                  files={record.attachments}
                                  busy={busy}
                                  onDelete={deleteAttachment}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                        </article>
                      </Fragment>
                    );
                  })}
                </div>
              )}

              <form key={recordFormVersion} onSubmit={addRecord} className="record-form">
                <div className="record-form-title">
                  <span>＋</span>
                  <div>
                    <h3>新增處理紀錄</h3>
                    <p>每次聯絡、現勘或回覆都記在同一案件。</p>
                  </div>
                </div>
                <RecordFields currentStatus={selected.status} busy={busy} onApplySuggestedStatus={updateStatus} />
                <button className="primary submit" disabled={busy}>
                  {busy ? "正在儲存…" : "儲存本次紀錄"}
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
