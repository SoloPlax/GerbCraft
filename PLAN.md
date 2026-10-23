# GerbCraft delivery plan

Updated: 22 October 2026. First target: **Windows**, as requested.

## First release: core Gerber editor and Activation App

The first release is 0.1.0. Its completion criterion is a usable Windows package
with the observed core workflow, explicit format limits, verified fixture
round trips, project persistence and a separate licence-issuing app. It does not
claim complete ViewMate parity or support for every Gerber construct.

- [x] Reusable REA, Ghidra and Windows research environment outside GerbCraft.
- [x] ViewMate import/edit/export, visibility, arcs/regions/macros, rotations,
  mirrors, individual edits and multi-step Undo investigated with retained evidence.
- [x] Focused REA analysis and 19-feature evidence map retained outside the product.
- [x] Independent geometry model, parser, renderer and project document model.
- [x] Layer controls, selection, move/copy/delete, rotation/mirrors and measurement.
- [x] Transactional edits, multi-step Undo/Redo and unsaved-change protection.
- [x] Gerber import/export and `.gcraft` save/reopen.
- [x] Units/zero omission/incremental coordinates, step-repeat, polarity,
  holes, curved regions and parameterized macros covered in automated tests.
- [x] Separate Activation App: signing identity, restore/backup, perpetual/dated
  licence issuance, local audit log and editor signature/device/expiry checking.
- [x] 27 automated core/licensing tests and four desktop integration tests pass.
- [x] Independent fixture comparison passes at 0.000002 mm, including 45° rotation.
- [x] Windows x64 installer and portable ZIP built for both apps.
- [x] Packaged-file inspection: public licence configuration present; private key absent.
- [x] Windows VM acceptance: install, activation, edit/Undo/Redo, save/reopen/export.
- [x] Activation App Windows launch and final delivery checksums.
- [x] Final editor launches without diagnostic flags, retains activation and reopens
  the tested project; installed app archive matches the Mac build by SHA-256.
- [x] User and activation guides, supported-format scope and recovery instructions.

The scoped 0.1.0 core-editor delivery is complete. GerbCraft remains open in the
Windows VM with the tested project. The Windows administrator app is installed;
its signing identity can be restored from the existing Mac identity as described
in the activation guide.

## Future scope, separate from the core release

- Broader customer/production-board corpus and native Windows x64 hardware testing.
- Non-circular drawing apertures, aperture blocks, thermal/moiré primitives,
  full X2 attribute preservation, broader drill syntax and other CAM formats.
- Panelisation, DFM, richer drawing tools, advanced selection and printing.
- Windows code signing, update delivery, performance profiling on large jobs,
  packaging metadata polish, formal release/support policy.
- Online seat enforcement, deactivation/revocation and customer self-service if
  desired. The initial offline licence is installation-bound, not hardware-proof.
- Mac/Linux delivery after Windows feedback.

## Evidence and reusable resources

- [Research plan and detailed results](docs/RESEARCH-PLAN.md)
- [User guide](docs/USER-GUIDE.md)
- [Activation and recovery](docs/ACTIVATION.md)
- [Release checks](docs/RELEASE-CHECKS.md)
- Research: `/Users/solomonsmit/develop/research/viewmate-essentials`
- REA/Ghidra: `/Users/solomonsmit/develop/tools`
- VM: `/Users/solomonsmit/Virtual Machines/Windows 11 ARM - Research.vmwarevm`

The research's remaining unknowns concern ViewMate internals and broader parity;
they do not prevent independent implementation of this defined first release.

## 0.1.1: supplied PCB sample — 21 October 2026

- [x] Preserve original ZIP; safely extract nine Gerber layers and two drill files.
- [x] Fix valid zero-diameter circular apertures that blocked front copper/silkscreen.
- [x] Prevent zero-width Canvas strokes from painting phantom artwork.
- [x] Retain zero-size objects through project validation and export.
- [x] Compare all primitive structures/numeric fields through export/reimport: 12,437
  objects, maximum numeric error 0.0000005 mm (same-parser check).
