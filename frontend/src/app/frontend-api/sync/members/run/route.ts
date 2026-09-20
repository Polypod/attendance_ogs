import { proxyMemberSync } from "../_shared";

export async function POST() {
  return proxyMemberSync("/run", "POST");
}
