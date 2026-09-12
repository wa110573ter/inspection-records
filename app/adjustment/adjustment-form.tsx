"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type CaseType = "misread" | "leak";
type FormState = Record<string, string>;

type ComparisonRow = {
  label: string;
  oldName: string;
  newName: string;
  unit: string;
};

const comparisonRows: ComparisonRow[] = [
  { label: "用水量", oldName: "oldUsage", newName: "newUsage", unit: "度" },
  { label: "水費", oldName: "oldWaterFee", newName: "newWaterFee", unit: "元" },
  { label: "營業稅", oldName: "oldTax", newName: "newTax", unit: "元" },
  { label: "清潔處理費", oldName: "oldCleaningFee", newName: "newCleaningFee", unit: "元" },
  { label: "保育費", oldName: "oldConservationFee", newName: "newConservationFee", unit: "元" },
];

const initialState: FormState = {
  caseType: "misread",
  raw31: "",
  reportNo: "",
  customerName: "",
  workArea: "",
  waterNumber: "",
  meterNumber: "",
  address: "",
  phone: "",
  caseReason: "抄表員誤抄",
  inspectionDate: localDate(),
  diameter: "",
  waterType: "",
  period1: "",
  pointer1: "",
  usage1: "",
  period2: "",
  pointer2: "",
  usage2: "",
  period3: "",
  pointer3: "",
  usage3: "",
  process: "",
  result: "",
  currentPeriod: "",
  correctedPointer: "",
  oldUsage: "",
  newUsage: "",
  oldWaterFee: "",
  newWaterFee: "",
  oldTax: "",
  newTax: "",
  oldCleaningFee: "",
  newCleaningFee: "",
  oldConservationFee: "",
  newConservationFee: "",
  abnormalCleaningFee: "",
  normalCleaningFee1: "",
  normalCleaningFee2: "",
  paymentMethod: "改單後通知用戶繳費",
};

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeWaterNumber(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function normalize31Text(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim();
    if (value) return value;
  }
  return "";
}

function parseRecentPeriods(text: string) {
  const rows: Array<{ period: string; pointer: string; usage: string }> = [];
  const rowPattern = /^\s*(\d{5,6})\s+(\d+)\s+(\d+)(?:\s+.*)?$/gm;
  for (const match of text.matchAll(rowPattern)) {
    rows.push({ period: match[1], pointer: match[2], usage: match[3] });
    if (rows.length === 3) break;
  }
  return rows;
}

function number(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function diff(oldValue: string, newValue: string) {
  return number(oldValue) - number(newValue);
}

function changeLabel(oldValue: string, newValue: string, unit: string) {
  const oldAmount = number(oldValue);
  const newAmount = number(newValue);
  const difference = newAmount - oldAmount;
  if (difference === 0) return `無差異`;
  return difference > 0
    ? `增 ${Math.abs(difference)} ${unit}`
    : `減 ${Math.abs(difference)} ${unit}`;
}

async function readApiError(response: Response) {
  const body = (await response.text()).trim();
  if (!body) {
    if (response.status === 401) return "登入已失效，請重新登入後再試。";
    return `產生 ODS 失敗（HTTP ${response.status}）。伺服器沒有回傳錯誤內容，請重新整理後再試。`;
  }

  try {
    const data = JSON.parse(body) as { error?: unknown; message?: unknown };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    if (typeof data.message === "string" && data.message.trim()) return data.message;
  } catch {
    // Non-JSON responses can happen when the runtime itself fails before the API handler returns.
  }

  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return plain.slice(0, 500) || `產生 ODS 失敗（HTTP ${response.status}）`;
}

function Field({
  label,
  name,
  value,
  onChange,
  required,
  inputMode,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="field">
      <span>{label}{required ? " *" : ""}</span>
      <input
        name={name}
        value={value}
        required={required}
        inputMode={inputMode}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(name, event.target.value)}
      />
    </label>
  );
}

