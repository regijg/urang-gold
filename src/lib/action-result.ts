/**
 * Consistent response shape for server actions / route handlers (master prompt §34).
 * Never put raw database error text in `message`.
 */
export type ActionSuccess<T> = { success: true; message: string; data: T };
export type ActionFailure = {
  success: false;
  message: string;
  code: string;
  fieldErrors?: Record<string, string>;
};
export type ActionResult<T = null> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T, message = "Berhasil"): ActionSuccess<T> {
  return { success: true, message, data };
}

export function fail(code: string, message: string, fieldErrors?: Record<string, string>): ActionFailure {
  return fieldErrors ? { success: false, message, code, fieldErrors } : { success: false, message, code };
}

/** Domain error thrown by services; converted to ActionFailure at the action boundary. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toFailure(error: unknown): ActionFailure {
  if (error instanceof AppError) return fail(error.code, error.message, error.fieldErrors);
  console.error("[unexpected]", error);
  return fail("INTERNAL_ERROR", "Terjadi kesalahan. Silakan coba lagi.");
}
