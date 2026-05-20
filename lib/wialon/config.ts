export function getWialonToken(): string {
  const t = process.env.TOKEN ?? process.env.WIALON_TOKEN;
  if (!t) throw new Error("Missing TOKEN in environment");
  return t;
}

export function getWialonReportConfig() {
  const resourceId = Number(
    process.env.WIALON_RESOURCE_ID ?? "25601229",
  );
  const templateId = Number(process.env.WIALON_TEMPLATE_ID ?? "31");
  const unitGroupId = Number(process.env.WIALON_UNIT_GROUP_ID ?? "27901514");
  if (!Number.isFinite(resourceId) || !Number.isFinite(templateId)) {
    throw new Error("Invalid WIALON_RESOURCE_ID / WIALON_TEMPLATE_ID");
  }
  if (!Number.isFinite(unitGroupId)) {
    throw new Error(
      "Invalid WIALON_UNIT_GROUP_ID — must be a numeric unit group / object id from Wialon",
    );
  }
  return { resourceId, templateId, unitGroupId };
}

export const WIALON_BASE = "https://hst-api.wialon.com/wialon/ajax.html";
