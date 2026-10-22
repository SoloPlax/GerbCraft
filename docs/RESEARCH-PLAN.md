# GerbCraft investigation and implementation plan

Updated: 21 October 2026

## Objective

Understand ViewMate Essentials' Gerber viewing and editing workflows through
repeatable runtime tests and focused REA/Ghidra analysis, then use the resulting
behaviour specification to design and implement GerbCraft. Proposed first scope:
Gerber import, layer viewing, selection, basic editing, undo/redo, and Gerber export.
GerbCraft's implementation and technology choices have not yet been decided.

## Completed

- [x] Clone REA and configure its reusable environment outside GerbCraft.
- [x] Install Ghidra and Java; verify REA/Ghidra with a decompilation smoke test.
- [x] Identify and extract ViewMate Essentials 12.2.1; inventory its packaged help.
- [x] Establish that the main editor is x86 mixed native C++/CLI code.
- [x] Install VMware Fusion and Windows 11 Pro ARM64 outside GerbCraft.
- [x] Configure local admin, VMware Tools, networking, and Windows updates.
- [x] Install and activate ViewMate; verify that the editor opens.
- [x] Import a generated Gerber with three pads and two tracks.
- [x] Move the layer by +100 mil X and +50 mil Y; save a native job.
- [x] Export metric RS-274X and reimport into a fresh job.
- [x] Check exported coordinates: maximum error per coordinate 0.00001 mm.
- [x] Preserve clean Windows and tested ViewMate snapshots.
- [x] Retain 11 Gerber exports and two native jobs on Mac; verify source/destination hashes.
- [x] Test individual-pad move, copy and delete, with exported before/after Undo states.
- [x] Verify hidden layers are omitted from Combined export and restored visibility preserves geometry.
- [x] Compare the two small fixtures numerically; observed maximum deviation 0.00001 mm.
- [x] Test CW/CCW arcs, an L region and a multi-primitive aperture macro; exported
  geometry matches within 0.00002 mm for these fixtures.
- [x] Test 90° rotation and both mirror directions, with Undo. Five-component
  comparisons pass within 0.000025 mm; transform centre is inferred from bounds.
- [x] Test 45° rotation and reimport. Rectangle orientation rotates, but circles
  become 360-vertex macros. Full swept-geometry equivalence remains unverified.
- [x] Test three-step group Undo: move five, copy five, delete ten; Undo restores
  each stage and returns exactly to the earlier exported baseline geometry.
- [x] Reopen the retained two-layer native job and verify all seven exported
  components exactly match its earlier combined export.
- [x] Retain 15 additional Gerber exports and four fixtures on Mac; all 19
  guest/host SHA-256 comparisons match.

This establishes a working research environment, a basic round trip, and the
scoped individual-edit/Undo and two-layer visibility tests.
It does not establish comprehensive application compatibility or behaviour.

## Next: core feature map and focused code investigation

- [x] Build a feature/evidence matrix from the existing help inventory and UI.
  Start with import, coordinate interpretation, apertures, layer visibility,
  selection, edit commands, undo/redo, and export.
- [x] Mark each capability as documented, observed, inferred, or untested.
  Shared help and bundled components alone do not establish edition entitlement.
- [x] Locate the relevant managed classes, native routines, and UI command paths
  with REA/Ghidra. Trace a narrow workflow first: import -> layer displacement
  -> export. Record symbol/address references, Evidence IDs, and unknowns.
- [ ] Identify the geometry representation, coordinate precision, and ownership
  of transforms/export where the available evidence supports those conclusions.

Deliverable: a feature map and a sourced explanation of the first workflow,
with explicit gaps for the next runtime pass. Do not decompile the entire
application indiscriminately.

First pass completed: [19-feature map](/Users/solomonsmit/develop/research/viewmate-essentials/CORE-FEATURE-MAP.md) and
[code findings](/Users/solomonsmit/develop/research/viewmate-essentials/CORE-WORKFLOW-ANALYSIS.md).
Located import/export dialogs, reader dispatch, coordinate rounding, layer
displacement and element mutation, and Gerber format-header output. The
[native follow-up](/Users/solomonsmit/develop/research/viewmate-essentials/NATIVE-FOLLOWUP-ANALYSIS.md)
connects accepted import to the reader and export command to geometry traversal,
layer/category predicates, ordinary flashes/strokes and coordinate formatting.
Exact physical coordinate scale, complete record layouts and advanced emission
branches remain open.
REA evidence and a snapshot are saved; the native session is closed.

