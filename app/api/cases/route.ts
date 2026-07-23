import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { attachments, caseRecords, cases } from "../../../db/schema";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

    return Response.json({
      cases: caseRows.map((item) => ({
        ...item,
        attachments: fileRows
          .filter((file) => file.caseId === item.id && !file.recordId)
          .map(withAttachmentUrl),
        records: recordRows
          .filter((record) => record.caseId === item.id)
          .map((record) => ({
            ...record,
            attachments: fileRows
              .filter((file) => file.recordId === record.id)
              .map(withAttachmentUrl),
          })),
      })),
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
      status: clean(payload.status) || "待處理",
      customStatus: clean(payload.customStatus),
      createdAt: now,
      updatedAt: now,
    };

    const db = getDb();
    await db.insert(cases).values(newCase);
    return Response.json(
      { case: { ...newCase, attachments: [], records: [] } },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "案件建立失敗" },
      { status: 500 },
    );
  }
}
