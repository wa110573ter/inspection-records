import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tracking dropdown excludes the removed legacy status option", async () => {
  const source = await readFile(
    new URL("../app/inspection-app.tsx", import.meta.url),
    "utf8",
  );
  const options = source.match(
    /const trackingOptions = \[([\s\S]*?)\] as const;/,
  )?.[1];

  assert.ok(options, "trackingOptions should remain defined");
  assert.doesNotMatch(options, /未結案|聯絡未果|待現勘|待複查|其他/);
  assert.match(options, /全部追蹤狀態/);
  assert.match(options, /今日要追蹤/);
  assert.match(options, /已結案/);
});
