// Writes src/environments/build-info.ts with the release, commit and deploy of a
// Netlify build (Netlify sets NETLIFY, COMMIT_REF and DEPLOY_ID), so the running app
// can say exactly which build it is. Anywhere else it does nothing and the committed
// default ("local") stays, so local builds and the git tree are unaffected.
// Runs before `npm run build` / `ionic build` (package.json "prebuild" and
// "ionic:build:before"); it never fails the build.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

/**
 * The release the build is based on, from the newest "v…" tag before it:
 * "6.0.1" on the tagged commit, "6.0.1+62" for 62 commits after it, "" if unknown.
 */
function releaseVersion() {
  const git = (args, timeout) =>
    execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"], timeout })
      .toString()
      .trim();
  const describe = () => git(["describe", "--tags", "--long", "--match", "v[0-9]*"], 10000);
  let described;
  try {
    described = describe();
  } catch (err) {
    // The clone may lack the tags.
    try {
      git(["fetch", "--tags", "--quiet"], 60000);
      described = describe();
    } catch (err2) {
      return "";
    }
  }
  const match = /^v(.+)-(\d+)-g[0-9a-f]+$/.exec(described);
  if (!match) return "";
  return match[2] === "0" ? match[1] : `${match[1]}+${match[2]}`;
}

module.exports = { releaseVersion };

if (require.main === module && process.env.NETLIFY === "true") {
  try {
    const info = {
      version: releaseVersion(),
      commit: process.env.COMMIT_REF || "unknown",
      deployId: process.env.DEPLOY_ID || "",
      builtAt: new Date().toISOString(),
    };
    const file = path.join(root, "src", "environments", "build-info.ts");
    fs.writeFileSync(
      file,
      "// Written by scripts/write-build-info.js during the Netlify build.\n" +
        `export const BUILD_INFO = ${JSON.stringify(info, null, 2)};\n`
    );
    console.log(`build-info: ${info.version || "no release tag"}, ${info.commit} (deploy ${info.deployId})`);
  } catch (err) {
    console.warn("build-info: could not write the build info:", err.message);
  }
}
