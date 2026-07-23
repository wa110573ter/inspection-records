import { requireChatGPTUser } from "./chatgpt-auth";
import InspectionApp from "./inspection-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return (
    <>
      <InspectionApp userName={user.displayName} />
      <a
        href="/import"
        style={{
          position: "fixed",
          left: 20,
          bottom: 26,
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
        }}
      >
        批次匯入
      </a>
    </>
  );
}
