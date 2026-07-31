import { requireChatGPTUser } from "../chatgpt-auth";
import AdjustmentForm from "./adjustment-form";

export const dynamic = "force-dynamic";

export default async function AdjustmentPage() {
  await requireChatGPTUser("/adjustment");
  return <AdjustmentForm />;
}
