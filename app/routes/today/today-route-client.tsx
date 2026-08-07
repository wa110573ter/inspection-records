"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { appleMapsUrl, googleMapsUrl, parseCoordinate } from "../../route-utils";

type RecordItem = {
  id: string;
  date: string;
  method: string;
  pointer: string;
  process: string;
  result: string;
  nextStep: string;
  followUpDate: string;
};

type CaseItem = {
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
  records: RecordItem[];
};

type StopItem = {
  id: string;
  caseId: string;
  position: number;
  coordinateSnapshot: string;
  status: "pending" | "active" | "completed" | "skipped";
  skippedReason: string;
  customerName: string;
  waterNumber: string;
  phone: string;
  address: string;
  meterNumber: string;
  reason: string;
  receivedDate: string;
  caseStatus: string;
  latestRecord: RecordItem | null;
};

type RouteData = {
  id: string;
  routeDate: string;
  status: string;
  currentStopId: string;
  stops: StopItem[];
};

type TodayRouteResponse = {
  cases: CaseItem[];
  route: RouteData | null;
};

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "操作失敗");
  return data;
}

async function fetchTodayRouteData(): Promise<TodayRouteResponse> {
  const [caseResponse, routeResponse] = await Promise.all([
    jsonRequest<{ cases: CaseItem[] }>("/api/cases"),
    jsonRequest<{ route: RouteData | null }>(`/api/routes/today?date=${today()}`),
  ]);
  return { cases: caseResponse.cases, route: routeResponse.route };
}

