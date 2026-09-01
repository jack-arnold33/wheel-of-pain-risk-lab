# Risk-lab closeout

> Historical milestone record: the original PWA-feasibility lab closed at this
> point. A later, separately scoped RL-SPE external-audio routing experiment
> reopened the disposable harness without changing the conclusions below. See
> [`external-tts-decision.md`](external-tts-decision.md) for its current status.

## Status and decision

The Wheel of Pain Risk Lab is complete and frozen. It remains a disposable
evidence application and is not the Wheel of Pain Timer implementation.

The tested results are sufficient for the product owner to select an
installable, offline-first PWA for the Wheel of Pain Timer MVP. The proven
candidate stack is also accepted as the product's initial technical baseline:

- React and TypeScript
- Vite with `vite-plugin-pwa`
- a custom Workbox service worker
- IndexedDB through Dexie
- plain CSS
- static HTTPS hosting, initially GitHub Pages
- no required backend, account, analytics, or network connection

Exact dependency versions may advance when product implementation begins. Lab
source code is not production scaffolding and must not be copied without an
ordinary product design and code review.

## Evidence summary

| Area | Result | Product conclusion |
| --- | --- | --- |
| GitHub Pages deployment | Pass | Static public HTTPS hosting can deliver the PWA. |
| Home Screen installation | Pass | The PWA can be installed on the required physical iPhone 15. |
| Offline cold launch | Pass | A previously loaded installed PWA launches in airplane mode. |
| Offline timer completion | Pass | The core timer can run without a network connection. |
| Foreground timer sequence | Pass | The deterministic sequence advances without zero linger. |
| Controlled callback delay | Pass | Elapsed-time projection catches up instead of extending a phase. |
| Wake lock while running and paused | Pass | The display can remain awake through the active workout lifetime. |
| Wake-lock background lifecycle | Pass | Release is observable and reacquisition succeeds after return. |
| Wake-lock completion and early end | Pass | The lock remains through Complete and releases on Done or early End. |
| Installed-app update adoption | Observed with friction | A cached old UI appeared before the new service worker was adopted. The product needs visible safe-update activation. |

The required support target remains iPhone 15 with a minimum iOS version of
26.6. The repository evidence identifies the physical iPhone 15 but does not
include exported run JSON independently confirming the exact installed iOS
version.

## Product requirements derived from the lab

The actual timer must:

1. Calculate an active timer from elapsed time rather than callback counts.
2. Install to the iPhone Home Screen and cold-launch offline after a confirmed
   successful online load.
3. Request screen wake lock from the workout Play action.
4. Retain wake lock while running, paused, and on the persistent Complete
   screen.
5. Detect platform release and attempt reacquisition when the active workout
   becomes visible again.
6. Release wake lock immediately on End Workout and after Done dismisses
   Complete.
7. Show a truthful warning when wake lock is unsupported, denied, or released;
   timer correctness must not depend on the lock.
8. Detect a waiting application version and provide a visible, safe activation
   path without corrupting local data or an active workout.
9. Keep routines, packs, preferences, participants, and workout state local by
   default.

## Explicitly deferred or unvalidated

The following results are not Pass:

- RL-TIM-03 through RL-TIM-12 were intentionally deferred. The product owner
  considers interaction with another phone activity a reason to pause the
  workout. Ordinary recovery behavior remains a product acceptance concern,
  not a reason to continue this lab.
- RL-OFF-05 through RL-OFF-07 were not completed as formal cases. Update
  retrieval was observed, including stale-cache friction, but interrupted or
  mixed-version updates were not exercised.
- Storage durability, quota failure, atomic replacement, and backup restoration
  were not tested beyond basic local evidence persistence.
- Browser voice availability, locality enforcement, offline speech, and speech
  privacy were not tested.
- Landscape legibility, television overscan, and the exact mirrored-TV setup
  were not formally validated.
- Unsupported or denied wake-lock behavior was visible in a desktop-browser
  smoke check, but the complete RL-WAK-06 matrix was not run on the iPhone.

These items are accepted as implementation-stage risks. They must not be cited
as lab-validated behavior in the product repository.

## Repository disposition

- Keep the deployed lab and this repository available for evidence reference.
- Do not add product features or evolve it into the main timer.
- Correct only defects that invalidate already-recorded evidence.
- Record the accepted PWA architecture and linked findings in the Wheel of Pain
  Timer specifications.
