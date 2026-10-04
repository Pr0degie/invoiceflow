export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string
  ) {
    super(message ?? `API error ${status}`);
    this.name = "ApiError";
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isBadRequest() {
    return this.status === 400;
  }
}

/**
 * invoice-api refuses password changes and account deletion on the public
 * demo account (403 demo_account_readonly) — its password is shared by every
 * visitor.
 */
export function isDemoAccountError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    (err.body as { error?: string } | null)?.error === "demo_account_readonly"
  );
}
