import { proxyMemberSync } from "../_shared";

export async function POST() {
  return proxyMemberSync("/preview", "POST");
}
