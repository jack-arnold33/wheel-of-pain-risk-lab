# PWA risk lab specification

## Purpose

The PWA risk lab is a small, disposable test application used to validate the
highest-risk browser and iOS capabilities before substantial work begins on the
Wheel of Pain Timer application.

The lab answers whether the intended product behavior is feasible and what
fallbacks or support boundaries the product needs. It is not an early version
of the product, and its implementation choices do not select the main
application's technical stack or architecture.

The platform risks being investigated are recorded in
[`ios-pwa-risks.md`](ios-pwa-risks.md).

Implementation-neutral details derived from this specification are recorded in
the [`smoke-test evidence guide`](evidence-contract.md) and
[`RL-TIM smoke-test plan`](timer-smoke-test.md). This specification remains
authoritative if a derived design document conflicts with it.

## Goals

- Produce repeatable evidence for timer recovery, wake lock, offline operation,
  storage durability, speech behavior, installation mode, and landscape
  mirroring.
- Test on physical iPhones in both browser and Home Screen launch modes.
- Distinguish a product blocker from a supported capability with a fallback.
- Record enough environment and event data to explain failures.
- Turn findings into explicit product requirements, support boundaries, or
  accepted residual risks before main-application implementation begins.

## Non-goals

- Implementing the Wheel of Pain Timer user experience
- Selecting the main application's framework, libraries, or architecture
- Reusing the lab as production application scaffolding
- Building routine management, content-pack management, or final backup flows
- Choosing final visual styling, sounds, or speech content
- Proving behavior on simulators alone
- Collecting analytics, telemetry, or private workout-group content

## Lab principles

1. **One question per experiment.** Each experiment has explicit preconditions,
   actions, observations, and a verdict.
2. **Visible instrumentation.** Important timestamps, lifecycle events,
   capability results, and recovery decisions are visible and exportable.
3. **Synthetic data only.** Speech text, names, stored records, and files are
   generic test fixtures.
4. **No silent network activity.** The lab performs no analytics or telemetry.
   Any experiment that may use a network is clearly identified before it runs.
5. **Real-device evidence.** Simulator results may help diagnose a problem but
   cannot establish iPhone support.
6. **Disposable implementation.** Lab code may demonstrate feasibility but is
   not copied into the main app without a separate design review.

## Lab capabilities

The lab provides:

- An experiment index with a short purpose and required setup for each test
- Manual environment fields for device model, OS version, browser, and notes
- Automatic recording where available of display mode, visibility state,
  network state, capability presence, and persistent-storage state
- A visible event log using both a monotonic process-relative timestamp and a
  wall-clock timestamp
- Clear Start, Mark Observation, Pass, Fail, and Inconclusive actions
- Per-experiment reset without erasing unrelated experiment evidence
- Export of a run report as human-readable, portable JSON
- A clearly labeled action to erase all lab data on the device

The interface should be functional rather than polished. It must remain usable
on a phone, but it does not adopt the product's retro theme or become a preview
of the final UI.

## Evidence record

Each run records at least:

| Field | Meaning |
| --- | --- |
| Lab version | Identifies the exact deployed experiment behavior. |
| Run identifier | Distinguishes repeated runs without identifying a person. |
| Experiment and case | Stable identifiers from this specification. |
| Start and end time | Wall-clock context for the run. |
| Device and OS | Manually confirmed model and exact OS version. |
| Browser and launch mode | Browser tab or Home Screen, plus detected display mode. |
| Connectivity | Online, offline, or changed during the case. |
| Preconditions | Setup confirmed by the tester. |
| Event log | Lifecycle, timer, storage, wake-lock, and speech events relevant to the case. |
| Expected and actual result | Concise comparison. |
| Verdict | Pass, Fail, Inconclusive, or Not Supported. |
| Artifacts | Optional screen-recording, screenshot, or external console-log references. |
| Notes | Permission state, device settings, interruptions, or suspected cause. |

A report remains on the device until explicitly exported or erased. The lab
does not upload it.

## Required test matrix

