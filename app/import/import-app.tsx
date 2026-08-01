"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { CASE_PROGRESS_OPTIONS, CASE_STATUSES } from "../case-status.js";

type ImportRow = {
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
  rawText?: string;
};

type HeaderKey = Exclude<keyof ImportRow, "rawText">;
type ImportMode = "31" | "csv";

const statuses = CASE_STATUSES;
const progressOptions = CASE_PROGRESS_OPTIONS;
const headers: Array<{ key: HeaderKey; label: string }> = [
  { key: "waterNumber", label: "水號" },
  { key: "customerName", label: "姓名" },
  { key: "phone", label: "電話" },
  { key: "address", label: "地址" },
  { key: "coordinates", label: "座標" },
  { key: "meterNumber", label: "表號" },
  { key: "reason", label: "案件原因" },
  { key: "receivedDate", label: "收件日期" },
  { key: "status", label: "案件狀態" },
  { key: "customStatus", label: "目前進度" },
];

const aliases: Record<string, HeaderKey> = {
  水號: "waterNumber", 水号: "waterNumber", 用戶水號: "waterNumber", 用户水号: "waterNumber", waternumber: "waterNumber", waterno: "waterNumber",
  姓名: "customerName", 用戶姓名: "customerName", 用户姓名: "customerName", customername: "customerName", name: "customerName",
  電話: "phone", 电话: "phone", 用戶電話: "phone", 用户电话: "phone", phone: "phone",
  地址: "address", 住址: "address", address: "address",
  座標: "coordinates", 坐标: "coordinates", 經緯度: "coordinates", 经纬度: "coordinates", coordinates: "coordinates",
  表號: "meterNumber", 表号: "meterNumber", 水表號碼: "meterNumber", meter: "meterNumber", meternumber: "meterNumber",
  案件原因: "reason", 原因: "reason", reason: "reason",
  收件日期: "receivedDate", 日期: "receivedDate", receiveddate: "receivedDate",
  案件狀態: "status", 案件状态: "status", 狀態: "status", 状态: "status", status: "status",
  目前進度: "customStatus", 当前进度: "customStatus", 其他狀態說明: "customStatus", 其他状态说明: "customStatus", customstatus: "customStatus",
};

