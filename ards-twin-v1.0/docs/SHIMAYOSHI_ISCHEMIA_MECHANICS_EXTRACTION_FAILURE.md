# Shimayoshi ischemia mechanics extraction failure analysis

Date: 2026-10-11

## Observed failure

Workflow run `38152058617` appeared to hang during a nominal 0.8-second
control simulation after sarcomere mechanics instrumentation was added.

The step ran for about 29 minutes before cancellation.

## Root cause

The mechanics patcher exited with:

```
Error: patch anchor not unique: sarcomere cycle initialization
```

The workflow did not stop on that failed Node command. It continued to
MSBuild and compiled unmodified upstream Shimayoshi source.

Because the source was unmodified, the stock executable did not contain the
runtime-duration argument handling. The command:

```
simulator.exe 0.8 ...
```

therefore did not produce a 0.8-second run; the stock model continued toward
its default 3600-second simulation.

The uploaded artifact contained only an empty source-diff file, which confirms
that no extraction patch had been applied.

## Correction

The current extraction path now:

1. Uses the unique initial-state-load block as the sarcomere initialization
   anchor rather than a bare `fclose(Initial1)`.
2. Checks the Node patcher exit code before building.
3. Requires a non-empty source diff before MSBuild.
4. Regression-tests a fixture containing multiple `fclose(Initial1)` sites.
5. Uses a dedicated 0.8-second mechanics proof before any long source run.

## Verification

Mechanics proof workflow run `38167535845` succeeded.

The patched 0.8-second simulator execution completed in about one second and
produced exactly two 400-ms paced-cycle rows with finite:

- peak active force `Fb`;
- start/min/max/end half-sarcomere length `hsmL`;
- end-cycle cross-bridge position `hsmX`.

Therefore the prior 29-minute run does **not** demonstrate that hsmL
instrumentation slows Shimayoshi materially. It demonstrates a fail-open CI
path that compiled stock source after the patcher had already failed.