Run the blocker experiments on:

- A physical iPhone 15 running iOS 26.6, the minimum supported product
  environment
- A physical iPhone 15 running the current production iOS version when it is
  newer than iOS 26.6
- A normal browser tab
- An icon added to the Home Screen and opened in app-like mode
- Online and airplane-mode conditions where the experiment requires both

One iPhone 15 may satisfy both OS-version entries when iOS 26.6 is the current
production version. If the versions differ, evidence from both environments is
required; this may require two devices or completing the iOS 26.6 runs before a
test device is updated.

Other iPhone models and display sizes are useful supplementary coverage but do
not gate the risk-lab milestone. Record Low Power Mode, Auto-Lock setting,
orientation lock, and whether the phone is being mirrored when those settings
can affect an observation.

The product support floor for this lab is iOS 26.6 on iPhone 15. A failure in
that environment must not be dismissed because the same case passes on a newer
iOS version or another iPhone model.

## Hosting and deployment

The lab is hosted as a public GitHub Pages project site at a stable URL under
the repository path. The implementation must account for that path in resource,
manifest, and service-worker URLs and scope.

Deployment uses a manually triggered GitHub Actions workflow and the protected
`github-pages` deployment environment. A push to the default branch does not
automatically replace the active test version. Each deployed build visibly
identifies, and includes in exported evidence, its source commit, build
identifier, report-schema version, and fixture-schema version.

Update cases use reproducible version-one and version-two commits or tags
deployed in sequence to the same stable URL. This exercises an actual
service-worker update rather than treating separate URLs as an update. The lab
must make offline readiness and the currently active version observable.

The deployed application and all bundled fixtures are public and contain only
synthetic data. GitHub necessarily receives ordinary requests for hosted
resources, but the lab sends no analytics, evidence, identifiers, fixtures, or
other application data to GitHub or any other service. Reports remain on the
device unless the tester explicitly exports them.

## Physical test setup

The required mirroring target is a television. At test time, record the
television model, any receiver or intermediary, the mirroring or connection
method, resolution where observable, viewing distance, and relevant overscan or
picture settings. This exact setup is the milestone-gating RL-DSP environment;
additional televisions or mirroring paths provide supplementary evidence.

## Speech experiment scope

RL-SPE-01 through RL-SPE-08 exercise voices exposed by the browser or operating
system. RL-SPE-09 through RL-SPE-24 are the separately approved external-audio
routing extension. They use one generic pre-generated fixture and, when a
server-side proxy is deliberately configured, the same generic live fixture.
No private pack content or real participant identity is permitted.

## Experiment priority

| Priority | Experiment | Why it runs at this stage |
| --- | --- | --- |
| 1 | RL-TIM: timer lifecycle and recovery | Incorrect workout state would undermine the product's core purpose. |
| 1 | RL-OFF: installation and offline launch | The installable offline product promise depends on it. |
| 1 | RL-WAK: screen wake lock | Garage and mirrored use depend on the display remaining visible, though a fallback is possible. |
| 2 | RL-STO: storage durability | Local-first data and recovery require predictable failure handling. |
| 2 | RL-SPE: speech and voice privacy | Motivation is optional, but private text must never be transmitted without consent. |
| 3 | RL-DSP: landscape and mirroring | Layout problems are correctable but should be found before final UI work. |

## RL-TIM: timer lifecycle and recovery

### Question

Can a running or paused multi-phase timeline recover correctly after callback
delay, background suspension, reload, process termination, and clock anomalies
without depending on continuous background execution?

### Test fixture

Use a short deterministic sequence that crosses boundaries quickly:

```text
Prepare 5 seconds
Work 8 seconds
Rest 4 seconds
Work 8 seconds
Cooldown 3 seconds
Complete
```

The lab shows the expected phase and remaining duration, the observed phase and
remaining duration, and the persisted checkpoint used for recovery. It records
periodic callbacks but calculates correctness independently from the number of
callbacks received.

### Cases

