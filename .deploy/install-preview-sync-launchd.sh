#!/bin/bash
set -eu

REPO="$(git rev-parse --show-toplevel)"
SCRIPT="$REPO/.deploy/sync-main-preview.sh"
LABEL="com.defyinglogic.hummod-preview-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGDIR="$REPO/.deploy/logs"

if [ "$(git -C "$REPO" branch --show-current)" != "main" ]; then
  echo "Run this installer from the main deployment checkout." >&2
  exit 2
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOGDIR"
chmod +x "$SCRIPT"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCRIPT</string>
    <string>$REPO</string>
  </array>
  <key>StartInterval</key>
  <integer>30</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOGDIR/preview-sync.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOGDIR/preview-sync.err.log</string>
</dict>
</plist>
PLIST

uid="$(id -u)"
launchctl bootout "gui/$uid/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$uid" "$PLIST"
launchctl kickstart -k "gui/$uid/$LABEL"

echo "Installed $LABEL"
echo "Repository: $REPO"
echo "Interval: 30 seconds"
echo "Logs: $LOGDIR"
