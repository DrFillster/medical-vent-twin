#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/medical-vent-twin}"
LABEL="com.defyinglogic.hummod-v15-server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SERVER="$REPO_DIR/.deploy/server-no-cache.py"
LOG_DIR="$HOME/Library/Logs"

test -f "$SERVER"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>$SERVER</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>REPO_DIR</key>
    <string>$REPO_DIR</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/hummod-v15-server.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/hummod-v15-server.err.log</string>
</dict>
</plist>
PLIST

if grep -q '<key>WEB_ROOT</key>' "$PLIST"; then
  echo "v15-server-repair: refusing; WEB_ROOT override remains in plist" >&2
  exit 2
fi

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "v15-server-repair: restarted $LABEL"
echo "v15-server-repair: origin=http://127.0.0.1:8770/"
