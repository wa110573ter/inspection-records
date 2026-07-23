"use client";

import { ChangeEvent, useMemo, useState } from "react";

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
};

type HeaderKey = keyof ImportRow;

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
  { key: "customStatus", label: "其他狀態說明" },
];

const aliases: Record<string, HeaderKey> = {
  水號: "waterNumber",
  水号: "waterNumber",
  用戶水號: "waterNumber",
  用户水号: "waterNumber",
  waternumber: "waterNumber",
  waterno: "waterNumber",
  姓名: "customerName",
  用戶姓名: "customerName",
  用户姓名: "customerName",
  customername: "customerName",
  name: "customerName",
  電話: "phone",
  电话: "phone",
  用戶電話: "phone",
  用户电话: "phone",
  phone: "phone",
  地址: "address",
  住址: "address",
  address: "address",
  座標: "coordinates",
  坐标: "coordinates",
  經緯度: "coordinates",
  经纬度: "coordinates",
  coordinates: "coordinates",
  表號: "meterNumber",
  表号: "meterNumber",
  水表號碼: "meterNumber",
  meter: "meterNumber",
  meternumber: "meterNumber",
  案件原因: "reason",
  原因: "reason",
  reason: "reason",
  收件日期: "receivedDate",
  日期: "receivedDate",
  receiveddate: "receivedDate",
  案件狀態: "status",
  案件状态: "status",
  狀態: "status",
  状态: "status",
  status: "status",
  其他狀態說明: "customStatus",
  其他状态说明: "customStatus",
  customstatus: "customStatus",
};

const styles = `
  .import-shell{min-height:100vh;width:min(980px,100%);margin:0 auto;padding:28px 22px 80px;color:#17253d}
  .import-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}
  .import-top h1{margin:4px 0 0;font-size:clamp(1.7rem,5vw,2.35rem)}
  .import-top p{margin:0;color:#1263df;font-size:.72rem;font-weight:800;letter-spacing:.14em}
  .import-user{color:#65738a;font-size:.82rem}
  .import-card{padding:22px;border:1px solid #dde4ec;border-radius:22px;background:#fff;box-shadow:0 10px 35px rgba(17,36,65,.06)}
  .import-card+.import-card{margin-top:16px}
  .import-card h2{margin:0 0 8px;font-size:1.1rem}
  .import-card>p{margin:0 0 18px;color:#65738a;line-height:1.65}
  .import-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
  .import-field{display:flex;flex-direction:column;gap:7px;color:#40506a;font-size:.82rem;font-weight:800}
  .import-field.wide{grid-column:1/-1}
  .import-field input,.import-field select,.import-field textarea{width:100%;border:1px solid #cfd8e4;border-radius:12px;background:#fff;color:#17253d;font:inherit;font-weight:400;outline:0}
  .import-field input,.import-field select{min-height:46px;padding:0 12px}
  .import-field textarea{min-height:210px;padding:12px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.78rem;line-height:1.55}
  .import-field input:focus,.import-field select:focus,.import-field textarea:focus{border-color:#1263df;box-shadow:0 0 0 3px rgba(18,99,223,.1)}
  .file-box{padding:17px;border:1px dashed #99b5d9;border-radius:15px;background:#f7faff}
  .file-box input{height:auto;padding:8px;background:transparent}
  .actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px}
  .primary,.secondary{min-height:46px;padding:0 18px;border-radius:12px;font-weight:800;cursor:pointer}
  .primary{border:0;background:#1263df;color:#fff;box-shadow:0 8px 22px rgba(18,99,223,.22)}
  .secondary{border:1px solid #b9c8da;background:#fff;color:#26466f}
  .primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}
  .notice{margin-top:16px;padding:13px 15px;border-radius:12px;line-height:1.55}
  .notice.error{border:1px solid #efb4b8;background:#fff2f3;color:#a62d35}
  .notice.success{border:1px solid #a9ddc1;background:#effaf4;color:#1f7249}
  .notice ul{margin:8px 0 0;padding-left:20px}
  .preview{overflow-x:auto;margin-top:16px;border:1px solid #dde4ec;border-radius:14px}
  table{width:100%;border-collapse:collapse;min-width:760px;font-size:.76rem}
  th,td{padding:10px;border-bottom:1px solid #edf1f5;text-align:left;vertical-align:top;white-space:nowrap}
  th{background:#f5f8fc;color:#506078}
  td{max-width:240px;overflow:hidden;text-overflow:ellipsis}
  .count{display:inline-flex;margin-top:12px;padding:6px 10px;border-radius:999px;background:#eaf2fd;color:#245da9;font-size:.78rem;font-weight:800}
  .back-link{display:inline-flex;margin-top:18px;color:#1263df;font-weight:800;text-decoration:none}
  .tips{margin:14px 0 0;padding-left:19px;color:#65738a;line-height:1.7;font-size:.83rem}
  @media(max-width:650px){.import-grid{grid-template-columns:1fr}.import-field.wide{grid-column:auto}.import-top{align-items:flex-start;flex-direction:column}.actions>*{flex:1}.import-card{padding:17px}}
`;

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-()（）]/g, "");
}

