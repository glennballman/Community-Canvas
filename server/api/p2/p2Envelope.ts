export function p2Ok(data: Record<string, any> = {}) {
  return { ok: true, ...data };
}

export function p2Err(code: string, message: string, details?: any) {
  return { ok: false, error: { code, message, details } };
}
