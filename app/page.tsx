import { requireChatGPTUser } from "./chatgpt-auth";
import Workbench from "./workbench";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <Workbench userName={user.displayName} />;
}
