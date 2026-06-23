/**
 * A GeoGami Event: a named bundle of games run as an experimental study or
 * school excursion. Mirrors the server-side Event model.
 *
 * `games` may be either an array of game ids (when sending to the server) or
 * populated game objects (as returned by GET /event/userevents), so it is typed
 * loosely as any[].
 */
export interface GeoEvent {
  _id?: string;
  name: string;
  description?: string;
  games: any[];
  user?: string;
  sharedWith?: string[];
  // Set by the server on GET /event/userevents so the UI can hide owner-only
  // actions (delete / share) for shared co-editors.
  isOwner?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
