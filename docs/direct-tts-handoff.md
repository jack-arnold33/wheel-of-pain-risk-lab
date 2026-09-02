# Direct TTS product handoff

## Tested environment and result

Physical environment fields and live result are pending. Until RL-SPE-25–33
exports record the exact iPhone, iOS, GitHub Pages commit/origin, Safari and
Home Screen modes, television route, connectivity, and date, the result is
**Inconclusive**.

## Accepted risk

The owner is willing to store one dedicated project key in a dedicated
IndexedDB credential record for this personal-use PWA. This is an explicit
exception to OpenAI guidance against exposing keys in client-side browsers or
apps. Required mitigations are a dedicated project, project key (not Admin
key), narrow model allowlist where available, small hard spend limit, lower
alert, and revocation after testing.

## Blockers

- A direct-request CORS failure blocks the client-only architecture.
- Failure to route `HTMLAudioElement` MP3 playback to the target TV blocks the
  proposed dynamic-speech path.
- Prepared transition latency above approximately 250 ms blocks just-in-time
  announcement playback and requires earlier preparation or a different design.
- Any credential appearance in build output, caches, export, logs, evidence, or
  full-value UI blocks adoption.

## Exact Wheel of Pain Timer specification changes after a Pass

1. Add the pinned speech request contract and approved content boundary; keep
   generation separate from timer projection.
2. Add a dedicated IndexedDB credential store with masked entry, configured
   indicator, Replace, Remove, abort, and erase-all behavior.
3. Require abortable bounded direct Fetch, normalized errors, expected MP3 type,
   nonempty/max-size validation, and `cache: "no-store"`.
4. Require retained `HTMLAudioElement` playback and object-URL revocation on
   every terminal, replacement, cancellation, and reset path.
5. Require numbered preparation, one-shot consumption, zero-Prepare skip, stale
   rejection, and approximately 250 ms transition-to-playing acceptance.
6. Exclude credentials, authorization, text/body material, audio, Blob/object
   URLs, and upstream bodies from generic state, logs, service-worker messages,
   caches, backup, and evidence exports.
7. Document the owner setup, residual risk, spend controls, revocation, and the
   exact supported iPhone/iOS/TV environment.

After a Fail caused by CORS, do not make these direct-client changes. Record the
required architecture choice: trusted middleware, browser-safe provider, or no
dynamic TV-compatible speech.

