import type { Tables } from "@/types/database";

export type AppUser = Tables<"users">;

export type SignInWithPasswordInput = {
  readonly email: string;
  readonly password: string;
};

export type AuthErrorDetails = {
  readonly code?: string;
  readonly message: string;
  readonly status?: number;
};