export default function AdjustmentForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const caseType = form.caseType as CaseType;

  const totals = useMemo(() => {
    const oldTotal = number(form.oldWaterFee) + number(form.oldTax) + number(form.oldCleaningFee) + number(form.oldConservationFee);
    const newTotal = number(form.newWaterFee) + number(form.newTax) + number(form.newCleaningFee) + number(form.newConservationFee);
    const normalAverage = Math.round((number(form.normalCleaningFee1) + number(form.normalCleaningFee2)) / 2);
    return {
      oldTotal,
      newTotal,
      difference: oldTotal - newTotal,
      normalAverage,
      leakReduction: number(form.abnormalCleaningFee) - normalAverage,
    };
  }, [form]);

  const settlementLabel = totals.difference > 0
    ? "應退／減收"
    : totals.difference < 0
      ? "應補收"
      : "無差額";
  const settlementAmount = Math.abs(totals.difference);

  const update = (name: string, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const parse31 = () => {
    const text = normalize31Text(form.raw31);
    const periods = parseRecentPeriods(text);
    const waterNumber = normalizeWaterNumber(firstMatch(text, [
      /^\s*水\s*號\s*[：:]?\s*(?:\n\s*)?([0-9A-Z-]+)/mi,
      /^\s*用戶水號\s*[：:]?\s*(?:\n\s*)?([0-9A-Z-]+)/mi,
    ]));
    const customerName = firstMatch(text, [
      /用戶姓名\s*[：:]?\s*([^\t\n]+?)(?=\s*(?:用戶電話|電話|加退污水費)\s*[：:]|$)/i,
      /^\s*(?:戶名|姓名)\s*[：:]?\s*(?:\n\s*)?([^\t\n]+)/mi,
    ]);
    const phone = firstMatch(text, [
      /用戶電話\s*[：:]?\s*([0-9()#extEXT\-\s]+)/i,
      /(?:行動電話|手機|電話)\s*[：:]?\s*([0-9()#extEXT\-\s]+)/i,
    ]).replace(/\s+/g, "");
    const address = firstMatch(text, [
      /^\s*(?:用水地址|住址|地址)\s*[：:]?\s*(?:\n\s*)?([^\t\n]+)/mi,
    ]);
    const meterNumber = firstMatch(text, [
      /^\s*(?:水表號碼|水表編號|表號)\s*[：:]?\s*(?:\n\s*)?([0-9A-Z-]+)/mi,
    ]);
    const workArea = firstMatch(text, [
      /^\s*(?:工作區|抄表工作區)\s*[：:]?\s*(?:\n\s*)?([0-9A-Z-]+)/mi,
    ]);
    const diameter = firstMatch(text, [
      /口\s*徑\s*[：:]?\s*(?:\n\s*)?([0-9.]+)/i,
      /管線口徑\s*[：:]?\s*(?:\n\s*)?([0-9.]+)/i,
    ]).replace(/[^0-9.]/g, "");
    const waterType = firstMatch(text, [
      /^\s*用水種別\s*[：:]?\s*(?:\n\s*)?([^\t\n ]+)/mi,
      /^\s*種別\s*[：:]?\s*(?:\n\s*)?([^\t\n ]+)/mi,
    ]);

    setForm((current) => ({
      ...current,
      waterNumber: waterNumber || current.waterNumber,
      customerName: customerName || current.customerName,
      address: address || current.address,
      phone: phone || current.phone,
      meterNumber: meterNumber || current.meterNumber,
      workArea: workArea || current.workArea,
      diameter: diameter || current.diameter,
      waterType: waterType || current.waterType,
      period1: periods[0]?.period || current.period1,
      pointer1: periods[0]?.pointer || current.pointer1,
      usage1: periods[0]?.usage || current.usage1,
      period2: periods[1]?.period || current.period2,
      pointer2: periods[1]?.pointer || current.pointer2,
      usage2: periods[1]?.usage || current.usage2,
      period3: periods[2]?.period || current.period3,
      pointer3: periods[2]?.pointer || current.pointer3,
      usage3: periods[2]?.usage || current.usage3,
    }));
    setMessage(periods.length >= 3
      ? "已帶入基本資料與最近三期資料，請再核對欄位。"
      : "已帶入可辨識的基本資料，但最近三期資料不足，請再核對。"
    );
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/adjustment-ods", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("ODS 產生失敗：伺服器回傳空白檔案。");
      const disposition = response.headers.get("content-disposition") || "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const filename = encoded ? decodeURIComponent(encoded) : "改單報告.ods";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(`已產生 ${filename}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "產生 ODS 失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="adjustment-page">
      <style>{styles}</style>
      <header>
        <div>
          <p className="eyebrow">虎尾所稽查工具</p>
          <h1>改單 ODS 產生器</h1>
          <p>貼一次31畫面，補上台水網站試算結果後，直接下載正式版面 ODS。</p>
        </div>
        <Link href="/" className="back">返回案件追蹤</Link>
      </header>

      <form onSubmit={submit}>
        <section className="panel">
          <h2>1. 選擇格式與匯入31畫面</h2>
          <div className="type-switch">
            <button type="button" className={caseType === "misread" ? "active" : ""} onClick={() => setForm((current) => ({ ...current, caseType: "misread", caseReason: "抄表員誤抄" }))}>抄表員誤抄</button>
            <button type="button" className={caseType === "leak" ? "active" : ""} onClick={() => setForm((current) => ({ ...current, caseType: "leak", caseReason: "內線漏水減免清潔處理費" }))}>減免清潔處理費</button>
          </div>
          <label className="field full">
            <span>31畫面全文</span>
            <textarea value={form.raw31} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update("raw31", event.target.value)} placeholder="在31畫面按 Ctrl+A、Ctrl+C，再貼到這裡。" />
          </label>
          <button type="button" className="secondary" onClick={parse31}>自動擷取並帶入</button>
        </section>

        <section className="panel">
          <h2>2. 基本資料</h2>
          <div className="grid">
            <Field label="查報編號" name="reportNo" value={form.reportNo} onChange={update} required />
            <Field label="水號" name="waterNumber" value={form.waterNumber} onChange={(name, value) => update(name, normalizeWaterNumber(value))} required />
            <Field label="用戶姓名" name="customerName" value={form.customerName} onChange={update} required />
            <Field label="工作區" name="workArea" value={form.workArea} onChange={update} />
            <Field label="水表號碼" name="meterNumber" value={form.meterNumber} onChange={update} />
            <Field label="電話" name="phone" value={form.phone} onChange={update} />
            <Field label="用水地址" name="address" value={form.address} onChange={update} required />
            <Field label="口徑" name="diameter" value={form.diameter} onChange={update} inputMode="numeric" />
            <Field label="種別／表況" name="waterType" value={form.waterType} onChange={update} />
            <Field label="案件原因" name="caseReason" value={form.caseReason} onChange={update} />
            <label className="field"><span>稽查日期 *</span><input type="date" value={form.inspectionDate} required onChange={(event: ChangeEvent<HTMLInputElement>) => update("inspectionDate", event.target.value)} /></label>
          </div>
        </section>

        <section className="panel">
          <h2>3. 最近三期資料</h2>
          <div className="period-table">
            <strong>期別</strong><strong>指針</strong><strong>用水量</strong>
            {[1, 2, 3].map((row) => (
              <div className="period-row" key={row}>
                <input value={form[`period${row}`]} onChange={(event: ChangeEvent<HTMLInputElement>) => update(`period${row}`, event.target.value)} />
                <input inputMode="numeric" value={form[`pointer${row}`]} onChange={(event: ChangeEvent<HTMLInputElement>) => update(`pointer${row}`, event.target.value)} />
                <input inputMode="numeric" value={form[`usage${row}`]} onChange={(event: ChangeEvent<HTMLInputElement>) => update(`usage${row}`, event.target.value)} />
              </div>
            ))}
          </div>
        </section>

        {caseType === "misread" ? (
          <section className="panel comparison-panel">
            <div className="section-heading">
              <div>
                <h2>4. 台水試算結果—抄表員誤抄</h2>
                <p>左邊輸入原帳單，右邊輸入改單後金額；同一費目固定在同一列，方便直接核對。</p>
              </div>
            </div>

            <div className="key-grid">
              <Field label="改單期別" name="currentPeriod" value={form.currentPeriod} onChange={update} required />
              <Field label="修正後指針" name="correctedPointer" value={form.correctedPointer} onChange={update} inputMode="numeric" />
            </div>

            <div className="comparison-table" role="group" aria-label="原帳單與改單後水費比較">
              <div className="compare-head">
                <span>項目</span>
                <strong className="old-heading">原帳單</strong>
                <strong className="new-heading">改單後</strong>
                <span className="diff-heading">差異</span>
              </div>

              {comparisonRows.map((row) => (
                <div className="compare-row" key={row.oldName}>
                  <span className="compare-label">{row.label}</span>
                  <div className="compare-input old-input">
                    <input
                      aria-label={`原${row.label}`}
                      inputMode="numeric"
                      required
                      value={form[row.oldName]}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => update(row.oldName, event.target.value)}
                    />
                    <small>{row.unit}</small>
                  </div>
                  <div className="compare-input new-input">
                    <input
                      aria-label={`改單後${row.label}`}
                      inputMode="numeric"
                      required
                      value={form[row.newName]}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => update(row.newName, event.target.value)}
                    />
                    <small>{row.unit}</small>
                  </div>
                  <span className="compare-diff">{changeLabel(form[row.oldName], form[row.newName], row.unit)}</span>
                </div>
              ))}

              <div className="compare-total-row">
                <strong>合計</strong>
                <span className="total-value old-total">{totals.oldTotal} 元</span>
                <span className="total-value new-total">{totals.newTotal} 元</span>
                <span className="compare-diff total-diff">{changeLabel(String(totals.oldTotal), String(totals.newTotal), "元")}</span>
              </div>
            </div>

            <div className="settlement-card">
              <span>本次改單結果</span>
              <strong>{settlementLabel} {settlementAmount} 元</strong>
              <small>用水量差：{Math.abs(diff(form.oldUsage, form.newUsage))} 度</small>
            </div>
          </section>
        ) : (
          <section className="panel">
            <h2>4. 清潔處理費減免計算</h2>
            <div className="grid">
              <Field label="異常期清潔處理費" name="abnormalCleaningFee" value={form.abnormalCleaningFee} onChange={update} inputMode="numeric" required />
              <Field label="正常第1期清潔處理費" name="normalCleaningFee1" value={form.normalCleaningFee1} onChange={update} inputMode="numeric" required />
              <Field label="正常第2期清潔處理費" name="normalCleaningFee2" value={form.normalCleaningFee2} onChange={update} inputMode="numeric" required />
            </div>
            <div className="summary"><span>正常平均：<b>{totals.normalAverage}</b> 元</span><span>可減免：<b>{totals.leakReduction}</b> 元</span></div>
          </section>
        )}

        <section className="panel">
          <h2>5. 查報文字</h2>
          <label className="field full"><span>複查經過</span><textarea value={form.process} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update("process", event.target.value)} placeholder="可留白，系統會先產生基本文字。" /></label>
          <label className="field full"><span>處理結果及擬辦</span><textarea value={form.result} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update("result", event.target.value)} placeholder="可留白，系統會依數字產生基本文字。" /></label>
          <Field label="處理方式" name="paymentMethod" value={form.paymentMethod} onChange={update} />
        </section>

        <div className="submit-bar">
          <div>{message || "產生前會檢查查報編號、水號、姓名與地址不得空白。"}</div>
          <button disabled={busy}>{busy ? "產生中…" : "產生正式 ODS"}</button>
        </div>
      </form>
    </main>
  );
}

