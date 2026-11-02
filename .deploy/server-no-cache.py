"""No-cache static server for hummod.defying-logic.com v1.5.

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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def parse_request(self):
        if not super().parse_request():
            return False
        host = self.headers.get('Host', '').split(':')[0].lower()
        self.directory = str(
            Path('/Users/philipbernard/Sites/vent-v1.0-frozen-20261014')
            if host == 'vent.defying-logic.com' else WEB_ROOT
        )
        return True

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        host = self.headers.get('Host', '').split(':')[0].lower()
        legacy_prefix = '/ards-twin-v1.0/web'
        if host == 'hummod.defying-logic.com' and (
            self.path == legacy_prefix
            or self.path.startswith(legacy_prefix + '/')
            or self.path.startswith(legacy_prefix + '?')
        ):
            target = self.path[len(legacy_prefix):]
            if not target.startswith('/'):
                target = '/' + target
            self.send_response(307)
            self.send_header('Location', target)
            self.end_headers()
            return
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
