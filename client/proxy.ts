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

  // 3. Protect internal ingestion dashboard
  if (pathname.startsWith("/internal/ingestion")) {
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
    const adminEmails = adminEmailsStr.split(",").map((e) => e.trim().toLowerCase());

    return fetch(new URL("/api/auth/get-session", request.url).toString(), {
      headers: { cookie: request.headers.get("cookie") || "" },
    })
      .then((res) => res.json())
      .then((sessionData) => {
        if (!sessionData?.user) {
          console.error("Middleware: No user found in session data", sessionData);
          return NextResponse.redirect(new URL("/?error=no_user", request.url));
        }
        if (!adminEmails.includes(sessionData.user.email.toLowerCase())) {
          console.error(`Middleware: User email ${sessionData.user.email} not in admin list:`, adminEmails);
          return NextResponse.redirect(new URL("/?error=not_admin", request.url));
        }
        return NextResponse.next();
      })
      .catch((err) => {
        console.error("Middleware: Fetch get-session failed:", err);
        return NextResponse.redirect(new URL("/?error=fetch_failed", request.url));
      });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/ask/:path*", "/ask", "/login", "/signup", "/internal/ingestion/:path*"],
};
