#!/bin/sh
set -eu

HOSTNAME="${1:-engine.hummod.defying-logic.com}"
TUNNEL_NAME="${2:-medical-vent-twin-native}"

if [ "$(uname -s)" != "Darwin" ]; then
  printf '%s\n' "This helper is for macOS." >&2
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  printf '%s\n' "cloudflared is not installed."
  printf '%s\n' "Install it first with: brew install cloudflared"
  exit 1
fi

cat <<EOF
This helper intentionally does not create credentials automatically.

One-time Cloudflare steps:

  cloudflared tunnel login
  cloudflared tunnel create $TUNNEL_NAME
  cloudflared tunnel list

Then:

1. Copy:
     native-engine/cloudflare/config.example.yml
   to:
     $HOME/.cloudflared/config.yml

2. Replace <TUNNEL_UUID> and <MAC_USERNAME>.

3. Create DNS:
     cloudflared tunnel route dns $TUNNEL_NAME $HOSTNAME

4. Validate ingress:
     cloudflared tunnel ingress validate

5. Test interactively:
     cloudflared tunnel run $TUNNEL_NAME

6. When confirmed, install cloudflared as a login service:
     cloudflared service install

The native engine should remain at:
  http://127.0.0.1:8771

Browser config:
  window.MEDICAL_TWIN_NATIVE_ENGINE_URL = 'https://$HOSTNAME';
EOF
