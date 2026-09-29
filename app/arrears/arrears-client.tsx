"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./arrears.css";

type CaseSummary = {
  id: string;
  waterNumber: string;
  customerName: string;
  address: string;
  coordinates: string;
  meterNumber: string;
  reason: string;
  status: string;
};

type ImportRow = {
  waterNumber: string;
  customerName: string;
  address: string;
  coordinates: string;
  meterNumber: string;
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

let leafletPromise: Promise<LeafletApi> | null = null;

function normalize(value: string) {
  return value.replace(/[\s\-_()（）:：]/g, "").toLowerCase();
}

function normalizeWaterNumber(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function parseCoordinates(value: string): LatLng | null {
  const numbers = value
    .trim()
    .replace(/[，、；;]/g, ",")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (numbers.length < 2 || numbers.some((number) => !Number.isFinite(number))) return null;

  const [first, second] = numbers;
  if (first >= 21 && first <= 26.5 && second >= 118 && second <= 123) return [first, second];
  if (second >= 21 && second <= 26.5 && first >= 118 && first <= 123) return [second, first];
  return null;
}

function googleMapsUrl(item: CaseSummary) {
  const point = parseCoordinates(item.coordinates);
  const destination = point ? \`\${point[0].toFixed(6)},\${point[1].toFixed(6)}\` : item.address || item.waterNumber;
  return \`https://www.google.com/maps/dir/?api=1&destination=\${encodeURIComponent(destination)}\`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("地圖無法載入"));
  const current = (window as Window & { L?: LeafletApi }).L;
  if (current) return Promise.resolve(current);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    if (!document.getElementById("arrears-leaflet-css")) {
      const link = document.createElement("link");
      link.id = "arrears-leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const finish = () => {
      const api = (window as Window & { L?: LeafletApi }).L;
      if (api) resolve(api);
      else reject(new Error("地圖元件載入失敗"));
    };

    const existing = document.getElementById("arrears-leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("地圖元件載入失敗")), { once: true });
      window.setTimeout(finish, 300);
      return;
    }

    const script = document.createElement("script");
    script.id = "arrears-leaflet-js";
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

function parseDelimited(text: string) {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { rows: [] as ImportRow[], error: "請貼上試算表資料或選擇 CSV 檔案" };

  const delimiter = (lines[0].match(/\t/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? "\t" : ",";
  const matrix = lines.map((line) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, "")));
  const headers = matrix[0].map(normalize);

  const find = (...aliases: string[]) => headers.findIndex((header) => aliases.map(normalize).includes(header));
  const water = find("水號", "用戶水號", "用水號碼");
  const name = find("姓名", "用戶姓名", "戶名", "用戶名稱");
  const address = find("地址", "用水地址", "裝置地址");
  const coordinate = find("座標", "經緯度", "圖資座標", "xy座標");
  const meter = find("表號", "水表號碼", "水表編號", "量水器號碼");
  const x = find("x座標", "x", "經度", "longitude", "lng");
  const y = find("y座標", "y", "緯度", "latitude", "lat");

  if (water < 0) return { rows: [] as ImportRow[], error: "第一列找不到「水號」欄位" };

  const rows = matrix.slice(1).map((cells) => ({
    waterNumber: cells[water] || "",
    customerName: name >= 0 ? cells[name] || "" : "",
    address: address >= 0 ? cells[address] || "" : "",
    coordinates: coordinate >= 0
      ? cells[coordinate] || ""
      : x >= 0 && y >= 0
        ? \`\${cells[x] || ""},\${cells[y] || ""}\`
        : "",
    meterNumber: meter >= 0 ? cells[meter] || "" : "",
  })).filter((row) => row.waterNumber.trim());

  return { rows, error: "" };
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "操作失敗");
  return payload;
}

function popupHtml(item: CaseSummary) {
  return \`
    <div class="arrears-popup">
      <strong>\${escapeHtml(item.waterNumber)}</strong>
      <b>\${escapeHtml(item.customerName || "未填姓名")}</b>
      <div><span>地址</span><em>\${escapeHtml(item.address || "未填地址")}</em></div>
      <div><span>表號</span><em>\${escapeHtml(item.meterNumber || "未填表號")}</em></div>
      <a href="\${googleMapsUrl(item)}" target="_blank" rel="noreferrer">Google Maps 導航</a>
      <button type="button" data-arrears-done="\${escapeHtml(item.id)}">✓ 已貼單，關掉這戶</button>
    </div>
  \`;
}

export default function ArrearsClient({ userName }: { userName: string }) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [mapError, setMapError] = useState("");

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await readJson<{ cases: CaseSummary[] }>(await fetch("/api/cases?view=summary", { cache: "no-store" }));
      setCases(payload.cases.filter((item) => item.reason === "2期欠費貼單"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "資料載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const pending = useMemo(() => cases.filter((item) => item.status !== "已結案"), [cases]);
  const completed = useMemo(() => cases.filter((item) => item.status === "已結案"), [cases]);
  const mapCases = showCompleted ? cases : pending;
  const located = useMemo(
    () => mapCases
      .map((item) => ({ item, point: parseCoordinates(item.coordinates) }))
      .filter((entry): entry is { item: CaseSummary; point: LatLng } => Boolean(entry.point)),
    [mapCases],
  );

  const markDone = useCallback(async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setMessage("");
    try {
      await readJson(await fetch(\`/api/cases/\${id}\`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "已結案", customStatus: "" }),
      }));
      setCases((current) => current.map((item) => item.id === id ? { ...item, status: "已結案" } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusyId("");
    }
  }, [busyId]);

  useEffect(() => {
    const node = mapNode.current;
    if (!node) return;
    const handleClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("[data-arrears-done]");
      const id = button?.dataset.arrearsDone;
      if (id) void markDone(id);
    };
    node.addEventListener("click", handleClick);
    return () => node.removeEventListener("click", handleClick);
  }, [markDone]);

  useEffect(() => {
    if (loading || !mapNode.current || located.length === 0) return;
    let cancelled = false;
    let map: LeafletMap | null = null;
    setMapError("");

    void loadLeaflet()
      .then((leaflet) => {
        if (cancelled || !mapNode.current) return;
        mapNode.current.innerHTML = "";
        map = leaflet.map(mapNode.current, { zoomControl: true }).setView([23.706, 120.43], 13);
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const icon = leaflet.divIcon({
          className: "arrears-pin-wrap",
          html: '<span class="arrears-pin"></span>',
          iconSize: [32, 44],
          iconAnchor: [16, 42],
          popupAnchor: [0, -36],
        });

        for (const { item, point } of located) {
          leaflet.marker(point, { icon }).addTo(map).bindPopup(popupHtml(item), { maxWidth: 340, minWidth: 270 });
        }

        if (located.length === 1) map.setView(located[0].point, 17);
        else map.fitBounds(leaflet.latLngBounds(located.map((entry) => entry.point)), { padding: [42, 42] });
      })
      .catch((error: unknown) => setMapError(error instanceof Error ? error.message : "地圖載入失敗"));

    return () => {
      cancelled = true;
      map?.remove();
      if (mapNode.current) mapNode.current.innerHTML = "";
    };
  }, [loading, located]);

  const parsed = useMemo(() => parseDelimited(importText), [importText]);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportText(await file.text());
  }

  async function importRows() {
    if (parsed.error || !parsed.rows.length || importing) return;
    const existing = new Set(pending.map((item) => normalizeWaterNumber(item.waterNumber)));
    const rows = parsed.rows.filter((row) => !existing.has(normalizeWaterNumber(row.waterNumber)));
    const skipped = parsed.rows.length - rows.length;
    if (!rows.length) {
      setMessage("這批水號目前都已在未完成清單中，沒有重複匯入。");
      return;
    }

    setImporting(true);
    setMessage("");
    try {
      const payloadRows = rows.map((row) => ({
        ...row,
        phone: "",
        reason: "2期欠費貼單",
        status: "待處理",
        customStatus: "",
      }));
      const result = await readJson<{ imported: number }>(await fetch("/api/cases/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: payloadRows,
          defaultStatus: "待處理",
          defaultCustomStatus: "",
          defaultReason: "2期欠費貼單",
        }),
      }));
      setMessage(\`已匯入 \${result.imported} 戶\${skipped ? \`，另有 \${skipped} 戶因未完成清單已存在而略過\` : ""}。\`);
      setImportText("");
      setImportOpen(false);
      await loadCases();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "匯入失敗");
    } finally {
      setImporting(false);
    }
  }

  const missing = mapCases.length - located.length;

  return (
    <main className="arrears-shell">
      <header className="arrears-head">
        <div>
          <a href="/">← 返回查表工作台</a>
          <h1>2期欠費貼單</h1>
          <p>{userName}｜全部未貼戶直接顯示在地圖；你自己排順序，貼完就關掉。</p>
        </div>
        <button type="button" onClick={() => setImportOpen((value) => !value)}>＋ 批次匯入</button>
      </header>

      <section className="arrears-stats">
        <div><span>總戶數</span><strong>{cases.length}</strong></div>
        <div><span>未貼</span><strong>{pending.length}</strong></div>
        <div><span>已貼</span><strong>{completed.length}</strong></div>
        <label><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> 顯示已完成</label>
      </section>

      {importOpen ? (
        <section className="arrears-import">
          <h2>批次匯入</h2>
          <p>直接從 Excel／ODS 複製貼上即可。至少要有「水號」；建議包含姓名、地址、表號及座標。可使用單一「座標」欄，或分成 X座標／Y座標。電話不會顯示也不會匯入。</p>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={chooseFile} />
          <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={"水號\t姓名\t地址\t表號\tX座標\tY座標"} />
          {parsed.error && importText ? <div className="arrears-warning">{parsed.error}</div> : null}
          {parsed.rows.length > 0 ? <div className="arrears-preview">辨識到 {parsed.rows.length} 戶</div> : null}
          <div className="arrears-import-actions">
            <button type="button" onClick={() => setImportOpen(false)}>取消</button>
            <button className="primary" type="button" disabled={importing || !parsed.rows.length || Boolean(parsed.error)} onClick={() => void importRows()}>
              {importing ? "匯入中…" : \`匯入 \${parsed.rows.length} 戶\`}
            </button>
          </div>
        </section>
      ) : null}

      {message ? <div className="arrears-message">{message}</div> : null}
      {missing > 0 ? <div className="arrears-warning">有 {missing} 戶沒有可辨識座標，暫時無法顯示在地圖上。</div> : null}
      {mapError ? <div className="arrears-warning">{mapError}</div> : null}

      <section className="arrears-map-card">
        {loading ? <div className="arrears-empty">載入中…</div> : null}
        {!loading && mapCases.length === 0 ? <div className="arrears-empty">目前沒有未貼的 2 期欠費戶。</div> : null}
        {!loading && mapCases.length > 0 && located.length === 0 ? <div className="arrears-empty">目前這批資料沒有可辨識的座標。</div> : null}
        <div ref={mapNode} className="arrears-map" aria-label="2期欠費貼單地圖" />
      </section>

      <section className="arrears-list">
        <h2>未貼清單 <span>{pending.length}</span></h2>
        {pending.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.waterNumber}</strong>
              <b>{item.customerName || "未填姓名"}</b>
              <p>{item.address || "未填地址"}</p>
              <small>{item.meterNumber ? \`表號 \${item.meterNumber}\` : "未填表號"}</small>
            </div>
            <a href={googleMapsUrl(item)} target="_blank" rel="noreferrer">導航</a>
            <button type="button" disabled={busyId === item.id} onClick={() => void markDone(item.id)}>
              {busyId === item.id ? "處理中…" : "✓ 已貼單"}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
