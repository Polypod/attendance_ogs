import { proxyMemberSync } from "../_shared";

export async function GET() {
  return proxyMemberSync("/status", "GET");
}
