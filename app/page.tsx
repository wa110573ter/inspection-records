import { requireChatGPTUser } from "./chatgpt-auth";
import AppleMapsLinks from "./apple-maps-links";
import Case31Import from "./case-31-import";
import CaseDeepLink from "./case-deep-link";
import InspectionApp from "./inspection-app";
import MeterNumberImportFix from "./meter-number-import-fix";
import MobileUploadFix from "./mobile-upload-fix";

export const dynamic = "force-dynamic";

const floatingLink = {
  position: "fixed" as const,
  left: 20,
  zIndex: 30,
  minHeight: 48,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 17px",
  border: "1px solid #b8c9de",
  borderRadius: 15,
  background: "white",
  color: "#1263df",
  boxShadow: "0 8px 22px rgba(17, 36, 65, 0.14)",
  fontWeight: 800,
  textDecoration: "none",
};

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return (
    <>
      <MobileUploadFix />
      <MeterNumberImportFix />
      <Case31Import />
      <CaseDeepLink />
      <AppleMapsLinks />
      {/* 日期、追蹤與下拉流程皆由 InspectionApp 原生管理。 */}
      <InspectionApp userName={user.displayName} />
      <a href="/routes/today" style={{ ...floatingLink, bottom: 206 }}>
        今日路線
      </a>
      <a href="/journal" style={{ ...floatingLink, bottom: 146 }}>
        處理日誌
      </a>
      <a href="/adjustment" style={{ ...floatingLink, bottom: 86 }}>
        改單 ODS
      </a>
      <a href="/import" style={{ ...floatingLink, bottom: 26 }}>
        批次匯入
      </a>
    </>
  );
}
