import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for better-auth session token in cookies
  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  const isHomePage = pathname === "/";
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtectedPage = pathname.startsWith("/ask");

  // 1. If user is authenticated and visits home (/) or login/signup -> redirect to /ask
  if ((isHomePage || isAuthPage) && sessionToken) {
    return NextResponse.redirect(new URL("/ask", request.url));
  }

  // 2. If user is unauthenticated and tries to access /ask -> redirect to home with ?auth=signin query param
  if (isProtectedPage && !sessionToken) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("auth", "signin");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/ask/:path*", "/ask", "/login", "/signup"],
};
