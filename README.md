# GerbCraft 0.2.1 — Windows first

A local desktop Gerber editor with layered viewing, selection, move/copy/delete,
rotation, mirroring, Undo/Redo, drill editing, bare-board 3D, project files and RS-274X export. This build includes perpetual access with no activation or expiry. The separate
**GerbCraft Activation** administrator app is retained for optional future licensing.

## Install and start

- Editor: [Windows installer](dist/editor/GerbCraft-0.2.1-Windows-x64.exe)
- Administrator only: [Activation App installer](dist/activation/GerbCraft-Activation-0.1.0-Windows-x64.exe)
- Portable ZIP editions are beside each installer. Extract the entire ZIP before launching.

The release is Windows x64; the acceptance environment is Windows 11 ARM in
VMware Fusion using Windows x64 emulation. The installers are unsigned. Windows uses software rendering for VM compatibility.
The Windows research VM, REA and Ghidra remain outside this project for reuse.

1. Open GerbCraft and choose **Explore a sample**, or **Import Gerber / ZIP**.
2. Select a ZIP board archive or individual Gerber/drill files. ZIP subfolders are included; supporting files are reported and skipped.
3. Save your editable work as `.gcraft`; export fabrication artwork as `.gbr` and drills separately. Saving and all exports work immediately without a licence file.

See the [user guide](docs/USER-GUIDE.md), [activation guide](docs/ACTIVATION.md),
[release checks](docs/RELEASE-CHECKS.md), and [project plan](PLAN.md).

## Supported first-release scope

- Metric and inch RS-274X, leading/trailing zero omission, absolute/incremental coordinates.
- Circle, rectangle, obround and regular polygon flashes; circular aperture holes.
- Circular-aperture line and arc strokes, single/multi-quadrant arcs and full circles.
- Regions with straight/curved contours, dark/clear polarity, step-and-repeat.
- Aperture macros: circle, outline, polygon, vector line, centre/lower-left rectangles;
  parameters, variables and arithmetic. Aperture mirror/rotate/scale commands.
- Layer names, colours, visibility and locks. Click/Shift-click/box selection,
  movement, copying, deletion, arbitrary rotation and mirroring, distance measurement.
- 100-step Undo/Redo using structural patches with a 64 MB history budget.
- Excellon absolute holes and G85 slots: add, edit diameter/plating/endpoints, transform, copy, delete and separate PTH/NPTH export.
- Two-copper-layer FR4 board setup; software 3D with outline/cutouts/drills, top/bottom copper, mask and silk, orbit/pan/zoom and PNG export.
- Visible, active-layer or selected-object RS-274X export in millimetres with six decimal places.

Unsupported constructs produce an import error. This version does not support
non-circular drawing apertures, aperture blocks, moiré/thermal macro primitives,
Excellon routing/repeats/incremental coordinates, blind/buried holes, DXF, ODB++, panelisation or DFM. X2 attributes are read as metadata
but omitted from exported artwork with a warning. These are explicit future scope;
0.2 is a scoped editor preview, not comprehensive ViewMate feature parity.

## Development

Node.js/npm required. From this folder:

```sh
npm ci
npm test
npm run test:ui
npm start
npm run activation
npm run build:win
npm run build:activation
```

`npm start` uses the checked-in public licence configuration. Tests use isolated
profiles and an unpackaged-only development override. Packaged builds ignore that
override. Earcut (ISC) and polygon-clipping (MIT), including their dependencies,
are locally bundled in `src/vendor`; notices are in `src/vendor/LICENSES.txt`.
Rebuild that bundle with `npm run build:geometry` after changing those dependencies.

Architecture: pure JavaScript geometry/parser/document modules in `src/core`,
Canvas renderer and desktop UI in `src`, narrow Electron bridges in `electron`.
The renderer has no Node.js access; sandboxing and context isolation are enabled.
Private signing keys are outside the repository and never packaged.

Implementation is independent source code guided by synthetic fixtures and
observed workflows. Research evidence is retained separately at
`/Users/solomonsmit/develop/research/viewmate-essentials`.

## User sample compatibility update

Version 0.1.1 accepts zero-diameter standard circular apertures without drawing
phantom strokes. The supplied nine-layer PCB imports, saves, reopens and exports
with 12,437 objects. See [sample test results](Sample_Gerber_Files/GerbCraft-Test-Results/TEST-RESULTS.md).
The original ZIP is preserved; import the extracted `.gbr` files or open the
prepared `.gcraft` project, or import the original ZIP directly in 0.2.1.

Version 0.2.0 adds both sample drill files: 379 plated + 2 non-plated holes. Open
`Sample_Gerber_Files/GerbCraft-Test-Results/PCB-11-23001-drills-3D.gcraft` for the
11-layer project with the supplied 1.55 mm board setup. The notes list 239 holes
and 190 × 163 mm; the files contain 381 holes and a 190 × 163.2 mm profile.
Those discrepancies are reported without changing the originals.

Version 0.2.1 adds direct ZIP import and perpetual access by default. ZIP import is
atomic and undoable as one operation, with integrity and bounded-size checks.
Password-protected archives and nested ZIP archives are not supported. The ZIP
reader uses yauzl and pend (MIT), included with their licence notices.
