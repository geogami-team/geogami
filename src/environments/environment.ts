// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
// const localhost="localhost"

// const localhostIP="192.168.8.88"; // Change this to your local IP address
const localhostIP="localhost";      // Use localhost if `cross-origin` error ` arised
const localWebGLPort="50732";

export const environment = {
  production: false,
  apiURL: `http://${localhostIP}:3000`,
  uiURL:`http://${localhostIP}:8100`,
  webglURL: `http://${localhostIP}:${localWebGLPort}`,
  dashboardURL: `https://dashboard.geogami.uni-muenster.de`,
  mapboxAccessToken:
    "pk.eyJ1IjoiZmVsaXhhZXRlbSIsImEiOiI2MmE4YmQ4YjIzOTI2YjY3ZWFmNzUwOTU5NzliOTAxOCJ9.nshlehFGmK_6YmZarM2SHA",
  photoQuality: 10,
  // VR world
  mapStyle: "../../../../assets/mapStyles/",
  //* Default share data status is false
  shareData_status: false,
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
*/
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
