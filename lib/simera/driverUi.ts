/** Client-safe labels / ids for driver monitoring filters */

export type DriverCardId =
  | "overspeeding"
  | "harsh_braking"
  | "harsh_cornering"
  | "harsh_acceleration"
  | "overrevving"
  | "eco_roll"
  | "idling"
  | "offline";

export const CARD_LABELS: Record<DriverCardId, string> = {
  overspeeding: "Overspeeding",
  harsh_braking: "Harsh Braking",
  harsh_cornering: "Harsh Cornering",
  harsh_acceleration: "Harsh Acceleration",
  overrevving: "Overrevving",
  eco_roll: "Eco-Roll",
  idling: "Idling",
  offline: "Offline",
};
