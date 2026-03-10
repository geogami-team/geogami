import { Component, OnInit, ViewChild } from "@angular/core";

import { AlertController, NavController } from "@ionic/angular";

import { GamesService } from "../../../services/games.service";

// VR world
import { ActivatedRoute } from "@angular/router";
// For getting user role
import { AuthService } from "../../../services/auth-service.service";
import { environment } from "src/environments/environment";

import mapboxgl from "mapbox-gl";
import { UtilService } from "src/app/services/util.service";
import { SocketService } from "src/app/services/socket.service";
import { TranslateService } from "@ngx-translate/core";
// import {} from environment.mapStyle + 'realWorld.json'

@Component({
  selector: "app-play-game-list",
  templateUrl: "./play-game-list.page.html",
  styleUrls: ["./play-game-list.page.scss"],
})
export class PlayGameListPage implements OnInit {
  @ViewChild("gamesMap") mapContainer;
  @ViewChild("popupContainer") popupContainer: any;

  games_res: any;
  games_view: any; // for viewing based on filter games_res
  all_games_segment: any;
  gamesWithLocs: any;

  gameEnvSelected = "real"; // (default) game mode select
  gameModeSelected = "single"; // (default) game mode select
  isMutiplayerGame = undefined;

  // To be able to update games list and switch between segments
  searchText: string = "";
  selectedSegment: string = "curated";
  // to disable mine segment for unlogged user
  userRole: String = "unloggedUser";
  userId: String = "";
  user = this.authService.getUser();

  isVRMirrored: boolean = false; // temp
  map: mapboxgl.Map;
  isListTabSelected: boolean = true;
  isStandalone: boolean = false;

  // Map popup
  popup: any;
  game_id: any;
  game_name: any;
  game_place: any;
  game_numTasks: any;

  // loading = false;

  // no need for it
  // Multiplyar impl. (get values from retreived game data)
  /* isSingleMode: boolean = true;
  numPlayers : number = 1; */

  constructor(
    public navCtrl: NavController,
    public gamesService: GamesService,
    private route: ActivatedRoute,
    private authService: AuthService,
    private utilService: UtilService,
    private socketService: SocketService,
    private alertController: AlertController,
    public _translate: TranslateService
  ) {}

  ngOnInit() {
    /* if device is not connected to internet, show notification */
    if (!this.utilService.getIsOnlineValue()) {
      // show no connection notification
      this.utilService.showAlertNoConnection();
      // return;
    }

    /* Check if page is accessed directly via standalone URL param */
    this.isStandalone = this.route.snapshot.queryParamMap.get('standalone') === 'true';
    if (this.isStandalone) {
      this.gameEnvSelected = 'virtual';
    }

    /* Check whther user is registerd. if yes, get role and id */
    // Get user role
    this.user.subscribe((event) => {
      if (event != null) {
        this.selectedSegment = "all";
        this.userRole = event["roles"][0];
        this.userId = this.authService.getUserId();
      } else {
        this.user = null;
      }
    });

    // Get games data from server
    this.getGamesData();
  }

  ionViewWillEnter() {
    /* in case user has joined room and pressed back button */
    if (this.socketService.socket.ioSocket.connected) {
      this.socketService.socket.disconnect();
    }
  }

  ngAfterViewInit(): void {}

  // Get games data from server
  getGamesData() {
    /* Only content admin can view multi-players games */
    this.gamesService
      .getGames(true, this.userRole != "unloggedUser")
      .then((res) => res.content)
      .then((games) => {
        // Get either real or VE agmes based on selected environment
        this.games_res = games;

        /* filter games based on selected environment (default: real, standalone: virtual) */
        if (this.isStandalone) {
          this.filterVirtualEnvGames();
        } else {
          this.filterRealWorldGames();
        }

        // this.loading = true;

        // Filter data of selected segment
        this.segmentChanged(this.selectedSegment);
      });
  }

  // ToDo: update the functions
  doRefresh(event) {
    // Get games data from server
    // Only content admin can view multi-players games
    this.gamesService
      .getGames(true, this.userRole != "unloggedUser")
      .then((res) => res.content)
      .then((games) => {
        this.games_res = games;
        this.filterGamesEnv(this.gameEnvSelected);
      })
      .finally(() => event.target.complete());
  }

  //* update shown games based on search phrase
  filterList(event) {
    this.filterSelectedSegementList(event.detail.value);
  }

  gameClick(game: any) {
    this.navCtrl.navigateForward(`play-game/game-detail?gameId=${game._id}`);
  }

  // segment (my games - all games - curated game)
  segmentChanged(segVal) {
    //--- ToDo check duplicate code and create a func for it
    // if mine is selected
    if (segVal == "mine") {
      this.games_view = this.all_games_segment?.filter(
        (game) =>
          game.user == this.userId &&
          game.isMultiplayerGame == this.isMutiplayerGame
      );

      // to update shown games based on search phrase
      this.updateGamesListSearchPhrase();
    } else if (segVal == "all") {
      // if all is selected
      //onsole.log("all"); //temp
      this.games_view = this.all_games_segment?.filter(
        (game) => game.isMultiplayerGame == this.isMutiplayerGame
      );

      // to update shown games based on search phrase
      this.updateGamesListSearchPhrase();
    } else if (segVal == "curated") {
      // if curated is selected
      this.games_view = this.all_games_segment.filter(
        (game) =>
          game.isCuratedGame == true &&
          game.isMultiplayerGame == this.isMutiplayerGame
      );

      // to update shown games based on search phrase
      this.updateGamesListSearchPhrase();
    }
  }

