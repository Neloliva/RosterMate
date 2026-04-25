import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

// Guards the manager dashboard. Matcher excludes the staff portal, marketing
// pages, static assets, and /login itself. Middleware runs on the Edge so it
// can only check cookie presence — the authoritative DB session validation
// lives in server actions and page components.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/|api|login|staff|about|history|DevHelp|projectplan|how-it-works|favicon.ico|manifest.json|sw.js|screenshots|robots.txt).*)",
  ],
};

export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}