const styles = `
  .import-shell{min-height:100vh;width:min(980px,100%);margin:0 auto;padding:28px 22px 80px;color:#17253d}
  .import-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.import-top h1{margin:4px 0 0;font-size:clamp(1.7rem,5vw,2.35rem)}.import-top p{margin:0;color:#1263df;font-size:.72rem;font-weight:800;letter-spacing:.14em}.import-user{color:#65738a;font-size:.82rem}
  .import-card{padding:22px;border:1px solid #dde4ec;border-radius:22px;background:#fff;box-shadow:0 10px 35px rgba(17,36,65,.06)}.import-card+.import-card{margin-top:16px}.import-card h2{margin:0 0 8px;font-size:1.1rem}.import-card>p{margin:0 0 18px;color:#65738a;line-height:1.65}
  .mode-tabs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.mode-tab{min-height:48px;border:1px solid #b9c8da;border-radius:12px;background:#fff;color:#26466f;font-weight:900;cursor:pointer}.mode-tab.active{border-color:#1263df;background:#eaf2fd;color:#1263df}
  .import-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.import-field{display:flex;flex-direction:column;gap:7px;color:#40506a;font-size:.82rem;font-weight:800}.import-field.wide{grid-column:1/-1}.import-field input,.import-field select,.import-field textarea{width:100%;border:1px solid #cfd8e4;border-radius:12px;background:#fff;color:#17253d;font:inherit;font-weight:400;outline:0}.import-field input,.import-field select{min-height:46px;padding:0 12px}.import-field textarea{min-height:260px;padding:12px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;line-height:1.55}.import-field input:focus,.import-field select:focus,.import-field textarea:focus{border-color:#1263df;box-shadow:0 0 0 3px rgba(18,99,223,.1)}
  .file-box{padding:17px;border:1px dashed #99b5d9;border-radius:15px;background:#f7faff}.file-box input{height:auto;padding:8px;background:transparent}.actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px}.primary,.secondary{min-height:46px;padding:0 18px;border-radius:12px;font-weight:800;cursor:pointer}.primary{border:0;background:#1263df;color:#fff;box-shadow:0 8px 22px rgba(18,99,223,.22)}.secondary{border:1px solid #b9c8da;background:#fff;color:#26466f}.primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}
  .notice{margin-top:16px;padding:13px 15px;border-radius:12px;line-height:1.55}.notice.error{border:1px solid #efb4b8;background:#fff2f3;color:#a62d35}.notice.success{border:1px solid #a9ddc1;background:#effaf4;color:#1f7249}.notice.info{border:1px solid #b7cceb;background:#f1f6fd;color:#315b91}.notice ul{margin:8px 0 0;padding-left:20px}
  .preview{overflow-x:auto;margin-top:16px;border:1px solid #dde4ec;border-radius:14px}table{width:100%;border-collapse:collapse;min-width:760px;font-size:.76rem}th,td{padding:10px;border-bottom:1px solid #edf1f5;text-align:left;vertical-align:top;white-space:nowrap}th{background:#f5f8fc;color:#506078}td{max-width:240px;overflow:hidden;text-overflow:ellipsis}.count{display:inline-flex;margin-top:12px;padding:6px 10px;border-radius:999px;background:#eaf2fd;color:#245da9;font-size:.78rem;font-weight:800}.back-link{display:inline-flex;margin-top:18px;color:#1263df;font-weight:800;text-decoration:none}.tips{margin:14px 0 0;padding-left:19px;color:#65738a;line-height:1.7;font-size:.83rem}
  @media(max-width:650px){.import-grid{grid-template-columns:1fr}.import-field.wide{grid-column:auto}.import-top{align-items:flex-start;flex-direction:column}.actions>*{flex:1}.import-card{padding:17px}.mode-tabs{grid-template-columns:1fr}}
`;

function emptyRow(): ImportRow {
  return { waterNumber: "", customerName: "", phone: "", address: "", coordinates: "", meterNumber: "", reason: "", receivedDate: "", status: "", customStatus: "" };
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_\-()（）:：]/g, "");
}

function parseDelimited(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/, "")); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseImportRows(text: string) {
  const matrix = parseDelimited(text.trim());
  if (!matrix.length) return { rows: [] as ImportRow[], error: "請選擇 CSV 或貼上資料" };
  const mappedHeaders = matrix[0].map((label) => aliases[normalizeHeader(label)] || null);
  if (!mappedHeaders.includes("waterNumber")) return { rows: [] as ImportRow[], error: "第一列必須包含「水號」欄位" };
  const rows = matrix.slice(1).map((values) => {
    const item = emptyRow();
    mappedHeaders.forEach((key, index) => { if (key) item[key] = String(values[index] || "").trim(); });
    return item;
  });
  return { rows, error: "" };
}

function cleanToken(value: string) {
  return value.replace(/^[\s:：]+|[\s:：]+$/g, "");
}

function extractValue(text: string, labels: string[]) {
  const tokens = text.split(/[\t\r\n]+/).map(cleanToken).filter(Boolean);
  const normalizedLabels = labels.map(normalizeHeader);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const normalized = normalizeHeader(token);
    const matchingLabel = normalizedLabels.find((label) => normalized === label);
    if (!matchingLabel) continue;

    for (let next = index + 1; next < Math.min(tokens.length, index + 4); next += 1) {
      const candidate = cleanToken(tokens[next]);
      if (!candidate) continue;
      if (normalizedLabels.includes(normalizeHeader(candidate))) continue;
      return candidate;
    }
  }

  for (const label of labels) {
    const spacedLabel = label.split("").map((character) => `${character}\\s*`).join("");
    const match = text.match(new RegExp(`${spacedLabel}[:：]?\\s*(?:\\r?\\n\\s*)?([^\\t\\r\\n]+)`, "i"));
    if (match?.[1]) return cleanToken(match[1]);
  }
  return "";
}

