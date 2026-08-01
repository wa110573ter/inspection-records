import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE_STATUSES,
  coerceCaseStatus,
  normalizeCaseStatus,
  recommendCaseUpdate,
} from "../app/case-status.js";

test("only three current statuses are exposed", () => {
  assert.deepEqual(CASE_STATUSES, ["待處理", "處理中", "已結案"]);
});

test("pending and closed cases cannot keep a processing progress", () => {
  assert.deepEqual(normalizeCaseStatus("待處理", "待複查"), {
    status: "待處理",
    customStatus: "",
    migrated: false,
  });
  assert.deepEqual(normalizeCaseStatus("已結案", "等待用戶回覆"), {
    status: "已結案",
    customStatus: "",
    migrated: false,
  });
});

test("processing cases preserve their selected progress", () => {
  assert.deepEqual(normalizeCaseStatus("處理中", "等待用戶修繕"), {
    status: "處理中",
    customStatus: "等待用戶修繕",
    migrated: false,
  });
});

test("known legacy statuses migrate to processing with a useful progress", () => {
  assert.deepEqual(normalizeCaseStatus("待現勘", ""), {
    status: "處理中",
    customStatus: "待現場勘查",
    migrated: true,
  });
  assert.deepEqual(normalizeCaseStatus("待用戶回覆", "等待用戶提供照片"), {
    status: "處理中",
    customStatus: "等待用戶提供照片",
    migrated: true,
  });
});

test("unknown write statuses are rejected instead of silently stored", () => {
  assert.equal(normalizeCaseStatus("隨便輸入的狀態", ""), null);
});

test("unexpected stored values are still displayed safely", () => {
  assert.deepEqual(coerceCaseStatus("舊系統自訂狀態", ""), {
    status: "處理中",
    customStatus: "舊系統自訂狀態",
    migrated: true,
  });
});

test("a clear close result without future work recommends closing", () => {
  assert.deepEqual(
    recommendCaseUpdate({ result: "確認抄表無誤", nextStep: "", followUpDate: "" }),
    { status: "已結案", customStatus: "" },
  );
});

test("completed inspection and refund options can close when no work remains", () => {
  assert.deepEqual(
    recommendCaseUpdate({ result: "已完成複查", nextStep: "", followUpDate: "" }),
    { status: "已結案", customStatus: "" },
  );
  assert.deepEqual(
    recommendCaseUpdate({ result: "已完成退費或下期扣抵", nextStep: "", followUpDate: "" }),
    { status: "已結案", customStatus: "" },
  );
});

test("a follow-up date prevents an automatic close recommendation", () => {
  assert.deepEqual(
    recommendCaseUpdate({
      result: "已完成處理",
      nextStep: "無，案件可結案",
      followUpDate: "2026-08-05",
    }),
    { status: "處理中", customStatus: "持續處理中" },
  );
});

test("an actionable next step prevents an automatic close recommendation", () => {
  assert.deepEqual(
    recommendCaseUpdate({
      result: "已向用戶說明並取得諒解",
      nextStep: "安排現場複查",
      followUpDate: "",
    }),
    { status: "處理中", customStatus: "待複查" },
  );
});

test("contact failures recommend processing with contact-failure progress", () => {
  assert.deepEqual(
    recommendCaseUpdate({ contactResult: "未接", result: "", nextStep: "再次電話聯繫" }),
    { status: "處理中", customStatus: "聯絡未果" },
  );
});

test("transfer next steps map to the related-unit progress", () => {
  assert.deepEqual(
    recommendCaseUpdate({ result: "", nextStep: "轉請相關單位處理" }),
    { status: "處理中", customStatus: "已轉相關單位" },
  );
});

test("empty form values do not produce a misleading recommendation", () => {
  assert.equal(recommendCaseUpdate({}), null);
});
