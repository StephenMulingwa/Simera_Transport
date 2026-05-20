import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/db/users";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  try {
    const user = await findUserById(session.sub);
    if (!user || !user.active) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load user profile" },
      { status: 500 },
    );
  }
}
