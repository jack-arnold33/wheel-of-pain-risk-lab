# Wheel of Pain Risk Lab

A disposable PWA test application for validating platform assumptions before
implementation of
[Wheel of Pain Timer](https://github.com/jack-arnold33/wheel-of-pain-timer).

The lab uses a production-representative PWA stack to assess risk. The stack
began as a candidate and was selected as the main application's technical
baseline at closeout. The lab itself remains disposable and is not production
scaffolding.

## Status

The original PWA-feasibility milestone is **complete**. The disposable lab has
been reopened for the separately scoped external-TTS routing experiment; this
does not change or invalidate the original [closeout report](docs/closeout.md).
External audio routing remains unproven until exported evidence from the
physical iPhone and television setup is recorded.

- [Risk-lab specification](docs/risk-lab.md)
- [Smoke-test evidence](docs/evidence-contract.md)
- [RL-TIM smoke-test plan](docs/timer-smoke-test.md)
- [RL-WAK smoke-test plan](docs/wake-lock-smoke-test.md)
- [Recorded smoke-test results](docs/test-results.md)
- [Risk-lab closeout](docs/closeout.md)
- [External TTS physical-device procedure](docs/external-tts-test.md)
- [External TTS decision record](docs/external-tts-decision.md)
- [Direct TTS product handoff](docs/direct-tts-handoff.md)
- [Candidate PWA stack](docs/stack-decision.md)
- Source specification commit:
  [8d6eb2b](https://github.com/jack-arnold33/wheel-of-pain-timer/commit/8d6eb2b)

## Direct-browser TTS experiment

The active RL-SPE-25–33 track tests direct browser Fetch from the deployed
GitHub Pages origin to OpenAI speech, MP3 buffering, and retained
`HTMLAudioElement` playback. It has no proxy, SDK, provider abstraction, or
fallback. Its key field is masked and stores only in a dedicated IndexedDB
record after manual physical-device entry. The decision remains Inconclusive
until the documented iPhone Safari, Home Screen, and exact mirrored-TV runs are
entered.

The UI separates this active nine-case track from core cases and the historical
routing experiment so the case menu stays focused.

## Historical external-routing experiment

The RL-SPE extension compares browser `SpeechSynthesis`, a pre-generated WAV
fixture through `HTMLAudioElement`, and that same fixture through Web Audio. It
can also prepare live audio through an optional same-origin proxy. The bundled
fixture contains only “Test participant. Begin the next interval.” and was
generated outside the browser with the repository script.

Run `pnpm test`, `pnpm typecheck`, and `pnpm build` for automated verification.
No lint script is configured in this repository.

Historical proxy generation is opt-in. Copy `.env.live.example` to `.env.local`, set
`OPENAI_API_KEY` only in the server process environment, run `pnpm tts-proxy`,
and start the Vite development server separately. A static GitHub Pages build
does not provide the proxy. Never put a provider key in a `VITE_*` variable.