function parse31(text: string) {
  if (!text.trim()) return { rows: [] as ImportRow[], error: "請先在 31 畫面按 Ctrl+A、Ctrl+C，再貼到這裡" };
  const item = emptyRow();
  item.waterNumber = extractValue(text, ["水號", "用戶水號", "用水號碼", "水號資料"]);
  if (!item.waterNumber) {
    const match = text.match(/\b(?:5M|[A-Z0-9]{2})(?:\s*-\s*[A-Z0-9]+){2,5}\b/i);
    if (match) item.waterNumber = match[0];
  }
  item.customerName = extractValue(text, ["用戶姓名", "用戶名稱", "姓名", "戶名", "用水人姓名"]);
  item.phone = extractValue(text, ["行動電話", "聯絡電話", "用戶電話", "電話", "手機", "電話號碼"]);
  item.address = extractValue(text, ["用水地址", "裝置地址", "住址", "地址", "通訊地址"]);
  item.coordinates = extractValue(text, ["座標", "經緯度", "X/Y座標", "X座標"]);
  item.meterNumber = extractValue(text, ["水表號碼", "水表編號", "量水器號碼", "表號"]);
  item.rawText = text.trim();
  if (!item.waterNumber) return { rows: [item], error: "目前未辨識到水號，請確認貼上的是完整 31 畫面；其他原始文字尚未送出。" };
  return { rows: [item], error: "" };
}

