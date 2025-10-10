import { MapFeatures } from "./mapFeatures";

export interface Task {
  _id?: string;
  answer: any;
  category: string;
  evaluate: string;
  id: number;
  mapFeatures: MapFeatures;
  name: string;
  question: any;
  settings: any;
  type: string;
  collaborationType: string;
  virEnvType: string;           //* to be used in having multiple vir. envs in a single game
  isVEBuilding: boolean;
  floor: string;
  initialFloor: string;
  excludedObjectsNames: string[];    //* list of excluded objects from virtual environment

}

// export class Task {
//   constructor(
//     public answer: any,
//     public category: string,
//     public evaluate: string,
//     public id: number,
//     public mapFeatures: MapFeatures,
//     public name: string,
//     public question: any,
//     public settings: any,
//     public type: string
//   ) {}
// }
