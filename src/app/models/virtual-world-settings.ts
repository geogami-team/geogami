// undefined means the camera's original distance; null means invalid input.
export function parseCameraFarClipPlane(value: unknown): number | null | undefined {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return undefined;
  }
  if (typeof value !== "number" && typeof value !== "string") return null;

  const distance = Number(value);
  // Unity receives a float, so reject values that overflow even if JS accepts them.
  return distance >= 1 && Number.isFinite(Math.fround(distance)) ? distance : null;
}
