# Direct-browser OpenAI TTS decision record

## Status

**Inconclusive — physical paid-request evidence has not been entered.**

Automated tests establish request construction, bounded error handling,
credential isolation, stale-result rejection primitives, one-shot URL lifetime,
export redaction, and timer independence. They cannot establish CORS behavior
from the public GitHub Pages origin, iPhone playback policy, or TV routing.

## Decision threshold

Mark the architecture Pass only if all of the following are supported by
exported physical-device runs:

- authenticated direct Fetch succeeds from the deployed GitHub Pages origin in
  Safari and installed Home Screen mode, without middleware;
- the returned MP3 plays through `HTMLAudioElement` on the intended TV route;
- prepared playback begins within approximately 250 ms of the numbered
  transition;
- invalid, removed, offline, timed-out, backgrounded, cancelled, and stale
  requests never change timer correctness or replay late;
- the credential persists and removes as designed without entering source,
  build output, Cache Storage, exports, logs, evidence, or full-value UI;
- the service worker does not cache the authenticated exchange; and
- the owner accepts the residual client-side-key risk and confirms bounded
  project permissions and financial exposure.

Any missing environment field or required launch-mode run remains
Inconclusive. A reproducible direct-request CORS block is Fail for this exact
architecture.

## Result table

| Evidence | Result |
| --- | --- |
| Device, iOS, deployment commit, Pages origin | Not entered |
| Safari direct Fetch and MP3 | Not run |
| Home Screen direct Fetch and MP3 | Not run |
| Exact mirrored TV route | Not run |
| Prepared transition latency | Not run |
| Credential persistence/removal/exclusion | Harness ready; physical run pending |
| Failure and stale-result containment | Automated coverage passes; physical run pending |
| Service-worker cache inspection | Implementation has precache only; deployed inspection pending |
| Owner residual-risk acceptance | Not recorded |
| Decision | **Inconclusive** |

## Fail consequence

If the browser blocks the authenticated request through CORS, retain the
observable `cors-or-network` evidence and record Fail. The product must then
choose one of: a trusted middleware service, a different provider with an
approved browser-safe authentication mechanism, or no dynamic TV-compatible
speech. Do not weaken browser security or add middleware to this experiment.

## Scope limit

A Pass would validate only this owner-controlled iPhone/PWA/Pages/TV setup and
request contract. It would not prove client-side API-key storage generally
secure or endorsed by OpenAI.
