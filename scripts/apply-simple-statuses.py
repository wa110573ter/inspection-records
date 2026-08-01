from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


app_path = Path("app/inspection-app.tsx")
text = app_path.read_text()

text = replace_once(
    text,
    '''const statuses = [
  "待處理",
  "聯絡未果",
  "待現勘",
  "處理中",
  "待用戶回覆",
  "待複查",
  "已結案",
  "其他",
];''',
    '''const statuses = ["待處理", "處理中", "已結案"];

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
}''',
    "simplify statuses",
)

text = replace_once(
    text,
    '''const processOptions = [
  "電話聯繫用戶，說明案件情形。",
  "現場抄錄水表指針。",
  "核對前期抄表指數及用水量。",
  "檢查水表及表後管線是否有漏水情形。",
  "向用戶說明目前用水情形。",
  "收到用戶回傳的照片或資料。",
  "查詢3-1系統及相關資料。",
];''',
    '''const processOptions = [
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
];''',
    "expand process options",
)

text = replace_once(
    text,
    '''const resultOptions = [
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
];''',
    '''const resultOptions = [
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
];''',
    "expand result options",
)

text = replace_once(
    text,
    '''const nextStepOptions = [
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
];''',
    '''const nextStepOptions = [
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
];''',
    "expand next step options",
)

text = replace_once(
    text,
    '''  .latest-action-summary span{display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}''',
    '''  .latest-action-summary span{display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .case-progress{margin:9px 0 0;padding:7px 9px;border-radius:9px;background:#fff8e8;color:#805a0d;font-size:.72rem;font-weight:850}
  .detail-tags .progress-tag{background:#fff3ce;color:#77530b}''',
    "add progress styles",
)

text = replace_once(
    text,
    '''function caseStatusLabel(item: InspectionCase) {
  return item.status === "其他" && item.customStatus ? item.customStatus : item.status;
}''',
    '''function caseStatusLabel(item: InspectionCase) {
  return item.status;
}

function caseProgressLabel(item: InspectionCase) {
  return item.customStatus.trim();
}''',
    "status and progress labels",
)

text = replace_once(
    text,
    '''function recommendedStatus(result: string, nextStep: string, contactResult: string) {
  const combined = `${result} ${nextStep} ${contactResult}`.trim();
  if (!combined) return null;
  if (combined.includes("結案") || combined.includes("無，案件可結案")) return "已結案";
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
  if (combined.includes("現勘")) return "待現勘";
  if (combined.includes("等待用戶") || combined.includes("修繕") || combined.includes("回覆")) {
    return "待用戶回覆";
  }
  return "處理中";
}''',
    '''function recommendedStatus(result: string, nextStep: string, contactResult: string) {
  const combined = `${result} ${nextStep} ${contactResult}`.trim();
  if (!combined) return null;
  if (
    combined.includes("已完成處理") ||
    combined.includes("已結案") ||
    combined.includes("無，案件可結案")
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
}''',
    "simplify recommendations",
)

text = replace_once(
    text,
    '''function casePayload(data: FormData) {
  return {
    waterNumber: normalizeWaterNumber(String(data.get("waterNumber") || "")),
    customerName: String(data.get("customerName") || ""),
    phone: String(data.get("phone") || ""),
    address: String(data.get("address") || ""),
    coordinates: String(data.get("coordinates") || ""),
    meterNumber: String(data.get("meterNumber") || ""),
    reason: String(data.get("reason") || ""),
    receivedDate: String(data.get("receivedDate") || ""),
    status: String(data.get("status") || "待處理"),
    customStatus: String(data.get("customStatus") || ""),
  };
}''',
    '''function casePayload(data: FormData) {
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
}''',
    "normalize case payload",
)

text = replace_once(
    text,
    '''          <label>
            案件狀態
            <select name="status" defaultValue={item?.status || "待處理"}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            其他狀態說明
            <input name="customStatus" defaultValue={item?.customStatus} />
          </label>''',
    '''          <label>
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
          </label>''',
    "replace custom status input",
)

text = replace_once(
    text,
    '''  onApplySuggestedStatus?: (status: string) => void | Promise<void>;''',
    '''  onApplySuggestedStatus?: (status: string, progress?: string) => void | Promise<void>;''',
    "status callback type",
)

text = replace_once(
    text,
    '''  const statusSuggestion = useMemo(
    () => recommendedStatus(result, nextStep, contactResult),
    [contactResult, nextStep, result],
  );''',
    '''  const statusSuggestion = useMemo(
    () => recommendedStatus(result, nextStep, contactResult),
    [contactResult, nextStep, result],
  );
  const progressSuggestion = useMemo(
    () => recommendedProgress(result, nextStep, contactResult),
    [contactResult, nextStep, result],
  );''',
    "progress recommendation memo",
)

text = replace_once(
    text,
    '''        {statusSuggestion && statusSuggestion !== currentStatus && onApplySuggestedStatus && (
          <div className="status-suggestion">
            <span>依本次結果，建議案件狀態改為「{statusSuggestion}」</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onApplySuggestedStatus(statusSuggestion)}
            >
              套用建議狀態
            </button>
          </div>
        )}''',
    '''        {statusSuggestion && onApplySuggestedStatus && (statusSuggestion !== currentStatus || progressSuggestion) && (
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
        )}''',
    "apply status and progress suggestion",
)