- [x] Desktop import/save/reopen and top-side screenshot verified.
- [x] 31 core/licensing tests plus five desktop tests pass.
- [x] Build Windows 0.1.1 compatibility update.
- [x] Open complete prepared project in Windows: nine layers, 12,437 objects;
  front copper/silkscreen/outline visible (7,309 objects).
- [x] Windows visibility, Hide all/Show all and visibility Undo/Redo.
- [x] Outline move (+10 mm X/+5 mm Y), 90° rotation, horizontal mirror,
  three-step Undo, copy/delete/Undo, and clearing Redo after a new change.
- [x] Visible-layer export excludes eight hidden layers: 24 outline objects
  (20 lines, four arcs); reimport succeeds and numeric comparison has zero error.
- [x] Windows Save/Save As/reopen retains all nine layers and visibility. Returned
  project data exactly matches the prepared original after all test edits are undone.
- [x] Preserve previous eight-layer working board separately; leave the tested
  nine-layer project open and stop the temporary transfer server.

Next priorities from this Windows sample test:

- [x] Improve Undo storage efficiency (0.2.0): structural patches now retain 100
  small edits on the full board using approximately 26 KB; the 64 MB cap remains.
- [ ] Independently review full copper/polarity output and validate on native
  Windows x64 hardware. The current sample export check uses GerbCraft's parser.

Windows evidence: `test/evidence/windows/sample-comparison.json`,
`sample-outline.gbr`, `sample-tested.gcraft`, and `sample-reopened.png`.

Prepared project and report: `Sample_Gerber_Files/GerbCraft-Test-Results`.
At the 0.1.1 checkpoint drills were unsupported; 0.2.0 adds them below. X2 artwork
metadata is still omitted on Gerber export.


## Next extension: drill editor and 3D board viewer

