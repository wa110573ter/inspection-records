import { desc, eq } from "drizzle-orm";
import { coerceCaseStatus, normalizeCaseStatus } from "../../case-status.js";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { attachments, caseRecords, cases } from "../../../db/schema";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function withAttachmentUrl<T extends { id: string }>(file: T) {
  return { ...file, url: `/api/uploads/${file.id}` };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  try {
    const db = getDb();
    const caseRows = await db
      .select()
      .from(cases)
      .where(eq(cases.ownerEmail, user.email))
      .orderBy(desc(cases.updatedAt));
    const recordRows = await db
      .select()
      .from(caseRecords)
      .where(eq(caseRecords.ownerEmail, user.email))
      .orderBy(desc(caseRecords.date), desc(caseRecords.createdAt));
    const fileRows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.ownerEmail, user.email))
      .orderBy(desc(attachments.createdAt));

    const caseFiles = new Map<string, Array<ReturnType<typeof withAttachmentUrl>>>();
    const recordFiles = new Map<string, Array<ReturnType<typeof withAttachmentUrl>>>();
    for (const file of fileRows) {
      const fileWithUrl = withAttachmentUrl(file);
      if (file.recordId) {
        const existing = recordFiles.get(file.recordId) || [];
        existing.push(fileWithUrl);
        recordFiles.set(file.recordId, existing);
      } else {
        const existing = caseFiles.get(file.caseId) || [];
        existing.push(fileWithUrl);
        caseFiles.set(file.caseId, existing);
      }
    }

    const recordsByCase = new Map<string, Array<(typeof recordRows)[number] & { attachments: Array<ReturnType<typeof withAttachmentUrl>> }>>();
    for (const record of recordRows) {
      const existing = recordsByCase.get(record.caseId) || [];
      existing.push({ ...record, attachments: recordFiles.get(record.id) || [] });
      recordsByCase.set(record.caseId, existing);
    }

    return Response.json({
      cases: caseRows.map((item) => {
        const normalized = coerceCaseStatus(item.status, item.customStatus);
        return {
          ...item,
          status: normalized.status,
          customStatus: normalized.customStatus,
          attachments: caseFiles.get(item.id) || [],
          records: recordsByCase.get(item.id) || [],
        };
      }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "案件載入失敗" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const waterNumber = clean(payload.waterNumber).replace(/[\s-]/g, "").toUpperCase();
    if (!waterNumber) {
      return Response.json({ error: "請輸入水號" }, { status: 400 });
    }

    const requestedStatus = clean(payload.status) || "待處理";
    const normalizedStatus = normalizeCaseStatus(requestedStatus, payload.customStatus);
    if (!normalizedStatus) {
      return Response.json({ error: "案件狀態無效" }, { status: 400 });
    }

    const raw31 = clean(payload.raw31);
    const now = new Date().toISOString();
    const newCase = {
      id: crypto.randomUUID(),
      ownerEmail: user.email,
      waterNumber,
      customerName: clean(payload.customerName),
      phone: clean(payload.phone),
      address: clean(payload.address),
      coordinates: clean(payload.coordinates),
      meterNumber: clean(payload.meterNumber),
      reason: clean(payload.reason),
      receivedDate: clean(payload.receivedDate),
      status: normalizedStatus.status,
      customStatus: normalizedStatus.customStatus,
      createdAt: now,
      updatedAt: now,
    };

    const db = getDb();
    const statements = [db.insert(cases).values(newCase)];
    if (raw31) {
      statements.push(
        db.insert(caseRecords).values({
          id: crypto.randomUUID(),
          caseId: newCase.id,
          ownerEmail: user.email,
          date: newCase.receivedDate || localDate(),
          method: "31畫面匯入",
          pointer: "",
          process: `【31畫面完整原始資料】\n${raw31}`,
          result: "已自動擷取重要欄位，完整原文另存保留",
          nextStep: "請核對擷取欄位；後續新增紀錄不會覆蓋本筆原始資料",
          followUpDate: "",
          createdAt: now,
        }),
      );
    }
    await db.batch(statements as [typeof statements[number], ...Array<typeof statements[number]>]);

    return Response.json(
      {
        case: {
          ...newCase,
          attachments: [],
          records: raw31
            ? [{
                id: "pending-refresh",
                date: newCase.receivedDate || localDate(),
                method: "31畫面匯入",
                pointer: "",
                process: `【31畫面完整原始資料】\n${raw31}`,
                result: "已自動擷取重要欄位，完整原文另存保留",
                nextStep: "請核對擷取欄位；後續新增紀錄不會覆蓋本筆原始資料",
                followUpDate: "",
                createdAt: now,
                attachments: [],
              }]
            : [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "案件建立失敗" },
      { status: 500 },
    );
  }
}
