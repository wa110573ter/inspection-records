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

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "操作失敗，請稍後再試");
  return data;
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
        if (active) {
          setError(err instanceof Error ? err.message : "無法載入案件");
        }
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
    setView("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    payload.waterNumber = normalizeWaterNumber(String(payload.waterNumber || ""));

    try {
      const result = await api<{ case: InspectionCase }>("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const caseId = result.case.id;
      await uploadFiles(caseId, null, data.get("system31") as File, "system31");
      await uploadFiles(caseId, null, data.get("gis") as File, "gis");
      await loadCases(caseId);
      setView("detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "案件建立失敗");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(
    caseId: string,
    recordId: string | null,
    file: File | null,
    category: string,
  ) {
    if (!file || file.size === 0) return;
    const body = new FormData();
    body.set("caseId", caseId);
    if (recordId) body.set("recordId", recordId);
    body.set("category", category);
    body.set("file", file);
    await api("/api/uploads", { method: "POST", body });
  }

  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());

    try {
      const result = await api<{ record: FollowUp }>(
        `/api/cases/${selected.id}/records`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const files = data.getAll("media") as File[];
      for (const file of files) {
        await uploadFiles(selected.id, result.record.id, file, "record");
      }
      form.reset();
      await loadCases(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "紀錄新增失敗");
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
            <button
              className="summary-card green"
              onClick={() => setFilter("已結案")}
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
                    <button
                      key={item.id}
                      className="case-card"
                      onClick={() => openCase(item.id)}
                    >
                      <div className="case-card-top">
                        <span className={`status status-${item.status}`}>
                          {item.status === "其他" && item.customStatus
                            ? item.customStatus
                            : item.status}
                        </span>
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
            <div className="form-section">
              <h3>用戶與水表資料</h3>
              <div className="field-grid">
                <label>
                  水號 <em>必填</em>
                  <input name="waterNumber" required inputMode="text" />
                </label>
                <label>
                  姓名
                  <input name="customerName" autoComplete="name" />
                </label>
                <label>
                  電話
                  <input name="phone" type="tel" autoComplete="tel" />
                </label>
                <label>
                  表號
                  <input name="meterNumber" />
                </label>
                <label className="wide">
                  地址
                  <input name="address" autoComplete="street-address" />
                </label>
                <label>
                  座標
                  <input name="coordinates" placeholder="120.000000,23.000000" />
                </label>
                <label>
                  收件日期
                  <input name="receivedDate" type="date" defaultValue={today()} />
                </label>
              </div>
            </div>
            <div className="form-section">
              <h3>案件內容</h3>
              <div className="field-grid">
                <label className="wide">
                  案件原因
                  <textarea name="reason" rows={4} />
                </label>
                <label>
                  案件狀態
                  <select name="status" defaultValue="待處理">
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  其他狀態說明
                  <input name="customStatus" />
                </label>
              </div>
            </div>
            <div className="form-section">
              <h3>系統畫面</h3>
              <div className="upload-grid">
                <label className="upload-box">
                  <span className="upload-icon">▣</span>
                  <strong>3-1 畫面</strong>
                  <small>點一下拍照或選擇圖片</small>
                  <input name="system31" type="file" accept="image/*" capture="environment" />
                </label>
                <label className="upload-box">
                  <span className="upload-icon">⌖</span>
                  <strong>圖資畫面</strong>
                  <small>點一下拍照或選擇圖片</small>
                  <input name="gis" type="file" accept="image/*" capture="environment" />
                </label>
              </div>
            </div>
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
                <span className={`status status-${selected.status}`}>
                  {selected.status}
                </span>
                <span>{selected.waterNumber}</span>
              </div>
              <h2>{selected.customerName || "未填姓名"}</h2>
              <p>{selected.reason || "尚未填寫案件原因"}</p>
            </div>
            <label className="status-select">
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

          <div className="detail-layout">
            <aside className="profile-card">
              <h3>案件基本資料</h3>
              <dl>
                <div>
                  <dt>電話</dt>
                  <dd>
                    {selected.phone ? (
                      <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                    ) : (
                      "未填"
                    )}
                  </dd>
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
              {selected.attachments.length > 0 && (
                <div className="system-images">
                  <h4>系統畫面</h4>
                  <div>
                    {selected.attachments.map((file) => (
                      <a key={file.id} href={file.url} target="_blank" rel="noreferrer">
                        {file.contentType.startsWith("image/") ? (
                          <img src={file.url} alt={file.filename} />
                        ) : (
                          <span>{file.filename}</span>
                        )}
                        <small>{file.category === "system31" ? "3-1 畫面" : "圖資畫面"}</small>
                      </a>
                    ))}
                  </div>
                </div>
              )}
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
                        <div className="record-head">
                          <strong>{record.method}</strong>
                          <time>{formatDate(record.date)}</time>
                        </div>
                        {record.pointer && (
                          <p className="pointer">現場指針：{record.pointer} 度</p>
                        )}
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
                          <div className="media-strip">
                            {record.attachments.map((file) => (
                              <a key={file.id} href={file.url} target="_blank" rel="noreferrer">
                                {file.contentType.startsWith("image/") ? (
                                  <img src={file.url} alt={file.filename} />
                                ) : file.contentType.startsWith("video/") ? (
                                  <video src={file.url} muted playsInline />
                                ) : (
                                  <span>{file.filename}</span>
                                )}
                              </a>
                            ))}
                          </div>
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
                <div className="field-grid">
                  <label>
                    日期
                    <input name="date" type="date" defaultValue={today()} required />
                  </label>
                  <label>
                    處理方式
                    <select name="method" defaultValue="現場勘查">
                      {methods.map((method) => (
                        <option key={method}>{method}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    現場指針
                    <input name="pointer" inputMode="decimal" placeholder="例如 676" />
                  </label>
                  <label>
                    下次追蹤日期
                    <input name="followUpDate" type="date" />
                  </label>
                  <label className="wide">
                    處理經過
                    <textarea name="process" rows={4} />
                  </label>
                  <label className="wide">
                    處理結果
                    <textarea name="result" rows={3} />
                  </label>
                  <label className="wide">
                    下一步
                    <textarea name="nextStep" rows={3} />
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
                    <small>可直接拍照／錄影，也可從手機選擇多個檔案。</small>
                  </label>
                </div>
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
