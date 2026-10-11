# Full HumMod on the Mac native engine

Status: Mac transport qualification implemented; execution still requires the
hardwired Mac.

## Architecture decision

Do **not** continue recreating the complete HumMod model subsystem-by-subsystem
inside the browser or native C++ engine.

The preferred runtime stack is:

```
remote browser
    |
    | HTTPS / Cloudflare Tunnel
    v
native Mac engine :8771
    |
    +-- native myocardial shadow library
    |
    +-- persistent HumMod process adapter
            |
            v
       plain Wine
            |
            v
  unmodified HumMod.EXE + local model tree
```

The executable and model tree remain local to the Mac. They are not committed,
served, or returned through the public API.

## Why an external process

The public HumMod standalone tree contains the model descriptions plus the
Windows executable, but it does not include the executable's parser/solver C++
source.

The official executable should therefore remain an external runtime dependency.
The project does not reverse engineer or modify the executable.

The current HumMod standalone documentation and published descriptions identify
HumMod as Windows-based. The project already has validated Windows execution
and prior Mac/Wine Win32 window/dialog discovery.

## Existing validated evidence

Pinned standalone model:

- repository: `riliescu/hummod-standalone`
- revision: `8dab57e05631f779bf5020fe0dd51874d8ae98c1`
- `HumMod.EXE` SHA-256:
  `4243E8721F77A5FABF3128FAC5AC139588B20A8285D35D2021C6852D596803CB`
- executable size: 2,043,904 bytes

Previously validated Windows persistent-session sequence:

```
initialize
 -> read baseline
 -> checkpoint
 -> live controls
 -> advance
 -> read
 -> restore
 -> read exact baseline
 -> terminate
```

Core native outputs already demonstrated:

- HR
- MAP
- CO
- PaO2
- PaCO2
- arterial pH

The same-process Windows validation restored all six values exactly to baseline.

## Pinned command IDs

The full menu captured from the pinned executable establishes:

| Command | ID |
|---|---:|
| File / Load Solution | 3 |
| File / Save Solution | 4 |
| File / Exit | 5 |
| Go / 1 Sec | 12 |
| Go / 5 Sec | 13 |
| Go / 10 Sec | 14 |
| Go / 1 Min | 15 |
| Go / 5 Min | 16 |

These IDs are **not** treated as a generic HumMod API. They are valid only when
the executable hash matches the pinned SHA-256.

The Wine helper also scopes Open/Save dialogs to the HumMod process PID and
uses the validated filename edit IDs 1148/1001 and action button ID 1.

## Mac qualification

Requirements:

- plain Wine;
- `winepath`;
- `mingw-w64` / `x86_64-w64-mingw32-gcc`;
- Node.js;
- a local unmodified HumMod standalone tree.

Run:

```sh
HUMMOD_ROOT=/path/to/hummod-standalone \
sh scripts/qualify-hummod-mac-wine.sh
```

The script:

1. verifies the HumMod executable hash and size;
2. compiles the small Win32 control helper;
3. launches HumMod under plain Wine;
4. saves a baseline SOLN;
5. advances the same process by three one-second commands;
6. saves the advanced SOLN;
7. reloads the baseline SOLN into the same process;
8. immediately re-saves and requires exact canonical baseline restoration;
9. advances one additional second;
10. converts all SOLNs with the existing HumMod native solution parser;
11. writes `qualification-report.json`.

The qualification does not grant physiology or control authority to the native
service.

## Next service step after a Mac PASS

Do not expose Wine or HumMod directly through Cloudflare.

Implement a private local persistent-worker boundary:

```
native-engine
    |
    | localhost / stdio
    v
HumMod worker
    |
    +-- initialize
    +-- read
    +-- verified live-set
    +-- advance
    +-- checkpoint
    +-- restore
    +-- terminate
```

The public browser communicates only with the native-engine API.

## Vent coupling

HumMod does not replace Vent's mechanical lung model.

Vent remains authoritative for:

- PEEP;
- recruitment/derecruitment;
- compliance/resistance compartments;
- plateau pressure;
- total PEEP;
- driving pressure;
- pressure/flow/volume waveforms;
- breath maneuvers.

HumMod supplies the whole-body systemic physiology state. The coupling layer
must remain explicit about which model owns each variable.

## Licensing/distribution boundary

No HumMod executable or model tree is added to this repository or served by the
native engine.

The runtime adapter expects a user-supplied/local HumMod installation. Any
public/commercial integration must continue to comply with the applicable
HumMod license/permissions.
