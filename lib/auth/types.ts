export type UserRole = "admin" | "observer";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
};
