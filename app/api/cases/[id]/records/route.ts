import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getDb } from "../../../../../db";
import { caseRecords, cases } from "../../../../../db/schema";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
  const { id } = await context.params;
  const payload = (await request.json()) as Record<string, unknown>;
  const date = clean(payload.date);
  const method = clean(payload.method);
  if (!date || !method) {
    return Response.json({ error: "請填寫日期與處理方式" }, { status: 400 });
  }

  const db = getDb();
  const ownedCase = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email)))
    .limit(1);
  if (!ownedCase.length) {
    return Response.json({ error: "找不到案件" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    caseId: id,
    ownerEmail: user.email,
    date,
    method,
    pointer: clean(payload.pointer),
    process: clean(payload.process),
    result: clean(payload.result),
    nextStep: clean(payload.nextStep),
    followUpDate: clean(payload.followUpDate),
    createdAt: now,
  };

  // Keep the record write independent from the case timestamp update. Some
  // hosted D1-compatible environments do not reliably support batch writes.
  await db.insert(caseRecords).values(record);
  try {
    await db
      .update(cases)
      .set({ updatedAt: now })
      .where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email)));
  } catch (updateError) {
    console.error("處理紀錄已儲存，但案件更新時間寫入失敗", updateError);
  }

  return Response.json({ record: { ...record, attachments: [] } }, { status: 201 });
}