function parseDelimited(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0)
    ? "\t"
    : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseImportRows(text: string) {
  const matrix = parseDelimited(text.trim());
  if (!matrix.length) return { rows: [] as ImportRow[], error: "請選擇 CSV 或貼上資料" };

  const mappedHeaders = matrix[0].map((label) => aliases[normalizeHeader(label)] || null);
  if (!mappedHeaders.includes("waterNumber")) {
    return { rows: [] as ImportRow[], error: "第一列必須包含「水號」欄位" };
  }

  const rows = matrix.slice(1).map((values) => {
    const item: ImportRow = {
      waterNumber: "",
      customerName: "",
      phone: "",
      address: "",
      coordinates: "",
      meterNumber: "",
      reason: "",
      receivedDate: "",
      status: "",
      customStatus: "",
    };
    mappedHeaders.forEach((key, index) => {
      if (key) item[key] = String(values[index] || "").trim();
    });
    return item;
  });

  return { rows, error: "" };
}

function downloadTemplate() {
  const csv = `\uFEFF${headers.map((item) => item.label).join(",")}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "稽查案件批次匯入範例.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export default function ImportApp({ userName }: { userName: string }) {
  const [text, setText] = useState("");
  const [defaultStatus, setDefaultStatus] = useState("處理中");
  const [defaultReason, setDefaultReason] = useState("");
  const [defaultReceivedDate, setDefaultReceivedDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const parsed = useMemo(() => parseImportRows(text), [text]);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    setErrors([]);
    setSuccess(false);
    setText(await file.text());
  }

  async function importRows() {
    setMessage("");
    setErrors([]);
    setSuccess(false);
    if (parsed.error) {
      setMessage(parsed.error);
      return;
    }
    if (!parsed.rows.length) {
      setMessage("沒有可匯入的案件");
      return;
    }
    if (!window.confirm(`確定匯入 ${parsed.rows.length} 件案件嗎？`)) return;

    setBusy(true);
    try {
      const response = await fetch("/api/cases/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: parsed.rows,
          defaultStatus,
          defaultReason,
          defaultReceivedDate,
        }),
      });
      const result = (await readJson(response)) as {
        imported?: number;
        error?: string;
        errors?: string[];
      };
      if (!response.ok) {
        setMessage(result.error || "批次匯入失敗");
        setErrors(result.errors || []);
        return;
      }
      setSuccess(true);
      setMessage(`已成功匯入 ${result.imported || parsed.rows.length} 件案件`);
      setText("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批次匯入失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="import-shell">
      <style>{styles}</style>
      <header className="import-top">
        <div>
          <p>PRIVATE CASE IMPORT</p>
          <h1>批次匯入稽查案件</h1>
        </div>
        <span className="import-user">{userName}</span>
      </header>

      <section className="import-card">
        <h2>1. 準備 CSV</h2>
        <p>可從 Excel、Google 試算表或手機檔案選取 CSV，也能直接貼上逗號或 Tab 分隔的資料。</p>
        <div className="actions">
          <button type="button" className="secondary" onClick={downloadTemplate}>
            下載空白範例 CSV
          </button>
        </div>
        <ul className="tips">
          <li>「水號」為必填欄位，水號中的橫線與空白會自動移除。</li>
          <li>收件日期可輸入民國格式 115/07/23，或西元格式 2026-07-23。</li>
          <li>未填案件狀態時，會使用下方設定的預設狀態。</li>
        </ul>
      </section>

      <section className="import-card">
        <h2>2. 選擇檔案或貼上資料</h2>
        <div className="import-grid">
          <label className="import-field wide file-box">
            選擇 CSV 檔案
            <input type="file" accept=".csv,text/csv,text/plain" onChange={chooseFile} />
          </label>
          <label className="import-field wide">
            CSV／試算表資料
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setMessage("");
                setErrors([]);
                setSuccess(false);
              }}
              placeholder="水號,姓名,電話,地址,座標,表號,案件原因,收件日期,案件狀態,其他狀態說明"
            />
          </label>
          <label className="import-field">
            未填狀態時預設為
            <select value={defaultStatus} onChange={(event) => setDefaultStatus(event.target.value)}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="import-field">
            未填收件日期時套用
            <input
              value={defaultReceivedDate}
              onChange={(event) => setDefaultReceivedDate(event.target.value)}
              placeholder="例如 115/07/23，可留白"
            />
          </label>
          <label className="import-field wide">
            未填案件原因時套用
            <input
              value={defaultReason}
              onChange={(event) => setDefaultReason(event.target.value)}
              placeholder="可留白"
            />
          </label>
        </div>

        {text && !parsed.error && <span className="count">辨識到 {parsed.rows.length} 件案件</span>}
        {text && parsed.error && <div className="notice error">{parsed.error}</div>}

        {parsed.rows.length > 0 && (
          <div className="preview">
            <table>
              <thead>
                <tr>
                  {headers.slice(0, 8).map((item) => (
                    <th key={item.key}>{item.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 5).map((row, index) => (
                  <tr key={`${row.waterNumber}-${index}`}>
                    {headers.slice(0, 8).map((item) => (
                      <td key={item.key}>{row[item.key] || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message && (
          <div className={`notice ${success ? "success" : "error"}`}>
            {message}
            {errors.length > 0 && (
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={() => void importRows()}
            disabled={busy || !parsed.rows.length}
          >
            {busy ? "正在匯入…" : `匯入 ${parsed.rows.length || 0} 件案件`}
          </button>
          <a className="back-link" href="/">
            返回案件清單
          </a>
        </div>
      </section>
    </main>
  );
}
