/** Read numbers from Unity, including comma decimals sent by older German clients. */
export function parseVirtualWorldNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  // Wire values have no grouping separators. Reject partial parses, blanks and NaN.
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) {
    return null;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
