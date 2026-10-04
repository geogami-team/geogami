import { Injectable } from "@angular/core";
import { NavController } from "@ionic/angular";
import { Socket } from "ngx-socket-io";

/* Posted to the top window by the GeoGami app inside the WebGL frame (VE map panel) when the player presses done */
export const VE_CLOSE_FRAME_MESSAGE = "geogami:closeVEFrame";

@Injectable({
  providedIn: "root",
})
export class SocketService {
  socket: Socket;
  /* last room joined with "newGame", re-joined after a reconnect */
  private veRoom: { gameCode: string; virEnvType: string; isSingleMode: boolean } = null;

  constructor(socket: Socket, public navCtrl: NavController) {
    this.socket = socket;
  }

  /**
   * Socket events
   */
  creatAndJoinNewRoom(
    gameCode: string,
    virEnvType: string,
    isSingleMode: boolean
  ) {
    this.veRoom = {
      gameCode: gameCode,
      virEnvType: virEnvType,
      isSingleMode: isSingleMode,
    };
    this.socket.emit("newGame", this.veRoom);

    // Room membership belongs to a single connection on the server, so after an
    // auto-reconnect (network drop, backgrounded tab, main thread blocked while
    // Unity loads) room events (avatar updates, closeWebGLFrame) stop arriving.
    this.socket.removeListener("reconnect", this.rejoinVERoom);
    this.socket.on("reconnect", this.rejoinVERoom);
  }

  private rejoinVERoom = () => {
    if (this.veRoom) {
      this.socket.emit("newGame", this.veRoom);
    }
  };

  joinVERoom(gameCode: string) {
    this.socket.emit("joinVEGame", {
      gameCode: gameCode,
    });
  }

  checkRoomNameExistance(gameCode) {
    return new Promise((resolve) => {
      this.socket.emit(
        "checkRoomNameExistance_v2",
        { gameCode: gameCode },
        (callback) => {
          console.log(
            "🚀 ~ SocketService ~ checkRoomNameExistance ~ response.roomStatus:",
            callback.roomStatus
          );
          resolve(callback.roomStatus);
        }
      );
    });
  }

  // for closing webGL frame of single-player and multi-player game
  closeVEGame() {
    console.log("🚀 ~ SocketService ~ closeVEGame ~ closeVEGame:")
    this.socket.emit("closeVEGame");
  }

  /**
   * Socket events' listeners
   * for closing webGL frame of single-player game
   */
  closeFrame_listener() {
    this.socket.removeListener("closeWebGLFrame"); /* one handler, not one per game played */
    this.socket.on("closeWebGLFrame", () => {
      // root, so the playing-virenv page (and its WebGL frame) is destroyed rather than kept in the stack
      this.navCtrl.navigateRoot(`/`);
    });
  }

  /**
   * General functions
   */
  disconnectSocket() {
    /* dissconnect socket connection */
    if (this.socket) {
      this.veRoom = null;
      /* remove all listners to avoid duplicate listenres after rejoining game */
      this.socket.removeAllListeners();
      /*  dissconnect socket server*/
      this.socket.disconnect();
    }
  }
}
