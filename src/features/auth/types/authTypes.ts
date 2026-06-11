import type { Tables } from "@/types/database";

export type AppUser = Tables<"users">;

export type AdminPickerUser = {
  readonly id: string;
  readonly username: string;
};

export type SignInWithPasswordInput = {
  readonly email: string;
  readonly password: string;
};

export type AuthErrorDetails = {
  readonly code?: string;
  readonly message: string;
  readonly status?: number;
};
