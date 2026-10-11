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
Preferred Cloudflare setup: remotely managed Tunnel

1. Open Cloudflare dashboard -> Networking -> Tunnels.
2. Create/select tunnel:
     $TUNNEL_NAME
3. Add a published application:
     hostname: $HOSTNAME
     service:  http://127.0.0.1:8771
4. Protect $HOSTNAME with a Cloudflare Access self-hosted application.
5. On this Mac, run the connector installation command/token shown by
   Cloudflare for macOS.
6. Confirm the native engine itself remains loopback-only:
     curl http://127.0.0.1:8771/health
7. Confirm remote routing:
     ./scripts/verify-native-cloudflare.sh https://$HOSTNAME

Cloudflare currently recommends remotely managed Tunnels for most deployments.

Fallback for an existing locally managed Tunnel:

  cloudflared tunnel login
  cloudflared tunnel create $TUNNEL_NAME
  cp native-engine/cloudflare/config.example.yml $HOME/.cloudflared/config.yml
  # replace the UUID and username placeholders
  cloudflared tunnel route dns $TUNNEL_NAME $HOSTNAME
  cloudflared tunnel ingress validate
  cloudflared tunnel run $TUNNEL_NAME

The native engine should remain at:
  http://127.0.0.1:8771

The browser endpoint is:
  https://$HOSTNAME

No Cloudflare token or credential is written by this helper.
EOF
