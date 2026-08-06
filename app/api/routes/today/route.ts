import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { nearestNeighborOrder, parseCoordinate } from "../../../route-utils";
import { getDb } from "../../../../db";
import {
  caseRecords,
  cases,
  dailyRoutes,
  dailyRouteStops,
} from "../../../../db/schema";

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

async function loadRoute(ownerEmail: string, routeDate: string) {
  const db = getDb();
  const routeRows = await db
    .select()
    .from(dailyRoutes)
    .where(and(eq(dailyRoutes.ownerEmail, ownerEmail), eq(dailyRoutes.routeDate, routeDate)))
    .orderBy(desc(dailyRoutes.updatedAt))
    .limit(1);
  const route = routeRows[0];
  if (!route) return null;

  const stops = await db
    .select({
      id: dailyRouteStops.id,
      routeId: dailyRouteStops.routeId,
      caseId: dailyRouteStops.caseId,
      position: dailyRouteStops.position,
      coordinateSnapshot: dailyRouteStops.coordinateSnapshot,
      coordinateSourceSnapshot: dailyRouteStops.coordinateSourceSnapshot,
      status: dailyRouteStops.status,
      arrivedAt: dailyRouteStops.arrivedAt,
      completedAt: dailyRouteStops.completedAt,
      skippedReason: dailyRouteStops.skippedReason,
      customerName: cases.customerName,
      waterNumber: cases.waterNumber,
      phone: cases.phone,
      address: cases.address,
      meterNumber: cases.meterNumber,
      reason: cases.reason,
      receivedDate: cases.receivedDate,
      caseStatus: cases.status,
    })
    .from(dailyRouteStops)
    .innerJoin(cases, eq(dailyRouteStops.caseId, cases.id))
    .where(and(eq(dailyRouteStops.routeId, route.id), eq(dailyRouteStops.ownerEmail, ownerEmail)))
    .orderBy(asc(dailyRouteStops.position));

  const caseIds = stops.map((stop) => stop.caseId);
  const records = caseIds.length
    ? await db
        .select()
        .from(caseRecords)
        .where(and(eq(caseRecords.ownerEmail, ownerEmail), inArray(caseRecords.caseId, caseIds)))
        .orderBy(desc(caseRecords.date), desc(caseRecords.createdAt))
    : [];
  const latestRecord = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (!latestRecord.has(record.caseId)) latestRecord.set(record.caseId, record);
  }

  return {
    ...route,
    stops: stops.map((stop) => ({ ...stop, latestRecord: latestRecord.get(stop.caseId) ?? null })),
  };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
  const routeDate = new URL(request.url).searchParams.get("date") || localDate();
  try {
    return Response.json({ route: await loadRoute(user.email, routeDate), routeDate });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "今日路線載入失敗" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const routeDate = clean(payload.routeDate) || localDate();
    const caseIds = Array.isArray(payload.caseIds)
      ? [...new Set(payload.caseIds.filter((item): item is string => typeof item === "string" && item.trim()))]
      : [];
    if (!caseIds.length) return Response.json({ error: "請至少選擇一件案件" }, { status: 400 });

    const db = getDb();
    const ownedCases = await db
      .select()
      .from(cases)
      .where(and(eq(cases.ownerEmail, user.email), inArray(cases.id, caseIds)));
    if (ownedCases.length !== caseIds.length) {
      return Response.json({ error: "部分案件不存在或不屬於目前帳號" }, { status: 403 });
    }

    const invalid = ownedCases
      .map((item) => ({ item, parsed: parseCoordinate(item.coordinates) }))
      .filter((entry) => !entry.parsed.ok);
    if (invalid.length) {
      return Response.json(
        {
          error: "部分案件缺少可用圖資座標",
          invalidCases: invalid.map(({ item, parsed }) => ({
            id: item.id,
            customerName: item.customerName,
            waterNumber: item.waterNumber,
            reason: parsed.ok ? "" : parsed.error,
          })),
        },
        { status: 400 },
      );
    }

    const startCoordinates = clean(payload.startCoordinates);
    const shouldOptimize = payload.optimize !== false;
    const ordered = shouldOptimize
      ? nearestNeighborOrder(
          ownedCases.map((item) => ({ ...item, coordinates: item.coordinates })),
          startCoordinates || undefined,
        )
      : caseIds.map((id) => ownedCases.find((item) => item.id === id)!).filter(Boolean);

    const now = new Date().toISOString();
    const existing = await db
      .select({ id: dailyRoutes.id })
      .from(dailyRoutes)
      .where(and(eq(dailyRoutes.ownerEmail, user.email), eq(dailyRoutes.routeDate, routeDate)))
      .limit(1);

    let routeId = existing[0]?.id;
    if (routeId) {
      await db.delete(dailyRouteStops).where(and(eq(dailyRouteStops.routeId, routeId), eq(dailyRouteStops.ownerEmail, user.email)));
      await db
        .update(dailyRoutes)
        .set({
          startLabel: clean(payload.startLabel) || "虎尾服務營運所",
          startCoordinates,
          endLabel: clean(payload.endLabel) || "不限",
          endCoordinates: clean(payload.endCoordinates),
          status: "draft",
          currentStopId: "",
          startedAt: "",
          completedAt: "",
          updatedAt: now,
        })
        .where(and(eq(dailyRoutes.id, routeId), eq(dailyRoutes.ownerEmail, user.email)));
    } else {
      routeId = crypto.randomUUID();
      await db.insert(dailyRoutes).values({
        id: routeId,
        ownerEmail: user.email,
        routeDate,
        startLabel: clean(payload.startLabel) || "虎尾服務營運所",
        startCoordinates,
        endLabel: clean(payload.endLabel) || "不限",
        endCoordinates: clean(payload.endCoordinates),
        status: "draft",
        currentStopId: "",
        startedAt: "",
        completedAt: "",
        createdAt: now,
        updatedAt: now,
      });
    }

    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index];
      const parsed = parseCoordinate(item.coordinates);
      if (!parsed.ok) continue;
      await db.insert(dailyRouteStops).values({
        id: crypto.randomUUID(),
        routeId,
        caseId: item.id,
        ownerEmail: user.email,
        position: index + 1,
        coordinateSnapshot: parsed.value.normalized,
        coordinateSourceSnapshot: "company_gis",
        status: index === 0 ? "active" : "pending",
        arrivedAt: "",
        completedAt: "",
        skippedReason: "",
        createdAt: now,
        updatedAt: now,
      });
    }

    const route = await loadRoute(user.email, routeDate);
    const firstStop = route?.stops[0];
    if (route && firstStop) {
      await db
        .update(dailyRoutes)
        .set({ currentStopId: firstStop.id, status: "active", startedAt: now, updatedAt: now })
        .where(and(eq(dailyRoutes.id, route.id), eq(dailyRoutes.ownerEmail, user.email)));
    }

    return Response.json({ route: await loadRoute(user.email, routeDate) }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "今日路線建立失敗" },
      { status: 500 },
    );
  }
}
