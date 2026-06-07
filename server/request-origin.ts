export function requestOrigin(request: Request) {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (host) {
    const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.)/.test(host);
    return `${forwardedProto || (local ? "http" : "https")}://${host}`;
  }
  return new URL(request.url).origin;
}
