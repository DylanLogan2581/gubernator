import { useState } from "react";

import type { Citizen } from "../../../types/citizenTypes";

export type CitizenCoreEditState = {
  readonly givenName: string;
  readonly givenNameError: string | undefined;
  readonly isEditing: boolean;
  readonly setGivenName: (value: string) => void;
  readonly setGivenNameError: (value: string | undefined) => void;
  readonly setIsEditing: (value: boolean) => void;
  readonly setSex: (value: string) => void;
  readonly setSurname: (value: string) => void;
  readonly sex: string;
  readonly surname: string;
};

// Owned by an ancestor that outlives the "Edit" tab's mount lifecycle, so a
// typed draft survives switching tabs and back instead of being discarded.
export function useCitizenCoreEditState(
  citizen: Citizen,
): CitizenCoreEditState {
  const [isEditing, setIsEditing] = useState(false);
  const [givenName, setGivenName] = useState(citizen.givenName);
  const [surname, setSurname] = useState(citizen.surname ?? "");
  const [sex, setSex] = useState(citizen.sex ?? "");
  const [givenNameError, setGivenNameError] = useState<string | undefined>(
    undefined,
  );

  return {
    givenName,
    givenNameError,
    isEditing,
    setGivenName,
    setGivenNameError,
    setIsEditing,
    setSex,
    setSurname,
    sex,
    surname,
  };
}
