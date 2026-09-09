"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./simple-workbench.css";

type Attachment = {
  id: string;
  filename: string;
  url: string;
};

type RecordItem = {
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
  records: RecordItem[];
};

type LatLng = [number, number];

type LeafletMap = {
  setView: (center: LatLng, zoom: number) => LeafletMap;
  fitBounds: (bounds: unknown, options?: { padding?: [number, number] }) => void;
  remove: () => void;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  bindPopup: (html: string, options?: { maxWidth?: number; minWidth?: number }) => LeafletMarker;
};

type LeafletLayer = { addTo: (map: LeafletMap) => LeafletLayer };
type LeafletIcon = unknown;
type LeafletApi = {
  map: (element: HTMLElement, options?: { zoomControl?: boolean }) => LeafletMap;
  tileLayer: (url: string, options: { maxZoom: number; attribution: string }) => LeafletLayer;
  marker: (point: LatLng, options?: { icon?: LeafletIcon }) => LeafletMarker;
  latLngBounds: (points: LatLng[]) => unknown;
  divIcon: (options: { className: string; html: string; iconSize: [number, number]; iconAnchor: [number, number]; popupAnchor: [number, number] }) => LeafletIcon;
};

const selectionKey = "inspection-simple-selected-v1";
const maxUploadSize = 100 * 1024 * 1024;
let leafletPromise: Promise<LeafletApi> | null = null;

function todayTaipei() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalize(value: string) {
  return value.replace(/[\s-]/g, "").toLowerCase();
}

function parseCoordinates(value: string): LatLng | null {
  const numbers = value
    .trim()
    .split(/[\s,，]+/)
    .map(Number)
    .filter(Number.isFinite);
  if (numbers.length < 2) return null;
  const [first, second] = numbers;
  if (first >= 21 && first <= 26 && second >= 118 && second <= 123) return [first, second];
  if (second >= 21 && second <= 26 && first >= 118 && first <= 123) return [second, first];
  if (Math.abs(first) > 90 && Math.abs(second) <= 90) return [second, first];
  if (Math.abs(second) > 90 && Math.abs(first) <= 90) return [first, second];
  return null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function singleNavigationUrl(item: CaseSummary) {
  const point = parseCoordinates(item.coordinates);
  const destination = point ? `${point[0]},${point[1]}` : item.address || item.waterNumber;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "操作失敗");
  return payload;
}

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("地圖無法載入"));
  const current = (window as Window & { L?: LeafletApi }).L;
  if (current) return Promise.resolve(current);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    if (!document.getElementById("simple-workbench-leaflet-css")) {
      const link = document.createElement("link");
      link.id = "simple-workbench-leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const finish = () => {
      const api = (window as Window & { L?: LeafletApi }).L;
      if (api) resolve(api);
      else reject(new Error("地圖元件載入失敗"));
    };

    const existing = document.getElementById("simple-workbench-leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("地圖元件載入失敗")), { once: true });
      window.setTimeout(finish, 300);
      return;
    }

    const script = document.createElement("script");
    script.id = "simple-workbench-leaflet-js";
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

function statusText(item: CaseSummary) {
  return item.status === "處理中" && item.customStatus ? `${item.status}｜${item.customStatus}` : item.status;
}

