# Direct OpenAI TTS physical-device procedure

## Scope and safety boundary

This procedure tests one question: can the deployed GitHub Pages PWA send a
real authenticated browser `fetch` directly to OpenAI, receive an MP3, and play
it through a retained `HTMLAudioElement` on the intended mirrored television?
It is evidence, not product implementation. Do not add a proxy or workaround a
CORS failure.

Never put the real key in chat, source, a terminal, an environment file,
screenshots, screen recordings, notes, console output, or exported JSON. Enter
it only in the password-masked field on the physical iPhone after the deployed
page loads. The field is cleared after Save and the full value is never shown
again.

The deployed request contract, verified against official OpenAI documentation
on 2026-09-01, is:

- `POST https://api.openai.com/v1/audio/speech`
- bearer authentication with a standard project API key, not an Admin API key;
- model `gpt-4o-mini-tts-2025-12-15`;
- voice `alloy`;
- response format `mp3`, speed `1`; and
- fixed fixture ID `wheel-awaits-v1`, representing only the approved generic
  sentence shown by the lab.

OpenAI documents the endpoint, available models, voices, formats, and speed in
the [Create speech reference](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create).
It also says API keys are secrets that should not be exposed in browsers or
apps in the [API authentication guidance](https://developers.openai.com/api/reference/overview).
This owner-approved lab is a bounded exception; it does not establish that
client-side keys are generally secure or recommended. Project model allowlists,
project keys, spend alerts, and spend limits are described in the
[Projects API reference](https://developers.openai.com/api/reference/typescript/resources/admin/subresources/organization/subresources/projects).

## Account setup

Before enabling Test speech:

1. Create a dedicated project for this disposable lab.
2. Create or select a project key. Do not use an organization Admin API key.
3. Where the account UI permits, set the project model policy to an allowlist
   containing only `gpt-4o-mini-tts-2025-12-15`.
4. Set a small hard project spend limit and a lower spend alert.
5. Plan to revoke the key immediately after the physical runs.

The lab cannot inspect or certify any of these account settings.

## Record the environment for every run

Enter the exact iPhone model, exact iOS version, deployment commit shown in the
header, public GitHub Pages origin, Safari or Home Screen launch mode, TV or
receiver model, mirroring route, connectivity, and date. Start a separate run
for every launch-mode or routing change. Physical observation—phone, TV, both,
or neither—is authoritative.

Use the **Direct OpenAI browser gate** case group. The nine cases deliberately
combine related checks so the normal case menu stays short.

## Cases

### RL-SPE-25 — feasibility matrix and CORS gate

Run four configurations with the valid dedicated key: Safari unmirrored, Home
Screen unmirrored, Safari mirrored to the exact target TV, and Home Screen
mirrored to that TV. Tap Test speech once per run. Record destination and one of:

- Fetch resolved with an observable 2xx response, expected audio content type,
  nonzero bounded byte count, and playback events;
- Fetch resolved with an observable non-2xx status class; or
- Fetch rejected before JavaScript could observe an HTTP response.

The last result is `cors-or-network`. A browser `TypeError` alone does not prove
CORS uniquely caused the failure. Use independent Safari Web Inspector network
evidence only if available without exposing the Authorization header. Do not
manually send an OPTIONS request; the browser must perform any preflight.

### RL-SPE-26 — persistence without redisplay

In Safari and then Home Screen mode, save the key, reload, fully close and cold
launch, and confirm only the configured indicator and last four characters
return. Make a second successful request without re-entering or redisplaying
the full key.

### RL-SPE-27 — removal gate

In each launch mode, begin a request or prepare operation, tap Remove key, and
reload. Confirm the request is aborted, prepared/playing audio is discarded,
the indicator is not configured, and Test speech remains disabled until a new
key is manually entered.

### RL-SPE-28 — invalid credential

Use a fake or deliberately invalid lab value; do not revoke the real key merely
for this case. In both launch modes, confirm an observable 401/403 is recorded
only as `authentication`, with no response body or key in UI, events, or export.

### RL-SPE-29 — cancellation and lifecycle

Use separate runs in both launch modes for Cancel, key replacement during a
request, backgrounding, and visibility return. No cancelled or superseded
result may become prepared or play later.

### RL-SPE-30 — offline and timer independence

Go offline before tapping Test speech in both launch modes. The request must be
skipped promptly. Keep the timer running throughout and confirm its elapsed-time
projection and controls are unaffected.

### RL-SPE-31 — prepared playback matrix

In both launch modes and on the exact TV route:

1. Tap Prepare next transition, wait for prepared, then Simulate transition.
   Compare `direct-tts.transition` and `direct-tts.playing`; the target is about
   250 ms or less.
2. Tap Zero-second Prepare. The transition must be skipped, and any late result
   must be rejected rather than replayed.
3. Repeat successful prepared playback enough to expose routing changes,
   duplicates, late replay, or URL lifetime errors. Keep cost small and do not
   generate more samples than needed to answer the routing question.

### RL-SPE-32 — interruption and rotation

In both launch modes, exercise an ordinary audio interruption and rotate between
portrait and landscape in separate runs. Record routing and timer behavior. A
missed or interrupted announcement must not replay late.

### RL-SPE-33 — erase, export, and cache proof

In both launch modes, save a fake value, create evidence, tap Erase all lab data,
reload, and confirm the key is absent. Inspect the JSON before sharing it: it
must contain no full key, Authorization header, request sentence, response body,
MP3 bytes, Blob, object URL, or upstream body. It may contain only the fixture
ID and bounded request/result metadata.

For the deployed commit, inspect the generated service worker and its manifest.
It must contain only same-origin build assets, no runtime route, and no OpenAI
speech URL. The application request also uses `cache: "no-store"`. Confirm the
authenticated request and response are absent from Cache Storage.

## Stop conditions and classification

Stop before any request not initiated by a tester tap. Revoke the dedicated key
after testing. Classify direct-browser TTS as Pass only when every threshold in
the decision record is met. If the authenticated direct request is blocked by
CORS, record the exact observable evidence as Fail; do not classify it as an
implementation defect and do not add a proxy.
