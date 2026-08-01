"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { coerceCaseStatus } from "../case-status.js";

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

type JournalEntry = {
  item: InspectionCase;
  record: FollowUp;
};

type DatePreset = "today" | "yesterday" | "sevenDays" | "month" | "all" | "custom";

const datePresets: Array<[DatePreset, string]> = [
  ["today", "今天"],
  ["yesterday", "昨天"],
  ["sevenDays", "最近7天"],
  ["month", "本月"],
  ["all", "全部"],
  ["custom", "自訂日期"],
];

const styles = `
  *{box-sizing:border-box}
  body{margin:0;background:#f3f6fa;color:#17253d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif}
  button,input{font:inherit}
  .journal-shell{width:min(1080px,100%);margin:0 auto;padding:20px 18px 70px}
  .journal-topbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
  .journal-topbar h1{margin:3px 0 0;font-size:clamp(1.65rem,4vw,2.2rem);letter-spacing:-.03em}
  .eyebrow{margin:0;color:#1263df;font-size:.72rem;font-weight:900;letter-spacing:.13em}
  .journal-account{display:flex;align-items:center;gap:10px;color:#65738a;font-size:.78rem;font-weight:800}
  .journal-account a,.back-link{color:#1263df;text-decoration:none;font-weight:900}
  .journal-intro{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border:1px solid #d9e3ef;border-radius:18px;background:#fff;box-shadow:0 9px 28px rgba(25,53,91,.08)}
  .journal-intro h2{margin:0 0 5px;font-size:1.15rem}
  .journal-intro p{margin:0;color:#66758a;font-size:.82rem;line-height:1.55}
  .journal-count{flex:none;min-width:86px;padding:11px 14px;border-radius:14px;background:#eaf2fd;color:#1557b0;text-align:center}
  .journal-count strong{display:block;font-size:1.5rem}
  .journal-count span{font-size:.7rem;font-weight:900}
  .journal-toolbar{margin-top:16px;padding:17px;border:1px solid #d9e3ef;border-radius:18px;background:#fff}
  .journal-search{display:flex;align-items:center;gap:9px;padding:0 13px;border:1px solid #bdcad9;border-radius:12px;background:#f9fbfd}
  .journal-search input{width:100%;min-height:48px;border:0;outline:0;background:transparent;color:#17253d;font-weight:750}
  .journal-search span{color:#6a7b91;font-size:1.2rem}
  .preset-row{display:flex;gap:8px;overflow-x:auto;margin-top:13px;padding-bottom:2px}
  .preset{flex:none;min-height:40px;padding:0 14px;border:1px solid #c9d5e2;border-radius:999px;background:#fff;color:#40516b;font-weight:850;cursor:pointer}
  .preset.active{border-color:#1263df;background:#1263df;color:#fff}
  .custom-range{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:13px;padding-top:13px;border-top:1px solid #e3e9f0}
  .custom-range label{display:grid;gap:6px;color:#54647b;font-size:.72rem;font-weight:900}
  .custom-range input{min-height:44px;border:1px solid #bdcad9;border-radius:11px;background:#fff;padding:0 11px;color:#17253d;font-weight:800}
  .filter-summary{margin:11px 2px 0;color:#6b788c;font-size:.72rem;font-weight:750}
  .journal-loading,.journal-empty,.journal-error{margin-top:18px;padding:28px;border:1px solid #d9e3ef;border-radius:18px;background:#fff;text-align:center;color:#64748b}
  .journal-error{border-color:#e9b8bc;background:#fff6f6;color:#a32b33}
  .date-group{margin-top:22px}
  .date-heading{display:flex;align-items:center;gap:10px;margin:0 2px 11px;color:#17345d;font-size:1.02rem;font-weight:950}
  .date-heading::before{content:"";width:11px;height:11px;border:4px solid #1263df;border-radius:999px;background:#fff;box-shadow:0 0 0 4px #e5effd}
  .date-heading::after{content:"";height:1px;flex:1;background:#d7e0ea}
  .date-heading span{color:#748196;font-size:.7rem;font-weight:850}
  .journal-cards{display:grid;gap:12px}
  .journal-card{overflow:hidden;border:1px solid #d9e3ef;border-radius:18px;background:#fff;box-shadow:0 7px 20px rgba(22,45,78,.06)}
  .card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 17px;border-bottom:1px solid #e7edf4;background:#fbfcfe}
  .card-head h3{margin:3px 0 0;font-size:1rem;line-height:1.35}
  .method{color:#1263df;font-size:.72rem;font-weight:950}
  .status{flex:none;padding:6px 9px;border-radius:999px;background:#edf2f7;color:#40516b;font-size:.67rem;font-weight:900}
  .case-line{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 17px 0}
  .case-line strong{display:block;font-size:.94rem}
  .case-line p{margin:4px 0 0;color:#64748b;font-size:.76rem;line-height:1.45}
  .copy-button{flex:none;min-height:36px;padding:0 11px;border:1px solid #b8c9de;border-radius:10px;background:#fff;color:#1263df;font-size:.7rem;font-weight:900;cursor:pointer}
  .case-details{display:flex;gap:7px;flex-wrap:wrap;padding:10px 17px 0}
  .case-details span{padding:5px 8px;border-radius:8px;background:#f2f5f9;color:#5b6b80;font-size:.67rem;font-weight:800}
  .record-content{display:grid;gap:10px;padding:15px 17px 17px}
  .pointer{margin:0;padding:9px 11px;border-radius:10px;background:#eef5ff;color:#1557b0;font-size:.78rem;font-weight:900}
  .content-block{padding:11px 12px;border:1px solid #e1e8f0;border-radius:12px;background:#fff}
  .content-block.result{border-color:#cfe6d7;background:#f5fcf7}
  .content-block.next{border-color:#f0d99d;background:#fffaf0}
  .content-block span{display:block;margin-bottom:5px;color:#6a778b;font-size:.66rem;font-weight:950;letter-spacing:.04em}
  .content-block p{margin:0;white-space:pre-wrap;color:#2b3b52;font-size:.79rem;line-height:1.62}
  .record-meta{display:flex;gap:8px;flex-wrap:wrap;color:#6c7b90;font-size:.68rem;font-weight:800}
  .record-meta .follow{color:#9a6513}
  .attachment-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:2px}
  .attachment{display:block;overflow:hidden;border:1px solid #dce4ed;border-radius:11px;background:#f3f6f9;color:#40516b;text-decoration:none}
  .attachment img,.attachment video{display:block;width:100%;height:92px;object-fit:cover;background:#e8edf3}
  .attachment span{display:block;padding:8px;font-size:.65rem;font-weight:850;overflow-wrap:anywhere}
  .card-actions{display:flex;justify-content:flex-end;padding:0 17px 16px}
  .open-case{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border-radius:11px;background:#1263df;color:#fff;text-decoration:none;font-size:.74rem;font-weight:900}
  @media(max-width:700px){
    .journal-shell{padding:16px 12px 70px}
    .journal-topbar{align-items:stretch;flex-direction:column}
    .journal-account{justify-content:space-between}
    .journal-intro{align-items:flex-start}
    .custom-range{grid-template-columns:1fr}
    .attachment-row{grid-template-columns:repeat(2,minmax(0,1fr))}
    .case-line{flex-direction:column}
    .copy-button{width:100%}
    .card-actions .open-case{width:100%}
  }
`;

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function firstDayOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function formatDate(value: string, withWeekday = false) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "未設定";
  const year = Number(match[1]) - 1911;
  const month = match[2];
  const day = match[3];
  const base = `${year}/${month}/${day}`;
  if (!withWeekday) return base;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[new Date(`${value}T00:00:00`).getDay()];
  return `${base}（${weekday}）`;
}

