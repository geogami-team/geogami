// Range of the task editor's slider. `default` matches the far clip plane of every avatar camera
// in the Unity project, so an unset task and one set to `default` look the same to the player.
export const CAMERA_FAR_CLIP_PLANE = { min: 100, max: 1000, step: 50, default: 1000 };

// undefined means the camera's original distance. Other values are clamped to the slider's range.
export function parseCameraFarClipPlane(value: unknown): number | undefined {
  const distance = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof distance !== "number" || !Number.isFinite(distance)) return undefined;

  return Math.min(Math.max(distance, CAMERA_FAR_CLIP_PLANE.min), CAMERA_FAR_CLIP_PLANE.max);
}
