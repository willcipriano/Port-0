export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toJSON(): ApiErrorBody {
    return {
      error: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function sanitizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) {
    return new ApiError(500, 'internal_error', isProduction() ? 'Internal server error' : err.message);
  }
  return new ApiError(500, 'internal_error', 'Internal server error');
}
