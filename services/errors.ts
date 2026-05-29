export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