Requested/discussed 21 October 2026. Initial implementation is complete in 0.2.0;
Windows VM acceptance passed, including the final rebuild with both layout
corrections, project reopening and PNG export. See [research and proposed design](docs/RESEARCH-PLAN.md#drill-editing-and-3d-viewer-research--21-october-2026).

- [x] Review official ZofzPCB, KiCad, Altium, Ucamco and Three.js documentation.
- [x] Inspect sample layer roles and manufacturing notes: two copper layers,
  FR4, 1.55 mm overall thickness, 35 micrometre copper, ENIG, green mask/white legend.
- [x] Improve Undo storage for larger documents before expanding editable data.
- [x] Add absolute Excellon import/export, hole/G85-slot editing and plating controls;
  output tools are regenerated by diameter. Routing/repeats/blind holes remain future scope.
- [x] Report sample discrepancies: 381 file records vs 239 stated holes (difference
  142); actual profile 190 × 163.2 mm vs nominal 190 × 163 mm. Source intent cannot
  be reconciled without corrected design/manufacturing notes. Originals preserved.
- [x] Persist Board Setup v2: role mapping, closed outline/cutouts, two-layer FR4
  thickness/copper/finish/colours; v1 projects still load. No general multilayer stackup yet.
- [x] Validate the software 3D approach in Fusion: complete sample renders in
  isometric and bottom views without GPU acceleration.
- [ ] Validate on native Windows x64 hardware; WebGL is not required by this viewer.
- [x] Implement bare-board software 3D with holes/slots, copper/mask/silkscreen
  textures; orbit/pan/zoom, standard views and PNG. Rebuilt from current edits/Undo
  when opened; close the preview to edit. Plated barrels are not modelled as solids.
- [x] Automated checks: polarity/texture coordinates, profile topology, hole/slot
  dimensions, project save/reopen and unchanged document after 3D view operations.
  Native Windows x64 and independent fabrication review remain pending.
- [ ] Later: exploded layers, transparency/section inspection and measurements.
- [ ] Later: components from placement data plus models, model export and enclosure
  review. Gerber artwork alone does not supply accurate component bodies/placement.

### 0.2.0 final verification checkpoint

- [x] 39 core/licensing tests and eight desktop tests pass.
- [x] Windows VM: add a hole, Undo/Redo and restore the original 11-layer board.
- [x] Windows Save As returned exact original project data; plated export matches
  the expected 379-hole output. See `test/evidence/windows/drills3d-comparison.json`.
- [x] Build final installer/ZIP, check packaged contents and refresh SHA-256 hashes.
- [x] Preserve prior VM working project as `pre-020-working.gcraft`.
- [x] Install `update020final.exe`, retain activation, reopen the complete
  `drills3d-tested.gcraft` and verify the corrected round-hole form and 3D layout.
- [x] Windows final-build top/bottom/isometric views and PNG export; returned
  `test/evidence/windows/drills3d-top.png` inspected on the Mac.
- [x] Preserve the user's subsequent layer-visibility changes separately as
  `working-before-final-020.gcraft` in the VM's GerbCraftBuild folder.

The final build is open in the Windows VM with the sample in isometric 3D.
Final screenshot: `test/evidence/windows/drills3d-final-isometric.png`.
The temporary private-network transfer server was stopped after verification.

## 0.2.1: perpetual access and ZIP import — 22 October 2026

Priority requested by the user. Licence administration is deferred; the default
editor build grants perpetual access without activation or expiry. The optional
signed-licence implementation and existing identity are retained.

- [x] Production perpetual mode enables saving and every export; old invalid or
  expired licence files do not restrict it. UI explains that no activation is needed.
- [x] Import ZIP files through the main Import button and File menu, including
  subfolders, common Gerber extensions and text-named Excellon files.
- [x] Report skipped supporting files; never extract archive paths to disk.
- [x] Validate archive integrity and bounded sizes; reject unsafe paths, links,
  encrypted artwork, corrupt entries and over-limit imports.
- [x] Parse the complete batch before adding layers; one-step import Undo/Redo.
- [x] Original sample ZIP: 11 layers, 12,818 objects, 381 holes, one skipped note.
- [x] 43 core/licensing/archive tests and 10 desktop tests pass.
- [x] Final 0.2.1 Windows package, dependency/notices/private-key inspection and hashes.
- [x] Install in Windows VM: perpetual badge, direct ZIP import and skipped-note
  report, one-step Undo/Redo and save verified. Returned project geometry matches
  every source layer exactly (same-parser check). Evidence: `zip021-comparison.json`.
- [x] Leave the saved ZIP-imported board open; stop temporary transfer server.

Public-release priorities remain independent CAM validation, native Windows x64
hardware, broader production boards/performance, signing and customer delivery.
Licence administration is no longer a release prerequisite for this build.

## Open-source licensing — 23 October 2026

- [x] Adopt strong copyleft through `GPL-3.0-only` for GerbCraft's original source.
- [x] Add the full licence, copyright/SPDX notices and consistent package metadata.
- [x] Explain redistribution, source availability and optional donations in README.
- [x] Preserve dependency licences and complete the bundled attribution notices.
- [x] Include the GPL text in future editor and activation-app packages.
- [x] Rebuild public binary release assets and supply their complete corresponding
  source and build instructions from the exact release commit.

## First public Windows download — 23 October 2026

- [x] Clean public checkout: dependency installation succeeds; 42 core and seven
  desktop tests pass. Four private-board checks skip as intended.
- [x] Rebuild GPL-licensed Windows x64 installer and portable ZIP from `dc4116a`.
- [x] Verify installer integrity and matching application files, GPL/dependency
  notices, perpetual configuration and exclusion of private files.
- [x] Archive matching source, build instructions and nine upstream source archives.
- [x] Publish [v0.2.1](https://github.com/SoloPlax/GerbCraft/releases/tag/v0.2.1)
  as an early pre-release with all three packages and SHA-256 checksums.
- [x] Verify uploaded file digests and add direct download links to README.
- [x] User reports the public download works in Windows 11 ARM; observe the app
  displaying the imported board (11 layers, 12,818 objects), selection/zoom and
  the perpetual-access badge. The VM display is working again.
- [ ] Complete save/reopen, export, Undo/Redo and 3D smoke checks of the public
  rebuild. Earlier 0.2.1 results remain separate; the current session was left
  available while the user worked in the VM. Native Windows x64, independent CAM
  validation and signing remain open.
