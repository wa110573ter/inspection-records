import { requireChatGPTUser } from "../chatgpt-auth";
import JournalClient from "./journal-client";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const user = await requireChatGPTUser("/journal");
  return <JournalClient userName={user.displayName} />;
}
