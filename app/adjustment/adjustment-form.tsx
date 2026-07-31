"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type CaseType = "misread" | "leak";
type FormState = Record<string, string>;

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

function extract(text: string, labels: string[], maxLength = 80) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(?:${escaped.join("|")})\\s*[：:]?\\s*(?:\\r?\\n\\s*)?([^\\r\\n]{1,${maxLength}})`, "i");
  return text.match(pattern)?.[1]?.trim() || "";
}

function number(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function diff(oldValue: string, newValue: string) {
  return number(oldValue) - number(newValue);
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
    const text = form.raw31;
    const waterNumber = normalizeWaterNumber(extract(text, ["水號", "用戶水號"], 40));
    setForm((current) => ({
      ...current,
      waterNumber: waterNumber || current.waterNumber,
      customerName: extract(text, ["用戶姓名", "戶名", "姓名"]) || current.customerName,
      address: extract(text, ["用水地址", "地址"], 120) || current.address,
      phone: extract(text, ["行動電話", "手機", "電話"], 40) || current.phone,
      meterNumber: extract(text, ["水表號碼", "水表編號", "表號"], 40) || current.meterNumber,
      workArea: extract(text, ["工作區", "抄表工作區"], 20) || current.workArea,
      diameter: extract(text, ["管線口徑", "口徑"], 20).replace(/[^0-9.]/g, "") || current.diameter,
      waterType: extract(text, ["用水種別", "種別"], 60) || current.waterType,
    }));
    setMessage("已從31畫面嘗試帶入資料，請再核對欄位。");
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
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "產生 ODS 失敗");
      }
      const blob = await response.blob();
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
          <section className="panel">
            <h2>4. 台水試算結果—抄表員誤抄</h2>
            <div className="grid">
              <Field label="改單期別" name="currentPeriod" value={form.currentPeriod} onChange={update} required />
              <Field label="修正後指針" name="correctedPointer" value={form.correctedPointer} onChange={update} inputMode="numeric" />
              <Field label="原用水量" name="oldUsage" value={form.oldUsage} onChange={update} inputMode="numeric" required />
              <Field label="修正後用水量" name="newUsage" value={form.newUsage} onChange={update} inputMode="numeric" required />
              <Field label="原水費" name="oldWaterFee" value={form.oldWaterFee} onChange={update} inputMode="numeric" required />
              <Field label="修正後水費" name="newWaterFee" value={form.newWaterFee} onChange={update} inputMode="numeric" required />
              <Field label="原營業稅" name="oldTax" value={form.oldTax} onChange={update} inputMode="numeric" required />
              <Field label="修正後營業稅" name="newTax" value={form.newTax} onChange={update} inputMode="numeric" required />
              <Field label="原清潔處理費" name="oldCleaningFee" value={form.oldCleaningFee} onChange={update} inputMode="numeric" required />
              <Field label="修正後清潔處理費" name="newCleaningFee" value={form.newCleaningFee} onChange={update} inputMode="numeric" required />
              <Field label="原保育費" name="oldConservationFee" value={form.oldConservationFee} onChange={update} inputMode="numeric" required />
              <Field label="修正後保育費" name="newConservationFee" value={form.newConservationFee} onChange={update} inputMode="numeric" required />
            </div>
            <div className="summary"><span>用水差額：<b>{diff(form.oldUsage, form.newUsage)}</b> 度</span><span>原總額：<b>{totals.oldTotal}</b> 元</span><span>修正後：<b>{totals.newTotal}</b> 元</span><span>{settlementLabel}：<b>{settlementAmount}</b> 元</span></div>
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
  *{box-sizing:border-box}.adjustment-page{min-height:100vh;background:#f3f7fb;color:#17253d;padding:26px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.adjustment-page>header{max-width:1080px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.eyebrow{margin:0 0 5px;color:#1263df;font-weight:900}.adjustment-page h1{margin:0;font-size:2rem}.adjustment-page header p:last-child{color:#65738a}.back{display:inline-flex;min-height:44px;align-items:center;padding:0 16px;border:1px solid #bdcad9;border-radius:12px;background:white;color:#1263df;text-decoration:none;font-weight:800}.adjustment-page form{max-width:1080px;margin:auto;display:grid;gap:16px}.panel{background:white;border:1px solid #dce5ef;border-radius:18px;padding:20px;box-shadow:0 8px 24px rgba(23,52,93,.06)}.panel h2{margin:0 0 16px;font-size:1.08rem}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.field{display:grid;gap:7px}.field span{font-size:.78rem;font-weight:850;color:#40506a}.field input,.field textarea,.period-row input{width:100%;border:1px solid #b9c8da;border-radius:10px;background:#fff;padding:11px 12px;font:inherit;color:#17253d}.field textarea{min-height:115px;resize:vertical}.field.full{grid-column:1/-1}.type-switch{display:flex;gap:8px;margin-bottom:14px}.type-switch button,.secondary{min-height:42px;border:1px solid #b9c8da;border-radius:10px;background:#fff;padding:0 14px;font-weight:850;color:#26466f;cursor:pointer}.type-switch button.active{background:#1263df;border-color:#1263df;color:white}.secondary{margin-top:10px}.period-table{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.period-table>strong{font-size:.78rem;color:#65738a}.period-row{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.summary{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px;padding:13px;border-radius:12px;background:#f3f7fd}.summary span{font-size:.84rem}.summary b{font-size:1rem;color:#1263df}.submit-bar{position:sticky;bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;border:1px solid #b8c9de;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 12px 30px rgba(18,42,76,.15);font-size:.8rem;color:#56657a}.submit-bar button{min-height:48px;border:0;border-radius:12px;background:#1263df;color:white;padding:0 22px;font-weight:900;font-size:1rem;cursor:pointer}.submit-bar button:disabled{opacity:.65}@media(max-width:760px){.adjustment-page{padding:15px}.adjustment-page>header{flex-direction:column}.grid{grid-template-columns:1fr 1fr}.submit-bar{align-items:stretch;flex-direction:column}.submit-bar button{width:100%}}@media(max-width:500px){.grid{grid-template-columns:1fr}.period-table{grid-template-columns:repeat(3,minmax(0,1fr))}.panel{padding:16px}}
`;
