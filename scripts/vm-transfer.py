# Copyright (C) 2026 SoloPlax
# SPDX-License-Identifier: GPL-3.0-only

"""Temporary, private-NAT-only transfer for the Windows acceptance test."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parent.parent
FILES = {
 '/editor.asar': ROOT/'dist/editor/win-unpacked/resources/app.asar',
 '/drills3d.gcraft': ROOT/'Sample_Gerber_Files/GerbCraft-Test-Results/PCB-11-23001-drills-3D.gcraft',
 '/sample.gcraft': ROOT/'Sample_Gerber_Files/GerbCraft-Test-Results/PCB-11-23001 Rev 1.gcraft',
 '/sample.zip': ROOT/'Sample_Gerber_Files/PCB-11-23001 Rev 1.zip',
 '/editor.exe': ROOT/'dist/editor/GerbCraft-0.2.1-Windows-x64.exe',
 '/activation.exe': ROOT/'dist/activation/GerbCraft-Activation-0.1.0-Windows-x64.exe',
 '/transform.gbr': ROOT/'test/fixtures/transform.gbr',
 '/rotate45.gbr': ROOT/'test/evidence/rotate45.gbr',
 '/research.gcl': ROOT/'test/evidence/windows/research.gcl',
}
OUTPUTS = {'zip021-tested.gcraft', 'drills3d-tested.gcraft', 'drills3d-top.png', 'drills3d-PTH.drl', 'installation-id.txt', 'edited.gbr', 'Board.gcraft', 'checksums.txt', 'sample-outline.gbr', 'sample-tested.gcraft'}
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  p = FILES.get(self.path)
  if not p or not p.is_file(): self.send_error(404); return
  self.send_response(200); self.send_header('Content-Length', str(p.stat().st_size)); self.end_headers()
  with p.open('rb') as f: shutil.copyfileobj(f, self.wfile)
 def do_POST(self):
  name = self.path.removeprefix('/')
  size = int(self.headers.get('Content-Length', '0'))
  if name not in OUTPUTS or not 0 < size <= 50000000: self.send_error(400); return
  (ROOT/'test/evidence/windows'/name).write_bytes(self.rfile.read(size))
  self.send_response(204); self.end_headers()
ThreadingHTTPServer(('172.16.215.1', 8765), Handler).serve_forever()