| ID | Action | Expected observation |
| --- | --- | --- |
| RL-TIM-01 | Run continuously in the foreground. | The exact sequence completes without lingering at zero or accumulating callback drift. |
| RL-TIM-02 | Introduce a controlled main-thread callback delay. | The displayed timeline catches up from elapsed monotonic time rather than extending a phase. |
| RL-TIM-03 | Background briefly within one phase. | Return shows the correct phase and remaining time. |
| RL-TIM-04 | Background long enough to cross multiple phases. | Return advances across every elapsed boundary without replaying missed cues. |
| RL-TIM-05 | Pause, background, and return. | The same phase and remaining duration stay frozen. |
| RL-TIM-06 | Reload while running. | The persisted timeline reconstructs the correct running state once. |
| RL-TIM-07 | Force-terminate while running and reopen later. | Wall-clock evidence reconstructs the correct phase or Complete. |
| RL-TIM-08 | Force-terminate while paused and reopen later. | The exact paused phase and duration are restored. |
| RL-TIM-09 | Interrupt the three-second resume countdown by backgrounding, reload, and termination in separate runs. | Every run returns to the saved phase paused and requires a new resume countdown. |
| RL-TIM-10 | Move the device wall clock backward after termination. | Recovery does not invent negative elapsed time; it restores paused with an accuracy warning. |
| RL-TIM-11 | Move the device wall clock forward after termination. | Recovery advances by positive elapsed time and records the known ambiguity. |
| RL-TIM-12 | Let the workout finish while suspended or terminated. | Reopen shows Complete without replaying missed sounds or speech. |

Clock-change tests require care because they affect the entire device. Restore
automatic date and time immediately after each case and record both the change
and restoration in the run notes.

### Decision threshold

- Any reproducible incorrect phase, remaining time, paused state, or completion
  state in a required launch mode is a blocker for the PWA-only MVP until a
  reliable strategy or narrower support boundary is demonstrated.
- Missing or delayed callbacks are not failures when reconstructed state is
  correct.
- Missed background audio is acceptable; replaying missed cues in a burst is
  not.

## RL-OFF: installation, offline launch, and update

### Question

Can the app be added to the Home Screen, launch in an app-like mode, and cold
start with all required resources after a successful online load? Can an update
be adopted without corrupting stored data?

### Cases

| ID | Action | Expected observation |
| --- | --- | --- |
| RL-OFF-01 | Add the hosted lab to the Home Screen using the documented browser flow. | An icon is created and launch-mode behavior is recorded truthfully. |
| RL-OFF-02 | Launch from the icon while online. | The lab opens in the expected app-like display mode or records the limitation. |
| RL-OFF-03 | After a confirmed successful online load, enable airplane mode and cold-launch from the icon. | The experiment index and blocker experiments load without a network. |
| RL-OFF-04 | While offline, run RL-TIM-01 through completion and reopen stored evidence. | Timer behavior and local evidence work without a network. |
| RL-OFF-05 | Reload an active lab run while offline. | Required resources load and timer recovery remains available. |
| RL-OFF-06 | Deploy a visibly versioned compatible update, reconnect, and reopen. | The new version eventually becomes active without losing existing evidence fixtures. |
| RL-OFF-07 | Interrupt update retrieval or activation. | The lab retains a complete usable old or new version rather than a mixed broken state. |

First-time installation while offline is outside the promised behavior.

### Decision threshold

- Failure to cold-launch and run the timer offline after confirmed readiness is
  a blocker for the offline MVP on that environment.
- A browser-versus-Home-Screen display-mode difference is not automatically a
  blocker if the product can explain it and remains usable, but it may define a
  support boundary.
- Data loss or a mixed unusable application version during a normal compatible
  update is a blocker.

## RL-WAK: screen wake lock

### Question

Does the Screen Wake Lock capability actually keep the display awake throughout
the intended workout lifetime in browser and Home Screen modes, and can failure
be detected and explained?

### Setup