const styles = `
  *{box-sizing:border-box}.adjustment-page{min-height:100vh;background:#f3f7fb;color:#17253d;padding:26px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.adjustment-page>header{max-width:1080px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.eyebrow{margin:0 0 5px;color:#1263df;font-weight:900}.adjustment-page h1{margin:0;font-size:2rem}.adjustment-page header p:last-child{color:#65738a}.back{display:inline-flex;min-height:44px;align-items:center;padding:0 16px;border:1px solid #bdcad9;border-radius:12px;background:white;color:#1263df;text-decoration:none;font-weight:800}.adjustment-page form{max-width:1080px;margin:auto;display:grid;gap:16px}.panel{background:white;border:1px solid #dce5ef;border-radius:18px;padding:20px;box-shadow:0 8px 24px rgba(23,52,93,.06)}.panel h2{margin:0 0 16px;font-size:1.08rem}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.field{display:grid;gap:7px}.field span{font-size:.78rem;font-weight:850;color:#40506a}.field input,.field textarea,.period-row input{width:100%;border:1px solid #b9c8da;border-radius:10px;background:#fff;padding:11px 12px;font:inherit;color:#17253d}.field textarea{min-height:115px;resize:vertical}.field.full{grid-column:1/-1}.type-switch{display:flex;gap:8px;margin-bottom:14px}.type-switch button,.secondary{min-height:42px;border:1px solid #b9c8da;border-radius:10px;background:#fff;padding:0 14px;font-weight:850;color:#26466f;cursor:pointer}.type-switch button.active{background:#1263df;border-color:#1263df;color:white}.secondary{margin-top:10px}.period-table{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.period-table>strong{font-size:.78rem;color:#65738a}.period-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.summary{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;padding:13px;border-radius:12px;background:#f3f7fd}.summary span{font-size:.84rem}.summary b{font-size:1rem;color:#1263df}.section-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.section-heading h2{margin-bottom:5px}.section-heading p{margin:0 0 16px;color:#65738a;font-size:.88rem;line-height:1.55}.key-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:16px}.comparison-table{overflow:hidden;border:1px solid #cedae8;border-radius:14px;background:#fff}.compare-head,.compare-row,.compare-total-row{display:grid;grid-template-columns:140px minmax(0,1fr) minmax(0,1fr) 112px;gap:10px;align-items:center}.compare-head{padding:10px 12px;background:#edf3fa;color:#52647d;font-size:.78rem}.compare-head strong{text-align:center}.old-heading{color:#5f6b7c}.new-heading{color:#1263df}.diff-heading{text-align:right}.compare-row{padding:10px 12px;border-top:1px solid #e4ebf3}.compare-label{font-size:.86rem;font-weight:900;color:#293b55}.compare-input{position:relative}.compare-input input{width:100%;min-height:46px;border:1px solid #b9c8da;border-radius:10px;padding:10px 38px 10px 11px;font:inherit;font-size:1rem;color:#17253d;text-align:right}.compare-input small{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:#7a899c;font-size:.72rem;pointer-events:none}.old-input input{background:#f8fafc}.new-input input{background:#f2f7ff;border-color:#88b5ee;font-weight:850}.new-input input:focus{outline:3px solid rgba(18,99,223,.14);border-color:#1263df}.compare-diff{text-align:right;color:#52647d;font-size:.78rem;font-weight:800}.compare-total-row{padding:12px;background:#f7faff;border-top:1px solid #dce6f1}.total-value{text-align:right;border-radius:9px;padding:10px 12px;font-weight:900}.old-total{background:#eef1f5}.new-total{background:#e7f1ff;color:#0d59c9}.total-diff{font-size:.82rem}.settlement-card{margin-top:14px;padding:14px 16px;border-radius:14px;background:#123968;color:white;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}.settlement-card span{font-size:.8rem;font-weight:800;opacity:.78}.settlement-card strong{font-size:1.22rem}.settlement-card small{text-align:right;opacity:.82}.submit-bar{position:sticky;bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;border:1px solid #b8c9de;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 12px 30px rgba(18,42,76,.15);font-size:.8rem;color:#56657a}.submit-bar button{min-height:48px;border:0;border-radius:12px;background:#1263df;color:white;padding:0 22px;font-weight:900;font-size:1rem;cursor:pointer}.submit-bar button:disabled{opacity:.65}@media(max-width:760px){.adjustment-page{padding:15px}.adjustment-page>header{flex-direction:column}.grid{grid-template-columns:1fr 1fr}.compare-head,.compare-row,.compare-total-row{grid-template-columns:92px minmax(0,1fr) minmax(0,1fr) 84px;gap:7px}.compare-head,.compare-row{padding-left:9px;padding-right:9px}.settlement-card{grid-template-columns:1fr auto}.settlement-card small{grid-column:1/-1;text-align:left}.submit-bar{align-items:stretch;flex-direction:column}.submit-bar button{width:100%}}@media(max-width:560px){.comparison-panel{padding:14px}.key-grid{grid-template-columns:1fr 1fr}.compare-head,.compare-row,.compare-total-row{grid-template-columns:76px minmax(0,1fr) minmax(0,1fr)}.diff-heading{display:none}.compare-diff{grid-column:2/4;text-align:right;margin-top:-3px;font-size:.72rem}.compare-row{row-gap:5px}.compare-input input{padding:10px 31px 10px 8px}.compare-input small{right:8px}.total-diff{grid-column:2/4}.settlement-card{grid-template-columns:1fr}.settlement-card small{text-align:left}.settlement-card strong{font-size:1.12rem}}@media(max-width:500px){.grid{grid-template-columns:1fr}.period-table{grid-template-columns:repeat(3,minmax(0,1fr))}.panel{padding:16px}.key-grid{grid-template-columns:1fr 1fr}}
`;