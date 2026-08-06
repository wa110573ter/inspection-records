import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("today route keeps coordinate navigation and ownership checks", async () => {
  const [utils, api, stops, client, schema, migration, home] = await Promise.all([
    read("app/route-utils.ts"),
    read("app/api/routes/today/route.ts"),
    read("app/api/routes/today/stops/[stopId]/route.ts"),
    read("app/routes/today/today-route-client.tsx"),
    read("db/schema.ts"),
    read("drizzle/0001_add_daily_routes.sql"),
    read("app/page.tsx"),
  ]);

  assert.match(utils, /TAIWAN_BOUNDS/);
  assert.match(utils, /nearestNeighborOrder/);
  assert.match(utils, /destination=.*normalized/);
  assert.match(api, /eq\(cases\.ownerEmail, user\.email\)/);
  assert.match(api, /coordinateSnapshot/);
  assert.match(stops, /eq\(dailyRouteStops\.ownerEmail, user\.email\)/);
  assert.match(client, /現場記錄並完成/);
  assert.match(client, /Google Maps導航/);
  assert.match(client, /已切換到下一站/);
  assert.match(schema, /dailyRoutes/);
  assert.match(schema, /dailyRouteStops/);
  assert.match(migration, /CREATE TABLE `daily_routes`/);
  assert.match(migration, /CREATE TABLE `daily_route_stops`/);
  assert.match(home, /href="\/routes\/today"/);
});

test("route migration is additive", async () => {
  const migration = await read("drizzle/0001_add_daily_routes.sql");
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|ALTER TABLE .* DROP/i);
});