function MapModal({ cases, onClose }: { cases: CaseSummary[]; onClose: () => void }) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState("");
  const located = useMemo(
    () => cases
      .map((item) => ({ item, point: parseCoordinates(item.coordinates) }))
      .filter((entry): entry is { item: CaseSummary; point: LatLng } => Boolean(entry.point)),
    [cases],
  );

  useEffect(() => {
    if (!mapNode.current || located.length === 0) return;
    let cancelled = false;
    let map: LeafletMap | null = null;

    void loadLeaflet()
      .then((leaflet) => {
        if (cancelled || !mapNode.current) return;
        map = leaflet.map(mapNode.current, { zoomControl: true }).setView([23.706, 120.43], 14);
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const icon = leaflet.divIcon({
          className: "sw-pin-wrap",
          html: '<span class="sw-pin"></span>',
          iconSize: [32, 44],
          iconAnchor: [16, 42],
          popupAnchor: [0, -36],
        });

        for (const { item, point } of located) {
          const popup = `
            <div class="sw-popup">
              <strong>${escapeHtml(item.waterNumber)}</strong>
              <b>${escapeHtml(item.customerName || "未填姓名")}</b>
              <div><span>地址</span>${escapeHtml(item.address || "未填")}</div>
              <div><span>電話</span>${escapeHtml(item.phone || "未填")}</div>
              <div><span>表號</span>${escapeHtml(item.meterNumber || "未填")}</div>
              <div><span>原因</span>${escapeHtml(item.reason || "未填")}</div>
              <div><span>狀態</span>${escapeHtml(statusText(item) || "未設定")}</div>
              <a href="${singleNavigationUrl(item)}" target="_blank" rel="noreferrer">導航到這一戶</a>
            </div>`;
          leaflet.marker(point, { icon }).addTo(map).bindPopup(popup, { maxWidth: 340, minWidth: 260 });
        }

        if (located.length === 1) map.setView(located[0].point, 17);
        else map.fitBounds(leaflet.latLngBounds(located.map((entry) => entry.point)), { padding: [48, 48] });
      })
      .catch((mapError: unknown) => setError(mapError instanceof Error ? mapError.message : "地圖載入失敗"));

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [located]);

  const missing = cases.length - located.length;

  return (
    <div className="sw-overlay" role="dialog" aria-modal="true" aria-label="已選案件地圖">
      <div className="sw-map-modal">
        <header className="sw-map-head">
          <div><strong>已選 {cases.length} 戶</strong><span>只有圖釘，不排行程、不改案件狀態</span></div>
          <button type="button" onClick={onClose}>返回繼續選</button>
        </header>
        {missing > 0 ? <div className="sw-map-warning">{missing} 戶沒有可辨識座標，因此不會顯示圖釘。</div> : null}
        {error ? <div className="sw-map-warning">{error}</div> : null}
        {located.length === 0 ? (
          <div className="sw-empty-map">目前勾選的案件沒有可用座標。請返回清單。</div>
        ) : (
          <div ref={mapNode} className="sw-map-canvas" />
        )}
      </div>
    </div>
  );
}

