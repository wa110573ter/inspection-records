"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./workbench.css";

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

type CaseSummary = {
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
};

type CaseDetail = CaseSummary & {
  attachments: Attachment[];
  records: FollowUp[];
};

type LatLng = [number, number];

type LeafletMap = {
  setView: (center: LatLng, zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown, options?: { padding?: [number, number] }) => void;
  remove: () => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (html: string) => LeafletMarker;
};

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
};

type LeafletApi = {
  map: (element: HTMLElement, options?: { zoomControl?: boolean }) => LeafletMap;
  tileLayer: (url: string, options: { maxZoom: number; attribution: string }) => LeafletLayer;
  marker: (point: LatLng) => LeafletMarker;
  latLngBounds: (points: LatLng[]) => unknown;
};

type QuickRecord = {
  date: string;
  method: string;
  pointer: string;
  process: string;
  result: string;
  nextStep: string;
  followUpDate: string;
  status: string;
  customStatus: string;
};

const statusOptions = ["待處理", "處理中", "已結案"];
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
  "持續處理中",
];
const resultOptions = [
  "",
  "已完成處理",
  "現場無人在家",
  "確認抄表無誤",
  "發現表後漏水",
  "未發現漏水",
  "用戶電話未接",
  "用戶電話空號",
  "等待用戶回覆",
  "等待用戶修繕",
  "需再次現勘",
  "已完成複查",
  "已結案",
];
const nextStepOptions = [
  "",
  "無，案件可結案",
  "再次電話聯繫",
  "等待用戶回覆",
  "等待用戶修繕",
  "等待用戶提供照片",
  "安排現場勘查",
  "安排現場複查",
  "確認後續用水量",
  "追蹤下一期用水量",
  "辦理改單",
];

const selectionStorageKey = "inspection-workbench-selected-cases-v1";
const maxUploadSize = 100 * 1024 * 1024;
let leafletPromise: Promise<LeafletApi> | null = null;

function taipeiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function normalizeText(value: string) {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

function parseCoordinates(value: string): LatLng | null {
  const numbers = value
    .trim()
    .split(/[\s,，]+/)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
  if (numbers.length < 2) return null;

  const [first, second] = numbers;
  if (Math.abs(first) > 90 && Math.abs(second) <= 90) return [second, first];
  if (Math.abs(second) > 90 && Math.abs(first) <= 90) return [first, second];
  if (first >= 21 && first <= 26 && second >= 118 && second <= 123) return [first, second];
  if (second >= 21 && second <= 26 && first >= 118 && first <= 123) return [second, first];
  return null;
}

function googleMapsUrl(item: CaseSummary) {
  const point = parseCoordinates(item.coordinates);
  const query = point ? `${point[0]},${point[1]}` : item.address || item.waterNumber;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "操作失敗");
  return payload;
}

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("地圖無法載入"));
  const existing = (window as Window & { L?: LeafletApi }).L;
  if (existing) return Promise.resolve(existing);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    if (!document.getElementById("leaflet-workbench-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-workbench-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const finish = () => {
      const api = (window as Window & { L?: LeafletApi }).L;
      if (api) resolve(api);
      else reject(new Error("地圖元件載入失敗"));
    };

    const existingScript = document.getElementById("leaflet-workbench-js") as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("地圖元件載入失敗")), { once: true });
      window.setTimeout(finish, 250);
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-workbench-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("地圖元件載入失敗"));
    document.body.appendChild(script);
  }).catch((error) => {
    leafletPromise = null;
    throw error;
  });

  return leafletPromise;
}

function statusClass(status: string) {
  if (status === "待處理") return "todo";
  if (status === "已結案") return "closed";
  return "processing";
}

