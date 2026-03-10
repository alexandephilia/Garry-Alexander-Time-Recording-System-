/**
 * Base application error with HTTP status code.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** 400 — malformed or missing input */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

/** 404 — resource doesn't exist */
export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(404, `${resource} with id ${id} not found.`);
  }
}

/** 409 — state conflict (e.g. double clock-in) */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}