function RecordModal({ caseId, onClose, onSaved }: { caseId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [date, setDate] = useState(todayTaipei());
  const [pointer, setPointer] = useState("");
  const [result, setResult] = useState("");
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await readJson<{ case: CaseDetail }>(await fetch(`/api/cases/${caseId}`, { cache: "no-store" }));
      setDetail(payload.case);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "案件載入失敗");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || saving) return;
    if (!pointer && !result && !note && !nextStep && files.length === 0) {
      setError("至少填一項現場紀錄或加入照片。");
      return;
    }
    const oversized = files.find((file) => file.size > maxUploadSize);
    if (oversized) {
      setError(`${oversized.name} 超過 100 MB。`);
      return;
    }

    setSaving(true);
    setError("");
    setProgress("");
    try {
      const created = await readJson<{ record: RecordItem }>(await fetch(`/api/cases/${detail.id}/records`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, method: "現場勘查", pointer, process: note, result, nextStep, followUpDate }),
      }));

      const failed: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress(`照片 ${index + 1}/${files.length} 上傳中`);
        const body = new FormData();
        body.set("caseId", detail.id);
        body.set("recordId", created.record.id);
        body.set("category", "record");
        body.set("file", file);
        try {
          await readJson(await fetch("/api/uploads", { method: "POST", body }));
        } catch {
          failed.push(file.name);
        }
      }

      if (followUpDate || nextStep) {
        await readJson(await fetch(`/api/cases/${detail.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "處理中", customStatus: followUpDate ? "待複查" : "持續處理中" }),
        }));
      }

      if (failed.length > 0) {
        setError(`紀錄已儲存，但照片上傳失敗：${failed.join("、")}`);
        setFiles([]);
        await load();
        await onSaved();
        return;
      }

      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "儲存失敗");
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  async function markClosed() {
    if (!detail || saving) return;
    setSaving(true);
    setError("");
    try {
      await readJson(await fetch(`/api/cases/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "已結案", customStatus: "" }),
      }));
      await onSaved();
      onClose();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sw-overlay" role="dialog" aria-modal="true" aria-label="案件紀錄">
      <div className="sw-record-modal">
        <header className="sw-record-head">
          <div><strong>{detail?.waterNumber || "案件紀錄"}</strong><span>{detail?.customerName || ""}</span></div>
          <button type="button" onClick={onClose}>關閉</button>
        </header>
        <div className="sw-record-scroll">
          {loading ? <div className="sw-loading">載入中…</div> : null}
          {error ? <div className="sw-error">{error}</div> : null}
          {detail ? (
            <>
              <div className="sw-basic">
                <div><span>地址</span><strong>{detail.address || "未填"}</strong></div>
                <div><span>電話</span><strong>{detail.phone || "未填"}</strong></div>
                <div><span>表號</span><strong>{detail.meterNumber || "未填"}</strong></div>
                <div><span>原因</span><strong>{detail.reason || "未填"}</strong></div>
              </div>
              <form className="sw-record-form" onSubmit={save}>
                <label><span>日期</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <label><span>現場指針</span><input inputMode="numeric" value={pointer} onChange={(event) => setPointer(event.target.value)} placeholder="例如 266" /></label>
                <label><span>結果</span><select value={result} onChange={(event) => setResult(event.target.value)}><option value="">選擇結果</option><option>現場無人在家</option><option>確認抄表無誤</option><option>發現表後漏水</option><option>未發現漏水</option><option>用戶電話未接</option><option>等待用戶回覆</option><option>需再次現勘</option><option>已完成複查</option></select></label>
                <label><span>下一步</span><select value={nextStep} onChange={(event) => setNextStep(event.target.value)}><option value="">沒有／未定</option><option>再次電話聯繫</option><option>等待用戶回覆</option><option>等待用戶修繕</option><option>等待用戶提供照片</option><option>安排現場複查</option><option>確認後續用水量</option><option>辦理改單</option></select></label>
                <label><span>追蹤日</span><input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label>
                <label className="sw-full"><span>現場備註</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="可不填；有異常再記" /></label>
                <label className="sw-full"><span>照片／影片（單檔最高 100MB）</span><input type="file" accept="image/*,video/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
                {progress ? <div className="sw-progress sw-full">{progress}</div> : null}
                <div className="sw-record-actions sw-full"><button className="primary" type="submit" disabled={saving}>{saving ? "儲存中…" : "儲存紀錄"}</button><button type="button" onClick={() => void markClosed()} disabled={saving}>直接結案</button></div>
              </form>
              <section className="sw-history">
                <h3>最近紀錄</h3>
                {detail.records.length === 0 ? <p>目前沒有處理紀錄。</p> : detail.records.slice(0, 8).map((record) => (
                  <article key={record.id}><strong>{record.date}｜{record.method}</strong>{record.pointer ? <span>指針 {record.pointer}</span> : null}{record.result ? <span>{record.result}</span> : null}{record.process ? <p>{record.process}</p> : null}{record.attachments.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer">查看照片：{file.filename}</a>)}</article>
                ))}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SimpleWorkbench({ userName }: { userName: string }) {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await readJson<{ cases: CaseSummary[] }>(await fetch("/api/cases?view=summary", { cache: "no-store" }));
      setCases(payload.cases);
      const valid = new Set(payload.cases.map((item) => item.id));
      setSelected((current) => new Set(Array.from(current).filter((id) => valid.has(id))));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "案件載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(selectionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) setSelected(new Set(parsed.filter((item): item is string => typeof item === "string")));
      }
    } catch {
      // Selection is only a convenience state; ignore malformed browser storage.
    } finally {
      setHydrated(true);
    }
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(selectionKey, JSON.stringify(Array.from(selected))); } catch { /* optional */ }
  }, [hydrated, selected]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return cases.filter((item) => {
      if (status === "active" && item.status === "已結案") return false;
      if (status === "todo" && item.status !== "待處理") return false;
      if (status === "processing" && item.status !== "處理中") return false;
      if (status === "closed" && item.status !== "已結案") return false;
      if (!q) return true;
      return normalize(`${item.waterNumber} ${item.customerName} ${item.address} ${item.phone} ${item.meterNumber} ${item.reason}`).includes(q);
    });
  }, [cases, query, status]);

  const selectedCases = useMemo(() => cases.filter((item) => selected.has(item.id)), [cases, selected]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filtered.forEach((item) => next.delete(item.id));
      else filtered.forEach((item) => next.add(item.id));
      return next;
    });
  }

  return (
    <main className="sw-shell">
      <header className="sw-top">
        <div><h1>虎尾所查表工作台</h1><p>{userName}｜勾選只是暫存工作清單，不會改成完成或略過。</p></div>
        <nav><a href="/import">批次匯入</a><a href="/journal">處理日誌</a><a href="/legacy">舊版案件</a><a className="adjustment" href="/adjustment">改單 ODS</a></nav>
      </header>

      <section className="sw-tools">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋水號、姓名、地址、電話、表號" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">未結案</option><option value="all">全部案件</option><option value="todo">待處理</option><option value="processing">處理中</option><option value="closed">已結案</option></select>
        <button type="button" onClick={toggleVisible}>{allVisibleSelected ? "取消目前全部" : "勾選目前全部"}</button>
        <button type="button" onClick={() => void loadCases()}>重新整理</button>
      </section>

      {error ? <div className="sw-error">{error}</div> : null}
      {loading && cases.length === 0 ? <div className="sw-loading">案件載入中…</div> : null}

      <section className="sw-list">
        {filtered.map((item) => {
          const checked = selected.has(item.id);
          return (
            <article key={item.id} className={`sw-case${checked ? " selected" : ""}`}>
              <label className="sw-check"><input type="checkbox" checked={checked} onChange={() => toggle(item.id)} /><span /></label>
              <button type="button" className="sw-case-main" onClick={() => toggle(item.id)}>
                <div className="sw-case-title"><strong>{item.waterNumber}</strong><b>{item.customerName || "未填姓名"}</b></div>
                <div className="sw-case-reason">{item.reason || "未填原因"}</div>
                <div className="sw-case-address">{item.address || "未填地址"}</div>
                <div className="sw-case-meta"><span>{statusText(item)}</span>{item.meterNumber ? <span>表號 {item.meterNumber}</span> : null}</div>
              </button>
              <div className="sw-case-actions"><button type="button" onClick={() => setRecordId(item.id)}>紀錄</button><a href={singleNavigationUrl(item)} target="_blank" rel="noreferrer">導航</a></div>
            </article>
          );
        })}
      </section>

      {!loading && filtered.length === 0 ? <div className="sw-loading">沒有符合條件的案件。</div> : null}

      {selected.size > 0 ? (
        <div className="sw-selection-bar">
          <div><strong>已選 {selected.size} 戶</strong><span>可繼續往下勾，不會卡住</span></div>
          <button type="button" className="map" onClick={() => setShowMap(true)}>看圖釘</button>
          <button type="button" onClick={() => setSelected(new Set())}>清除</button>
        </div>
      ) : null}

      {showMap ? <MapModal cases={selectedCases} onClose={() => setShowMap(false)} /> : null}
      {recordId ? <RecordModal caseId={recordId} onClose={() => setRecordId(null)} onSaved={loadCases} /> : null}
    </main>
  );
}
