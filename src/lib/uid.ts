import { v4 as uuidV4 } from "uuid";

export function generateLocalId(): string {
  return uuidV4();
}
