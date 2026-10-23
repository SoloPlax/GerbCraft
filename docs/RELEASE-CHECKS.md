# GerbCraft release checks

## Public Windows pre-release — 23 October 2026

[v0.2.1](https://github.com/SoloPlax/GerbCraft/releases/tag/v0.2.1) is published
with the GPL-licensed Windows x64 installer, portable ZIP, matching source ZIP and
`SHA256SUMS.txt`. Source/build commit: `dc4116ab2a6573edd685949662a0717abaabdc5c`.

A clean archive of the public repository installed its locked dependencies and
passed 42 core tests and seven desktop tests on macOS. One core and three desktop
private-board tests skipped as intended. The installer payload passed its archive
integrity test; its executable, application archive and GPL text match the portable
build. Package metadata, dependency notices, perpetual mode and exclusion of
private samples, licence files and signing keys were checked.

The source ZIP matches every tracked file at the release commit and includes nine
upstream source archives, build instructions and a source/checksum manifest.
GitHub's uploaded SHA-256 digests match all four local release files. Local evidence
is in `test/evidence/public-release-0.2.1`; final packages are in `dist/release` and
`dist/editor`. The prior local binaries are preserved under
`dist/editor/pre-gpl-0.2.1`.

The VM display recovered. After the public-download handoff, the user reported
that the app works. Live observation in Windows 11 ARM confirmed the imported
board displaying 11 layers and 12,818 objects, selection/zoom and the perpetual
access badge. The downloaded/installed files were not independently hashed in
the guest during this session. Save/reopen, export, Undo/Redo and 3D checks of
this public rebuild remain pending; the VM was left available while the user
worked. The fuller Windows 11 ARM / x64 emulation results below apply to the
prior 0.2.1 build. Native Windows x64, independent CAM validation and code signing
remain outstanding; this is an early pre-release.

## GPLv3 source release — 23 October 2026

GerbCraft's original source now uses `GPL-3.0-only`. The repository includes the
unmodified GNU GPLv3 text, copyright/SPDX notices, matching package metadata and
README terms. Both editor and activation packaging configurations include the
licence as `LICENSE-GerbCraft.txt` beside the executable.
Existing third-party notices are preserved; the vendor notice file now also
includes the splaytree MIT notice and Apache 2.0 terms for the Microsoft helper
code already embedded in polygon-clipping.

Validation: all 43 core tests pass, maintained JavaScript files pass syntax checks,
and temporary Windows x64 directory builds of both apps contain the exact GPL
text beside the executable and `GPL-3.0-only` package metadata. The editor's
packaged vendor notices match the updated source. These checks do not rebuild the
existing release installer/ZIP assets or replace Windows runtime acceptance.

At this checkpoint, the local 0.2.1 installer/ZIP files predated the update. The
public pre-release above completes these packaging steps, which also apply to
future releases:

- Rebuild from the intended GPL-licensed release commit and inspect its notices.
- Provide the complete corresponding source for that exact build alongside the
  download, including build scripts, required dependency sources and notices.
- Record the source commit and refreshed binary hashes in the release notes.

## 0.2.1 ZIP import and perpetual access — 22 October 2026

43 core/licensing/archive tests and 10 desktop tests pass. Tests cover the
original ZIP (11 layers / 12,818 objects / 381 holes), subfolders, uppercase
extensions, text-named drill files, duplicate basenames, skipped notes/metadata,
stored/deflated entries, CRC corruption, malformed/unsafe/linked/encrypted entries,
size declarations and the layer limit. Desktop tests use the real perpetual
release configuration, with no valid licence: save/reopen, Gerber export and
whole-import Undo/Redo pass. A failed archive artwork parse preserves the current
project and its prior Undo history.

The 0.2.1 Windows installer and ZIP were built. Package inspection confirms the
perpetual configuration, ZIP reader and its dependency/licence notices, with no
private keys or research/sample files. Checksums are refreshed. ZIP input is read
in memory, never extracted to filesystem paths; inputs are bounded to 100 MB ZIP,
50 MB per file, 100 MB total text, 256 layers and 4,096 archive entries.

Evidence: `test/evidence/0.2.1-core-tests.txt`, `0.2.1-desktop-tests.txt`,
`0.2.1-build.txt`, `0.2.1-package-check.json`, `zip-perpetual.png`.
The production-dependency audit reports zero findings as of this check; the
existing eight moderate build-tool findings remain separate.
Windows 11 ARM / Fusion smoke verification passed: installed 0.2.1, verified
perpetual status, imported the original ZIP (11 layers, 381 holes), saw the skipped
manufacturing note, undid/redid the entire import, and saved `zip021-tested.gcraft`.
The returned project validates and every layer's object geometry exactly matches
the source import, ignoring generated IDs. This remains a same-parser check.
Evidence: `test/evidence/windows/zip021-comparison.json`, `zip021-tested.gcraft`,
`zip021-import.png` and `zip021-saved.png`. The saved board remains open in Windows.
The temporary private-network file transfer server was stopped after verification. Public-release checks for native
Windows x64, independent CAM validation, signing and broader performance remain.

Licence administration is deferred by user request. This build includes perpetual
access without activation; the optional issuer and signed-licence implementation
are retained. Historical activation requirements below apply to 0.2.0 and earlier.
Runtime ZIP dependencies yauzl 3.4.0 and pend 1.2.0 now ship with the app; the older
statement below about no production Node dependencies describes the baseline only.

## 0.2.0 drill editor and software 3D

39 core/licensing tests and eight Electron desktop tests pass. Added tests cover
Excellon precision/units/G85, strict unsupported-input rejection, per-hole edits,
slot transforms, history independence, profile topology, overlapping drill
subtraction, mesh area, v1/v2 persistence, surface polarity, PNG and project output.
The new 3D desktop tests run with GPU acceleration disabled.

The actual 11-file sample has 12,818 objects, 381 holes, three closed profile
contours and 8,210 surface triangles. Both drill files round-trip with identical
geometry and plating using our parser. This is not independent CAM validation.
100 visibility edits on the complete board retain 100 steps using 26,002 bytes
of estimated UTF-16 history storage; all 100 Undo/Redo steps succeeded.

Evidence: `test/evidence/0.2.0-core-tests.txt`, `0.2.0-desktop-tests.txt`,
`Sample_Gerber_Files/GerbCraft-Test-Results/drill-3d-report.json`,
`3d-isometric.png`, `3d-top.png`, `3d-bottom.png` and the prepared v2 project.

Windows 11 ARM / Fusion: 0.2.0 installed and retained activation. The full board
opens in software 3D, including bottom view and cutouts. Hole addition, Undo,
Redo and restoration passed. Save As returned a project exactly equal to the
prepared original; plated drill export exactly matches the expected 379-hole
output. Evidence: `test/evidence/windows/drills3d-comparison.json`,
`drills3d-tested.gcraft`, `drills3d-PTH.drl`, `drills3d-isometric.png`.
The final rebuild is installed in the VM with activation retained. The corrected
round-hole field visibility and wide-window 3D aspect ratio were verified there,
and the complete 11-layer project reopened successfully. Top/bottom/isometric
views and PNG export passed; the returned `windows/drills3d-top.png` was inspected
on the Mac. Final screenshots: `windows/drills3d-final-hole-dialog.png` and
`windows/drills3d-final-bottom.png`, `windows/drills3d-final-isometric.png`. The user's subsequent visibility changes
were saved separately as `working-before-final-020.gcraft`. Native Windows x64 remains
unavailable for validation. 3D components, sections, STEP export, general
multilayer stackup, routed Excellon and plated barrel solids remain future work.

## 0.1.1 sample compatibility update

31 core/licensing tests and five desktop tests pass, including the supplied PCB.
Zero-diameter standard circular apertures now import, save and export without
painting phantom strokes. Nine layers and 12,437 objects pass a structural/numeric
round trip; maximum numeric difference is 0.0000005 mm. See
[full sample results](../Sample_Gerber_Files/GerbCraft-Test-Results/TEST-RESULTS.md).
Windows sample acceptance is complete: all nine layers opened and saved/reopened;
visibility, outline transformations, copy/delete and Undo/Redo passed. The returned
Windows project exactly matches the prepared original. Outline-only export contains
20 lines and four arcs, matching source structure and coordinates with zero numeric
difference using the same parser. Evidence: `test/evidence/windows/sample-comparison.json`
and `sample-reopened.png`. The 64 MB history cap retains about four steps for this
board; improving snapshot storage is tracked in PLAN.md.

Current logs in `test/evidence` describe 0.1.1; the following records the earlier
0.1.0 release acceptance.

## 0.1.0 baseline

Date: 21 October 2026. Target: Windows x64. Status: scoped core-release checks passed.

## Automated verification

- 27 core/licensing tests: four fixture round trips; arbitrary rotation; mirror
  involution and arc direction; macro arithmetic; polarity/holes; inch/trailing
  zero/incremental formats; step-repeat; curved regions; single-quadrant/full
  circles; unsupported-format rejection; three-step Undo/Redo and history branch;
  hidden/locked selection; transactional rollback; project validation; signature,
  installation binding, expiry and tamper checks.
- Four Electron integration tests: import/edit/visibility/Undo/Redo; small-display
  fit; native-bridge import/save/reopen/export; isolated Activation App identity,
  licence issuance, verification, backup and audit record.
- Independent research checker: arcs, region, macros, transform baseline and 45°
  rotation all match within 0.000002 mm. This is component comparison on small
  synthetic fixtures, not proof of arbitrary Boolean copper equivalence.
- Windows-generated export after +2.54 mm X movement: five of five independent
  components match within 0.000002 mm. Saved project validates with one layer and
  five objects. Files retained in `test/evidence/windows`.

Logs: `test/evidence/unit-tests.txt`, `ui-tests.txt`,
`independent-comparison.json`, `windows/comparison.json`.

## Actual Windows acceptance

Environment: Windows 11 Pro ARM64 in the reusable VMware Fusion research VM.
Windows x64 emulation runs the x64 application. Native x64 laptop testing remains
future validation; it has not been implied by these VM results.

Observed: installer completes; licence gate blocks saving before activation;
signed research licence activates; import displays five objects; +2.54 mm move
changes centre from 4.250 to 6.790 mm; Undo restores 4.250 and Redo restores 6.790;
Save succeeds; export succeeds; saved project reopens. Final packages include
software rendering by default after a blank VM graphics surface was diagnosed.
Both final applications then launched normally without command-line flags. The
updated editor retained activation and reopened the saved project with centre
6.790, 3.900 mm. Both downloaded installers and the installed editor app archive
match their Mac build hashes. Screenshots and checksums are in
`test/evidence/windows`. The Windows issuer is intentionally a fresh profile;
restore the existing Mac signing identity before issuing customer licences.

## Packaging and security

Both applications have Windows installers and portable ZIP packages. SHA-256
checksums are in `dist/SHA256SUMS.txt`. Explicit package file lists exclude
research artifacts, test data and private signing keys. The editor contains only
the configured public key. Missing/malformed release configuration fails closed.

Sandboxing and context isolation are enabled. Renderers have no Node access;
navigation, new windows and permission requests are denied. File operations use
narrow bridges and user-selected paths. Project saves use a temporary file plus
rename. No runtime network access is needed.

The installers are unsigned; no signing certificate or auto-update service was
configured. Executable resource editing is disabled for this cross-platform
build, so some Windows shell icons/metadata can retain Electron defaults even
though installer/window artwork is branded. Windows rendering uses software for
VM compatibility; large-board performance is not established.

The development-only dependency tree reports eight moderate audit findings in
the builder's `sprintf-js` dependency chain. No production Node dependencies are
shipped. A forced major/downgrade audit fix was not applied; reassess build-tool
updates before a public release. These are not claimed resolved.

## Explicit product limits

See README for the supported Gerber subset and unsupported constructs. Combined
layer export follows ordered polarity and may differ from the viewer's isolated
layer compositing. Export omits X2 metadata. Offline licences have no remote
revocation, seat service, hardware attestation or clock-tamper protection.

These checks establish the scoped core-editor release on synthetic fixtures.
They do not establish production-board certification or complete CAM parity.
