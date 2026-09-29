import { requireChatGPTUser } from "../chatgpt-auth";
import ArrearsClient from "./arrears-client";

export const dynamic = "force-dynamic";

export default async function ArrearsPage() {
  const user = await requireChatGPTUser("/arrears");
  return <ArrearsClient userName={user.displayName} />;
}
