# Using GerbCraft

## Open artwork

Choose **Import Gerber / ZIP** and select ZIP archives or individual Gerber/drill
files. Each artwork file becomes a layer. ZIP subfolders are included; recognised
Gerber/drill extensions and identifiable artwork in `.txt`, `.dat` or extensionless
files are read. Supporting documents and Mac metadata are skipped and listed.
If a supported artwork file is invalid, the whole batch is rejected. Undo removes
the whole import; Redo restores it. Archives are read in memory without extracting
files onto your disk. Password-protected and nested ZIP archives are unsupported.
Import is transactional: if any selected file is unsupported or invalid, none
of that batch is added. The current limit is 256 layers, 200,000 objects, and
50 MB per input file/project. ZIP files and total imported text are limited to
100 MB, with at most 4,096 archive entries. Large drawings can be slow; these are limits,
not performance guarantees.

Use the layer checkbox to show/hide artwork and the diamond to lock/unlock it.
Click a layer to make it active. Double-click or right-click a layer for its
name, colour and removal controls. Hidden or locked objects cannot be edited.

## Navigate and select

- Scroll to zoom around the pointer; **Fit board** fits visible artwork.
- Use Pan, hold Alt, or drag with the middle mouse button to pan.
- In Select mode, click an object; Shift-click adds/removes it.
- Drag a box to select fully enclosed objects. **Select all** selects visible,
  unlocked objects. **Clear** clears selection.
- Measure mode reports the straight-line distance between two clicked points.
- Grid and unit controls change the display. Grid does not snap movement.

## Edit precisely

The inspector shows selection count and bounds. Enter X/Y offsets, then choose
**Move** or **Copy**. Enter an angle and choose **Rotate**. Choose selection centre
or origin as the transform pivot. Selection centre means the centre of its
rendered bounding box. Flip left/right reflects X; flip up/down reflects Y.
Circular apertures remain circular through rotation. Delete removes selected objects.

Undo and Redo cover geometry and layer changes. A new change after Undo clears
Redo. History is limited to 100 steps or 64 MB and is not saved in project files.
Layer removal can be undone. Import/open actions and unsupported cases report
errors without replacing the current drawing unexpectedly.

## Save and export

Version 0.2.1 includes perpetual access. No activation or licence file is needed.

**Save project** writes `.gcraft` with all layers, visibility, locks and geometry.
Double-click the project title to rename it. Closing or opening another project
asks before discarding unsaved changes.

**Export Gerber** offers visible layers, active layer or selected objects.
Export one file per physical PCB layer for manufacturing. Combining layers is an
ordered overlay: clear artwork from a later layer can erase earlier artwork in
the combined Gerber, although the viewer isolates clear polarity within each
layer. The export dialogue warns about this distinction.

Output uses millimetres and 6.6 coordinates. Existing X2 file/object/aperture
attributes are not reproduced. Curved geometry remains arcs; transformed
non-circular apertures become aperture macros. Open the exported file in an
independent viewer and check the intended physical-layer separation before use.

## Windows shortcuts

Use the File/Edit/View menus to see assigned shortcuts. Standard Ctrl+O opens a
project, Ctrl+S saves, Ctrl+Z undoes and Ctrl+Y redoes; Ctrl+A selects all
eligible objects. While editing a text field, text editing takes priority.


## Drill holes and slots (0.2)

**Import Gerber / ZIP** also accepts `.drl`, `.xln` and `.exc` Excellon files. Each drill
file becomes a separate drill layer. Supported input is absolute, metric/inch,
explicit decimal or declared fixed precision, with round holes and G85 slots.
For implied decimals, a format declaration is required; the importer does not
guess a scale. Excellon TZ includes trailing zeros and LZ includes leading zeros.
Routing, repeat and incremental commands are rejected. Only through holes on a
two-copper-layer board are currently supported.

Scroll down the inspector to **Drills & Board**. **Add hole / slot** creates a
hole on a visible, unlocked drill layer or a new layer. Coordinates and diameter
in these forms are always mm. A slot uses the two semicircle centres as endpoints;
its overall length is the endpoint distance plus its width.

Hide artwork to select holes easily. **Edit drills** changes diameter and plating
for the selected holes only; selecting one also allows position and slot endpoint
editing. Move, Copy, Rotate, mirrors, Delete and Undo/Redo work on holes and slots.
Changing holes does not automatically resize, move or add copper pads.

**Export drills** selects an active layer, selected drills or all drill layers
(including hidden), then a plating class. Export PTH and NPTH into separate files.
Unspecified plating must be resolved first. Tool numbers are regenerated by
diameter. The output uses explicit decimal mm, six decimal places, and retains
plating/span metadata. Export Gerber rejects drill objects rather than silently
converting them into artwork; hide drills or choose an artwork layer.

## Board setup and 3D preview (0.2)

**Board setup** records the physical layer roles, overall thickness, copper
thickness per side, FR4 material, finish and display colours in the project.
Initial layer roles come from X2 attributes, then recognised filenames; defaults
must be checked against the fabrication notes. Exactly one line/arc outline layer
is required. Nested closed contours become cutouts. Paste and unrelated layers
are ignored. Thickness defaults to 1.6 mm unless changed.

**3D preview** reconstructs the current document whenever opened, including edits
and Undo. Close it to return to editing, then reopen it to see the result. Top,
Bottom and Isometric/Fit choose standard views. Drag to orbit, scroll to zoom,
Shift-drag to pan and **Save image** exports a PNG. View controls do not change
2D layer visibility or export scope. Hidden drill layers still cut physical holes
when assigned the drill role in Board setup.

The orthographic software renderer works without WebGL. It shows physical board
thickness and actual cutouts/through holes, with top/bottom surface artwork.
Copper, mask and finish are surface textures; copper and plated barrel thickness
are recorded or indicated but are not separate solids. No component bodies,
exploded layers, sections, clearance analysis or STEP export are provided yet.
Colours are illustrative, and tiny features are limited by texture resolution.
Arcs are tessellated at up to 0.005 mm chord error for preview only. Profile
endpoints within 0.001 mm are stitched for preview; larger gaps, branches and
crossing/touching contours fail with an error. Original artwork remains exact.
The preview supports up to 5,000 drill objects and bounded outline complexity.

Projects with drills or board setup use format version 2. Older version 1 projects
still load. Keep the older original when saving a v2 project: 0.1.x cannot open v2.