function downloadTemplate() {
  const csv = `\uFEFF${headers.map((item) => item.label).join(",")}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = "稽查案件批次匯入範例.csv"; anchor.click(); URL.revokeObjectURL(url);
}

async function readJson(response: Response) { const text = await response.text(); return text ? JSON.parse(text) : {}; }

export default function ImportApp({ userName }: { userName: string }) {
  const [mode, setMode] = useState<ImportMode>("31");
  const [text, setText] = useState("");
  const [defaultStatus, setDefaultStatus] = useState("處理中");
  const [defaultProgress, setDefaultProgress] = useState("持續處理中");
  const [defaultReason, setDefaultReason] = useState("");
  const [defaultReceivedDate, setDefaultReceivedDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const parsed = useMemo(() => mode === "31" ? parse31(text) : parseImportRows(text), [mode, text]);

  function resetFeedback() { setMessage(""); setErrors([]); setSuccess(false); }
  function switchMode(next: ImportMode) { setMode(next); setText(""); resetFeedback(); }
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; resetFeedback(); setText(await file.text()); }

  async function importRows() {
    resetFeedback();
    if (parsed.error) { setMessage(parsed.error); return; }
    if (!parsed.rows.length) { setMessage("沒有可匯入的案件"); return; }
    const wording = mode === "31" ? "建立案件，並將完整 31 畫面另存為處理紀錄" : `匯入 ${parsed.rows.length} 件案件`;
    if (!window.confirm(`確定要${wording}嗎？`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/cases/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: parsed.rows, defaultStatus, defaultCustomStatus: defaultProgress, defaultReason, defaultReceivedDate }) });
      const result = (await readJson(response)) as { imported?: number; error?: string; errors?: string[] };
      if (!response.ok) { setMessage(result.error || "匯入失敗"); setErrors(result.errors || []); return; }
      setSuccess(true);
      setMessage(mode === "31" ? "已建立案件，31 畫面完整原文已另存保留，不會覆蓋舊紀錄" : `已成功匯入 ${result.imported || parsed.rows.length} 件案件`);
      setText("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "匯入失敗"); }
    finally { setBusy(false); }
  }

  return (
    <main className="import-shell">
      <style>{styles}</style>
      <header className="import-top"><div><p>PRIVATE CASE IMPORT</p><h1>匯入稽查案件</h1></div><span className="import-user">{userName}</span></header>

      <section className="import-card">
        <div className="mode-tabs">
          <button type="button" className={`mode-tab ${mode === "31" ? "active" : ""}`} onClick={() => switchMode("31")}>31 畫面 Ctrl+A 匯入</button>
          <button type="button" className={`mode-tab ${mode === "csv" ? "active" : ""}`} onClick={() => switchMode("csv")}>CSV／試算表批次匯入</button>
        </div>
        {mode === "31" ? (
          <><h2>貼上完整 31 畫面</h2><p>在 31 用戶資料維護畫面按 Ctrl+A、Ctrl+C，回到這裡按 Ctrl+V。系統會擷取水號、姓名、電話、地址、座標與表號，並把整份原文加日期另存為一筆處理紀錄。</p><div className="notice info">每次匯入都會新增一筆案件與原始資料紀錄，不會覆蓋同水號的舊案件。</div></>
        ) : (
          <><h2>準備 CSV</h2><p>可從 Excel、Google 試算表或手機檔案選取 CSV，也能直接貼上逗號或 Tab 分隔資料。</p><div className="actions"><button type="button" className="secondary" onClick={downloadTemplate}>下載空白範例 CSV</button></div></>
        )}
      </section>

      <section className="import-card">
        <h2>{mode === "31" ? "貼上 31 畫面全文" : "選擇檔案或貼上資料"}</h2>
        <div className="import-grid">
          {mode === "csv" && <label className="import-field wide file-box">選擇 CSV 檔案<input type="file" accept=".csv,text/csv,text/plain" onChange={chooseFile} /></label>}
          <label className="import-field wide">{mode === "31" ? "31 畫面完整原文" : "CSV／試算表資料"}<textarea value={text} onChange={(event) => { setText(event.target.value); resetFeedback(); }} placeholder={mode === "31" ? "請在 31 畫面按 Ctrl+A、Ctrl+C，再貼到此處……" : "水號,姓名,電話,地址,座標,表號,案件原因,收件日期,案件狀態,目前進度"} /></label>
          <label className="import-field">案件狀態<select value={defaultStatus} onChange={(event) => { const status = event.target.value; setDefaultStatus(status); if (status !== "處理中") setDefaultProgress(""); else if (!defaultProgress) setDefaultProgress("持續處理中"); }}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="import-field">目前進度<select value={defaultProgress} onChange={(event) => setDefaultProgress(event.target.value)} disabled={defaultStatus !== "處理中"}><option value="">未設定</option>{progressOptions.map((progress) => <option key={progress}>{progress}</option>)}</select></label>
          <label className="import-field">收件日期<input value={defaultReceivedDate} onChange={(event) => setDefaultReceivedDate(event.target.value)} placeholder="例如 115/07/27，可留白" /></label>
          <label className="import-field wide">案件原因<input value={defaultReason} onChange={(event) => setDefaultReason(event.target.value)} placeholder="例如：用水量徒增；可留白" /></label>
        </div>

        {text && !parsed.error && <span className="count">{mode === "31" ? "已辨識 1 件案件，完整原文會一併保存" : `辨識到 ${parsed.rows.length} 件案件`}</span>}
        {text && parsed.error && <div className="notice error">{parsed.error}</div>}
        {parsed.rows.length > 0 && (
          <div className="preview"><table><thead><tr>{headers.slice(0, 8).map((item) => <th key={item.key}>{item.label}</th>)}</tr></thead><tbody>{parsed.rows.slice(0, 5).map((row, index) => <tr key={`${row.waterNumber}-${index}`}>{headers.slice(0, 8).map((item) => <td key={item.key}>{row[item.key] || "—"}</td>)}</tr>)}</tbody></table></div>
        )}
        {message && <div className={`notice ${success ? "success" : "error"}`}>{message}{errors.length > 0 && <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>}</div>}
        <div className="actions"><button type="button" className="primary" onClick={() => void importRows()} disabled={busy || !parsed.rows.length || Boolean(parsed.error)}>{busy ? "正在匯入…" : mode === "31" ? "建立案件並保存完整原文" : `匯入 ${parsed.rows.length || 0} 件案件`}</button><a className="back-link" href="/">返回案件清單</a></div>
      </section>
    </main>
  );
}
