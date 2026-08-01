from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# Main application
path = Path("app/inspection-app.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";\n',
    'import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";\nimport {\n  CASE_PROGRESS_OPTIONS,\n  CASE_STATUSES,\n  coerceCaseStatus,\n  recommendCaseUpdate,\n} from "./case-status.js";\n',
    "inspection imports",
)
old_status_block = '''const statuses = ["待處理", "處理中", "已結案"];

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
'''
new_status_block = '''const statuses = CASE_STATUSES;
const progressOptions = CASE_PROGRESS_OPTIONS;

function normalizeCase(item: InspectionCase): InspectionCase {
  const normalized = coerceCaseStatus(item.status, item.customStatus);
  return {
    ...item,
    status: normalized.status,
    customStatus: normalized.customStatus,
  };
}
'''
text = replace_once(text, old_status_block, new_status_block, "inspection status block")
text, count = re.subn(
    r'function recommendedStatus\(.*?\nfunction stripTrailingPunctuation',
    'function stripTrailingPunctuation',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError(f"recommendation functions: expected 1 match, found {count}")
text = replace_once(
    text,
    '  const [reasonText, setReasonText] = useState(item?.reason || "");\n',
    '  const [reasonText, setReasonText] = useState(item?.reason || "");\n  const [caseStatus, setCaseStatus] = useState(item?.status || "待處理");\n  const [caseProgress, setCaseProgress] = useState(\n    item?.status === "處理中" ? item.customStatus : "",\n  );\n',
    "case field state",
)
old_case_selects = '''          <label>
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
          </label>'''
new_case_selects = '''          <label>
            案件狀態
            <select
              name="status"
              value={caseStatus}
              onChange={(event) => {
                const nextStatus = event.target.value;
                setCaseStatus(nextStatus);
                if (nextStatus !== "處理中") setCaseProgress("");
              }}
            >
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <small className="field-hint">只分成待處理、處理中及已結案三類。</small>
          </label>
          <label>
            目前進度（處理中）
            <select
              name="customStatus"
              value={caseProgress}
              onChange={(event) => setCaseProgress(event.target.value)}
              disabled={caseStatus !== "處理中"}
            >
              <option value="">未設定</option>
              {progressOptions.map((progress) => (
                <option key={progress} value={progress}>{progress}</option>
              ))}
              {item?.customStatus && !progressOptions.includes(item.customStatus) && (
                <option value={item.customStatus}>{item.customStatus}</option>
              )}
            </select>
            <small className="field-hint">
              {caseStatus === "處理中" ? "選擇細部進度，不必另外打字。" : "只有處理中案件需要設定進度。"}
            </small>
          </label>'''
text = replace_once(text, old_case_selects, new_case_selects, "case status selects")
text = replace_once(
    text,
    '''  record,
  currentStatus,
  busy = false,
  onApplySuggestedStatus,
}: {
  record?: FollowUp;
  currentStatus?: string;
  busy?: boolean;
  onApplySuggestedStatus?: (status: string, progress?: string) => void | Promise<void>;
}) {''',
    '''  record,
  currentStatus,
  currentProgress,
  busy = false,
  onApplySuggestedStatus,
}: {
  record?: FollowUp;
  currentStatus?: string;
  currentProgress?: string;
  busy?: boolean;
  onApplySuggestedStatus?: (status: string, progress?: string) => void | Promise<void>;
}) {''',
    "record props",
)
old_memos = '''  const statusSuggestion = useMemo(
    () => recommendedStatus(result, nextStep, contactResult),
    [contactResult, nextStep, result],
  );
  const progressSuggestion = useMemo(
    () => recommendedProgress(result, nextStep, contactResult),
    [contactResult, nextStep, result],
  );'''
new_memos = '''  const statusSuggestion = useMemo(
    () => recommendCaseUpdate({ result, nextStep, contactResult, followUpDate }),
    [contactResult, followUpDate, nextStep, result],
  );'''
text = replace_once(text, old_memos, new_memos, "recommendation memo")
old_suggestion = '''        {statusSuggestion && onApplySuggestedStatus && (statusSuggestion !== currentStatus || progressSuggestion) && (
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
        )}'''
new_suggestion = '''        {statusSuggestion && onApplySuggestedStatus && (
          statusSuggestion.status !== currentStatus ||
          statusSuggestion.customStatus !== (currentProgress || "")
        ) && (
          <div className="status-suggestion">
            <span>
              建議案件狀態改為「{statusSuggestion.status}」
              {statusSuggestion.customStatus ? `，目前進度設為「${statusSuggestion.customStatus}」` : ""}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onApplySuggestedStatus(
                statusSuggestion.status,
                statusSuggestion.customStatus,
              )}
            >
              一鍵套用
            </button>
          </div>
        )}'''
text = replace_once(text, old_suggestion, new_suggestion, "suggestion display")
text = text.replace(
    '<RecordFields record={record} currentStatus={selected.status} busy={busy} onApplySuggestedStatus={updateStatus} />',
    '<RecordFields record={record} currentStatus={selected.status} currentProgress={selected.customStatus} busy={busy} onApplySuggestedStatus={updateStatus} />',
)
text = text.replace(
    '<RecordFields currentStatus={selected.status} busy={busy} onApplySuggestedStatus={updateStatus} />',
    '<RecordFields currentStatus={selected.status} currentProgress={selected.customStatus} busy={busy} onApplySuggestedStatus={updateStatus} />',
)
text = replace_once(
    text,
    '                  disabled={busy}\n                >\n                  <option value="">未設定</option>\n                  {progressOptions.map((progress) => (',
    '                  disabled={busy || selected.status !== "處理中"}\n                >\n                  <option value="">未設定</option>\n                  {progressOptions.map((progress) => (',
    "detail progress disabled",
)
text = replace_once(
    text,
    '                placeholder="搜尋水號、姓名、地址、表號"',
    '                placeholder="搜尋水號、姓名、地址、表號或處理內容"',
    "search placeholder",
)
path.write_text(text)


# Journal uses the same compatibility rules.
path = Path("app/journal/journal-client.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { useEffect, useMemo, useState } from "react";\n',
    'import { useEffect, useMemo, useState } from "react";\nimport { coerceCaseStatus } from "../case-status.js";\n',
    "journal import",
)
old_journal_labels = '''function statusLabel(item: InspectionCase) {
  if (item.status === "待處理" || item.status === "處理中" || item.status === "已結案") {
    return item.status;
  }
  return "處理中";
}

function progressLabel(item: InspectionCase) {
  if (item.customStatus) return item.customStatus;
  if (item.status !== "待處理" && item.status !== "處理中" && item.status !== "已結案") {
    return item.status;
  }
  return "";
}'''
new_journal_labels = '''function statusLabel(item: InspectionCase) {
  return coerceCaseStatus(item.status, item.customStatus).status;
}

function progressLabel(item: InspectionCase) {
  return coerceCaseStatus(item.status, item.customStatus).customStatus;
}'''
text = replace_once(text, old_journal_labels, new_journal_labels, "journal labels")
path.write_text(text)


# Import page: three statuses, backward-compatible CSV aliases, and default progress.
path = Path("app/import/import-app.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { ChangeEvent, useMemo, useState } from "react";\n',
    'import { ChangeEvent, useMemo, useState } from "react";\nimport { CASE_PROGRESS_OPTIONS, CASE_STATUSES } from "../case-status.js";\n',
    "import page imports",
)
text = replace_once(
    text,
    'const statuses = ["待處理", "聯絡未果", "待現勘", "處理中", "待用戶回覆", "待複查", "已結案", "其他"];',
    'const statuses = CASE_STATUSES;\nconst progressOptions = CASE_PROGRESS_OPTIONS;',
    "import statuses",
)
text = replace_once(
    text,
    '{ key: "customStatus", label: "其他狀態說明" },',
    '{ key: "customStatus", label: "目前進度" },',
    "import header label",
)
text = replace_once(
    text,
    '  其他狀態說明: "customStatus", 其他状态说明: "customStatus", customstatus: "customStatus",',
    '  目前進度: "customStatus", 当前进度: "customStatus", 其他狀態說明: "customStatus", 其他状态说明: "customStatus", customstatus: "customStatus",',
    "import aliases",
)
text = replace_once(
    text,
    '  const [defaultStatus, setDefaultStatus] = useState("處理中");\n',
    '  const [defaultStatus, setDefaultStatus] = useState("處理中");\n  const [defaultProgress, setDefaultProgress] = useState("持續處理中");\n',
    "default progress state",
)
text = replace_once(
    text,
    'body: JSON.stringify({ rows: parsed.rows, defaultStatus, defaultReason, defaultReceivedDate })',
    'body: JSON.stringify({ rows: parsed.rows, defaultStatus, defaultCustomStatus: defaultProgress, defaultReason, defaultReceivedDate })',
    "import request body",
)
text = replace_once(
    text,
    'placeholder={mode === "31" ? "請在 31 畫面按 Ctrl+A、Ctrl+C，再貼到此處……" : "水號,姓名,電話,地址,座標,表號,案件原因,收件日期,案件狀態,其他狀態說明"}',
    'placeholder={mode === "31" ? "請在 31 畫面按 Ctrl+A、Ctrl+C，再貼到此處……" : "水號,姓名,電話,地址,座標,表號,案件原因,收件日期,案件狀態,目前進度"}',
    "import placeholder",
)
old_import_fields = '''          <label className="import-field">案件狀態<select value={defaultStatus} onChange={(event) => setDefaultStatus(event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="import-field">收件日期<input value={defaultReceivedDate} onChange={(event) => setDefaultReceivedDate(event.target.value)} placeholder="例如 115/07/27，可留白" /></label>'''
new_import_fields = '''          <label className="import-field">案件狀態<select value={defaultStatus} onChange={(event) => { const status = event.target.value; setDefaultStatus(status); if (status !== "處理中") setDefaultProgress(""); else if (!defaultProgress) setDefaultProgress("持續處理中"); }}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="import-field">目前進度<select value={defaultProgress} onChange={(event) => setDefaultProgress(event.target.value)} disabled={defaultStatus !== "處理中"}><option value="">未設定</option>{progressOptions.map((progress) => <option key={progress}>{progress}</option>)}</select></label>
          <label className="import-field">收件日期<input value={defaultReceivedDate} onChange={(event) => setDefaultReceivedDate(event.target.value)} placeholder="例如 115/07/27，可留白" /></label>'''
text = replace_once(text, old_import_fields, new_import_fields, "import fields")
path.write_text(text)
