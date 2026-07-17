export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: unknown;

  constructor(statusCode: number, message: string, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errors?: unknown) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }

  static paymentRequired(message: string) {
    return new ApiError(402, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message);
  }

  static badGateway(message: string) {
    return new ApiError(502, message);
  }
}