  /* update shown games based on search phrase */
  updateGamesListSearchPhrase() {
    if (this.searchText != "") {
      this.games_view = this.games_view.filter(
        (game) =>
          game.name.toLowerCase().includes(this.searchText.toLowerCase()) ||
          (game.place != undefined &&
            game.place.toLowerCase().includes(this.searchText.toLowerCase()))
      );
    }
  }

  // update list after selecting a segment
  filterSelectedSegementList(searchPhrase) {
    if (this.selectedSegment == "all") {
      this.games_view = this.all_games_segment.filter(
        (game) =>
          game.name.toLowerCase().includes(searchPhrase.toLowerCase()) ||
          (game.place != undefined &&
            game.place.toLowerCase().includes(searchPhrase.toLowerCase()))
      );
    } else if (this.selectedSegment == "mine") {
      this.games_view = this.all_games_segment.filter(
        (game) =>
          game.user == this.userId &&
          (game.name.toLowerCase().includes(searchPhrase.toLowerCase()) ||
            (game.place != undefined &&
              game.place.toLowerCase().includes(searchPhrase.toLowerCase())))
      );
    } else if (this.selectedSegment == "curated") {
      this.games_view = this.all_games_segment.filter(
        (game) =>
          game.isCuratedGame == true &&
          (game.name.toLowerCase().includes(searchPhrase.toLowerCase()) ||
            (game.place != undefined &&
              game.place.toLowerCase().includes(searchPhrase.toLowerCase())))
      );
    }
  }