function dateSearchAliases(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const rocYear = Number(match[1]) - 1911;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return [value, `${rocYear}/${match[2]}/${match[3]}`, `${rocYear}/${month}/${day}`, `${month}/${day}`].join(" ");
}

function createdAtLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `建檔 ${date.getFullYear() - 1911}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/[\s\-_/，,。；;（）()]/g, "");
}

function statusLabel(item: InspectionCase) {
  return coerceCaseStatus(item.status, item.customStatus).status;
}

function progressLabel(item: InspectionCase) {
  return coerceCaseStatus(item.status, item.customStatus).customStatus;
}

function dateRange(preset: DatePreset, customStart: string, customEnd: string) {
  const current = localIsoDate();
  if (preset === "today") return { start: current, end: current };
  if (preset === "yesterday") {
    const yesterday = addDays(current, -1);
    return { start: yesterday, end: yesterday };
  }
  if (preset === "sevenDays") return { start: addDays(current, -6), end: current };
  if (preset === "month") return { start: firstDayOfMonth(current), end: current };
  if (preset === "all") return { start: "", end: "" };
  if (!customStart && !customEnd) return { start: "", end: "" };
  if (!customStart) return { start: "", end: customEnd };
  if (!customEnd) return { start: customStart, end: "" };
  return customStart <= customEnd
    ? { start: customStart, end: customEnd }
    : { start: customEnd, end: customStart };
}

function inRange(value: string, start: string, end: string) {
  if (!value) return false;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
}

export default function JournalClient({ userName }: { userName: string }) {
  const current = localIsoDate();
  const [cases, setCases] = useState<InspectionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState<DatePreset>("sevenDays");
  const [customStart, setCustomStart] = useState(addDays(current, -6));
  const [customEnd, setCustomEnd] = useState(current);
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/cases", { cache: "no-store" })
      .then(async (response) => {
        const text = await response.text();
        const data = (text ? JSON.parse(text) : {}) as { cases?: InspectionCase[]; error?: string };
        if (!response.ok) throw new Error(data.error || "無法載入處理日誌");
        return data.cases || [];
      })
      .then((items) => {
        if (active) setCases(items);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "無法載入處理日誌");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const allEntries = useMemo<JournalEntry[]>(
    () =>
      cases
        .flatMap((item) => item.records.map((record) => ({ item, record })))
        .sort(
          (left, right) =>
            right.record.date.localeCompare(left.record.date) ||
            (right.record.createdAt || "").localeCompare(left.record.createdAt || ""),
        ),
    [cases],
  );

  const range = useMemo(
    () => dateRange(preset, customStart, customEnd),
    [customEnd, customStart, preset],
  );

  const visibleEntries = useMemo(() => {
    const needle = normalizeSearch(query.trim());
    return allEntries.filter(({ item, record }) => {
      if (!inRange(record.date, range.start, range.end)) return false;
      if (!needle) return true;
      const haystack = normalizeSearch(
        [
          dateSearchAliases(record.date),
          item.waterNumber,
          item.customerName,
          item.phone,
          item.address,
          item.meterNumber,
          item.reason,
          statusLabel(item),
          progressLabel(item),
          record.method,
          record.pointer,
          record.process,
          record.result,
          record.nextStep,
          dateSearchAliases(record.followUpDate),
        ].join(" "),
      );
      return haystack.includes(needle);
    });
  }, [allEntries, query, range.end, range.start]);

  const groups = useMemo(() => {
    const grouped = new Map<string, JournalEntry[]>();
    for (const entry of visibleEntries) {
      const existing = grouped.get(entry.record.date) || [];
      existing.push(entry);
      grouped.set(entry.record.date, existing);
    }
    return Array.from(grouped, ([date, entries]) => ({ date, entries }));
  }, [visibleEntries]);

  async function copyWaterNumber(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((currentId) => (currentId === id ? "" : currentId)), 1600);
    } catch {
      window.prompt("請複製水號", value);
    }
  }

  const rangeLabel = range.start || range.end
    ? `${range.start ? formatDate(range.start) : "最早"}～${range.end ? formatDate(range.end) : "現在"}`
    : "全部日期";

  return (
    <main className="journal-shell">
      <style>{styles}</style>
      <header className="journal-topbar">
        <div>
          <p className="eyebrow">WORK JOURNAL</p>
          <h1>處理日誌</h1>
        </div>
        <div className="journal-account">
          <span>{userName}</span>
          <a href="/">返回案件清單</a>
        </div>
      </header>

      <section className="journal-intro">
        <div>
          <h2>依日期找出做過的事情</h2>
          <p>可搜尋水號、姓名、地址、指針、處理經過、結果及下一步。</p>
        </div>
        <div className="journal-count">
          <strong>{visibleEntries.length}</strong>
          <span>筆紀錄</span>
        </div>
      </section>

      <section className="journal-toolbar">
        <label className="journal-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋日期、水號、姓名、地址或處理內容"
          />
        </label>
        <div className="preset-row" aria-label="日期篩選">
          {datePresets.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={preset === value ? "preset active" : "preset"}
              onClick={() => setPreset(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="custom-range">
            <label>
              開始日期
              <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
            </label>
            <label>
              結束日期
              <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </label>
          </div>
        )}
        <p className="filter-summary">目前範圍：{rangeLabel}{query.trim() ? `｜搜尋「${query.trim()}」` : ""}</p>
      </section>

      {loading ? (
        <div className="journal-loading">正在整理所有案件的處理紀錄…</div>
      ) : error ? (
        <div className="journal-error" role="alert">{error}</div>
      ) : groups.length === 0 ? (
        <div className="journal-empty">這個日期範圍內找不到符合的處理紀錄。</div>
      ) : (
        groups.map((group) => (
          <section className="date-group" key={group.date}>
            <h2 className="date-heading">
              {formatDate(group.date, true)}
              <span>{group.entries.length} 筆</span>
            </h2>
            <div className="journal-cards">
              {group.entries.map(({ item, record }) => (
                <article className="journal-card" key={record.id}>
                  <div className="card-head">
                    <div>
                      <span className="method">{record.method || "未填處理方式"}</span>
                      <h3>{item.reason || "未填案件原因"}</h3>
                    </div>
                    <span className="status">{statusLabel(item)}</span>
                  </div>

                  <div className="case-line">
                    <div>
                      <strong>{item.waterNumber}｜{item.customerName || "未填姓名"}</strong>
                      <p>{item.address || "未填地址"}</p>
                    </div>
                    <button
                      type="button"
                      className="copy-button"
                      onClick={() => void copyWaterNumber(item.waterNumber, record.id)}
                    >
                      {copiedId === record.id ? "已複製" : "複製水號"}
                    </button>
                  </div>

                  <div className="case-details">
                    {progressLabel(item) && <span>目前進度 {progressLabel(item)}</span>}
                    {item.phone && <span>電話 {item.phone}</span>}
                    {item.meterNumber && <span>表號 {item.meterNumber}</span>}
                    {record.attachments.length > 0 && <span>附件 {record.attachments.length} 個</span>}
                  </div>

                  <div className="record-content">
                    {record.pointer && <p className="pointer">現場指針：{record.pointer} 度</p>}
                    <div className="content-block">
                      <span>處理經過</span>
                      <p>{record.process || "未填寫處理經過"}</p>
                    </div>
                    {record.result && (
                      <div className="content-block result">
                        <span>處理結果</span>
                        <p>{record.result}</p>
                      </div>
                    )}
                    {record.nextStep && (
                      <div className="content-block next">
                        <span>下一步</span>
                        <p>{record.nextStep}</p>
                      </div>
                    )}
                    <div className="record-meta">
                      {record.followUpDate && <span className="follow">下次追蹤 {formatDate(record.followUpDate)}</span>}
                      {createdAtLabel(record.createdAt) && <span>{createdAtLabel(record.createdAt)}</span>}
                    </div>
                    {record.attachments.length > 0 && (
                      <div className="attachment-row">
                        {record.attachments.map((file) => (
                          <a className="attachment" href={file.url} target="_blank" rel="noreferrer" key={file.id}>
                            {file.contentType.startsWith("image/") ? (
                              <img src={file.url} alt={file.filename} />
                            ) : file.contentType.startsWith("video/") ? (
                              <video src={file.url} muted playsInline />
                            ) : null}
                            <span>{file.filename}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card-actions">
                    <a
                      className="open-case"
                      href={`/?caseWater=${encodeURIComponent(item.waterNumber)}&caseName=${encodeURIComponent(item.customerName || "")}&receivedDate=${encodeURIComponent(item.receivedDate)}&recordDate=${encodeURIComponent(record.date)}`}
                    >
                      開啟這件案件
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
