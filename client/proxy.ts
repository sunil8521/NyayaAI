import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_ROUTES = ["/", "/login", "/signup"];

// Helper to verify session + admin email against the backend
async function isAllowedAdmin(request: NextRequest): Promise<boolean> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.length) return false;

  try {
    const backendUrl = process.env.BACKEND_INTERNAL_URL;
    if (!backendUrl) return false;

    const res = await fetch(`${backendUrl}/api/auth/get-session`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });

    if (!res.ok) return false;

    const data = await res.json();
    const email = data?.user?.email?.toLowerCase();
    return Boolean(email && adminEmails.includes(email));
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  // 1. Redirect logged-in users away from public/auth pages
  if (AUTH_ROUTES.includes(pathname)) {
    return hasSession
      ? NextResponse.redirect(new URL("/ask", request.url))
      : NextResponse.next();
  }

  // 2. Require login for /ask and /internal/ingestion
  if (!hasSession) {
    const redirectUrl = new URL("/", request.url);
    if (pathname.startsWith("/ask")) redirectUrl.searchParams.set("auth", "signin");
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Extra email allowlist check for /internal/ingestion
  if (pathname.startsWith("/internal/ingestion")) {
    const allowed = await isAllowedAdmin(request);
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup", "/ask/:path*", "/ask", "/internal/ingestion/:path*"],
};
