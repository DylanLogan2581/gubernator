// #1121: a standalone proclamation for a nation or settlement -- pure
// roleplay/DM reference, zero simulation effects. Exactly one of nationId /
// settlementId is set, matching the DB scope-exclusive check. Distinct from
// a law_amendments row with a "decree" procedure: that always amends a
// law_documents' articles and never writes here.
export type Decree = {
  readonly bodyMarkdown: string;
  readonly createdAt: string;
  readonly id: string;
  readonly issuedByCitizenId: string | null;
  readonly issuedTurnNumber: number;
  readonly nationId: string | null;
  readonly revokedTurnNumber: number | null;
  readonly settlementId: string | null;
  readonly title: string;
  readonly worldId: string;
};