Record the device Auto-Lock interval, Low Power Mode, battery state, launch
mode, and whether wake lock is reported as supported. Use a test duration longer
than Auto-Lock so success is observable.

### Cases

| ID | Action | Expected observation |
| --- | --- | --- |
| RL-WAK-01 | Request wake lock from an allowed visible user flow. | Grant or failure is visible and logged; reported grant keeps the display awake past Auto-Lock. |
| RL-WAK-02 | Pause the test after a grant. | The lock remains effective while paused. |
| RL-WAK-03 | Background and foreground after a grant. | Release is detected and reacquisition is attempted when visible. |
| RL-WAK-04 | Reach Complete normally. | The lock remains effective until Done is pressed, then releases. |
| RL-WAK-05 | End the test early. | The lock releases immediately. |
| RL-WAK-06 | Exercise unsupported, denied, or released behavior where reproducible. | The lab reports that the screen may sleep while all timer behavior remains correct. |
| RL-WAK-07 | Repeat the prior cases from the Home Screen. | Results identify the iOS-version boundary and any difference from browser mode. |

### Decision threshold

- Timer corruption caused by wake-lock failure is a blocker.
- Wake-lock absence or denial is an acceptable capability limitation only when
  it is detected, the timer remains correct, and the fallback notice is usable.
- A version-specific Home Screen failure informs the minimum supported version
  or a documented limitation; it must never be treated as a successful lock.

## RL-STO: local storage durability and failure

### Question

Can representative local-first data and timer checkpoints be stored and read
atomically, can persistence status be observed, and do failures leave a
recoverable state?

### Test fixture

Store synthetic examples representing routines, packs near their documented
limits, participants, preferences, attendance, recovery checkpoints, and a
versioned backup. Include an integrity marker so partial or mismatched records
are detectable.

### Cases

| ID | Action | Expected observation |
| --- | --- | --- |
| RL-STO-01 | Write, close, cold-launch, and read the fixture. | Every record and integrity marker matches. |
| RL-STO-02 | Query persistence and request it from an eligible context. | Supported, granted, denied, or unavailable status is recorded without assuming success. |
| RL-STO-03 | Perform an atomic replacement and inject a controlled failure before completion. | The prior complete fixture remains available; no partial replacement is selected. |
| RL-STO-04 | Exercise a controlled quota/write failure. | The failure is actionable and prior stored data remains readable. |
| RL-STO-05 | Export, erase lab data, and restore the fixture. | The exported file validates completely before one atomic restore. |
| RL-STO-06 | Clear the site's data using operating-system or browser settings. | The next launch presents a clean local state and explains expected data loss. |

The lab cannot force or fully predict operating-system eviction. An inability to
reproduce eviction is Inconclusive, not proof that eviction cannot occur.

### Decision threshold

- Partial replacement, silent corruption, or an unrecoverable ordinary write
  failure is a blocker for local-first data behavior.
- Best-effort storage or refusal to grant persistent mode is an accepted
  platform risk only with clear warnings, export/restore, and correct handling
  of missing data.

## RL-SPE: speech, voice availability, and privacy

### Question

What voices does the browser expose, when do they become available, can their
locality be determined reliably, and how do speech and audio behave across
offline, interruption, and Home Screen conditions?

### Safety rules

- Use generic fixtures such as `Test Person! Begin the test interval.`
- Never use an imported private pack or real participant roster.
- Online-capable speech tests require a separate explicit lab consent each run.
- RL-SPE-01 through RL-SPE-08 do not contact a third-party speech API.
- RL-SPE-09 through RL-SPE-24 may contact only the configured server-side proxy
  and only for the visible generic fixture. Provider keys must never enter the
  browser, bundle, repository, logs, or exported evidence.
- Network observation can reveal application requests but may not prove whether
  an operating-system voice uses an internal network service. Voice metadata
  and observed behavior must be reported without overstating certainty.

### Cases

