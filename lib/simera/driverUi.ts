/** Client-safe labels / ids for driver monitoring filters */

export type DriverCardId =
  | "overspeeding"
  | "harsh_braking"
  | "harsh_cornering"
  | "harsh_acceleration"
  | "overrevving"
  | "idling"
  | "offline";

export const CARD_LABELS: Record<DriverCardId, string> = {
  overspeeding: "Overspeeding",
  harsh_braking: "Harsh Braking",
  harsh_cornering: "Harsh Cornering",
  harsh_acceleration: "Harsh Acceleration",
  overrevving: "Overrevving",
  idling: "Idling",
  offline: "Offline",
};
