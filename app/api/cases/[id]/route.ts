import { and, desc, eq } from "drizzle-orm";
import { coerceCaseStatus, normalizeCaseStatus } from "../../../case-status.js";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getBucket, getDb } from "../../../../db";
import { attachments, caseRecords, cases } from "../../../../db/schema";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function withAttachmentUrl<T extends { id: string }>(file: T) {
  return { ...file, url: `/api/uploads/${file.id}` };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  const { id } = await context.params;
  const db = getDb();
  const rows = await db
    .select()
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email)))
    .limit(1);
  if (!rows.length) return Response.json({ error: "找不到案件" }, { status: 404 });

  const recordRows = await db
    .select()
    .from(caseRecords)
    .where(and(eq(caseRecords.caseId, id), eq(caseRecords.ownerEmail, user.email)))
    .orderBy(desc(caseRecords.date), desc(caseRecords.createdAt));
  const fileRows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.caseId, id), eq(attachments.ownerEmail, user.email)))
    .orderBy(desc(attachments.createdAt));

  const caseFiles = fileRows.filter((file) => !file.recordId).map(withAttachmentUrl);
  const recordFiles = new Map<string, Array<ReturnType<typeof withAttachmentUrl>>>();
  for (const file of fileRows) {
    if (!file.recordId) continue;
    const existing = recordFiles.get(file.recordId) || [];
    existing.push(withAttachmentUrl(file));
    recordFiles.set(file.recordId, existing);
  }

  const item = rows[0];
  const normalized = coerceCaseStatus(item.status, item.customStatus);
  return Response.json({
    case: {
      ...item,
      status: normalized.status,
      customStatus: normalized.customStatus,
      attachments: caseFiles,
      records: recordRows.map((record) => ({
        ...record,
        attachments: recordFiles.get(record.id) || [],
      })),
    },
  });
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

  const hasStatus = "status" in payload;
  const hasProgress = "customStatus" in payload;
  if (hasStatus) {
    const normalized = normalizeCaseStatus(
      clean(payload.status),
      hasProgress ? payload.customStatus : "",
    );
    if (!normalized) {
      return Response.json({ error: "案件狀態無效" }, { status: 400 });
    }
    update.status = normalized.status;
    if (hasProgress || normalized.migrated || normalized.status !== "處理中") {
      update.customStatus = normalized.customStatus;
    }
  } else if (hasProgress) {
    const progress = clean(payload.customStatus);
    update.customStatus = progress;
    if (progress) update.status = "處理中";
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
