"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";

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

const statuses = [
  "待處理",
  "聯絡未果",
  "待現勘",
  "處理中",
  "待用戶回覆",
  "待複查",
  "已結案",
  "其他",
];

const methods = ["電話聯絡", "現場勘查", "用戶回傳", "內部處理", "其他"];

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
  @media (max-width:700px){
    .detail-actions{justify-content:flex-start;width:100%}
    .detail-hero{align-items:flex-start;flex-direction:column}
    .attachment-grid{grid-template-columns:1fr 1fr}
    .record-head-actions{align-items:flex-start;flex-direction:column}
    .form-actions>*{flex:1}
  }
`;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeWaterNumber(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function formatDate(value: string) {
  if (!value) return "未設定";
  return value.replaceAll("-", "/");
}

function isOverdue(value: string, status: string) {
  return Boolean(value && value < today() && status !== "已結案");
}

function caseStatusLabel(item: InspectionCase) {
  return item.status === "其他" && item.customStatus ? item.customStatus : item.status;
}

function categoryLabel(category: string) {
  if (category === "system31") return "3-1 畫面";
  if (category === "gis") return "圖資畫面";
  return "處理附件";
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = (text ? JSON.parse(text) : {}) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "操作失敗，請稍後再試");
  return data;
}

function casePayload(data: FormData) {
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

function CaseFields({ item }: { item?: InspectionCase }) {
  return (
    <>
      <div className="form-section">
        <h3>用戶與水表資料</h3>
        <div className="field-grid">
          <label>
            水號 <em>必填</em>
            <input name="waterNumber" required inputMode="text" defaultValue={item?.waterNumber} />
          </label>
          <label>
            姓名
            <input name="customerName" autoComplete="name" defaultValue={item?.customerName} />
          </label>
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
          <label className="wide">
            案件原因
            <textarea name="reason" rows={4} defaultValue={item?.reason} />
          </label>
          <label>
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

function RecordFields({ record }: { record?: FollowUp }) {
  return (
    <div className="field-grid">
      <label>
        日期
        <input name="date" type="date" defaultValue={record?.date || today()} required />
      </label>
      <label>
        處理方式
        <select name="method" defaultValue={record?.method || "現場勘查"}>
          {methods.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
      </label>
      <label>
        現場指針
        <input
          name="pointer"
          inputMode="decimal"
          placeholder="例如 676"
          defaultValue={record?.pointer}
        />
      </label>
      <label>
        下次追蹤日期
        <input name="followUpDate" type="date" defaultValue={record?.followUpDate} />
      </label>
      <label className="wide">
        處理經過
        <textarea name="process" rows={4} defaultValue={record?.process} />
      </label>
      <label className="wide">
        處理結果
        <textarea name="result" rows={3} defaultValue={record?.result} />
      </label>
      <label className="wide">
        下一步
        <textarea name="nextStep" rows={3} defaultValue={record?.nextStep} />
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
  const [view, setView] = useState<"list" | "new" | "detail">("list");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingCase, setEditingCase] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const selected = cases.find((item) => item.id === selectedId) ?? null;

  async function loadCases(selectId?: string) {
    try {
      setError("");
      const data = await api<{ cases: InspectionCase[] }>("/api/cases");
      setCases(data.cases);
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
        if (active) setCases(data.cases);
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
      const haystack = [
        item.waterNumber,
        item.customerName,
        item.phone,
        item.address,
        item.meterNumber,
        item.reason,
      ]
        .join(" ")
        .toLowerCase()
        .replace(/[\s-]/g, "");
      return matchFilter && (!needle || haystack.includes(needle));
    });
  }, [cases, filter, query]);

  const counts = useMemo(
    () => ({
      open: cases.filter((item) => item.status !== "已結案").length,
      follow: cases.filter((item) => {
        const next = item.records[0]?.followUpDate;
        return next && next === today() && item.status !== "已結案";
      }).length,
      overdue: cases.filter((item) =>
        isOverdue(item.records[0]?.followUpDate ?? "", item.status),
      ).length,
      closed: cases.filter((item) => item.status === "已結案").length,
    }),
    [cases],
  );

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

  async function updateStatus(status: string) {
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
            <button className="summary-card blue" onClick={() => setFilter("全部")}>
              <span>未結案</span>
              <strong>{counts.open}</strong>
            </button>
            <button className="summary-card amber" onClick={() => setFilter("全部")}>
              <span>今日追蹤</span>
              <strong>{counts.follow}</strong>
            </button>
            <button className="summary-card red" onClick={() => setFilter("全部")}>
              <span>已逾期</span>
              <strong>{counts.overdue}</strong>
            </button>
            <button className="summary-card green" onClick={() => setFilter("已結案")}>
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
                placeholder="搜尋水號、姓名、地址、表號"
              />
            </label>
            <div className="filter-row">
              {["全部", ...statuses].map((status) => (
                <button
                  key={status}
                  className={filter === status ? "filter active" : "filter"}
                  onClick={() => setFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </section>

          <section className="case-list">
            <div className="section-heading">
              <div>
                <p className="eyebrow">案件清單</p>
                <h2>{filter === "全部" ? "全部案件" : filter}</h2>
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
                  const nextDate = item.records[0]?.followUpDate ?? "";
                  return (
                    <button key={item.id} className="case-card" onClick={() => openCase(item.id)}>
                      <div className="case-card-top">
                        <span className={`status status-${item.status}`}>{caseStatusLabel(item)}</span>
                        <span className="water-no">{item.waterNumber}</span>
                      </div>
                      <h3>{item.customerName || "未填姓名"}</h3>
                      <p className="address">{item.address || "未填地址"}</p>
                      <div className="case-meta">
                        <span>收件 {formatDate(item.receivedDate)}</span>
                        {nextDate && (
                          <span className={isOverdue(nextDate, item.status) ? "due" : ""}>
                            追蹤 {formatDate(nextDate)}
                          </span>
                        )}
                      </div>
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
            <CaseFields />
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
            </div>
          </div>

          {editingCase && (
            <form key={selected.updatedAt} onSubmit={saveCase} className="edit-panel data-form">
              <h3>修改案件基本資料</h3>
              <CaseFields item={selected} />
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
                        href={`https://maps.google.com/?q=${encodeURIComponent(selected.coordinates)}`}
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
                  {selected.records.map((record) => (
                    <article key={record.id} className="timeline-item">
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
                            <RecordFields record={record} />
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
                  ))}
                </div>
              )}

              <form onSubmit={addRecord} className="record-form">
                <div className="record-form-title">
                  <span>＋</span>
                  <div>
                    <h3>新增處理紀錄</h3>
                    <p>每次聯絡、現勘或回覆都記在同一案件。</p>
                  </div>
                </div>
                <RecordFields />
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
