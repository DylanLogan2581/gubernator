import { formatNationOfficeType } from "@/features/nations";
import type { NationOfficeType } from "@/shared/government";

// citizen_directory_view.office_types (#1081) is a comma-separated,
// alphabetical list of raw office_type enum values for citizens holding more
// than one nation office at once — format each for display.
export function formatOfficeTypesLabel(officeTypes: string): string {
  return officeTypes
    .split(",")
    .map((type) => formatNationOfficeType(type.trim() as NationOfficeType))
    .join(", ");
}
