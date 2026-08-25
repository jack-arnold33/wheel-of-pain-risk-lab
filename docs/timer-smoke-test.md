# RL-TIM smoke-test plan

## Purpose

RL-TIM is the first vertical slice because timer recovery is the main PWA
blocker. The implementation should be deliberately small: one fixed sequence,
a few controls, visible state, a short log, and local checkpoint recovery.

This smoke test proves that the candidate PWA stack permits correct browser
timing, lifecycle handling, persistence, offline execution, and debugging. It
does not establish the main application's timer architecture.

## Fixed sequence

```text
Prepare 5 seconds
Work 8 seconds
Rest 4 seconds
Work 8 seconds
Cooldown 3 seconds
Complete
```

The screen shows expected and observed phase/remaining time, current status,
the last saved checkpoint, and recent events.

## Minimum timer approach under test

- Foreground time is calculated from elapsed monotonic time, not callback
  count or repeated subtraction.
- A checkpoint stores status, elapsed timeline position, and save wall time.
- Paused checkpoints never advance during an interruption.
- Running recovery uses positive wall elapsed time after reload, suspension, or
  process loss.
- A backward wall clock restores Paused with a visible accuracy warning.
- Recovery may skip elapsed phases but never replays their missed cues.
- Complete is clamped and shown once.

These are observable rules for the smoke test, not a reusable production timer
design.

## Minimal controls

- Start
- Pause
- Resume with a three-second countdown
- Inject callback delay
- Mark Observation
- End run
- Pass, Fail, Inconclusive, and Not Supported
- Reset RL-TIM
- Export report

## Case checklist

The case descriptions and blocker threshold in
[`risk-lab.md`](risk-lab.md#rl-tim-timer-lifecycle-and-recovery) remain
authoritative. The implementation only needs these short procedures:

| Case | Smoke procedure | Passing signal |
| --- | --- | --- |
| RL-TIM-01 | Let the sequence run in the foreground. | Correct order, no zero linger, and completion near 28 seconds. |
| RL-TIM-02 | Block callbacks long enough to cross a boundary. | First render catches up instead of extending a phase. |
| RL-TIM-03 | Background and return within one phase. | Correct phase and roughly correct remaining time. |
| RL-TIM-04 | Background across multiple phases. | Correct current phase; no missed-cue burst. |
| RL-TIM-05 | Pause, background, and return. | Paused phase and remaining time stay unchanged. |
| RL-TIM-06 | Reload while Running. | One correct recovered state. |
| RL-TIM-07 | Force-terminate while Running and reopen. | Correct phase or Complete from elapsed wall time. |
| RL-TIM-08 | Force-terminate while Paused and reopen. | Exact paused state is restored. |
| RL-TIM-09 | Interrupt resume countdown by background, reload, and termination in separate runs. | Saved state returns Paused and needs a new countdown. |
| RL-TIM-10 | Terminate, move wall clock backward, and reopen. | Paused state plus visible accuracy warning; no negative time. |
| RL-TIM-11 | Terminate, move wall clock forward, and reopen. | State advances or completes and records ambiguity. |
| RL-TIM-12 | Remain suspended or terminated beyond completion. | Reopen shows Complete without replaying cues. |

Observations should be made away from exact phase boundaries. A displayed time
within about one second of the expected value is sufficient for smoke-test
evidence; wrong status, phase, pause behavior, or completion is not.

## First implementation slice

Implement RL-TIM-01 and RL-TIM-02 first. Together they prove:

- the chosen stack can render and update the fixture;
- its scheduling model is independent of callback cadence;
- the lab can capture useful timestamps and observations; and
- the deployed PWA can be debugged on the target iPhone.

Then add checkpoint persistence for RL-TIM-05, RL-TIM-06, and RL-TIM-08 before
the termination and clock-change cases. Do not build a generic test runner,
timer library, schema framework, or production UI.

## Stack proof

RL-TIM is sufficient to retain a candidate lab stack when it can:

- build a small PWA under the GitHub Pages repository path;
- expose service-worker and lifecycle behavior without hiding it;
- access the required browser storage and timing APIs directly;
- produce a debuggable build for iPhone 15 on iOS 26.6;
- survive offline reload with the same test behavior; and
- remain simple enough to discard after the risk milestone.

A stack that obstructs these checks or requires substantial application
architecture should be rejected for the lab. That decision does not
automatically select or reject the main application's eventual stack.

## Recorded results

The initial deployed-slice result and its evidence limitations are recorded in
[`test-results.md`](test-results.md). Results in that log do not replace the
case procedures or repetition requirements in this plan.
