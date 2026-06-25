import { Task } from './task';

export class Game {
  constructor(
    public _id: number,
    public name: string,
    public place: string,
    public tracking: boolean,
    public tasks: Task[],
    public bbox: any,
    public isMultiplayerGame: boolean,
    public numPlayers: number,
    public TasksCount: number,
    public mapSectionVisible: boolean,
    public geofence: boolean,
    public isVRWorld: boolean,
    public isVRMirrored: boolean,
    public virEnvType: string,
    public isVisible: boolean,
    public isPublished: boolean,
    public disableShareData: boolean,
    public skipTaskPin?: string,
    public editors?: string[]
  ) { }
}
