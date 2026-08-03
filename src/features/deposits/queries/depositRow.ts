import type {
  DepositType,
  DepositTypeJob,
  WorkerInputEntry,
} from "../types/depositTypes";

export type WorkerInputEntryRow = {
  readonly amount_per_worker: number;
  readonly resource_id: string;
};

export type DepositTypeJobRow = {
  readonly id: string;
  readonly job_id: string;
  readonly output_units_per_worker: number;
  readonly worker_inputs_json: readonly WorkerInputEntryRow[];
};

export type DepositTypeRow = {
  readonly created_at: string;
  readonly deposit_type_jobs: readonly DepositTypeJobRow[];
  readonly icon: string | null;
  readonly icon_color: number | null;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly name: string;
  // Embedded FK references — job_definitions whose linked_deposit_type_id = this id.
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export const DEPOSIT_TYPE_SELECT = [
  "id,world_id,name,slug,icon,icon_color,is_trashed,created_at,updated_at",
  "referencing_jobs:job_definitions!job_definitions_linked_deposit_type_fk(id)",
  "deposit_type_jobs(id,job_id,output_units_per_worker,worker_inputs_json)",
].join(",");

export function toWorkerInputEntry(row: WorkerInputEntryRow): WorkerInputEntry {
  return {
    amountPerWorker: row.amount_per_worker,
    resourceId: row.resource_id,
  };
}

export function toDepositTypeJob(row: DepositTypeJobRow): DepositTypeJob {
  return {
    id: row.id,
    jobId: row.job_id,
    outputUnitsPerWorker: row.output_units_per_worker,
    workerInputsJson: row.worker_inputs_json.map(toWorkerInputEntry),
  };
}

export function toDepositType(row: DepositTypeRow): DepositType {
  return {
    createdAt: row.created_at,
    hasActiveReferences: row.referencing_jobs.length > 0,
    icon: row.icon,
    iconColor: row.icon_color,
    id: row.id,
    isTrashed: row.is_trashed,
    jobs: row.deposit_type_jobs.map(toDepositTypeJob),
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