| ID | Action | Expected observation |
| --- | --- | --- |
| RL-SPE-01 | Enumerate voices at initial load and after voice-list change events. | Arrival time, identity, language, default status, and exposed locality metadata are logged. |
| RL-SPE-02 | Preview System Default and an identified local voice after user interaction. | Generic text is spoken or an actionable unavailability result is recorded. |
| RL-SPE-03 | Repeat local-eligible speech in airplane mode. | Speech succeeds locally or the claimed locality limitation is exposed. |
| RL-SPE-04 | Select a voice, relaunch, and simulate or observe its disappearance. | An eligible System Default is used or speech becomes unavailable without blocking the timer. |
| RL-SPE-05 | Attempt to use a voice whose locality is online or unknown while online voices are disallowed. | No private utterance is provided to that voice. |
| RL-SPE-06 | Explicitly consent to an identified online voice using synthetic text. | Only the current synthetic utterance is supplied; disabling consent prevents future use. |
| RL-SPE-07 | Background, lock, interrupt audio, and return during separate utterances. | Speech may stop or fail, but the timer timeline remains independent and missed speech is not replayed. |
| RL-SPE-08 | Repeat discovery and playback in Home Screen mode. | Differences from browser mode are recorded. |
| RL-SPE-09 | Play Browser SpeechSynthesis without mirroring. | Baseline output destination and timing are recorded. |
| RL-SPE-10 | Play Browser SpeechSynthesis while mirrored. | Phone, TV, both, or neither is recorded. |
| RL-SPE-11 | Play the static fixture with HTMLAudioElement while mirrored. | Routing and playback-start timing are recorded. |
| RL-SPE-12 | Decode and play the same fixture with Web Audio while mirrored. | Routing, decode time, and playback timing are recorded. |
| RL-SPE-13 | Compare every playback path in an otherwise identical setup. | A destination is recorded for each path without inference from API events. |
| RL-SPE-14 | Repeat in Safari and installed Home Screen mode. | Launch-mode differences are explicit. |
| RL-SPE-15 | Play representative workout music during each speech path. | Audibility, routing, ducking, and interruption are noted. |
| RL-SPE-16 | Repeat static playback at least 20 times in a representative long session. | There are no unexplained routing changes, duplicates, or late replays. |
| RL-SPE-17 | Background and restore between separate utterances. | Missed or completed speech is not replayed. |
| RL-SPE-18 | Rotate between portrait and landscape. | Rotation does not unexpectedly change routing or invalidate controls. |
| RL-SPE-19 | Interrupt playback with a notification or other source where practical. | Interruption is visible and timer state stays independent. |
| RL-SPE-20 | Prepare audio, then trigger the numbered simulated transition. | Buffered playback starts within approximately 250 ms. |
| RL-SPE-21 | With the proxy configured, prepare live audio. | Request-to-first-byte and media-ready/decode timing determine prefetch lead time. |
| RL-SPE-22 | Disable the network before and during live generation. | Speech fails independently without delaying or corrupting timer behavior. |
| RL-SPE-23 | Cancel generation or let it finish after its target transition. | The stale result is rejected and never replayed later. |
| RL-SPE-24 | Operate the timer while speech generation and playback succeed or fail. | Timer projection and controls remain independent. |

### Decision threshold

- Any path that supplies private text to an online or unclassifiable voice
  without explicit consent is a product blocker.
- Missing voices, interrupted speech, or unavailable local speech are acceptable
  only when essential timer cues remain independent and the limitation is
  truthful.
- If locality cannot be enforced reliably on a target environment, the product
  must withhold spoken private content there unless the online-speech opt-in is
  enabled.
- External audio is viable only if at least one ordinary media path routes the
  static fixture consistently to the TV, buffered playback begins within about
  250 ms, a long session has no unexplained route changes or replay, provider
  and network failures do not affect the timer, and credentials remain
  server-side. Live generation itself may exceed 250 ms when reliable prefetch
  meets the transition threshold.

## RL-DSP: landscape layout and television mirroring

### Question

Can a minimal representative timer remain readable and operable in landscape
on the phone and when mirrored to a television without relying on orientation
lock?

### Test fixture

