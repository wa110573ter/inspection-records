export const CASE_STATUSES = Object.freeze(["待處理", "處理中", "已結案"]);

export const CASE_PROGRESS_OPTIONS = Object.freeze([
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
]);

const LEGACY_STATUS_PROGRESS = new Map([
  ["聯絡未果", "聯絡未果"],
  ["待現勘", "待現場勘查"],
  ["待用戶回覆", "已聯絡，待用戶回覆"],
  ["待複查", "待複查"],
  ["其他", "持續處理中"],
]);

const CLOSE_READY_RESULTS = new Set([
  "已完成處理",
  "已向用戶說明並取得諒解",
  "確認抄表無誤",
  "未發現漏水",
  "已完成複查",
  "已完成改單／退費／扣抵",
  "已完成退費或下期扣抵",
  "已轉相關單位處理",
  "已結案",
]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Strictly validates a write request while accepting known legacy statuses.
 * Non-processing statuses never keep a progress value.
 *
 * @param {unknown} status
 * @param {unknown} customStatus
 * @returns {{ status: string; customStatus: string; migrated: boolean } | null}
 */
export function normalizeCaseStatus(status, customStatus = "") {
  const statusText = clean(status);
  const progressText = clean(customStatus);

  if (CASE_STATUSES.includes(statusText)) {
    return {
      status: statusText,
      customStatus: statusText === "處理中" ? progressText : "",
      migrated: false,
    };
  }

  const legacyProgress = LEGACY_STATUS_PROGRESS.get(statusText);
  if (legacyProgress) {
    return {
      status: "處理中",
      customStatus: progressText || legacyProgress,
      migrated: true,
    };
  }

  return null;
}

/**
 * Safely presents old or unexpected stored data without breaking the UI.
 * Writes still use normalizeCaseStatus and reject unknown values.
 *
 * @param {unknown} status
 * @param {unknown} customStatus
 */
export function coerceCaseStatus(status, customStatus = "") {
  const normalized = normalizeCaseStatus(status, customStatus);
  if (normalized) return normalized;

  const statusText = clean(status);
  const progressText = clean(customStatus);
  return {
    status: "處理中",
    customStatus: progressText || statusText || "持續處理中",
    migrated: true,
  };
}

function inferProgress(combined) {
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
  if (combined.includes("現勘") || combined.includes("現場無人在家")) return "待現場勘查";
  if (combined.includes("後續用水量") || combined.includes("下一期用水量")) return "等待後續用水量";
  if (combined.includes("改單") || combined.includes("退費") || combined.includes("扣抵")) {
    return "待辦理改單／退費／扣抵";
  }
  if (combined.includes("簽報") || combined.includes("內部簽辦")) return "待內部簽辦";
  if (combined.includes("自行檢查")) return "等待用戶自行檢查";
  if (combined.includes("修繕")) return "等待用戶修繕";
  if (combined.includes("照片") || combined.includes("資料") || combined.includes("收據")) {
    return "等待用戶提供資料";
  }
  if (combined.includes("回覆")) return "已聯絡，待用戶回覆";
  if (combined.includes("相關單位")) return "已轉相關單位";
  return "持續處理中";
}

/**
 * Returns a safe recommendation. A follow-up date or actionable next step
 * always prevents an automatic close recommendation.
 *
 * @param {{ result?: unknown; nextStep?: unknown; contactResult?: unknown; followUpDate?: unknown }} values
 * @returns {{ status: string; customStatus: string } | null}
 */
export function recommendCaseUpdate(values) {
  const result = clean(values?.result);
  const nextStep = clean(values?.nextStep);
  const contactResult = clean(values?.contactResult);
  const followUpDate = clean(values?.followUpDate);
  const combined = `${result} ${nextStep} ${contactResult}`.trim();

  if (!combined && !followUpDate) return null;

  const closingNextStep = nextStep === "無，案件可結案";
  const actionableNextStep = Boolean(nextStep && !closingNextStep);
  const closeReadyResult = CLOSE_READY_RESULTS.has(result) || result.includes("可結案");

  if (!followUpDate && !actionableNextStep && (closingNextStep || closeReadyResult)) {
    return { status: "已結案", customStatus: "" };
  }

  return {
    status: "處理中",
    customStatus: inferProgress(combined),
  };
}
