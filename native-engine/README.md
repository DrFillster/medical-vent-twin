# Native physiology engine boundary

This directory begins the transition from an all-browser physiology runtime to
a native bedside simulation engine.

## Current authority

**None.**

The native executable currently exposes only the service boundary:

- `GET /health`
- `GET /state`

The returned patient variables are intentionally null. The existing v1.5
browser/HumMod runtime remains authoritative.

This prevents interface work from silently changing physiology.

## macOS build

Requirements:

- Apple Clang / Xcode command-line tools
- CMake 3.20 or newer

From the repository root:

```sh
./scripts/build-native-mac.sh
./scripts/run-native-engine.sh
```

Default endpoint:

```
http://127.0.0.1:8771
```

Check:

```sh
curl http://127.0.0.1:8771/health
curl http://127.0.0.1:8771/state
```

## Binding

The service defaults to loopback.

To listen on the LAN:

```sh
NATIVE_ENGINE_BIND=0.0.0.0 ./scripts/run-native-engine.sh
```

Direct Internet port-forwarding is **not** the preferred deployment. Put an
authenticated reverse proxy/tunnel in front of the loopback service instead.

## Planned migration order

1. Keep browser physiology authoritative.
2. Mirror browser bedside state into the native contract.
3. Move myocardial source state and the validated dynamic Shimayoshi shadow
   into native code.
4. Compare browser vs native shadow output.
5. Move cardiovascular closed-loop physiology only after source parity gates
   pass.
6. Move ventilator/lung physiology later if native execution provides a clear
   fidelity or performance advantage.

## Safety boundary

The native service must not gain control authority merely because it can
produce a value. Source provenance and regression parity are required before
any migrated subsystem becomes authoritative.
