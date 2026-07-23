import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { cases } from "../../../../db/schema";

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  const { id } = await context.params;
  const payload = (await request.json()) as { status?: string };
  if (!payload.status || !allowedStatuses.has(payload.status)) {
    return Response.json({ error: "案件狀態無效" }, { status: 400 });
  }

  const db = getDb();
  const result = await db
    .update(cases)
    .set({ status: payload.status, updatedAt: new Date().toISOString() })
    .where(and(eq(cases.id, id), eq(cases.ownerEmail, user.email)))
    .returning();

  if (!result.length) {
    return Response.json({ error: "找不到案件" }, { status: 404 });
  }
  return Response.json({ case: result[0] });
}
