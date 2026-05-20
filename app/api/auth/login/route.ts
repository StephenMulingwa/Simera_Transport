import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import {
  findUserByEmail,
  recordLogin,
} from "@/lib/db/users";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const user = await findUserByEmail(email);
    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }
    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.full_name || user.email,
      role: user.role,
    });
    await setSessionCookie(token);

    const fwd = req.headers.get("x-forwarded-for");
    const ip = fwd?.split(",")[0]?.trim() ?? null;
    const userAgent = req.headers.get("user-agent");
    await recordLogin(user.id, ip, userAgent);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
      },
      /** Same JWT as Set-Cookie — use as Bearer on the next fetch until the cookie commits */
      sessionToken: token,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 },
    );
  }
}
