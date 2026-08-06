import { requireChatGPTUser } from "../../chatgpt-auth";
import TodayRouteClient from "./today-route-client";

export const dynamic = "force-dynamic";

export default async function TodayRoutePage() {
  await requireChatGPTUser("/routes/today");
  return <TodayRouteClient />;
}
