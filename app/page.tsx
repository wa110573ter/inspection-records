import { requireChatGPTUser } from "./chatgpt-auth";
import InspectionApp from "./inspection-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <InspectionApp userName={user.displayName} />;
}
