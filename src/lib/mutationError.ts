export type MutationIssue = {
  readonly message: string;
  readonly path: readonly PropertyKey[];
};

type MutationErrorInstance<TCode extends string> = Error & {
  readonly code: TCode;
  readonly issues: readonly MutationIssue[];
};

type MutationErrorResult<TCode extends string> = {
  ErrorClass: new (params: {
    readonly code: TCode;
    readonly issues?: readonly MutationIssue[];
    readonly message: string;
  }) => MutationErrorInstance<TCode>;
  isError: (error: unknown) => error is MutationErrorInstance<TCode>;
};

export function createMutationError<TCode extends string>(
  name: string,
): MutationErrorResult<TCode> {
  class MutationError extends Error {
    readonly code: TCode;
    readonly issues: readonly MutationIssue[];

    constructor({
      code,
      issues = [],
      message,
    }: {
      readonly code: TCode;
      readonly issues?: readonly MutationIssue[];
      readonly message: string;
    }) {
      super(message);
      this.name = name;
      this.code = code;
      this.issues = issues;
    }
  }

  function isError(error: unknown): error is MutationError {
    return error instanceof MutationError;
  }

  return { ErrorClass: MutationError, isError };
}