Second runtime pass completed: [results and saved exports](/Users/solomonsmit/develop/research/viewmate-essentials/runtime-test/pass2/TEST-RESULTS.md).
Single-pad move/copy/delete and their Undo results passed numerical comparisons.
Hidden layers disappeared from Combined export; restoring visibility recovered
the original combined geometry. Source and destination hashes match.

Third runtime pass completed: [advanced results](/Users/solomonsmit/develop/research/viewmate-essentials/runtime-test/pass3/TEST-RESULTS.md).
Arcs, regions, macros, 90°/45° rotation, both mirrors and three-step group Undo
were exercised. The 45° export polygonizes circular apertures; positions and
rectangle orientation were checked separately, without certifying full copper
equivalence. The older help's rotation limitation does not describe this tested
case. Native-job reopening also passes. No Redo entry was visible in the Edit
menu; alternate mechanisms and history memory limits remain untested.

Next research pass: polarity/clear geometry, holes and curved regions,
parameterized macros, unit/zero-omission/incremental formats, element/selection
visibility filters and independent-reader validation of transformed output.
Focus further REA work on questions these tests expose. Do not infer general
precision from these small fixtures.

## Then: broaden the runtime evidence

- [ ] Extend synthetic fixtures to units/zero omission, aperture shapes and
  macros, arcs, regions, polarity, and multiple layers.
  Arcs, one straight region, a constant dark macro and multiple layers are now
  covered; this broader item remains open for formats and polarity.
- [x] Test selecting, moving, copying, deleting, rotating, and mirroring elements;
  inspect Undo and whole-layer visibility effects on export for the scoped fixtures.
- [ ] Resolve Redo availability, history memory limits, and element/selection
  visibility effects on export.
- [x] Retain the current fixtures and exported files with hashes on the Mac,
  alongside action logs and screenshots. See runtime-test/pass2 and pass3 for exact bytes.
  Continue this evidence capture for future fixtures.
- [x] Compare current simple-fixture geometry numerically with explicit tolerance;
  separate exporter reordering/formatting from geometric changes. Expand the
  checker or use an appropriate independent reference for future geometry types.

Deliverable: a repeatable fixture corpus and behaviour specification for the
proposed GerbCraft core. Drill, DXF, ODB++, SmartDFM, Layer Organizer, panelisation,
and other advanced features remain later scope unless priorities change.

## Then: design and implement GerbCraft

- [ ] Build our own GerbCraft Activation App. User requirement recorded on
  21 October 2026. Define licence issuance, activation/deactivation, device
  transfers, offline use and recovery during product design; scope and policy
  are still to be decided. This is a GerbCraft product component.
- [ ] Define the first usable version from the verified core feature map.
- [ ] Decide architecture and technology: geometry model, parser, renderer,
  selection/edit commands, undo history, and export.
- [ ] Implement a small end-to-end version: import -> display -> select/move
  -> undo/redo -> export -> reimport.
- [ ] Expand supported geometry and editing operations using the fixture corpus.

Completion criterion: the agreed fixture set passes import, rendering, editing,
undo/redo, and geometry-preserving export checks, with unsupported cases explicit.

## Reusable locations and evidence

- REA source: `/Users/solomonsmit/develop/tools/rea`
- Environment helper: `/Users/solomonsmit/develop/tools/rea-env.sh`
- Ghidra: `/Users/solomonsmit/develop/tools/ghidra_12.1.4_PUBLIC`
- ViewMate research: `/Users/solomonsmit/develop/research/viewmate-essentials`
- [Investigation index](/Users/solomonsmit/develop/research/viewmate-essentials/evidence/investigation-index.json)
- [Runtime test report](/Users/solomonsmit/develop/research/viewmate-essentials/runtime-test/Test-Results.txt)
- VM: `/Users/solomonsmit/Virtual Machines/Windows 11 ARM - Research.vmwarevm`
- [VM reuse guide](</Users/solomonsmit/Virtual Machines/Setup/Research-VM-Guide.txt>)

