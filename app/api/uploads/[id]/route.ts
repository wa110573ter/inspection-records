import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getBucket, getDb } from "../../../../db";
import { attachments, cases } from "../../../../db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return new Response("請先登入", { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const bucket = getBucket();
  const rows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.ownerEmail, user.email)))
    .limit(1);
  if (!rows.length) return new Response("找不到檔案", { status: 404 });

  const file = await bucket.get(rows[0].objectKey);
  if (!file) return new Response("找不到檔案", { status: 404 });

  return new Response(file.body, {
    headers: {
      "content-type": rows[0].contentType,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(rows[0].filename)}`,
      "cache-control": "private, max-age=300",
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  const { id } = await context.params;
  const db = getDb();
  const rows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.ownerEmail, user.email)))
    .limit(1);
  if (!rows.length) {
    return Response.json({ error: "找不到檔案" }, { status: 404 });
  }

  const file = rows[0];
  const bucket = getBucket();
  await bucket.delete(file.objectKey);
  await db.batch([
    db
      .delete(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.ownerEmail, user.email))),
    db
      .update(cases)
      .set({ updatedAt: new Date().toISOString() })
      .where(and(eq(cases.id, file.caseId), eq(cases.ownerEmail, user.email))),
  ]);

  return Response.json({ deleted: true });
}
