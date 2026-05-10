import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { countUsers, insertUser } from "@/lib/db/users";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).optional(),
});

/** One-time first admin when DB is empty and env bootstrap keys match */
export async function POST(req: Request) {
  try {
    const n = await countUsers();
    if (n > 0) {
      return NextResponse.json(
        { error: "Bootstrap disabled: users already exist" },
        { status: 403 },
      );
    }
    const envEmail = process.env.SIMERA_BOOTSTRAP_EMAIL;
    const envPass = process.env.SIMERA_BOOTSTRAP_PASSWORD;
    if (!envEmail || !envPass) {
      return NextResponse.json(
        {
          error:
            "Set SIMERA_BOOTSTRAP_EMAIL and SIMERA_BOOTSTRAP_PASSWORD in .env",
        },
        { status: 503 },
      );
    }
    const json = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const { email, password, fullName } = parsed.data;
    if (email !== envEmail || password !== envPass) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const hash = await hashPassword(password);
    const id = await insertUser(
      email,
      hash,
      fullName ?? "Administrator",
      "admin",
    );
    const token = await createSessionToken({
      sub: id,
      email,
      name: fullName ?? "Administrator",
      role: "admin",
    });
    await setSessionCookie(token);
    return NextResponse.json({ ok: true, userId: id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
