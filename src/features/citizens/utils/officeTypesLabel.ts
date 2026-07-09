import { formatNationOfficeType } from "@/features/nations";

// citizen_directory_view.office_types (#1081/#1114) is a comma-separated,
// alphabetical list of office_types.name values (raw default names or
// free-text custom names) for citizens holding more than one nation office
// at once — format each for display.
export function formatOfficeTypesLabel(officeTypes: string): string {
  return officeTypes
    .split(",")
    .map((type) => formatNationOfficeType(type.trim()))
    .join(", ");
}
