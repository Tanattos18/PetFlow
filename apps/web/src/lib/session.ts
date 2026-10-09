import { api } from "./api";
import type { MeResponse } from "@petflow/shared";

export type Session = MeResponse;

export async function fetchSession(): Promise<Session | null> {
  try {
    return await api<Session>("/api/auth/me", { redirectOnUnauthorized: false });
  } catch {
    return null;
  }
}
