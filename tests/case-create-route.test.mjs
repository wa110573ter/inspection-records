import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(
  new URL("../app/api/cases/route.ts", import.meta.url),
  "utf8",
);

test("case creation does not depend on D1 batch support", () => {
  assert.doesNotMatch(routeSource, /\bdb\.batch\s*\(/);
  assert.match(routeSource, /await db\.insert\(cases\)\.values\(newCase\)/);
});

test("optional 31 text is saved after the core case insert", () => {
  const caseInsert = routeSource.indexOf("await db.insert(cases).values(newCase)");
  const recordInsert = routeSource.indexOf("await db.insert(caseRecords).values");

  assert.ok(caseInsert >= 0, "missing core case insert");
  assert.ok(recordInsert > caseInsert, "31 record insert must happen after case creation");
  assert.match(routeSource, /catch \(recordError\)[\s\S]*案件已成功建立/);
});
