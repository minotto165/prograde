import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { configuredPin, isUnlocked } from "$lib/server/unlock";

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_app/") ||
    pathname === "/favicon.svg" ||
    pathname === "/robots.txt"
  );
}

export const handle: Handle = async ({ event, resolve }) => {
  if (!configuredPin()) return resolve(event);

  const path = event.url.pathname;
  if (path === "/unlock" || path === "/unlock/" || isPublicAsset(path)) {
    return resolve(event);
  }
  if (isUnlocked(event.cookies)) return resolve(event);

  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    return new Response("PIN を入力してください", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const next = path + event.url.search;
  throw redirect(303, "/unlock?next=" + encodeURIComponent(next));
};
