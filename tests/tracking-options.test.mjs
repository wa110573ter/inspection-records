import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("home page only exposes the four case-status filter buttons", async () => {
  const source = await readFile(
    new URL("../app/inspection-app.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /\["全部", \.\.\.statuses\]\.map/);
  assert.doesNotMatch(source, /id="tracking-filter"|追蹤篩選/);
  assert.doesNotMatch(source, /全部追蹤狀態|今日要追蹤|3日內要追蹤/);
});
