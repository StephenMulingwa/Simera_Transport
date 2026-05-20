import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/jwt";
import type { SessionPayload } from "@/lib/auth/types";

const PUBLIC = ["/login", "/favicon.ico"];
const AUTH_API = ["/api/auth/login", "/api/auth/bootstrap"];

/** Cookie or `Authorization: Bearer` — fixes immediate post-login API calls before
 *  the browser has committed `Set-Cookie` (common on HTTPS / strict clients). */
async function sessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const cookieTok = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieTok) {
    const s = await verifySessionToken(cookieTok);
    if (s) return s;
  }
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) {
      const s = await verifySessionToken(t);
      if (s) return s;
    }
  }
  return null;
}

function isPublicPath(pathname: string) {
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  if (pathname.startsWith("/login")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }
  if (AUTH_API.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  const session = await sessionFromRequest(request);

  if (!session) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/api/admin") && session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image).*)",
  ],
};
