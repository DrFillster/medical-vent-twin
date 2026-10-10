"""No-cache static server for hummod.defying-logic.com v1.3.

Serves only ards-twin-v1.0/web on 127.0.0.1:8770.
"""
import http.server
import os
import posixpath
import socketserver
from pathlib import Path

DENY_PREFIXES = ('/.git/', '/.env', '/.deploy/', '/.wrangler/', '/node_modules/')
PORT = int(os.environ.get('PORT', '8770'))
REPO_DIR = Path(os.environ.get(
    'REPO_DIR',
    str(Path(__file__).resolve().parents[1]),
)).expanduser().resolve()
WEB_ROOT = Path(os.environ.get(
    'WEB_ROOT',
    str(REPO_DIR / 'ards-twin-v1.0' / 'web'),
)).expanduser().resolve()

if not (WEB_ROOT / 'index.html').is_file():
    raise SystemExit(f'Refusing to serve: missing {WEB_ROOT / "index.html"}')

os.chdir(WEB_ROOT)

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        path = posixpath.normpath(self.path)
        for prefix in DENY_PREFIXES:
            if path.startswith(prefix):
                self.send_error(403, 'Forbidden by server policy')
                return
        return super().do_GET()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
    print(f'Serving {WEB_ROOT} with no-cache on 127.0.0.1:{PORT}', flush=True)
    httpd.serve_forever()
