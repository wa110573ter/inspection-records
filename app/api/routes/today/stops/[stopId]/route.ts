import { and, asc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { getDb } from "../../../../../../db";
import { dailyRoutes, dailyRouteStops } from "../../../../../../db/schema";

const ALLOWED_STATUS = new Set(["pending", "active", "completed", "skipped"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ stopId: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
  const { stopId } = await context.params;

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const status = clean(payload.status);
    if (!ALLOWED_STATUS.has(status)) {
      return Response.json({ error: "站點狀態無效" }, { status: 400 });
    }

    const db = getDb();
    const owned = await db
      .select()
      .from(dailyRouteStops)
      .where(and(eq(dailyRouteStops.id, stopId), eq(dailyRouteStops.ownerEmail, user.email)))
      .limit(1);
    const stop = owned[0];
    if (!stop) return Response.json({ error: "找不到路線站點" }, { status: 404 });

    const now = new Date().toISOString();
    await db
      .update(dailyRouteStops)
      .set({
        status,
        skippedReason: status === "skipped" ? clean(payload.skippedReason) || "其他" : "",
        arrivedAt: status === "active" ? stop.arrivedAt || now : stop.arrivedAt,
        completedAt: status === "completed" || status === "skipped" ? now : "",
        updatedAt: now,
      })
      .where(and(eq(dailyRouteStops.id, stopId), eq(dailyRouteStops.ownerEmail, user.email)));

    const remaining = await db
      .select()
      .from(dailyRouteStops)
      .where(and(eq(dailyRouteStops.routeId, stop.routeId), eq(dailyRouteStops.ownerEmail, user.email)))
      .orderBy(asc(dailyRouteStops.position));
    const next = remaining.find((item) => item.id !== stopId && (item.status === "pending" || item.status === "active"));

    for (const item of remaining) {
      if (item.id !== next?.id && item.status === "active") {
        await db
          .update(dailyRouteStops)
          .set({ status: "pending", updatedAt: now })
          .where(and(eq(dailyRouteStops.id, item.id), eq(dailyRouteStops.ownerEmail, user.email)));
      }
    }

    if (next) {
      await db
        .update(dailyRouteStops)
        .set({ status: "active", arrivedAt: next.arrivedAt || now, updatedAt: now })
        .where(and(eq(dailyRouteStops.id, next.id), eq(dailyRouteStops.ownerEmail, user.email)));
      await db
        .update(dailyRoutes)
        .set({ currentStopId: next.id, status: "active", updatedAt: now })
        .where(and(eq(dailyRoutes.id, stop.routeId), eq(dailyRoutes.ownerEmail, user.email)));
    } else {
      await db
        .update(dailyRoutes)
        .set({ currentStopId: "", status: "completed", completedAt: now, updatedAt: now })
        .where(and(eq(dailyRoutes.id, stop.routeId), eq(dailyRoutes.ownerEmail, user.email)));
    }

    return Response.json({ ok: true, nextStopId: next?.id ?? null });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "站點更新失敗" },
      { status: 500 },
    );
  }
}
