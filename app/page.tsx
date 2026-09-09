import Link from "next/link";
import { requireChatGPTUser } from "./chatgpt-auth";
import Workbench from "./workbench";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return (
    <>
      <Workbench userName={user.displayName} />
      <Link href="/routes/today" hidden aria-hidden="true" tabIndex={-1}>
        舊版今日路線
      </Link>
    </>
  );
}
