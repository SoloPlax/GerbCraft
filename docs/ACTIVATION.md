# GerbCraft Activation

The editor and activation-app source are licensed under `GPL-3.0-only`; see
[LICENSE](../LICENSE). This document describes an optional activation mechanism,
not a restriction on the rights granted by GPLv3. Recipients may modify the source,
including that mechanism, and redistribute it subject to the GPL terms. A future
activation setting cannot revoke the rights already granted for GPL releases.

## Current default: perpetual access (0.2.1)

The editor now includes perpetual access: no licence file, activation or expiry is
required for editing, saving, Gerber/drill export or PNG export. Existing licence
files are retained but do not restrict this build. The release configuration uses
`mode: "perpetual"`; this is a release mode, not a development override.

Licence administration is deferred. The signed-licence implementation and issuer
remain available for a future licensed build, but restoring or using the issuer is
not required for this release. The following documents that optional workflow.

The editor and the private administrator app are separate Windows applications.
Only the editor is intended for customers. Both can work without internet access.

## Current signing identity

This release embeds the public key from:
`/Users/solomonsmit/Library/Application Support/GerbCraft Activation/issuer-public.pem`.

The matching private key is stored in that same folder as `issuer-private.pem`,
outside GerbCraft source and release packages. On this Mac, `npm run activation`
opens the administrator app using that identity. **Back up private key** exports
it to a location you choose. Keep that backup secure: it permits licence issuance.
Do not distribute it with the editor or commit it to source control.

To use the Windows Activation App for this release, choose **Restore identity**
in a fresh administrator profile and select a securely transferred backup of
this existing identity. Creating a different identity will issue licences that
this already-built editor cannot verify. New identities require rebuilding the
editor with their public key in `build/license-config.json`.

## Issue and install a licence

1. In the editor, open Activation and copy its installation code.
2. In the administrator app, enter the customer name and installation code.
3. Choose perpetual access or an expiry date (valid through 23:59:59 UTC).
4. Choose **Create licence file** and send the resulting `.gcl` to that customer.
5. In the editor, choose **Import licence file** and select it.

The app records issuance in `issuance-log.jsonl` beside the administrator key.
Signed payloads bind the product, edition, customer, installation code and expiry.
An invalid, modified, expired or differently bound licence cannot enable saving
or exporting. Viewing and temporary editing remain available without activation.

## Recovery and limits

Windows editor data is under `%APPDATA%\GerbCraft`; administrator data is under
`%APPDATA%\GerbCraft Activation`. Preserve the editor's `installation-id` and
`license.gcl` when recovering that installation. A new installation code needs a
new licence. Private key restore refuses to overwrite an existing identity.

This initial design binds to an installation ID, not tamper-resistant hardware.
It has no online account, payment service, activation counter or remote revocation.
Copying the profile can copy its identity; local system time controls expiry.
A transfer is a new licence issuance, and the old offline licence cannot be
remotely invalidated. Choose a future online licensing policy before requiring
seat enforcement or automated customer self-service.
