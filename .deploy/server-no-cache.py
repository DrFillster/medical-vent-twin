"""No-cache wrapper for python -m http.server, used at port 8770 to serve vent.defying-logic.com.

Cloudflare's default cache-control caches responses for 4h by default. This script
sends Cache-Control: no-store so Cloudflare re-fetches from origin on every request,
which matches the development cadence of this site.
"""
import http.server, socketserver

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

PORT = 8770
with socketserver.TCPServer(('127.0.0.1', PORT), NoCacheHandler) as httpd:
    print(f'Serving with no-cache on 127.0.0.1:{PORT}', flush=True)
    httpd.serve_forever()
