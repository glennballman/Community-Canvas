/**
 * Public API error helpers.
 */

export function isTokenInvalid(code?: string) {
  return code === "UNAUTHORIZED" || code === "TOKEN_INVALID";
}

export function isExpired(code?: string) {
  return code === "CONFLICT";
}

export function isNotFound(code?: string) {
  return code === "NOT_FOUND";
}

export function isBadRequest(code?: string) {
  return code === "BAD_REQUEST" || code === "VALIDATION_ERROR";
}
