import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { getBucket, getDb } from "../../../../../../db";
import { attachments, caseRecords, cases } from "../../../../../../db/schema";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function findOwnedRecord(caseId: string, recordId: string, ownerEmail: string) {
  const db = getDb();
  return db
    .select({ id: caseRecords.id })
    .from(caseRecords)
    .where(
      and(
        eq(caseRecords.id, recordId),
        eq(caseRecords.caseId, caseId),
        eq(caseRecords.ownerEmail, ownerEmail),
      ),
    )
    .limit(1);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; recordId: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  const { id, recordId } = await context.params;
  const ownedRecord = await findOwnedRecord(id, recordId, user.email);
  if (!ownedRecord.length) {
    return Response.json({ error: "找不到處理紀錄" }, { status: 404 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const date = clean(payload.date);
  const method = clean(payload.method);
  if (!date || !method) {
    return Response.json({ error: "請填寫日期與處理方式" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = getDb();
  const result = await db
    .update(caseRecords)
    .set({
      date,
      method,
      pointer: clean(payload.pointer),
      process: clean(payload.process),
      result: clean(payload.result),
      nextStep: clean(payload.nextStep),
      followUpDate: clean(payload.followUpDate),
    })
    .where(
      and(
        eq(caseRecords.id, recordId),
        eq(caseRecords.caseId, id),
        eq(caseRecords.ownerEmail, user.email),
      ),
    )
    .returning();
  await db
    .update(cases)
    .set({ updatedAt: now })
    .where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email)));

  return Response.json({ record: result[0] });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; recordId: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  const { id, recordId } = await context.params;
  const ownedRecord = await findOwnedRecord(id, recordId, user.email);
  if (!ownedRecord.length) {
    return Response.json({ error: "找不到處理紀錄" }, { status: 404 });
  }

  const db = getDb();
  const files = await db
    .select({ objectKey: attachments.objectKey })
    .from(attachments)
    .where(
      and(
        eq(attachments.recordId, recordId),
        eq(attachments.caseId, id),
        eq(attachments.ownerEmail, user.email),
      ),
    );
  const bucket = getBucket();
  await Promise.all(files.map((file) => bucket.delete(file.objectKey)));

  const now = new Date().toISOString();
  await db.batch([
    db
      .delete(attachments)
      .where(
        and(
          eq(attachments.recordId, recordId),
          eq(attachments.caseId, id),
          eq(attachments.ownerEmail, user.email),
        ),
      ),
    db
      .delete(caseRecords)
      .where(
        and(
          eq(caseRecords.id, recordId),
          eq(caseRecords.caseId, id),
          eq(caseRecords.ownerEmail, user.email),
        ),
      ),
    db
      .update(cases)
      .set({ updatedAt: now })
      .where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email))),
  ]);

  return Response.json({ deleted: true });
}
