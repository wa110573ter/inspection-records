import { requireChatGPTUser } from "./chatgpt-auth";
import SimpleWorkbench from "./simple-workbench";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <SimpleWorkbench userName={user.displayName} />;
}
