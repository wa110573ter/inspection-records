import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getBucket, getDb } from "../../../db";
import { attachments, caseRecords, cases } from "../../../db/schema";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const allowedCategories = new Set(["system31", "gis", "record"]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  const form = await request.formData();
  const caseId = String(form.get("caseId") || "");
  const recordId = String(form.get("recordId") || "");
  const category = String(form.get("category") || "");
  const file = form.get("file");

  if (!(file instanceof File) || !caseId || !allowedCategories.has(category)) {
    return Response.json({ error: "上傳資料不完整" }, { status: 400 });
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return Response.json({ error: "只接受照片或影片" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "單一檔案請勿超過 100 MB" }, { status: 400 });
  }
  const db = getDb();
  const bucket = getBucket();
  const ownedCase = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.ownerEmail, user.email)))
    .limit(1);
  if (!ownedCase.length) {
    return Response.json({ error: "找不到案件" }, { status: 404 });
  }
  if (recordId) {
    const ownedRecord = await db
      .select({ id: caseRecords.id })
      .from(caseRecords)
      .where(
        and(
          eq(caseRecords.id, recordId),
          eq(caseRecords.caseId, caseId),
          eq(caseRecords.ownerEmail, user.email),
        ),
      )
      .limit(1);
    if (!ownedRecord.length) {
      return Response.json({ error: "找不到處理紀錄" }, { status: 404 });
    }
  }

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-100);
  const objectKey = `${user.email}/${caseId}/${id}-${safeName || "upload"}`;
  await bucket.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const attachment = {
    id,
    caseId,
    recordId: recordId || null,
    ownerEmail: user.email,
    category,
    objectKey,
    filename: file.name || "現場檔案",
    contentType: file.type,
    size: file.size,
    createdAt: new Date().toISOString(),
  };
  await db.insert(attachments).values(attachment);
  return Response.json(
    { attachment: { ...attachment, url: `/api/uploads/${id}` } },
    { status: 201 },
  );
}
