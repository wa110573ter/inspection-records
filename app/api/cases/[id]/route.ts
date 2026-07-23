import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getBucket, getDb } from "../../../../db";
import { attachments, caseRecords, cases } from "../../../../db/schema";

const allowedStatuses = new Set([
  "待處理",
  "聯絡未果",
  "待現勘",
  "處理中",
  "待用戶回覆",
  "待複查",
  "已結案",
  "其他",
]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  const { id } = await context.params;
  const payload = (await request.json()) as Record<string, unknown>;
  const update: Partial<typeof cases.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if ("waterNumber" in payload) {
    const waterNumber = clean(payload.waterNumber).replace(/[\s-]/g, "").toUpperCase();
    if (!waterNumber) {
      return Response.json({ error: "請輸入水號" }, { status: 400 });
    }
    update.waterNumber = waterNumber;
  }
  if ("customerName" in payload) update.customerName = clean(payload.customerName);
  if ("phone" in payload) update.phone = clean(payload.phone);
  if ("address" in payload) update.address = clean(payload.address);
  if ("coordinates" in payload) update.coordinates = clean(payload.coordinates);
  if ("meterNumber" in payload) update.meterNumber = clean(payload.meterNumber);
  if ("reason" in payload) update.reason = clean(payload.reason);
  if ("receivedDate" in payload) update.receivedDate = clean(payload.receivedDate);
  if ("customStatus" in payload) update.customStatus = clean(payload.customStatus);
  if ("status" in payload) {
    const status = clean(payload.status);
    if (!allowedStatuses.has(status)) {
      return Response.json({ error: "案件狀態無效" }, { status: 400 });
    }
    update.status = status;
  }

  const db = getDb();
  const result = await db
    .update(cases)
    .set(update)
    .where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email)))
    .returning();

  if (!result.length) {
    return Response.json({ error: "找不到案件" }, { status: 404 });
  }
  return Response.json({ case: result[0] });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  const { id } = await context.params;
  const db = getDb();
  const ownedCase = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email)))
    .limit(1);
  if (!ownedCase.length) {
    return Response.json({ error: "找不到案件" }, { status: 404 });
  }

  const files = await db
    .select({ objectKey: attachments.objectKey })
    .from(attachments)
    .where(and(eq(attachments.caseId, id), eq(attachments.ownerEmail, user.email)));
  const bucket = getBucket();
  await Promise.all(files.map((file) => bucket.delete(file.objectKey)));

  await db.batch([
    db
      .delete(attachments)
      .where(and(eq(attachments.caseId, id), eq(attachments.ownerEmail, user.email))),
    db
      .delete(caseRecords)
      .where(and(eq(caseRecords.caseId, id), eq(caseRecords.ownerEmail, user.email))),
    db.delete(cases).where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email))),
  ]);

  return Response.json({ deleted: true });
}
