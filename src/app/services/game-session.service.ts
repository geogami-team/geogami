import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';

type GameSessionKey = 'game' | 'savedTracksData';

/** Progress and drafts survive navigation, but never a reload/closed app. */
@Injectable({ providedIn: 'root' })
export class GameSessionService {
  private values = new Map<GameSessionKey, any>();

  constructor(private persistentStorage: Storage) {}

  // Discard progress written by older versions. Do not clear preferences/tokens.
  async discardLegacyProgress(): Promise<void> {
    await Promise.all(['game', 'savedTracksData'].map(key =>
      this.persistentStorage.remove(key).catch(error => {
        console.warn('Could not discard legacy game progress:', key, error);
      })
    ));
  }

  async get<T = any>(key: GameSessionKey): Promise<T> {
    return this.snapshot(this.values.get(key));
  }

  async set<T>(key: GameSessionKey, value: T): Promise<T> {
    this.values.set(key, this.snapshot(value));
    return value;
  }

  async remove(key: GameSessionKey): Promise<void> {
    this.values.delete(key);
  }

  // Match Ionic storage's snapshots: later mutations must not change saved tracks.
  private snapshot<T>(value: T): T {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
}