text = text.replace("setCases(data.cases);", "setCases(data.cases.map(normalizeCase));")
if text.count("setCases(data.cases.map(normalizeCase));") != 2:
    raise RuntimeError("normalize loaded cases: expected 2 replacements")

text = replace_once(
    text,
    '''        item.meterNumber,
        item.reason,
      ]''',
    '''        item.meterNumber,
        item.reason,
        item.customStatus,
        ...item.records.flatMap((record) => [
          record.method,
          record.pointer,
          record.process,
          record.result,
          record.nextStep,
        ]),
      ]''',
    "expand search haystack",
)

text = replace_once(
    text,
    '''  const counts = useMemo(
    () => ({
      open: cases.filter((item) => item.status !== "已結案").length,
      follow: cases.filter((item) => activeFollowUpDate(item) === today() && item.status !== "已結案").length,
      overdue: cases.filter((item) => isOverdue(activeFollowUpDate(item), item.status)).length,
      closed: cases.filter((item) => item.status === "已結案").length,
    }),
    [cases],
  );''',
    '''  const counts = useMemo(
    () => ({
      pending: cases.filter((item) => item.status === "待處理").length,
      active: cases.filter((item) => item.status === "處理中").length,
      follow: cases.filter((item) => activeFollowUpDate(item) === today() && item.status !== "已結案").length,
      closed: cases.filter((item) => item.status === "已結案").length,
    }),
    [cases],
  );''',
    "simplify counts",
)

text = replace_once(
    text,
    '''  async function updateStatus(status: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/api/cases/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await loadCases(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "狀態更新失敗");
    } finally {
      setBusy(false);
    }
  }''',
    '''  async function updateStatus(status: string, progress?: string) {
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
  }''',
    "add progress updater",
)

text = replace_once(
    text,
    '''          <section className="summary-grid" aria-label="案件摘要">
            <button
              className="summary-card blue"
              onClick={() => {
                setFilter("全部");
                setTrackingFilter("open");
              }}
            >
              <span>未結案</span>
              <strong>{counts.open}</strong>
            </button>
            <button
              className="summary-card amber"
              onClick={() => {
                setFilter("全部");
                setTrackingFilter("today");
              }}
            >
              <span>今日追蹤</span>
              <strong>{counts.follow}</strong>
            </button>
            <button
              className="summary-card red"
              onClick={() => {
                setFilter("全部");
                setTrackingFilter("overdue");
              }}
            >
              <span>已逾期</span>
              <strong>{counts.overdue}</strong>
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
          </section>''',
    '''          <section className="summary-grid" aria-label="案件摘要">
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
          </section>''',
    "replace summary cards",
)

text = replace_once(
    text,
    '''                      <p className="address">{item.address || "未填地址"}</p>
                      <div className="case-meta">''',
    '''                      <p className="address">{item.address || "未填地址"}</p>
                      {caseProgressLabel(item) && (
                        <p className="case-progress">目前進度：{caseProgressLabel(item)}</p>
                      )}
                      <div className="case-meta">''',
    "show progress on cards",
)

text = replace_once(
    text,
    '''                <span className={`status status-${selected.status}`}>{caseStatusLabel(selected)}</span>
                <span>{selected.waterNumber}</span>''',
    '''                <span className={`status status-${selected.status}`}>{caseStatusLabel(selected)}</span>
                {caseProgressLabel(selected) && <span className="progress-tag">{caseProgressLabel(selected)}</span>}
                <span>{selected.waterNumber}</span>''',
    "show progress in detail tags",
)

text = replace_once(
    text,
    '''              <label className="status-select compact">
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
              </label>''',
    '''              <label className="status-select compact">
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
              </label>''',
    "add detail progress selector",
)

app_path.write_text(text)

journal_path = Path("app/journal/journal-client.tsx")
journal = journal_path.read_text()

journal = replace_once(
    journal,
    '''function statusLabel(item: InspectionCase) {
  return item.status === "其他" && item.customStatus ? item.customStatus : item.status;
}''',
    '''function statusLabel(item: InspectionCase) {
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
}''',
    "journal status labels",
)

journal = replace_once(
    journal,
    '''          statusLabel(item),
          record.method,''',
    '''          statusLabel(item),
          progressLabel(item),
          record.method,''',
    "journal search progress",
)

journal = replace_once(
    journal,
    '''                    {item.phone && <span>電話 {item.phone}</span>}
                    {item.meterNumber && <span>表號 {item.meterNumber}</span>}
                    {record.attachments.length > 0 && <span>附件 {record.attachments.length} 個</span>}''',
    '''                    {progressLabel(item) && <span>目前進度 {progressLabel(item)}</span>}
                    {item.phone && <span>電話 {item.phone}</span>}
                    {item.meterNumber && <span>表號 {item.meterNumber}</span>}
                    {record.attachments.length > 0 && <span>附件 {record.attachments.length} 個</span>}''',
    "journal display progress",
)

journal_path.write_text(journal)
print("Applied simplified case statuses and selectable progress options.")
