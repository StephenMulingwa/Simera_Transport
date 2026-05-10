import { apiError, wialonCall } from "./client";
import { getWialonReportConfig } from "./config";
import { withWialonSession } from "./report";
import { extractRegistration } from "@/lib/simera/parsers";

export type UnitPosition = {
  id: number;
  name: string;
  registration: string;
  lat: number;
  lon: number;
  speedKmh: number | null;
};

function num(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Last known positions for units in the configured unit group.
 *  Strategy:
 *   1. Read the unit group itself (flags=1 = sys_base, includes the `u` field
 *      with member unit IDs).
 *   2. Search all accessible avl_unit (flags=1025 = sys_base + last_message)
 *      so we get name + last position.
 *   3. Keep only units whose id is in the group's member list.
 *  This avoids the brittle `rel_group_search` propType that was returning
 *  zero items in some accounts.
 */
export async function fetchUnitPositions(): Promise<UnitPosition[]> {
  const { unitGroupId } = getWialonReportConfig();

  return withWialonSession(async (sid) => {
    // 1) group membership
    const grp = await wialonCall<{
      items?: Record<string, unknown>[];
    }>(
      "core/search_items",
      {
        spec: {
          itemsType: "avl_unit_group",
          propName: "sys_id",
          propValueMask: String(unitGroupId),
          sortType: "sys_name",
        },
        force: 1,
        flags: 1,
        from: 0,
        to: 1,
      },
      sid,
    );
    if (apiError(grp)) {
      throw new Error(`search_items(group): ${JSON.stringify(grp)}`);
    }
    const groupItem = (grp.items ?? [])[0] as
      | Record<string, unknown>
      | undefined;
    const memberIds = new Set<number>();
    if (groupItem) {
      const u = groupItem.u;
      if (Array.isArray(u)) {
        for (const v of u) {
          const n = num(v);
          if (n != null) memberIds.add(n);
        }
      }
    }

    // 2) all accessible units with last-message position
    const res = await wialonCall<{
      items?: Record<string, unknown>[];
    }>(
      "core/search_items",
      {
        spec: {
          itemsType: "avl_unit",
          propName: "sys_name",
          propValueMask: "*",
          sortType: "sys_name",
        },
        force: 1,
        flags: 1025,
        from: 0,
        to: 10000,
      },
      sid,
    );

    if (apiError(res)) {
      throw new Error(`search_items(units): ${JSON.stringify(res)}`);
    }

    const items = res.items ?? [];
    const out: UnitPosition[] = [];

    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const id = num(item.id);
      const nm = item.nm != null ? String(item.nm) : "";
      if (id == null || !nm) continue;
      // 3) restrict to group members (if we got the group); otherwise keep all
      if (memberIds.size > 0 && !memberIds.has(id)) continue;

      const pos = item.pos as Record<string, unknown> | undefined;
      const y = pos ? num(pos.y) : null;
      const x = pos ? num(pos.x) : null;
      if (y == null || x == null) continue;

      const spd = pos?.s != null ? num(pos.s) : null;

      out.push({
        id,
        name: nm,
        registration: extractRegistration(nm) || nm,
        lat: y,
        lon: x,
        speedKmh: spd,
      });
    }

    return out;
  });
}