  //
  initMap(gamesPoints) {
    mapboxgl.accessToken = environment.mapboxAccessToken;
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: environment.mapStyle + "realWorld.json",
      // style: 'mapbox://styles/mapbox/light-v9',
      // style: 'mapbox://styles/mapbox/light-v10',
      // style: 'mapbox://styles/mapbox/streets-v11',
      center: [8, 51.8],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18, // to avoid error
    });

    // disable map rotation using right click + drag
    this.map.dragRotate.disable();
    // disable map rotation using touch rotation gesture
    this.map.touchZoomRotate.disableRotation();
    // Add zomm in/out controls
    this.map.addControl(new mapboxgl.NavigationControl());

    //Temp
    this.map.on("load", () => {
      // Load an image from an external URL pr assets
      this.map.loadImage(
        "assets/icons/icon-72x72.png",
        //"/assets/icons/marker-editor-solution.png",
        (error, image) => {
          if (error) throw error;
          // Add the image to the map style.
          this.map.addImage("geogami-marker", image);
        }
      );

      // Add a new source from our GeoJSON data and
      // set the 'cluster' option to true. GL-JS will
      // add the point_count property to your source data.
      this.map.addSource("clusters", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: gamesPoints,
        },
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
      });

      this.map.addLayer({
        id: "clusters",
        type: "circle",
        source: "clusters",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#51bbd6",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            5,
            2,
            10,
            7,
            15,
            20,
            20,
            30,
            25,
          ],
          "circle-opacity": 0,
          "circle-stroke-width": 12,
          "circle-stroke-color": "#51bbd6",
          "circle-stroke-opacity": 0.85,
        },
      });

      this.map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "clusters",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 20,
        },
      });

      // Add a layer showing game point
      this.map.addLayer({
        id: "unclustered-point",
        type: "symbol",
        source: "clusters",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": "geogami-marker",
          "icon-size": 0.75,
          "icon-offset": [0, 0],
          "icon-allow-overlap": true,
        },
      });

      // inspect a cluster on click
      this.map.on("click", "clusters", (e) => {
        const features = this.map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        const clusterId = features[0].properties.cluster_id;
        this.map
          .getSource("clusters")
          .getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;

            this.map.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom,
            });
          });
      });

      // When a click event occurs on a feature in
      // the unclustered-point layer, open a popup at
      // the location of the feature, with
      // description HTML from its properties.
      this.map.on("click", "unclustered-point", (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        this.popup = e.features[0].properties;

        // Data to send topopup component
        this.game_id = e.features[0].properties._id;
        this.game_name = e.features[0].properties.name;
        this.game_place = e.features[0].properties.place;
        this.game_numTasks = e.features[0].properties.task_num;
        //// console.log('properties: ', e.features[0].properties)

        // Ensure that if the map is zoomed out such that
        // multiple copies of the feature are visible, the
        // popup appears over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        this.popup = new mapboxgl.Popup({
          //closeButton: false
        })
          .setLngLat(coordinates)
          .setDOMContent(this.popupContainer.nativeElement)
          .addTo(this.map);
      });

      //--- ToDo (imp) use one func mouseenter for both cluster and point
      // Change the cursor to a pointer when the mouse is over the cluster layer.
      this.map.on("mouseenter", "clusters", (e) => {
        this.map.getCanvas().style.cursor = "pointer";
      });

      // Change it back to a pointer when it leaves.
      this.map.on("mouseleave", "clusters", () => {
        this.map.getCanvas().style.cursor = "";
      });

      // Change it back to a pointer when it leaves.
      this.map.on("mouseleave", "unclustered-point", () => {
        this.map.getCanvas().style.cursor = "";
      });

      // Change the cursor to a pointer when the mouse is over the game layer.
      this.map.on("mouseenter", "unclustered-point", () => {
        this.map.getCanvas().style.cursor = "pointer";
      });
    });
  }

  async openMapTap() {
    if (this.isListTabSelected) {
      this.isListTabSelected = false;

      if (!this.map) {
        // get minimal games with locs for games map view
        this.gamesService
          .getMinimalGamesWithLocs()
          .then((res) => res.content)
          .then((gameswithlocs) => {
            // Get either real or VE agmes based on selected environment
            this.gamesWithLocs = gameswithlocs;

            this.convertToGeoJson();
          });
      }
    }
  }

  openListTap() {
    if (!this.isListTabSelected) {
      this.isListTabSelected = true;
      // // console.log("isListTabSelected: ", this.isListTabSelected);
    }
  }

  async convertToGeoJson() {
    let convertedData = [];

    this.gamesWithLocs.forEach((game) => {
      if (game.coords) {
        convertedData.push({
          type: "Feature",
          properties: {
            _id: game._id,
            name: game.name,
            place: game.place,
            task_num: game.task_num,
          },
          geometry: {
            type: "Point",
            coordinates: game.coords,
          },
        });
      }
    });

    // // console.log("convertedData: ", convertedData)
    this.showGamesOnMap(convertedData);
  }

  showGamesOnMap(gamesListGeoJson) {
    if (!this.map) {
      // // console.log("Create map ////////////");
      this.initMap(gamesListGeoJson);
    }
    // no need for it since we can hide the map
    /* else if (this.map.getSource('clusters')) {
      this.map.removeLayer(`cluster-count`);
      this.map.removeLayer(`unclustered-point`);
      this.map.removeLayer(`clusters`);
      this.map.removeSource("clusters");

    // console.log("Else ////////////");

      this.map.addSource('clusters', {
        'type': 'geojson',
        'data': {
          'type': 'FeatureCollection',
          'features': gamesListGeoJson
        }
      });

      // Add a layer showing the clusters.
      this.map.addLayer({
        'id': 'clusters',
        type: "symbol",
        'source': 'clusters',
        layout: {
          "icon-image": "geogami-marker",
          "icon-size": 0.65,
          "icon-offset": [0, 0],
          "icon-allow-overlap": true,
        }
      }); 
    }*/
  }

  /* on game environment change OR refresh*/
  filterGamesEnv(envVal: string) {
    /* first, update game mode to single player */
    this.gameModeSelected = "single";
    this.isMutiplayerGame = undefined;
    /* then, check game env. */
    if (envVal == "real") {
      this.filterRealWorldGames();
    } else {
      this.filterVirtualEnvGames();
    }

    // Filter data of selected segment
    this.segmentChanged(this.selectedSegment);
  }

  filterRealWorldGames() {
    this.all_games_segment = this.games_res
      .filter((game) => game.isVRWorld == false || game.isVRWorld == undefined)
      .reverse();
  }

  filterVirtualEnvGames() {
    this.all_games_segment = this.games_res
      .filter((game) => game.isVRWorld == true)
      .reverse();
  }

  /***  on game mode change ***/
  filterGamesMode(modeVal: string) {
    if (modeVal == "single") {
      this.isMutiplayerGame = undefined;

      this.games_view = this.all_games_segment
        .filter((game) => game.isMultiplayerGame == undefined)
        .reverse();

      // Filter data of selected segment
      this.segmentChanged(this.selectedSegment);
    } else {
      this.isMutiplayerGame = true;
      this.games_view = this.all_games_segment
        .filter((game) => game.isMultiplayerGame == true)
        .reverse();

      // Filter data of selected segment
      this.segmentChanged(this.selectedSegment);
    }
  }

  // Edit game
  async EditGame(gameID: string) {
    let bundle = {
      isRealWorld: this.gameEnvSelected == "real" ? true : false,
      isSingleMode: this.gameModeSelected == "single" ? true : false,
      game_id: gameID,
    };
    this.navCtrl.navigateForward(`edit-game-tasks/${JSON.stringify(bundle)}`);
  }

  navigateBackToStart() {
    this.navCtrl.navigateRoot("/");
  }

  navigateCreateRealGames() {
    this.navCtrl.navigateForward("game-type-menu/RealWorld");
  }

  navigateCreateVirEnvGames() {
    this.navCtrl.navigateForward("game-type-menu/Vir.Env.");
  }
}