export default function TodayRouteClient() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [record, setRecord] = useState({
    date: today(),
    method: "現場查看",
    pointer: "",
    process: "",
    result: "",
    nextStep: "",
    followUpDate: "",
  });

  const load = async () => {
    const data = await fetchTodayRouteData();
    setCases(data.cases);
    setRoute(data.route);
  };

  useEffect(() => {
    let cancelled = false;
    void fetchTodayRouteData()
      .then((data) => {
        if (cancelled) return;
        setCases(data.cases);
        setRoute(data.route);
      })
      .catch((error) => {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "載入失敗");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCases = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return cases.filter((item) => {
      if (!keyword) return item.status !== "已結案";
      return [item.waterNumber, item.customerName, item.address, item.reason]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [cases, search]);

  const activeStop =
    route?.stops.find((stop) => stop.id === route.currentStopId) ??
    route?.stops.find((stop) => stop.status === "active") ??
    null;
  const completed = route?.stops.filter((stop) => stop.status === "completed").length ?? 0;
  const skipped = route?.stops.filter((stop) => stop.status === "skipped").length ?? 0;

  const toggleCase = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const createRoute = async () => {
    if (!selected.length) return setMessage("請先勾選今天要跑的案件");
    setBusy(true);
    setMessage("");
    try {
      const response = await jsonRequest<{ route: RouteData }>("/api/routes/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeDate: today(), caseIds: selected, optimize: true }),
      });
      setRoute(response.route);
      setSelected([]);
      setMessage("今日路線已建立，已依圖資座標建議順序");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "建立失敗");
    } finally {
      setBusy(false);
    }
  };

  const updateStop = async (stop: StopItem, status: "completed" | "skipped") => {
    setBusy(true);
    setMessage("");
    try {
      await jsonRequest(`/api/routes/today/stops/${stop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, skippedReason: status === "skipped" ? "今日略過" : "" }),
      });
      await load();
      setMessage(status === "completed" ? "已完成，已切換到下一站" : "已略過，已切換到下一站");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  };

  const saveRecordAndComplete = async () => {
    if (!activeStop) return;
    if (!record.date || !record.method) return setMessage("請填寫日期與處理方式");
    setBusy(true);
    setMessage("");
    try {
      await jsonRequest(`/api/cases/${activeStop.caseId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      await jsonRequest(`/api/routes/today/stops/${activeStop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      setRecordOpen(false);
      setRecord({
        date: today(),
        method: "現場查看",
        pointer: "",
        process: "",
        result: "",
        nextStep: "",
        followUpDate: "",
      });
      await load();
      setMessage("處理紀錄已儲存，已切換到下一站");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <p className="eyebrow">FIELD ROUTE</p>
          <h1>今日路線</h1>
          <p>{today()}｜公司圖資座標優先</p>
        </div>
        <Link className="route-back" href="/">
          返回案件
        </Link>
      </header>

      {message && (
        <div className="route-message" role="status">
          {message}
        </div>
      )}

      {route?.stops.length ? (
        <>
          <section className="route-summary">
            <div>
              <span>總站數</span>
              <strong>{route.stops.length}</strong>
            </div>
            <div>
              <span>已完成</span>
              <strong>{completed}</strong>
            </div>
            <div>
              <span>已略過</span>
              <strong>{skipped}</strong>
            </div>
            <div>
              <span>剩餘</span>
              <strong>{route.stops.length - completed - skipped}</strong>
            </div>
          </section>

          {activeStop ? (
            <section className="route-active">
              <div className="route-progress">
                第 {activeStop.position}／{route.stops.length} 站
              </div>
              <h2>{activeStop.customerName || "未填姓名"}</h2>
              <p className="route-reason">{activeStop.reason || "未填案件原因"}</p>
              <dl>
                <div>
                  <dt>水號</dt>
                  <dd>{activeStop.waterNumber}</dd>
                </div>
                <div>
                  <dt>電話</dt>
                  <dd>{activeStop.phone || "未填"}</dd>
                </div>
                <div>
                  <dt>地址</dt>
                  <dd>{activeStop.address || "未填"}</dd>
                </div>
                <div>
                  <dt>表號</dt>
                  <dd>{activeStop.meterNumber || "未填"}</dd>
                </div>
                <div>
                  <dt>圖資座標</dt>
                  <dd>{activeStop.coordinateSnapshot}</dd>
                </div>
              </dl>
              {activeStop.latestRecord && (
                <div className="route-latest">
                  <strong>
                    最近處理：{activeStop.latestRecord.date}｜{activeStop.latestRecord.method}
                  </strong>
                  <p>{activeStop.latestRecord.process || activeStop.latestRecord.result || "無內容"}</p>
                  {activeStop.latestRecord.nextStep && <p>下一步：{activeStop.latestRecord.nextStep}</p>}
                </div>
              )}
              <div className="route-actions">
                <a
                  className="route-primary"
                  href={googleMapsUrl(activeStop.coordinateSnapshot)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Maps導航
                </a>
                <a
                  className="route-secondary"
                  href={appleMapsUrl(activeStop.coordinateSnapshot)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Apple地圖
                </a>
                {activeStop.phone && (
                  <a className="route-secondary" href={`tel:${activeStop.phone}`}>
                    撥打電話
                  </a>
                )}
                <button className="route-primary" type="button" onClick={() => setRecordOpen(true)}>
                  現場記錄並完成
                </button>
                <button
                  className="route-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => updateStop(activeStop, "completed")}
                >
                  直接標示完成
                </button>
                <button
                  className="route-danger"
                  type="button"
                  disabled={busy}
                  onClick={() => updateStop(activeStop, "skipped")}
                >
                  略過此站
                </button>
              </div>
            </section>
          ) : (
            <section className="route-finished">
              <h2>今日路線已完成</h2>
              <p>
                完成 {completed} 件，略過 {skipped} 件。
              </p>
            </section>
          )}

          <section className="route-list">
            <h2>全部站點</h2>
            {route.stops.map((stop) => (
              <article key={stop.id} className={`route-stop ${stop.status}`}>
                <span>{stop.position}</span>
                <div>
                  <strong>{stop.customerName || "未填姓名"}</strong>
                  <p>
                    {stop.reason}｜{stop.address}
                  </p>
                </div>
                <em>
                  {stop.status === "completed"
                    ? "完成"
                    : stop.status === "skipped"
                      ? "略過"
                      : stop.status === "active"
                        ? "目前"
                        : "待辦"}
                </em>
              </article>
            ))}
          </section>
        </>
      ) : (
        <section className="route-builder">
          <h2>勾選今天要跑的案件</h2>
          <p>只有具備台灣合理範圍圖資座標的案件可建立路線，不會使用地址猜定位。</p>
          <input
            className="route-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜尋水號、姓名、地址或案件原因"
          />
          <div className="route-case-list">
            {filteredCases.map((item) => {
              const coordinate = parseCoordinate(item.coordinates);
              return (
                <label key={item.id} className={`route-case ${coordinate.ok ? "" : "invalid"}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    disabled={!coordinate.ok}
                    onChange={() => toggleCase(item.id)}
                  />
                  <div>
                    <strong>
                      {item.customerName || "未填姓名"}｜{item.waterNumber}
                    </strong>
                    <p>
                      {item.reason || "未填原因"}｜{item.address || "未填地址"}
                    </p>
                    <small>
                      {coordinate.ok ? `圖資座標：${coordinate.value.normalized}` : coordinate.error}
                    </small>
                  </div>
                </label>
              );
            })}
          </div>
          <button
            className="route-create"
            type="button"
            disabled={busy || !selected.length}
            onClick={createRoute}
          >
            {busy ? "建立中…" : `建立今日路線（已選 ${selected.length} 件）`}
          </button>
        </section>
      )}

      {recordOpen && activeStop && (
        <div className="route-modal" role="dialog" aria-modal="true" aria-label="現場處理紀錄">
          <div className="route-modal-card">
            <h2>現場處理紀錄</h2>
            <label>
              日期
              <input
                type="date"
                value={record.date}
                onChange={(event) => setRecord({ ...record, date: event.target.value })}
              />
            </label>
            <label>
              處理方式
              <select
                value={record.method}
                onChange={(event) => setRecord({ ...record, method: event.target.value })}
              >
                <option>現場查看</option>
                <option>電話聯絡</option>
                <option>留通知單</option>
                <option>其他</option>
              </select>
            </label>
            <label>
              現場指針
              <input
                value={record.pointer}
                onChange={(event) => setRecord({ ...record, pointer: event.target.value })}
              />
            </label>
            <label>
              處理經過
              <textarea
                rows={4}
                value={record.process}
                onChange={(event) => setRecord({ ...record, process: event.target.value })}
              />
            </label>
            <label>
              處理結果
              <textarea
                rows={3}
                value={record.result}
                onChange={(event) => setRecord({ ...record, result: event.target.value })}
              />
            </label>
            <label>
              下一步
              <textarea
                rows={2}
                value={record.nextStep}
                onChange={(event) => setRecord({ ...record, nextStep: event.target.value })}
              />
            </label>
            <label>
              追蹤日期
              <input
                type="date"
                value={record.followUpDate}
                onChange={(event) => setRecord({ ...record, followUpDate: event.target.value })}
              />
            </label>
            <div className="route-modal-actions">
              <button type="button" className="route-secondary" onClick={() => setRecordOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className="route-primary"
                disabled={busy}
                onClick={saveRecordAndComplete}
              >
                {busy ? "儲存中…" : "儲存並完成本站"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
