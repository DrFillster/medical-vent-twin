"""No-cache wrapper for python -m http.server, used at port 8770 to serve vent.defying-logic.com.

Adds:
  - Cache-Control: no-store (so Cloudflare doesn't cache stale content for 4h)
  - 403 Forbidden on paths that start with a dot (.git, .env, .htaccess, etc.)
    to block accidental exposure of repository metadata.

Run from the directory you want to serve. Default: ~/medical-vent-twin.
"""
import http.server, socketserver, posixpath, os

DENY_PREFIXES = ('/.git/', '/.env', '/.deploy/', '/.wrangler/', '/node_modules/')

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

PORT = 8770
with socketserver.TCPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
    print(f'Serving with no-cache + dotfile-deny on 127.0.0.1:{PORT}', flush=True)
    httpd.serve_forever()