Use a neutral layout containing only representative product hierarchy:

1. Large remaining time
2. Current phase
3. Work intervals remaining
4. Cycle, round, and exercise position
5. Next phase
6. Play/Pause plus secondary Skip and End controls

This fixture validates information density and safe placement, not final visual
design.

### Cases

| ID | Action | Expected observation |
| --- | --- | --- |
| RL-DSP-01 | Rotate between portrait and landscape during a running test. | No essential state or control is lost, clipped, or placed under unsafe areas. |
| RL-DSP-02 | Mirror landscape to the intended television setup. | Time and phase are legible from the expected workout distance. |
| RL-DSP-03 | Inspect television edges and aspect-ratio handling. | Essential information remains visible despite safe-area or overscan differences. |
| RL-DSP-04 | Exercise paused, resume countdown, wake warning, recovery notice, and End confirmation states. | Notices and secondary actions do not displace the primary timer hierarchy. |
| RL-DSP-05 | Enable larger text and reduced motion where available. | Essential information and controls remain usable without motion-dependent meaning. |

### Decision threshold

- An unreadable remaining time or inaccessible Play/Pause control in the target
  landscape and mirroring setup blocks final UI design until corrected.
- Overscan or orientation differences are acceptable only when safe layout can
  preserve all essential state without platform-specific orientation locking.

## Lab-level acceptance scenarios

### Run and export an experiment without telemetry

```gherkin
Given the lab is opened with no prior run
When the tester records environment details and runs a case
Then relevant events and observations are visible on the device
And the tester can assign Pass, Fail, Inconclusive, or Not Supported
And the completed run can be exported as portable JSON
And no report, identifier, analytics event, or synthetic fixture is uploaded
```

### Reopen evidence offline

```gherkin
Given a completed run is stored on the device
When the installed lab is cold-launched without a network
Then the run and its event log remain readable
And exporting or erasing the run does not require a network
```

### Keep experiments isolated

```gherkin
Given evidence exists for multiple experiments
When one experiment is reset
Then its disposable state is cleared
And completed evidence for other experiments is unchanged
```

## Result classification and product response

| Classification | Meaning | Required response |
| --- | --- | --- |
| Pass | Expected behavior is repeatable in the stated environment. | Record evidence and retain the product requirement. |
| Fail | Expected behavior is reproducibly incorrect. | Treat according to the experiment threshold; do not hide it with optimistic wording. |
| Inconclusive | Setup, observability, or platform control cannot establish a result. | Improve the experiment or retain the risk explicitly. |
| Not Supported | The capability is absent or deliberately unavailable. | Validate the fallback and decide the support boundary. |

One successful run is not sufficient for a blocker experiment. RL-TIM, RL-OFF,
and RL-WAK cases should be repeated after a fresh launch, with consistent
results recorded on each required environment.

## Exit criteria

The risk-lab milestone is complete when:

1. Every priority-1 case has a recorded verdict on every required environment.
2. Priority-2 cases have either a verdict or an explicitly accepted reason they
   remain inconclusive.
3. Landscape and mirroring have been exercised on the intended TV setup.
4. Reproducible failures have been reduced to a minimal case where practical.
5. Each failure or limitation has a documented product response: change the
   requirement, add a fallback, narrow support, accept the residual risk, or
   reconsider the PWA-only MVP.
6. Approved conclusions have been folded into the main product specifications.
7. The lab is frozen for evidence reproduction or discarded; it is not adopted
   silently as main-application scaffolding.

## Implementation decision status

The repository boundary, minimum supported environment, required physical
device, television mirroring target, hosting and version-identification
strategy, and speech-provider scope are resolved. No remaining environment or
scope decision blocks the implementation-neutral evidence and experiment
design.

The smoke-test evidence guide and initial RL-TIM mapping have been reviewed.
The approved candidate risk-assessment stack is recorded in
[`stack-decision.md`](stack-decision.md). Its use proves the proposed
technologies alongside the PWA capabilities; it does not turn the lab into the
main application's production scaffolding.
