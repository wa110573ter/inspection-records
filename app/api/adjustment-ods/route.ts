import { getChatGPTUser } from "../../chatgpt-auth";
import { generateOds } from "../../ods-utils";
import {
  LEAK_TEMPLATE_BASE64,
  MISREAD_TEMPLATE_BASE64,
} from "../../ods-template-data";

type Payload = Record<string, unknown>;

function text(payload: Payload, key: string) {
  return String(payload[key] ?? "").trim();
}

function amount(payload: Payload, key: string) {
  const value = Number(text(payload, key).replaceAll(",", ""));
  return Number.isFinite(value) ? value : 0;
}

function normalizeWaterNumber(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function rocDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[1]) - 1911}年${Number(match[2])}月${Number(match[3])}日`;
}

function safeFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "");
}

function error(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function commonValues(payload: Payload) {
  return {
    REPORT_NO: text(payload, "reportNo"),
    CUSTOMER_NAME: text(payload, "customerName"),
    WORK_AREA: text(payload, "workArea"),
    WATER_NUMBER: normalizeWaterNumber(text(payload, "waterNumber")),
    METER_NUMBER: text(payload, "meterNumber"),
    ADDRESS: text(payload, "address"),
    PHONE: text(payload, "phone"),
    CASE_REASON: text(payload, "caseReason"),
    INSPECTION_DATE: rocDate(text(payload, "inspectionDate")),
    DIAMETER: text(payload, "diameter"),
    WATER_TYPE: text(payload, "waterType"),
    PERIOD_1: text(payload, "period1"),
    POINTER_1: text(payload, "pointer1"),
    USAGE_1: text(payload, "usage1"),
    PERIOD_2: text(payload, "period2"),
    POINTER_2: text(payload, "pointer2"),
    USAGE_2: text(payload, "usage2"),
    PERIOD_3: text(payload, "period3"),
    POINTER_3: text(payload, "pointer3"),
    USAGE_3: text(payload, "usage3"),
  };
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return error("登入已失效，請重新登入。", 401);

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return error("送出的資料格式不正確。");
  }

  const reportNo = text(payload, "reportNo");
  const waterNumber = normalizeWaterNumber(text(payload, "waterNumber"));
  const customerName = text(payload, "customerName");
  const address = text(payload, "address");
  if (!reportNo) return error("查報編號不得空白。");
  if (!waterNumber) return error("水號不得空白。");
  if (!customerName) return error("用戶姓名不得空白。");
  if (!address) return error("用水地址不得空白。");

  const caseType = text(payload, "caseType");
  let template: string;
  let typeLabel: string;
  let values: Record<string, string | number>;

  if (caseType === "misread") {
    const oldUsage = amount(payload, "oldUsage");
    const newUsage = amount(payload, "newUsage");
    const oldWaterFee = amount(payload, "oldWaterFee");
    const newWaterFee = amount(payload, "newWaterFee");
    const oldTax = amount(payload, "oldTax");
    const newTax = amount(payload, "newTax");
    const oldCleaningFee = amount(payload, "oldCleaningFee");
    const newCleaningFee = amount(payload, "newCleaningFee");
    const oldConservationFee = amount(payload, "oldConservationFee");
    const newConservationFee = amount(payload, "newConservationFee");
    const oldTotal = oldWaterFee + oldTax + oldCleaningFee + oldConservationFee;
    const newTotal = newWaterFee + newTax + newCleaningFee + newConservationFee;
    const currentPeriod = text(payload, "currentPeriod").replace(/期$/, "");
    const correctedPointer = text(payload, "correctedPointer");
    const paymentMethod = text(payload, "paymentMethod") || "改單後通知用戶繳費";
    const process = text(payload, "process") ||
      `1複查經過：經稽查核對${currentPeriod}期抄表指數及現場水表，確認原計費用水量應予修正。`;
    const result = text(payload, "result") ||
      `2處理結果及擬辦：${currentPeriod}期用水量由${oldUsage}度更正為${newUsage}度，原應收${oldTotal}元，修正後應收${newTotal}元，差額${oldTotal - newTotal}元，${paymentMethod}。`;

    values = {
      ...commonValues(payload),
      PROCESS: process,
      RESULT: result,
      ACTION_1: `(1)會上下傳，修正${currentPeriod}期指針${correctedPointer ? `為${correctedPointer}度，` : "，"}用水量由${oldUsage}度更正為${newUsage}度`,
      ACTION_2: `(2)${currentPeriod}期水費(改單):`,
      NEW_WATER_FEE_TEXT: `${newWaterFee + newTax}元含${newTax}元營業稅`,
      NEW_CLEANING_FEE: newCleaningFee,
      NEW_CONSERVATION_FEE: newConservationFee,
      CURRENT_PERIOD: `${currentPeriod}期`,
      OLD_USAGE: oldUsage,
      NEW_USAGE: newUsage,
      DIFF_USAGE: `${oldUsage - newUsage}度`,
      OLD_WATER_FEE: oldWaterFee,
      NEW_WATER_FEE: newWaterFee,
      DIFF_WATER_FEE: oldWaterFee - newWaterFee,
      OLD_TAX: oldTax,
      NEW_TAX: newTax,
      DIFF_TAX: oldTax - newTax,
      OLD_CLEANING_FEE: oldCleaningFee,
      NEW_CLEANING_FEE_TABLE: newCleaningFee,
      DIFF_CLEANING_FEE: oldCleaningFee - newCleaningFee,
      OLD_CONSERVATION_FEE: oldConservationFee,
      NEW_CONSERVATION_FEE_TABLE: newConservationFee,
      DIFF_CONSERVATION_FEE: oldConservationFee - newConservationFee,
      OLD_TOTAL: oldTotal,
      NEW_TOTAL: newTotal,
      DIFF_TOTAL: oldTotal - newTotal,
    };
    template = MISREAD_TEMPLATE_BASE64;
    typeLabel = "抄表員誤抄";
  } else if (caseType === "leak") {
    const abnormal = amount(payload, "abnormalCleaningFee");
    const normal1 = amount(payload, "normalCleaningFee1");
    const normal2 = amount(payload, "normalCleaningFee2");
    const average = Math.round((normal1 + normal2) / 2);
    const reduction = abnormal - average;
    const period1 = text(payload, "period1");
    const period2 = text(payload, "period2");
    const period3 = text(payload, "period3");
    const paymentMethod = text(payload, "paymentMethod") || "改單後通知用戶繳費";
    const process = text(payload, "process") ||
      `一、經稽查確認${period1}期用水量徒增係表後內線漏水所致。二、用戶已完成修繕並申請減免清潔處理費。`;
    const result = text(payload, "result") ||
      `2處理結果及擬辦：一、依未漏水二期正常用水減除清潔處理費。二、${period1}期應繳清潔處理費為${abnormal}元；依${period2}及${period3}期平均清潔處理費計算為(${normal1}+${normal2})/2=${average}元；可減免金額為${abnormal}-${average}=${reduction}元。三、${paymentMethod}。請核示！ 敬會上下傳：`;

    values = {
      ...commonValues(payload),
      PROCESS: process,
      RESULT: result,
    };
    template = LEAK_TEMPLATE_BASE64;
    typeLabel = "減免清潔處理費";
  } else {
    return error("不支援的改單格式。");
  }

  const file = await generateOds(template, values);
  const filename = `${safeFilePart(reportNo)}_${typeLabel}_${safeFilePart(waterNumber)}.ods`;
  return new Response(file, {
    headers: {
      "content-type": "application/vnd.oasis.opendocument.spreadsheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
