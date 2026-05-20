import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { userIsNonDeletableSuperAdmin } from "@/lib/auth/superAdmin";
import { deleteUser, findUserById, setUserActive } from "@/lib/db/users";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (id === session.sub) {
    return NextResponse.json({ error: "Cannot modify own account here" }, { status: 400 });
  }
  try {
    const json = await req.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success || parsed.data.active === undefined) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const target = await findUserById(id);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (parsed.data.active === false && userIsNonDeletableSuperAdmin(target)) {
      return NextResponse.json(
        { error: "This Super Admin account cannot be deactivated" },
        { status: 400 },
      );
    }
    await setUserActive(id, parsed.data.active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (id === session.sub) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }
  try {
    const target = await findUserById(id);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (userIsNonDeletableSuperAdmin(target)) {
      return NextResponse.json(
        { error: "This Super Admin account cannot be deleted" },
        { status: 400 },
      );
    }
    const { deleted } = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "This account cannot be deleted" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
