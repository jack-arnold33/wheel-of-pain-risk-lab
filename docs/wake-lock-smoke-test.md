# RL-WAK smoke-test plan

## Purpose

This slice checks whether a physical iPhone keeps its screen awake throughout
a workout in Safari and in the installed Home Screen PWA. It also verifies
that platform releases are visible, recovery is attempted, and timer behavior
does not depend on wake-lock success.

## Before each run

- Record iPhone model, exact iOS version, launch mode, and Auto-Lock interval.
- Record Low Power Mode and whether the phone is mirroring to the target TV.
- Choose an Auto-Lock interval short enough to observe during the run.
- Do not interact with the screen while waiting past the Auto-Lock interval.

## Cases implemented in this slice

| Case | Short procedure | Passing signal |
| --- | --- | --- |
| RL-WAK-01 | Start a run and wait beyond Auto-Lock. | Status is Active and the screen remains awake. |
| RL-WAK-02 | Pause, then wait beyond Auto-Lock. | Status remains Active and the screen remains awake. |
| RL-WAK-03 | Background and return to the active run. | Release is logged while hidden and a new grant is logged after return. |
| RL-WAK-04 | Let the timer reach Complete, wait beyond Auto-Lock, then press Done. | Lock stays Active through Complete and becomes Released or Inactive after Done. |
| RL-WAK-05 | End a running timer early. | Lock becomes Released or Inactive immediately. |

Run each case in Safari and from the installed Home Screen icon. Use **Retry
wake lock** after a visible failure to distinguish a transient denial from an
unsupported environment. Export the report after assigning a verdict.

An API grant without the physical display staying awake is a failure. A
visible unsupported or denied result is not timer corruption, but it requires
the fallback and support-boundary decision defined in
[`risk-lab.md`](risk-lab.md#rl-wak-screen-wake-lock).
