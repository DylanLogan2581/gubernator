import { describe, expect, it } from "vitest";

import {
  getReadinessVoters,
  getSuccessionCandidates,
  type CitizenSuccessionInfo,
  type OfficeHolder,
} from "@/shared/government";

const RULER_ID = "ruler-1";

const OFFICE_HOLDERS: readonly OfficeHolder[] = [
  { officeType: "senator", citizenId: "senator-1" },
  { officeType: "senator", citizenId: "senator-2" },
  { officeType: "clergy", citizenId: "clergy-1" },
  { officeType: "elder", citizenId: "elder-1" },
  { officeType: "elder", citizenId: "elder-2" },
];

const SETTLEMENT_MANAGER_IDS = ["manager-1", "manager-2"];

const CITIZENS: readonly CitizenSuccessionInfo[] = [
  {
    citizenId: "child-1",
    status: "alive",
    parentACitizenId: RULER_ID,
    parentBCitizenId: null,
    bornOnTurnNumber: 10,
  },
  {
    citizenId: "child-2",
    status: "alive",
    parentACitizenId: null,
    parentBCitizenId: RULER_ID,
    bornOnTurnNumber: 20,
  },
  {
    citizenId: "dead-child",
    status: "dead",
    parentACitizenId: RULER_ID,
    parentBCitizenId: null,
    bornOnTurnNumber: 5,
  },
  {
    citizenId: "unrelated",
    status: "alive",
    parentACitizenId: null,
    parentBCitizenId: null,
    bornOnTurnNumber: 1,
  },
];

describe("getReadinessVoters", () => {
  it("monarchy: ruler only", () => {
    expect(
      getReadinessVoters({
        governmentType: "monarchy",
        rulerCitizenId: RULER_ID,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual([RULER_ID]);
  });

  it("despotism: ruler only", () => {
    expect(
      getReadinessVoters({
        governmentType: "despotism",
        rulerCitizenId: RULER_ID,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual([RULER_ID]);
  });

  it("theocracy: ruler only", () => {
    expect(
      getReadinessVoters({
        governmentType: "theocracy",
        rulerCitizenId: RULER_ID,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual([RULER_ID]);
  });

  it("republic: all senators (majority applied by caller)", () => {
    expect(
      getReadinessVoters({
        governmentType: "republic",
        rulerCitizenId: null,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual(["senator-1", "senator-2"]);
  });

  it("tribal_council: all elders (unanimous)", () => {
    expect(
      getReadinessVoters({
        governmentType: "tribal_council",
        rulerCitizenId: null,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual(["elder-1", "elder-2"]);
  });

  it("confederation: all settlement managers (unanimous)", () => {
    expect(
      getReadinessVoters({
        governmentType: "confederation",
        rulerCitizenId: null,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual(SETTLEMENT_MANAGER_IDS);
  });

  it("monarchy: no voters when ruler seat is vacant", () => {
    expect(
      getReadinessVoters({
        governmentType: "monarchy",
        rulerCitizenId: null,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual([]);
  });
});

describe("getSuccessionCandidates", () => {
  it("monarchy: living children of the ruler", () => {
    expect(
      getSuccessionCandidates({
        governmentType: "monarchy",
        rulerCitizenId: RULER_ID,
        citizens: CITIZENS,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual(["child-1", "child-2"]);
  });

  it("monarchy: no candidates when ruler seat is vacant", () => {
    expect(
      getSuccessionCandidates({
        governmentType: "monarchy",
        rulerCitizenId: null,
        citizens: CITIZENS,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual([]);
  });

  it("republic: senators are the candidates", () => {
    expect(
      getSuccessionCandidates({
        governmentType: "republic",
        rulerCitizenId: null,
        citizens: CITIZENS,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual(["senator-1", "senator-2"]);
  });

  it("theocracy: clergy are the candidates, ruler office excluded", () => {
    expect(
      getSuccessionCandidates({
        governmentType: "theocracy",
        rulerCitizenId: RULER_ID,
        citizens: CITIZENS,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual(["clergy-1"]);
  });

  it("tribal_council: eldest living citizen first", () => {
    expect(
      getSuccessionCandidates({
        governmentType: "tribal_council",
        rulerCitizenId: null,
        citizens: CITIZENS,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual(["unrelated", "child-1", "child-2"]);
  });

  it("confederation: settlement managers are the candidates", () => {
    expect(
      getSuccessionCandidates({
        governmentType: "confederation",
        rulerCitizenId: null,
        citizens: CITIZENS,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual(SETTLEMENT_MANAGER_IDS);
  });

  it("despotism: no derivable candidates, admin assigns", () => {
    expect(
      getSuccessionCandidates({
        governmentType: "despotism",
        rulerCitizenId: RULER_ID,
        citizens: CITIZENS,
        officeHolders: OFFICE_HOLDERS,
        settlementManagerCitizenIds: SETTLEMENT_MANAGER_IDS,
      }),
    ).toEqual([]);
  });
});
