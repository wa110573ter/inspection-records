import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("field workbench uses persistent checkbox selection and pin-only map", async () => {
  const [home, workbench, routePage, upload] = await Promise.all([
    read("app/page.tsx"),
    read("app/simple-workbench.tsx"),
    read("app/routes/today/page.tsx"),
    read("app/api/uploads/route.ts"),
  ]);

  assert.match(home, /SimpleWorkbench/);
  assert.doesNotMatch(home, /href="\/routes\/today"/);
  assert.match(workbench, /inspection-simple-selected-v1/);
  assert.match(workbench, /看圖釘/);
  assert.match(workbench, /返回繼續選/);
  assert.match(workbench, /只有圖釘，不排行程、不改案件狀態/);
  assert.match(workbench, /導航到這一戶/);
  assert.match(workbench, /waterNumber/);
  assert.match(workbench, /customerName/);
  assert.match(workbench, /phone/);
  assert.match(workbench, /meterNumber/);
  assert.match(workbench, /reason/);
  assert.match(routePage, /redirect\("\/"\)/);
  assert.match(upload, /100 \* 1024 \* 1024/);
});

test("legacy route migration stays additive", async () => {
  const migration = await read("drizzle/0001_add_daily_routes.sql");
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|ALTER TABLE .* DROP/i);
});
