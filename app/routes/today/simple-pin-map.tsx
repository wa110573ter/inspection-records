"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./simple-pin-map.css";

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

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
};

type LeafletIcon = unknown;

type LeafletApi = {
  map: (element: HTMLElement, options?: { zoomControl?: boolean }) => LeafletMap;
  tileLayer: (url: string, options: { maxZoom: number; attribution: string }) => LeafletLayer;
  marker: (point: LatLng, options?: { icon?: LeafletIcon }) => LeafletMarker;
  latLngBounds: (points: LatLng[]) => unknown;
  divIcon: (options: { className: string; html: string; iconSize: [number, number]; iconAnchor: [number, number]; popupAnchor: [number, number] }) => LeafletIcon;
};

const selectionStorageKey = "inspection-workbench-selected-cases-v1";
let leafletPromise: Promise<LeafletApi> | null = null;

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function singleDestinationUrl(item: CaseSummary) {
  const point = parseCoordinates(item.coordinates);
  const destination = point ? `${point[0]},${point[1]}` : item.address || item.waterNumber;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("地圖無法載入"));
  const existing = (window as Window & { L?: LeafletApi }).L;
  if (existing) return Promise.resolve(existing);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletApi>((resolve, reject) => {
    if (!document.getElementById("leaflet-simple-pin-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-simple-pin-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const finish = () => {
      const api = (window as Window & { L?: LeafletApi }).L;
      if (api) resolve(api);
      else reject(new Error("地圖元件載入失敗"));
    };

    const currentScript = document.getElementById("leaflet-simple-pin-js") as HTMLScriptElement | null;
    if (currentScript) {
      currentScript.addEventListener("load", finish, { once: true });
      currentScript.addEventListener("error", () => reject(new Error("地圖元件載入失敗")), { once: true });
      window.setTimeout(finish, 250);
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-simple-pin-js";
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

function readSelectedIds() {
  try {
    const raw = localStorage.getItem(selectionStorageKey);
    if (!raw) return [] as string[];
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [] as string[];
    return value.filter((item): item is string => typeof item === "string");
  } catch {
    return [] as string[];
  }
}

function popupHtml(item: CaseSummary) {
  const status = item.status === "處理中" && item.customStatus
    ? `${item.status}｜${item.customStatus}`
    : item.status || "未設定";

  return `
    <div class="simple-pin-popup">
      <div class="simple-pin-popup-title">${escapeHtml(item.waterNumber)}</div>
      <div class="simple-pin-popup-name">${escapeHtml(item.customerName || "未填姓名")}</div>
      <dl>
        <div><dt>地址</dt><dd>${escapeHtml(item.address || "未填地址")}</dd></div>
        <div><dt>電話</dt><dd>${escapeHtml(item.phone || "未填電話")}</dd></div>
        <div><dt>表號</dt><dd>${escapeHtml(item.meterNumber || "未填表號")}</dd></div>
        <div><dt>原因</dt><dd>${escapeHtml(item.reason || "未填原因")}</dd></div>
        <div><dt>狀態</dt><dd>${escapeHtml(status)}</dd></div>
      </dl>
      <a class="simple-pin-nav" href="${singleDestinationUrl(item)}" target="_blank" rel="noreferrer">導航到這一戶</a>
    </div>
  `;
}

export default function SimplePinMap() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedIds(readSelectedIds());
    void fetch("/api/cases?view=summary", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { cases?: CaseSummary[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "案件載入失敗");
        setCases(payload.cases || []);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "案件載入失敗");
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedCases = useMemo(() => {
    const selected = new Set(selectedIds);
    return cases.filter((item) => selected.has(item.id));
  }, [cases, selectedIds]);

  const locatedCases = useMemo(
    () => selectedCases
      .map((item) => ({ item, point: parseCoordinates(item.coordinates) }))
      .filter((entry): entry is { item: CaseSummary; point: LatLng } => Boolean(entry.point)),
    [selectedCases],
  );

  useEffect(() => {
    if (loading || error || !mapNode.current || locatedCases.length === 0) return;

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

        const icon = leaflet.divIcon({
          className: "simple-pin-icon-wrap",
          html: '<span class="simple-pin-icon"></span>',
          iconSize: [30, 42],
          iconAnchor: [15, 40],
          popupAnchor: [0, -34],
        });

        for (const { item, point } of locatedCases) {
          leaflet.marker(point, { icon }).addTo(map).bindPopup(popupHtml(item), { maxWidth: 330, minWidth: 260 });
        }

        if (locatedCases.length === 1) {
          map.setView(locatedCases[0].point, 17);
        } else {
          map.fitBounds(leaflet.latLngBounds(locatedCases.map((entry) => entry.point)), { padding: [50, 50] });
        }
      })
      .catch((mapError: unknown) => {
        if (!cancelled) setError(mapError instanceof Error ? mapError.message : "地圖載入失敗");
      });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [error, loading, locatedCases]);

  const missingCount = selectedCases.length - locatedCases.length;

  return (
    <main className="simple-map-shell">
      <header className="simple-map-header">
        <a href="/" className="simple-map-back">← 返回案件</a>
        <div>
          <strong>已選案件地圖</strong>
          <span>{selectedCases.length} 戶・只放圖釘，不排行程</span>
        </div>
      </header>

      {loading ? <div className="simple-map-message">正在載入案件…</div> : null}
      {!loading && selectedIds.length === 0 ? (
        <div className="simple-map-empty">
          <strong>目前沒有勾選案件</strong>
          <span>先回首頁勾選今天要看的戶，再打開地圖。</span>
          <a href="/">回首頁勾選</a>
        </div>
      ) : null}
      {!loading && selectedIds.length > 0 && selectedCases.length === 0 ? (
        <div className="simple-map-empty">
          <strong>找不到已勾選案件</strong>
          <span>案件可能已刪除或清單已更新，請回首頁重新勾選。</span>
          <a href="/">回首頁</a>
        </div>
      ) : null}
      {error ? <div className="simple-map-message error">{error}</div> : null}
      {missingCount > 0 ? (
        <div className="simple-map-warning">有 {missingCount} 戶沒有可辨識座標，所以不會顯示圖釘。</div>
      ) : null}

      <div ref={mapNode} className="simple-map-canvas" aria-label="已選案件圖釘地圖" />
    </main>
  );
}
