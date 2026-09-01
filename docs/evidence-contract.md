# Smoke-test evidence

## Purpose

The risk lab needs enough evidence to distinguish a repeatable platform or
stack problem from a one-off observation. It is not an automated test system,
analytics product, or long-lived evidence database.

[`risk-lab.md`](risk-lab.md) remains the source of truth for the experiments,
cases, and decision thresholds.

## What one run records

Each run records:

- lab version and source commit;
- random local run ID;
- experiment and case ID;
- start and end wall-clock time;
- manually confirmed iPhone model, iOS version, browser, and launch mode;
- connectivity and relevant device settings;
- confirmed preconditions;
- a short event log;
- expected and actual result;
- tester verdict and notes; and
- optional references to screenshots, recordings, or console logs.

The run report is stored locally and can be exported as readable JSON. The lab
does not upload it.

## Minimal event log

Events use a sequence number, wall-clock timestamp, and process-relative
monotonic timestamp when available. The log captures only events useful to the
active smoke test, such as:

- Start, Mark Observation, End, and verdict;
- visibility and page lifecycle changes;
- timer phase, pause, completion, checkpoint, and recovery;
- callback-delay start and end;
- connectivity and display-mode changes;
- wake-lock request, grant, release, or failure;
- storage operation success or failure; and
- speech request, result, or privacy-based refusal; and
- external-speech playback method, request start, first response byte when
  measurable, media-ready or decode time, playback request, start, completion,
  interruption, cancellation, failure, and stale-result rejection.

Sequence number is the reliable event order if the tester changes the device
clock. The log does not need a formal event-schema framework or exhaustive
browser instrumentation.

## Verdicts

The tester assigns Pass, Fail, Inconclusive, or Not Supported. The lab may show
the expected state beside the observed state, but it does not need an automated
verdict engine.

A blocker result should be reproduced in a fresh run before it drives a product
decision. If setup or observability is insufficient, record Inconclusive rather
than expanding the harness into a general testing platform.

## Storage and reset

- Active state and completed reports survive reload and offline cold launch.
- A failed replacement must not select obviously partial data as valid.
- Per-experiment reset clears only that experiment's disposable state.
- Reset does not erase completed reports from other experiments.
- Erase All is explicit and confirmed.

The lab only needs the simplest storage approach that can demonstrate these
behaviors. The final application's data model and migration architecture are
out of scope.

## Privacy boundary

All fixtures are synthetic. Reports remain on-device unless exported by the
tester. The lab sends no analytics, evidence, identifiers, or private text to
GitHub or another service. Ordinary GitHub Pages resource and update requests
are expected while online. The optional external-TTS case is a narrow
exception: after explicit tester action it sends only the displayed synthetic
fixture to the configured same-origin proxy. Exports log its fixture ID and
character count, not the complete utterance. Provider credentials exist only
in the proxy process environment.

## Good-enough evidence

A run is useful when another person can tell:

1. which build, device environment, and case were exercised;
2. what the tester did;
3. what the lab expected and observed;
4. whether the outcome was repeatable; and
5. what product fallback, support boundary, or stack concern follows.

Anything beyond that must directly reduce one of the risks in the source
specification.
