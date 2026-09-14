#!/bin/bash
# Local launcher for the medical-vent-twin app.
# Binds to 127.0.0.1 only — not exposed on LAN.
# Public access via Cloudflare tunnel: vent.defying-logic.com → localhost:8770
cd "$(dirname "$0")"
exec python3 -m http.server 8770 --bind 127.0.0.1 --directory .