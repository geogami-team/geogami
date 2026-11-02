// The build that is running. It is compiled into the bundle, so an old tab or a
// build the service worker still serves reports itself, not the latest release.
// scripts/write-build-info.js fills it in on Netlify; local builds keep "local".
export const BUILD_INFO = {
  // Release tag plus commits since it, e.g. "6.0.1+62".
  version: "",
  commit: "local",
  deployId: "",
  builtAt: "",
};
