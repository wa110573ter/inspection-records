import { requireChatGPTUser } from "../../chatgpt-auth";
import SimplePinMap from "./simple-pin-map";

export const dynamic = "force-dynamic";

export default async function TodayRoutePage() {
  await requireChatGPTUser("/routes/today");
  return <SimplePinMap />;
}
