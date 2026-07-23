import { requireChatGPTUser } from "../chatgpt-auth";
import ImportApp from "./import-app";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireChatGPTUser("/import");
  return <ImportApp userName={user.displayName} />;
}
