#!/usr/bin/env python3
# Renders the synthesized sound effects to WAV files with Firefox's real Web Audio engine (headless).
# Usage: python3 tools/render_sounds.py <output directory>
# tools/render-sounds.html renders each effect in an OfflineAudioContext, POSTs it to /save/<name>.wav,
# then POSTs /done. Fails if a sound is silent (peak 0) or clips (peak >= 1).
import http.server, os, socketserver, subprocess, sys, threading, urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.abspath(sys.argv[1])
# Snap Firefox can only write inside ~/snap/firefox/common/.
PROFILE = os.path.expanduser('~/snap/firefox/common/two-dragons-render')
os.makedirs(OUT, exist_ok=True)
os.makedirs(PROFILE, exist_ok=True)
done, saved, bad = threading.Event(), [], []


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        url = urllib.parse.urlparse(self.path)
        if url.path.startswith('/save/'):
            name = os.path.basename(url.path[6:])
            q = urllib.parse.parse_qs(url.query)
            peak, seconds = float(q['peak'][0]), q['seconds'][0]
            with open(os.path.join(OUT, name), 'wb') as f:
                f.write(body)
            saved.append(f'  {name:12} peak {peak:.3f}  {seconds} s  {len(body) // 1024} KB')
            if not 0 < peak < 1:
                bad.append(name)
        elif url.path == '/done':
            done.set()
        else:
            print(body.decode(errors='replace'))
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass


srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{srv.server_address[1]}/tools/render-sounds.html'
ff = subprocess.Popen(['firefox', '--headless', '--no-remote', '--profile', PROFILE, url],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ok = done.wait(120)
ff.terminate()
srv.shutdown()
print('\n'.join(saved))
if not ok or not saved:
    sys.exit('Sound rendering failed (headless Firefox)')
if bad:
    sys.exit('Silent or clipping sounds: ' + ', '.join(bad))
