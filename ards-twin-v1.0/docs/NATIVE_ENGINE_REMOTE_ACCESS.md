# Remote browser access to the native Mac engine

The native engine does **not** have to be used only from a browser running on
the Mac.

Recommended topology:

```
remote browser
     |
     | HTTPS
     v
authenticated tunnel / reverse proxy
     |
     v
Mac:127.0.0.1:8771
native physiology engine
```

## Preferred approach

Keep the engine bound to `127.0.0.1` and expose it through an authenticated
tunnel or reverse proxy.

For this project, a Cloudflare Tunnel is the natural first choice because the
existing application already uses the defying-logic.com domain.

Possible split:

```
https://hummod.defying-logic.com        -> browser UI
https://engine.hummod.defying-logic.com -> Mac 127.0.0.1:8771
```

or route both behind one origin so the browser calls:

```
https://hummod.defying-logic.com/api/native/...
```

The second design is preferable long term because it avoids cross-origin
configuration and gives the simulator one public origin.

## Do not start with router port forwarding

Router/NAT port forwarding would technically work if the Mac listens on a LAN
interface, but it exposes the service directly to the Internet and creates
additional TLS, authentication, firewall, and dynamic-IP work.

It is unnecessary when an outbound tunnel can connect the Mac to the public
hostname without opening an inbound router port.

## Network failure behavior

The bedside UI must treat native-engine connectivity as an explicit state:

- connected;
- reconnecting;
- unavailable;
- stale state.

It must never silently continue to display stale native physiology as current.

## Authentication

Before remote control endpoints are added, the public path must require
authentication. Read-only health/state exposure is not authorization to add
remote ventilator or scenario-control commands.

## Current status

The native service is boundary-only and has no physiology or control
authority. Remote exposure should remain read-only until the native engine has
passed browser-vs-native parity tests.


## Remote engine environment

Recommended native-engine process settings when the public UI is hosted at
`https://hummod.defying-logic.com`:

```sh
NATIVE_ENGINE_BIND=127.0.0.1 \
NATIVE_ENGINE_PORT=8771 \
NATIVE_ENGINE_CORS_ORIGIN=https://hummod.defying-logic.com \
./scripts/run-native-engine.sh
```

The browser endpoint is configured separately in:

```
ards-twin-v1.0/web/native-engine-config.js
```

For a dedicated tunnel hostname:

```js
window.MEDICAL_TWIN_NATIVE_ENGINE_URL =
  'https://engine.hummod.defying-logic.com';
```

The native server does not emit wildcard CORS. If
`NATIVE_ENGINE_CORS_ORIGIN` is blank, no cross-origin access header is
returned.

The current browser integration uses native `/health` and `/state` only to
show connection status. It does not use native bedside values and does not
send control commands.


## macOS persistent service

The repository includes a user-level launch agent installer:

```sh
./scripts/install-native-engine-launchd.sh
```

This builds the native engine if necessary and installs:

```
~/Library/LaunchAgents/com.defyinglogic.medical-vent-twin-native.plist
```

The process remains bound to `127.0.0.1:8771`, starts at login, and restarts
if it exits.

Remove it with:

```sh
./scripts/uninstall-native-engine-launchd.sh
```

## Cloudflare Tunnel setup

### Preferred: remotely managed Tunnel

Cloudflare currently recommends remotely managed Tunnels for most deployments.
Create the Tunnel in the Cloudflare dashboard, configure the published
application:

```
engine.hummod.defying-logic.com -> http://127.0.0.1:8771
```

and run the macOS connector installation command/token shown by Cloudflare.

The connector should run as a service so the Mac can recover after restart
without exposing an inbound router port.

Protect the hostname with Cloudflare Access before broader remote use.

### Fallback: locally managed Tunnel

The repository retains:

```
native-engine/cloudflare/config.example.yml
scripts/setup-native-cloudflare-tunnel.sh
```

for local development, testing, or an existing locally managed deployment.

The helper does not create or store Cloudflare credentials.

## Cloudflare Access and browser credentials

The browser uses credentialed `GET` requests to the engine origin.

The native engine responds only with the configured origin:

```
Access-Control-Allow-Origin: https://hummod.defying-logic.com
Access-Control-Allow-Credentials: true
```

It does not use wildcard CORS.

Cloudflare Access should authenticate the user at
`engine.hummod.defying-logic.com`. No service-token secret is embedded in the
browser.

## Production rule

Keep:

```
NATIVE_ENGINE_BIND=127.0.0.1
```

The Tunnel connector is local to the same Mac and can reach the loopback
service directly. Do not change the engine to `0.0.0.0` merely for remote
access.