Snapshots:

1. `Clean Windows 11 ARM - 2026-10-21` — powered-off Windows baseline.
2. `ViewMate 12.2.1 - Tested - 2026-10-21` — installed, activated, tested editor.

Windows activation remains outstanding. ViewMate licence type and expiry were
not inspected. These do not erase the completed observations; a future runtime
session depends on the application continuing to accept its licence.


## Drill editing and 3D viewer research — 21 October 2026

Status: documentation research and local sample inspection completed. This section
is a new product proposal; it does not claim these features are implemented. The
current delivery status is maintained in [PLAN.md](../PLAN.md); the earlier
ViewMate investigation checklist above is historical.

### What other tools do

| Reference | Documented approach | Application to GerbCraft |
| --- | --- | --- |
| [ZofzPCB Gerber Viewer](https://www.zofzpcb.com/Gerber-Viewer) and [manual](https://www.zofzpcb.com/help) | Assigns Gerber/drill files to a stackup with layer functions, thicknesses, drill spans and plating. Resolves positive/negative artwork into polygons and triangulates for display. Saves the setup for reuse. | Closest input workflow to ours: identify file roles, let users correct them, then construct a board from fabrication data. |
| [KiCad 10 PCB Editor: 3D Viewer](https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html#_3d_viewer) | Offers standard viewpoints, visibility/color controls, saved views, image export and optional raytracing. Footprints can reference external 3D models. | Use familiar navigation and a shared board model; treat component bodies as additional data. |
| [Altium: Controlling the 3D View](https://www.altium.com/documentation/altium-designer/pcb/3d-view) | Provides 2D/3D switching, perspective/orthographic projection, layer transparency, exaggerated thickness and section planes. | Add inspection controls gradually; mark exaggerated spacing explicitly and keep physical measurements unscaled. |
| [Ucamco Gerber Job](https://www.ucamco.com/en/gerber/gerber-job-file) | Carries fabrication information including thickness, finish and materials alongside image files. | Prefer supplied job metadata over guessed thickness or material; retain editable provenance when values come from notes or user input. |

These are vendor-documentation findings, not hands-on verification of those tools
in our VM. No customer files were uploaded to a web viewer.

### What the supplied board gives us

The nine Gerbers represent two copper layers plus front/back solder mask,
front/back paste, front/back silkscreen and the profile. Their X2 FileFunction
attributes identify these roles. Nine artwork files must not become nine copper
layers in the physical stackup.

The local `MI-11-23001 Rev 1.txt` manufacturing notes specify FR4, 1.55 mm overall
board thickness, 35 micrometre copper on each side, ENIG, green solder mask and
white silkscreen. Use these as documented inputs; exact mask, finish and dielectric
thicknesses are not provided. Do not add copper thickness twice when interpreting
the overall board thickness. Render any unresolved material thickness as a stated
preview assumption, not a manufacturing measurement.

A simple inspection counts 379 explicit XY drill records in the plated file and
two in the non-plated file, with ten plated tools (0.2–3.18 mm) and one 2.8 mm
non-plated tool. The notes instead list 239 pad/via holes. Reconcile this discrepancy
in the drill-import report; do not silently change the supplied records to match
notes. These counts are file inspection, not a completed drill parser test.
No assembly placement file or component model files are present in this sample.

### Proposed delivery sequence

1. Improve Undo storage for large documents, then add a distinct drill model:
   tool diameter, position, plating, layer span, and slots. Import/export Excellon;
   add/move/copy/delete holes, change sizes, and support Undo/Redo. Use explicit
   format settings when units/zero suppression are ambiguous. Preserve tool and
   plating semantics; changing a selected hole should not unintentionally change
   every hole using that tool. Hole edits must not silently rewrite copper pads.
2. Add Board Setup: map artwork roles, choose profile/cutouts, establish stackup,
   material, thickness and appearance. Prefer X2 attributes, then filename hints,
   then user correction. Save the confirmed setup and drill data in a versioned
   project format with migration from existing projects.
3. Deliver a bare-board 3D viewer: extruded outline and internal cutouts, drilled
   holes and slots, correct top/bottom copper, mask openings and silkscreen; orbit,
   pan, zoom, fit, top/bottom/isometric views and image export. Changes and Undo in
   2D update the preview from the same document; the camera does not modify artwork.
   Default to the physical bare board with paste hidden. Preview hole plating only
   when known; plated-hole input may describe a finished hole rather than drill-bit
   size, so barrel thickness must not be invented as a measured fact.
4. Add inspection features: exploded stack, transparency, section view, synchronized
   selection and measurements. Keep temporary 3D visibility independent of fabrication
   export scope. Label exaggerated layer spacing and other visual aids clearly.
5. Add assembled-board viewing when placement/rotation/side data and component
   models are available. BOM identifiers alone cannot place an accurate model.
   Model export (GLB/STEP), enclosure checks and photorealistic rendering are later
   scope with separate geometric validation; a display mesh is not automatically
   an engineering STEP model.

### Technical feasibility and checks

Proposed renderer candidate: locally bundled Three.js in the existing Electron
application. [ExtrudeGeometry](https://threejs.org/docs/pages/ExtrudeGeometry.html)
provides shape extrusion; the current
[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer) requires WebGL 2.
This is a candidate, not a selected or installed dependency.

First perform a graphics feasibility check: the current Windows build explicitly
disables hardware acceleration because Fusion previously showed a blank surface.
Verify WebGL 2 context creation and representative board performance under this
configuration and on native Windows x64. If unavailable, preserve the working 2D
editor and explain that 3D is unavailable; any renderer/startup changes require
regression testing of the original blank-window problem. Do not assume that a
Three.js dependency alone solves VM graphics compatibility.

Geometry work is separate from the renderer: stitch the profile's line/arc
centre paths into closed contours, classify nested cutouts, subtract drill/slot
shapes, and resolve ordered dark/clear artwork per physical layer. Do not extrude
an outline stroke as the substrate boundary. Reject or identify open/self-crossing
profiles instead of silently filling an arbitrary rectangle. Use a documented
curve tessellation tolerance and retain exact source geometry for 2D edits/export.
A surface-texture approach may be suitable for the first preview, but it must
preserve polarity, mask openings, holes, bottom-side orientation and adequate
resolution; it cannot substantiate precise 3D clearance or connectivity claims.

Acceptance on this sample: correct two-copper-layer mapping; 1.55 mm overall
thickness; profile/cutouts preserved; drill counts and diameters reconciled; mask
openings and tented vias checked; readable top/bottom orientation; live add/move/
delete-hole and Undo updates; save/reopen retains setup; switching views does not
change Gerber/drill exports. Add synthetic slots, non-plated/plated holes, internal
cutouts and multilayer fixtures, then compare with an independent viewer. Native
Windows x64 and the Fusion ARM VM are separate acceptance environments.


### Implemented first slice — 0.2.0

The first 3D renderer uses local polygon clipping/triangulation and a software
triangle depth buffer presented in Canvas 2D. This avoids a WebGL dependency in
the existing Windows software-rendering environment. Each physical surface is
composited separately with ordered dark/clear polarity; the bottom uses the same
world coordinates and is viewed from below. Geometry is built from centre paths,
cutouts and the union of drill voids. Exact Gerber geometry is unchanged.

Libraries: [Earcut](https://github.com/mapbox/earcut) 3.2.4 (ISC) and
[polygon-clipping](https://github.com/mfogel/polygon-clipping) 0.15.7 (MIT), bundled
locally with notices. Excellon TZ/LZ interpretation and G85 behaviour were checked
against [KiCad's format reader documentation](https://docs.kicad.org/doxygen/excellon__read__drill__file_8cpp_source.html).
The implementation is independent; no KiCad application source was copied.

The initial preview is a separate modal rebuilt on opening after edits/Undo,
with standard views, orbit, pan, zoom and PNG. It does not yet provide concurrent
2D/3D editing, component bodies, physical copper/plating solids, multilayer
stackups, sections, exploded views or engineering clearance checks.
