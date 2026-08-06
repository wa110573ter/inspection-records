import { requireChatGPTUser } from "../../chatgpt-auth";
import TodayRouteClient from "./today-route-client";
import "./route.css";

export const dynamic = "force-dynamic";

export default async function TodayRoutePage() {
  await requireChatGPTUser("/routes/today");
  return <TodayRouteClient />;
}
