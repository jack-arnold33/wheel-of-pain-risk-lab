# External TTS routing decision record

## Current decision

**Inconclusive — physical evidence not yet recorded.** Automated tests verify
state transitions, cancellation, one-shot buffering, stale-result rejection,
and playback selection. They cannot observe whether an iPhone sends sound to a
mirrored television, whether speech is audible over music, or the audible start
latency. Do not describe the routing hypothesis as proven.

## Evidence to complete

| Question | Current result | Evidence required for decision |
| --- | --- | --- |
| Does external TTS fix TV routing? | Inconclusive | Exported RL-SPE-11/12 physical runs showing consistent TV output. |
| Which playback method is reliable? | Inconclusive | Matched HTML audio and Web Audio runs in Safari and Home Screen mode. |
| Observed generation latency | Not measured | RL-SPE-21 request, first-byte, and ready/decode events from the configured provider. |
| Is prefetch required? | Inconclusive | Generation latency plus RL-SPE-20 transition-to-audible-start evidence. |
| Offline and failure behavior | Harness implemented; physical result pending | RL-SPE-17, 19, 22, 23, and 24 exports. |
| Credential/privacy boundary | Implemented for the lab adapter | Deployment review confirming server-only key and fixed generic text. |

## Acceptance rule

Mark the approach viable only when a static generated fixture consistently
reaches the TV through at least one ordinary media path, buffered playback
starts within about 250 ms of the transition, a representative long session
shows no unexplained route change/duplicate/late replay, network or provider
failure does not affect timer behavior, credentials remain server-side, and
the product can truthfully explain what text is sent and when.

If generation exceeds 250 ms but prefetch reliably meets the playback threshold,
record the required lead time and accept prefetch as mandatory. Otherwise keep
external TTS out of production and retain browser speech as an explicitly
limited optional feature or omit spoken sayings.
