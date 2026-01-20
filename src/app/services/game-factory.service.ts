import { Injectable } from "@angular/core";
import { Storage } from "@ionic/storage";

import { Game } from "./../models/game";
import { Task } from "./../models/task";

@Injectable({
  providedIn: "root",
})
export class GameFactoryService {
  public game: Game;

  constructor(private storage: Storage) { }

  // DoDo
  addGameInformation(data: any) {
    this.game = {
      ...this.game,
      ...data,
    };
    // console.log("🚀 ~ file: game-factory.service.ts:18 ~ addGameInformation ~ this.game:", this.game.name)
    this.storage.set("game", this.game);
  }

  addTask(task: Task) {
    if (!task._id) {
      task._id = String(Math.floor(Date.now() / 1000));
    }
    // // console.log(task, index);
    if (this.game.hasOwnProperty("tasks")) {
      // const newTaskArr = this.game.tasks;
      // newTaskArr.splice(index, 0, task);
      // // console.log(newTaskArr);
      this.game.tasks.push(task);
    } else {
      this.game = {
        ...this.game,
        tasks: [task],
      };
    }
    this.storage.set("game", this.game);
    return this.game;
  }

  removeTask(taskID: string) {
  // console.log(this.game.tasks);
    this.game.tasks = this.game.tasks.filter((t) => t._id != taskID);
    this.storage.set("game", this.game);
    return this.game;
  }

  updateTask(taskID: string, task: Task) {
  // console.log(task, taskID);
    if (task._id == undefined) {
      task._id = taskID;
    }
    this.game.tasks = this.game.tasks.map((t) => {
      if (t._id == taskID) {
        return task;
      }

      return t;
    });
  // console.log(this.game.tasks);
    this.storage.set("game", this.game);
    return this.game;
  }

  applyReorder(tasks) {
    this.game.tasks = tasks;
    this.storage.set("game", this.game);
  }

  async getGame(): Promise<Game> {
    return this.storage.get("game").then((val) => {
    // console.log(val);
      if (val != undefined) {
        this.game = val;
      } else if (!this.game) {
        this.game = new Game(0, "", "", true, [], undefined, false, 1, 0, false, false, false, false, "", false, false, false);
        this.storage.set("game", this.game);
      }
      return this.game;
    });
  }

  // Initialize new game
  initializeGame() {
    this.game = new Game(0, "", "", true, [], undefined,false,1, 0, false, false, false, false, "",false, false, false);
    this.storage.set("game", this.game);
    return this.game;
  }

  flushGame() {
    this.game = undefined;
    this.storage.remove("game");
  }
}
