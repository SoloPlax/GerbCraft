# Copyright (C) 2026 SoloPlax
# SPDX-License-Identifier: GPL-3.0-only

"""Archive a committed release and the upstream sources used by its dependencies."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
# Both embedded and lockfile-resolved geometry dependency versions are retained.
UPSTREAM = [
    ("earcut-3.2.4", "mapbox/earcut", "9e70986eb94054c621c926888dd05bc26bffb902"),
    ("polygon-clipping-0.15.7", "mfogel/polygon-clipping", "25f2a460ca7bd750d958d3d83b0037a32fcf75f6"),
    ("splaytree-3.1.2", "w8r/splay-tree", "24a97e4a7309b874db8e62b2ccd50c74458620d4"),
    ("splaytree-3.2.3", "w8r/splay-tree", "0f3602340f9d7eec6c4af846126ed72249d2b0d4"),
    ("robust-predicates-3.0.2", "mourner/robust-predicates", "c20b0ab9ab4c4f2969f3611908c41ce76aa0e7a7"),
    ("robust-predicates-3.0.3", "mourner/robust-predicates", "8bed7fadb4284911e1111876e54a6f8acfa445cd"),
    ("yauzl-3.4.0", "thejoshwolfe/yauzl", "f5798e15204ffbb9a428b00217e4659684a41b0f"),
    ("pend-1.2.0", "andrewrk/node-pend", "ed57bbe8520518dca24d0c6bb847ffb6b68ae6f9"),
    ("electron-45.0.0", "electron/electron", "v45.0.0"),
]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def fetch(item):
    name, repo, ref = item
    url = f"https://codeload.github.com/{repo}/tar.gz/{ref}"
    request = urllib.request.Request(url, headers={"User-Agent": "GerbCraft-source-release"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(100_000_001)
    if len(data) > 100_000_000 or not data.startswith(b"\x1f\x8b"):
        raise ValueError(f"Invalid or oversized upstream archive: {name}")
    return name, data, {"name": name, "url": url, "ref": ref,
                        "sha256": hashlib.sha256(data).hexdigest()}


def main():
    if git("status", "--porcelain", "--untracked-files=no"):
        raise SystemExit("Commit tracked changes before packaging release source.")
    commit = git("rev-parse", "HEAD")
    version = json.loads(git("show", f"{commit}:package.json"))["version"]
    output = ROOT / "dist" / "release" / f"GerbCraft-{version}-Source.zip"
    output.parent.mkdir(parents=True, exist_ok=True)
    prefix = f"GerbCraft-{version}/"
    # Download everything before creating the final archive; no partial release on failure.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        upstream = list(pool.map(fetch, UPSTREAM))
    subprocess.run(["git", "archive", "--format=zip", f"--prefix={prefix}",
                    f"--output={output}", commit], cwd=ROOT, check=True)
    with zipfile.ZipFile(output, "a", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data, _ in upstream:
            archive.writestr(f"{prefix}vendor-sources/{name}.tar.gz", data)
        manifest = {"version": version, "commit": commit,
                    "upstream": [metadata for _, _, metadata in upstream]}
        archive.writestr(prefix + "SOURCE-MANIFEST.json", json.dumps(manifest, indent=2) + "\n")
    print(f"Created {output} from {commit}; {len(upstream)} upstream source archives.")


if __name__ == "__main__":
    main()