function SelectedCasesMap({ cases, onClose }: { cases: CaseSummary[]; onClose: () => void }) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState("");
  const locatedCases = useMemo(
    () => cases.map((item) => ({ item, point: parseCoordinates(item.coordinates) })).filter((entry): entry is { item: CaseSummary; point: LatLng } => Boolean(entry.point)),
    [cases],
  );
  const missingCount = cases.length - locatedCases.length;

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    void loadLeaflet()
      .then((leaflet) => {
        if (cancelled || !mapNode.current) return;
        map = leaflet.map(mapNode.current, { zoomControl: true }).setView([23.706, 120.43], 14);
        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          })
          .addTo(map);

        for (const { item, point } of locatedCases) {
          const popup = `<div class="leaflet-popup-content"><strong>${escapeHtml(item.waterNumber)}｜${escapeHtml(item.customerName || "未填姓名")}</strong><span>${escapeHtml(item.reason || "未填原因")}</span><br><span>${escapeHtml(item.address || "未填地址")}</span><br><a href="${googleMapsUrl(item)}" target="_blank" rel="noreferrer">Google Maps 導航</a></div>`;
          leaflet.marker(point).addTo(map).bindPopup(popup);
        }

        if (locatedCases.length === 1) {
          map.setView(locatedCases[0].point, 17);
        } else if (locatedCases.length > 1) {
          map.fitBounds(leaflet.latLngBounds(locatedCases.map((entry) => entry.point)), { padding: [35, 35] });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setMapError(error instanceof Error ? error.message : "地圖載入失敗");
      });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [locatedCases]);

  return (
    <div className="workbench-overlay" role="dialog" aria-modal="true" aria-label="已選案件地圖">
      <div className="workbench-modal">
        <div className="modal-head">
          <div>
            <h2>已選案件地圖</h2>
            <p>共 {cases.length} 戶；只顯示你勾選的案件，不會自動排行程。</p>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="關閉地圖">×</button>
        </div>
        <div className="map-layout">
          <div ref={mapNode} className="map-canvas">
            {mapError ? <div className="loading-state">{mapError}</div> : null}
          </div>
          <div className="map-side">
            {missingCount > 0 ? (
              <div className="map-warning">有 {missingCount} 戶沒有可辨識的座標，因此不會出現在地圖圖釘上；仍可從下方按 Google Maps 以地址搜尋。</div>
            ) : null}
            {cases.map((item) => (
              <div className="map-case-card" key={item.id}>
                <strong>{item.waterNumber}｜{item.customerName || "未填姓名"}</strong>
                <span>{item.reason || "未填原因"}</span>
                <span>{item.address || "未填地址"}</span>
                <a href={googleMapsUrl(item)} target="_blank" rel="noreferrer">Google Maps 導航</a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  caseId,
  onClose,
  onChanged,
}: {
  caseId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState<QuickRecord>({
    date: taipeiToday(),
    method: "現場勘查",
    pointer: "",
    process: "",
    result: "",
    nextStep: "",
    followUpDate: "",
    status: "處理中",
    customStatus: "現場勘查完成，待後續",
  });

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await readJson<{ case: CaseDetail }>(
        await fetch(`/api/cases/${caseId}`, { cache: "no-store" }),
      );
      setDetail(payload.case);
      setForm((current) => ({
        ...current,
        status: payload.case.status,
        customStatus: payload.case.status === "處理中" ? payload.case.customStatus || "持續處理中" : current.customStatus,
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "案件載入失敗");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || saving) return;
    setError("");
    setUploadProgress("");

    const oversized = files.find((file) => file.size > maxUploadSize);
    if (oversized) {
      setError(`${oversized.name} 超過 100 MB，請改用較小的檔案。`);
      return;
    }
    if (!form.pointer && !form.process && !form.result && !form.nextStep && files.length === 0) {
      setError("請至少填寫指針、處理情形、結果、下一步或加入照片。 ");
      return;
    }

    setSaving(true);
    try {
      const recordPayload = await readJson<{ record: FollowUp }>(
        await fetch(`/api/cases/${detail.id}/records`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            date: form.date,
            method: form.method,
            pointer: form.pointer,
            process: form.process,
            result: form.result,
            nextStep: form.nextStep,
            followUpDate: form.followUpDate,
          }),
        }),
      );

      await readJson<{ case: CaseSummary }>(
        await fetch(`/api/cases/${detail.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: form.status,
            customStatus: form.status === "處理中" ? form.customStatus : "",
          }),
        }),
      );

      const failedUploads: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadProgress(`正在上傳照片 ${index + 1}/${files.length}：${file.name}`);
        const body = new FormData();
        body.set("caseId", detail.id);
        body.set("recordId", recordPayload.record.id);
        body.set("category", "record");
        body.set("file", file);
        try {
          await readJson<{ attachment: Attachment }>(
            await fetch("/api/uploads", { method: "POST", body }),
          );
        } catch {
          failedUploads.push(file.name);
        }
      }

      setUploadProgress("");
      setFiles([]);
      setForm((current) => ({
        ...current,
        date: taipeiToday(),
        pointer: "",
        process: "",
        result: "",
        nextStep: "",
        followUpDate: "",
      }));
      await loadDetail();
      await onChanged();
      if (failedUploads.length > 0) {
        setError(`紀錄已儲存，但 ${failedUploads.length} 個檔案上傳失敗：${failedUploads.join("、")}`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "儲存失敗");
    } finally {
      setSaving(false);
      setUploadProgress("");
    }
  }

  return (
    <div className="workbench-overlay" role="dialog" aria-modal="true" aria-label="案件快速紀錄">
      <div className="detail-modal">
        <div className="modal-head">
          <div>
            <h2>案件快速紀錄</h2>
            <p>照片採逐張上傳，頁面不會先載入所有大圖。</p>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="關閉案件">×</button>
        </div>
        <div className="detail-scroll">
          {loading ? <div className="loading-state">正在載入案件…</div> : null}
          {error ? <div className="workbench-message">{error}</div> : null}
          {detail ? (
            <>
              <section className="detail-hero-card">
                <h3>{detail.waterNumber}｜{detail.customerName || "未填姓名"}</h3>
                <p>{detail.reason || "未填原因"}<br />{detail.address || "未填地址"}</p>
                <div className="detail-grid">
                  <div className="detail-field"><span>電話</span><strong>{detail.phone || "—"}</strong></div>
                  <div className="detail-field"><span>表號</span><strong>{detail.meterNumber || "—"}</strong></div>
                  <div className="detail-field"><span>目前狀態</span><strong>{detail.status}{detail.customStatus ? `｜${detail.customStatus}` : ""}</strong></div>
                  <div className="detail-field"><span>座標</span><strong>{detail.coordinates || "—"}</strong></div>
                </div>
                <div className="attachment-links">
                  <a href={googleMapsUrl(detail)} target="_blank" rel="noreferrer">Google Maps 導航</a>
                  {detail.attachments.map((file) => (
                    <a key={file.id} href={file.url} target="_blank" rel="noreferrer">查看：{file.filename}</a>
                  ))}
                </div>
              </section>

              <section className="quick-record">
                <h3>新增紀錄</h3>
                <form className="quick-record-form" onSubmit={submitRecord}>
                  <div className="quick-record-grid">
                    <label><span>日期</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
                    <label><span>處理方式</span><select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}><option>現場勘查</option><option>現場複查</option><option>電話聯絡</option><option>LINE聯繫</option><option>收到用戶資料</option><option>內部處理</option><option>其他</option></select></label>
                    <label><span>現場指針</span><input inputMode="numeric" value={form.pointer} onChange={(event) => setForm({ ...form, pointer: event.target.value })} placeholder="例如 344" /></label>
                    <label><span>結果</span><select value={form.result} onChange={(event) => setForm({ ...form, result: event.target.value })}>{resultOptions.map((option) => <option key={option || "blank"} value={option}>{option || "未選"}</option>)}</select></label>
                    <label className="full"><span>處理情形／備註</span><textarea value={form.process} onChange={(event) => setForm({ ...form, process: event.target.value })} placeholder="例如：到場無人在，已貼單；水表未轉。" /></label>
                    <label><span>下一步</span><select value={form.nextStep} onChange={(event) => setForm({ ...form, nextStep: event.target.value })}>{nextStepOptions.map((option) => <option key={option || "blank"} value={option}>{option || "未選"}</option>)}</select></label>
                    <label><span>追蹤日期</span><input type="date" value={form.followUpDate} onChange={(event) => setForm({ ...form, followUpDate: event.target.value })} /></label>
                    <label><span>案件狀態</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                    <label><span>處理中進度</span><select value={form.customStatus} disabled={form.status !== "處理中"} onChange={(event) => setForm({ ...form, customStatus: event.target.value })}>{progressOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                    <label className="full"><span>照片／影片</span><input type="file" accept="image/*,video/*" multiple onChange={(event) => setFiles(Array.from(event.currentTarget.files || []))} /><small className="upload-note">單一檔案後端上限 100 MB，10 MB 以上手機照片可直接選取。儲存時會逐張上傳，避免一次處理多張高畫質照片造成手機當機。</small></label>
                  </div>
                  {uploadProgress ? <div className="upload-progress">{uploadProgress}</div> : null}
                  <div className="workbench-actions">
                    <button className="workbench-button success" type="submit" disabled={saving}>{saving ? "儲存中…" : "儲存紀錄"}</button>
                  </div>
                </form>
              </section>

              <section className="history-section">
                <h3>歷次處理紀錄</h3>
                {detail.records.length === 0 ? <div className="empty-state">目前沒有處理紀錄</div> : detail.records.map((record) => (
                  <article className="history-card" key={record.id}>
                    <div className="history-head"><strong>{record.date}｜{record.method}</strong><span>{formatDateTime(record.createdAt || "")}</span></div>
                    {record.pointer ? <p>指針：{record.pointer}</p> : null}
                    {record.process ? <p>{record.process}</p> : null}
                    {record.result ? <p>結果：{record.result}</p> : null}
                    {record.nextStep ? <p>下一步：{record.nextStep}{record.followUpDate ? `（${record.followUpDate}）` : ""}</p> : null}
                    {record.attachments.length > 0 ? <div className="attachment-links">{record.attachments.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer">查看：{file.filename}</a>)}</div> : null}
                  </article>
                ))}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Workbench({ userName }: { userName: string }) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await readJson<{ cases: CaseSummary[] }>(
        await fetch("/api/cases?view=summary", { cache: "no-store" }),
      );
      setCases(payload.cases);
      const validIds = new Set(payload.cases.map((item) => item.id));
      setSelectedIds((current) => new Set(Array.from(current).filter((id) => validIds.has(id))));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "案件載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(selectionStorageKey);
      if (saved) {
        const ids = JSON.parse(saved) as unknown;
        if (Array.isArray(ids) && ids.every((id) => typeof id === "string")) setSelectedIds(new Set(ids));
      }
    } catch {
      // Ignore unavailable or malformed local storage.
    } finally {
      setSelectionHydrated(true);
    }
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (!selectionHydrated) return;
    try {
      localStorage.setItem(selectionStorageKey, JSON.stringify(Array.from(selectedIds)));
    } catch {
      // Selection persistence is optional.
    }
  }, [selectedIds, selectionHydrated]);

  const reasonOptions = useMemo(
    () => Array.from(new Set(cases.map((item) => item.reason).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [cases],
  );

  const filteredCases = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return cases.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (reasonFilter !== "all" && item.reason !== reasonFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = normalizeText(`${item.waterNumber} ${item.customerName} ${item.address} ${item.phone} ${item.meterNumber} ${item.reason}`);
      return haystack.includes(normalizedQuery);
    });
  }, [cases, query, reasonFilter, statusFilter]);

  const selectedCases = useMemo(() => cases.filter((item) => selectedIds.has(item.id)), [cases, selectedIds]);
  const activeCount = cases.filter((item) => item.status !== "已結案").length;
  const todoCount = cases.filter((item) => item.status === "待處理").length;
  const processingCount = cases.filter((item) => item.status === "處理中").length;
  const allVisibleSelected = filteredCases.length > 0 && filteredCases.every((item) => selectedIds.has(item.id));

  function toggleCase(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredCases.forEach((item) => next.delete(item.id));
      else filteredCases.forEach((item) => next.add(item.id));
      return next;
    });
  }

  return (
    <main className="workbench-shell">
      <header className="workbench-topbar">
        <div className="workbench-title">
          <h1>虎尾所查表工作台</h1>
          <p>{userName}｜勾選今天想跑的案件，再自己看地圖決定順序。</p>
        </div>
        <nav className="workbench-nav" aria-label="網站功能">
          <a href="/import">批次匯入</a>
          <a href="/journal">處理日誌</a>
          <a href="/legacy">舊版案件管理</a>
          <a className="adjustment-link" href="/adjustment">改單 ODS</a>
        </nav>
      </header>

      <section className="workbench-stats" aria-label="案件統計">
        <div className="workbench-stat"><span>未結案</span><strong>{activeCount}</strong></div>
        <div className="workbench-stat"><span>待處理</span><strong>{todoCount}</strong></div>
        <div className="workbench-stat"><span>處理中</span><strong>{processingCount}</strong></div>
        <div className="workbench-stat"><span>已勾選</span><strong>{selectedIds.size}</strong></div>
      </section>

      <section className="workbench-controls">
        <div className="workbench-filter-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋水號、姓名、地址、電話、表號…" aria-label="搜尋案件" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="篩選案件狀態">
            <option value="all">全部狀態</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)} aria-label="篩選案件原因">
            <option value="all">全部原因</option>
            {reasonOptions.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
        </div>
        <div className="workbench-actions">
          <button className="workbench-button" type="button" onClick={toggleAllVisible} disabled={filteredCases.length === 0}>{allVisibleSelected ? "取消目前篩選全部" : "勾選目前篩選全部"}</button>
          <button className="workbench-button" type="button" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>清除勾選</button>
          <button className="workbench-button primary" type="button" onClick={() => setShowMap(true)} disabled={selectedIds.size === 0}>看已選地圖（{selectedIds.size}）</button>
          <button className="workbench-button" type="button" onClick={() => void loadCases()} disabled={loading}>重新整理</button>
          <span className="selection-summary">目前顯示 {filteredCases.length} / {cases.length} 筆</span>
        </div>
      </section>

      {error ? <div className="workbench-message">{error}</div> : null}
      {loading && cases.length === 0 ? <div className="loading-state">正在載入案件摘要…</div> : null}

      <section className="case-list" aria-label="案件清單">
        {filteredCases.map((item) => {
          const selected = selectedIds.has(item.id);
          return (
            <article className={`case-row${selected ? " selected" : ""}`} key={item.id}>
              <label className="case-check" aria-label={`選取 ${item.waterNumber}`}>
                <input type="checkbox" checked={selected} onChange={() => toggleCase(item.id)} />
              </label>
              <div className="case-main">
                <div className="case-heading">
                  <span className="case-water">{item.waterNumber}</span>
                  <strong>{item.customerName || "未填姓名"}</strong>
                  <span className={`case-status ${statusClass(item.status)}`}>{item.status}{item.customStatus ? `｜${item.customStatus}` : ""}</span>
                </div>
                <div className="case-reason">{item.reason || "未填案件原因"}</div>
                <div className="case-address">{item.address || "未填地址"}</div>
                <div className="case-meta">
                  {item.phone ? <span>電話 {item.phone}</span> : null}
                  {item.meterNumber ? <span>表號 {item.meterNumber}</span> : null}
                  <span>更新 {formatDateTime(item.updatedAt)}</span>
                </div>
              </div>
              <div className="case-row-actions">
                <a href={googleMapsUrl(item)} target="_blank" rel="noreferrer">導航</a>
                <button type="button" onClick={() => setDetailId(item.id)}>紀錄</button>
              </div>
            </article>
          );
        })}
      </section>

      {!loading && filteredCases.length === 0 ? <div className="empty-state">沒有符合目前條件的案件。</div> : null}
      {showMap ? <SelectedCasesMap cases={selectedCases} onClose={() => setShowMap(false)} /> : null}
      {detailId ? <DetailModal caseId={detailId} onClose={() => setDetailId(null)} onChanged={loadCases} /> : null}
    </main>
  );
}
