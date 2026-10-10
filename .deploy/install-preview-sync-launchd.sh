#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/medical-vent-twin}"
SYNC_LABEL="com.defyinglogic.hummod-preview-sync"
SERVER_LABEL="com.defyinglogic.hummod-v13-server"
PLIST="$HOME/Library/LaunchAgents/$SYNC_LABEL.plist"
SERVER_PLIST="$HOME/Library/LaunchAgents/$SERVER_LABEL.plist"
LOG_DIR="$HOME/Library/Logs"
SYNC="$REPO_DIR/.deploy/preview-sync-main.sh"
SERVER="$REPO_DIR/.deploy/server-no-cache.py"

test -f "$SYNC"
test -f "$SERVER"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
chmod +x "$SYNC"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$SYNC_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SYNC</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>REPO_DIR</key>
    <string>$REPO_DIR</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key>
  <integer>30</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/hummod-preview-sync.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/hummod-preview-sync.err.log</string>
</dict>
</plist>
PLIST

cat > "$SERVER_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$SERVER_LABEL</string>
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
  <string>$LOG_DIR/hummod-v13-server.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/hummod-v13-server.err.log</string>
</dict>
</plist>
PLIST

for spec in "$SYNC_LABEL:$PLIST" "$SERVER_LABEL:$SERVER_PLIST"; do
  label="${spec%%:*}"
  plist="${spec#*:}"
  launchctl bootout "gui/$(id -u)" "$plist" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$plist"
  launchctl kickstart -k "gui/$(id -u)/$label"
done

echo "Installed $SYNC_LABEL and $SERVER_LABEL"
echo "Repo: $REPO_DIR"
echo "Origin: http://127.0.0.1:8770/"
