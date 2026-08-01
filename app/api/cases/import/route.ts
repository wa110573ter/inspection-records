import { normalizeCaseStatus } from "../../../case-status.js";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { caseRecords, cases } from "../../../../db/schema";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: string) {
  if (!value) return "";
  const match = value.match(/^(\d{2,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (!match) return null;

  let year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1911) year += 1911;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

type ImportRow = Record<string, unknown>;

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  try {
    const payload = (await request.json()) as {
      rows?: ImportRow[];
      defaultStatus?: string;
      defaultReason?: string;
      defaultReceivedDate?: string;
    };
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!rows.length) {
      return Response.json({ error: "沒有可匯入的資料" }, { status: 400 });
    }
    if (rows.length > 500) {
      return Response.json({ error: "一次最多匯入 500 件案件" }, { status: 400 });
    }

    const defaultStatusText = clean(payload.defaultStatus) || "處理中";
    const defaultStatus = normalizeCaseStatus(defaultStatusText, "");
    const defaultReason = clean(payload.defaultReason);
    const defaultDateRaw = clean(payload.defaultReceivedDate);
    const defaultReceivedDate = normalizeDate(defaultDateRaw);

    if (!defaultStatus) {
      return Response.json({ error: "預設案件狀態無效" }, { status: 400 });
    }
    if (defaultDateRaw && !defaultReceivedDate) {
      return Response.json(
        { error: "預設收件日期格式不正確，請使用 115/07/23 或 2026-07-23" },
        { status: 400 },
      );
    }

    const errors: string[] = [];
    const now = new Date().toISOString();
    const values = rows.map((row, index) => {
      const rowNumber = index + 2;
      const waterNumber = clean(row.waterNumber).replace(/[\s-]/g, "").toUpperCase();
      const rowStatusText = clean(row.status);
      const normalizedStatus = normalizeCaseStatus(
        rowStatusText || defaultStatusText,
        clean(row.customStatus) || (rowStatusText ? "" : defaultStatus.customStatus),
      );
      const dateRaw = clean(row.receivedDate);
      const receivedDate = dateRaw ? normalizeDate(dateRaw) : defaultReceivedDate || "";

      if (!waterNumber) errors.push(`第 ${rowNumber} 列：缺少水號`);
      if (!normalizedStatus) {
        errors.push(`第 ${rowNumber} 列：案件狀態「${rowStatusText || defaultStatusText}」不正確`);
      }
      if (dateRaw && !receivedDate) {
        errors.push(`第 ${rowNumber} 列：收件日期「${dateRaw}」格式不正確`);
      }

      return {
        id: crypto.randomUUID(),
        ownerEmail: user.email,
        waterNumber,
        customerName: clean(row.customerName),
        phone: clean(row.phone),
        address: clean(row.address),
        coordinates: clean(row.coordinates),
        meterNumber: clean(row.meterNumber),
        reason: clean(row.reason) || defaultReason,
        receivedDate: receivedDate || "",
        status: normalizedStatus?.status || "處理中",
        customStatus: normalizedStatus?.customStatus || "",
        rawText: clean(row.rawText),
        createdAt: now,
        updatedAt: now,
      };
    });

    if (errors.length) {
      return Response.json(
        {
          error: `匯入資料有 ${errors.length} 個問題，尚未寫入資料庫`,
          errors: errors.slice(0, 30),
        },
        { status: 400 },
      );
    }

    const db = getDb();
    const statements = [];
    for (const value of values) {
      const { rawText, ...caseValue } = value;
      statements.push(db.insert(cases).values(caseValue));
      if (rawText) {
        statements.push(
          db.insert(caseRecords).values({
            id: crypto.randomUUID(),
            caseId: value.id,
            ownerEmail: user.email,
            date: value.receivedDate || localDate(),
            method: "31畫面匯入",
            pointer: "",
            process: `【31畫面完整原始資料】\n${rawText}`,
            result: "已自動擷取重要欄位，完整原文另存保留",
            nextStep: "請核對擷取欄位；後續新增紀錄不會覆蓋本筆原始資料",
            followUpDate: "",
            createdAt: now,
          }),
        );
      }
    }
    await db.batch(statements as Parameters<typeof db.batch>[0]);

    return Response.json({ imported: values.length }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "批次匯入失敗" },
      { status: 500 },
    );
  }
}
