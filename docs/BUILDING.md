# Build GerbCraft from source

## Run the editor

Use Node.js 22.12 or newer and npm, on a desktop computer with internet access.
The first Windows release was packaged with Node.js 22.23.2 and npm 10.9.8.
Download and extract the release's `GerbCraft-0.2.1-Source.zip`, or clone this
repository and check out the matching release tag. Open a terminal in the folder
containing `package.json`, then run:

```sh
npm ci
npm start
```

`npm ci` downloads the versions and verifies the package integrity values recorded
in `package-lock.json`, including the Electron runtime. No private board samples,
licence keys, signing keys, VMware, REA or Ghidra are needed. The default editor
configuration grants perpetual access without activation.

## Test and package for Windows

```sh
npm test
npm run test:ui
npm run build:win
```

Run desktop tests in an interactive desktop session. Tests that specifically use
private acceptance boards skip when those boards are absent; public synthetic
fixtures are included. Windows packaging produces an x64 installer and portable
ZIP under `dist/editor`. It downloads Electron and packaging tools as needed.
Windows x64 is the intended native build host. Cross-packaging on macOS is also
used by this project; any additional platform tools requested by electron-builder
must be available. No code-signing certificate is configured.

The installed app and portable ZIP include the runtime. End users do not need
Node.js, npm, Git, Python, or an activation app.

## Corresponding source and dependencies

The release source ZIP contains the tracked repository at the exact release
commit, plus `SOURCE-MANIFEST.json` and upstream source archives in
`vendor-sources`. The manifest records references and SHA-256 checksums. These
archives preserve the original source for the geometry and ZIP libraries and
Electron; they supplement the checked-in editable JavaScript geometry bundle.
Dependency authors' licences remain in force.

Normal application builds use the published Electron runtime and dependencies
through `npm ci`; they do not require rebuilding Electron. To modify the geometry
bundle, edit `scripts/geometry-vendor.mjs` or the dependency sources and run
`npm run build:geometry`. Preserve the corresponding dependency notices.

Electron's source archive includes its build instructions and pinned upstream
dependency definitions. Rebuilding that general-purpose runtime also requires
fetching its Chromium/Node dependencies and platform toolchain; this release
source bundle is not an offline Electron/Chromium build environment. See
[Electron's build instructions](https://github.com/electron/electron/tree/v45.0.0/docs/development).

Maintainers can reproduce the source bundle from a clean committed checkout with
Python 3, Git and internet access:

```sh
python3 scripts/package-source.py
```

When upgrading runtime dependencies, update that script's pinned upstream sources.
Distribute the matching source archive beside binary downloads, retain licence
notices, and record the build commit and checksums in the release notes.
