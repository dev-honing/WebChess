import { networkInterfaces } from "node:os";
import { noStoreJson } from "@/server/api-utils";
import { isPersistentStoreConfigured } from "@/server/room-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const port = new URL(request.url).port || "3000";
  const origins = process.env.VERCEL
    ? []
    : Object.values(networkInterfaces())
        .flatMap((addresses) => addresses || [])
        .filter((address) => address.family === "IPv4" && !address.internal)
        .map((address) => `http://${address.address}:${port}`);
  return noStoreJson({
    origins,
    persistent: isPersistentStoreConfigured(),
    deployment: Boolean(process.env.VERCEL),
  });
}
