import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload, UserRole } from "./types";

const COOKIE = "simera_session";

function secretKey() {
  const s =
    process.env.APP_SESSION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "Set APP_SESSION_SECRET (min 16 chars) for signed sessions.",
    );
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;
    const email = payload.email;
    const name = payload.name;
    const role = payload.role;
    if (
      typeof email !== "string" ||
      typeof name !== "string" ||
      (role !== "admin" && role !== "observer")
    ) {
      return null;
    }
    return { sub, email, name, role: role as UserRole };
  } catch {
    return null;
  }
}

export { COOKIE as SESSION_COOKIE_NAME };
