# Recorded smoke-test results

This log records engineering checkpoints from physical-device testing. The
case definitions, required matrix, repetition requirements, and decision
thresholds in [`risk-lab.md`](risk-lab.md) remain authoritative.

## 2026-08-24: initial deployed PWA timer slice

### Scope and environment

| Field | Observation |
| --- | --- |
| Deployment | GitHub Pages workflow run `Deploy risk lab to GitHub Pages #1` |
| Source | `main` at commit `2a8817a` |
| Deployment result | Success in 36 seconds; one Pages artifact produced |
| Public URL | `https://jack-arnold33.github.io/wheel-of-pain-risk-lab/` |
| Required device | Physical iPhone 15, as reported by the tester |
| Exact iOS version | Not captured in the report supplied to the repository |
| Launch and connectivity modes | Not captured individually in the report supplied to the repository |

### Result

The tester reported that all behavior exposed by the deployed initial slice
worked. This is a passing engineering checkpoint for the implemented
RL-TIM-01 foreground sequence, RL-TIM-02 callback-delay recovery, local report
handling, and GitHub Pages delivery.

This checkpoint is based on one tester report rather than committed exported
run JSON. It does not establish completion of RL-TIM-03 through RL-TIM-12,
RL-OFF, or the full required environment matrix. Priority-one cases still need
repeat runs with the exact iOS version, browser or Home Screen launch mode, and
connectivity recorded in each exported report.

### GitHub Actions Node.js 20 warning

The successful deployment included this GitHub annotation:

> Node.js 20 is deprecated. The following actions target Node.js 20 but are
> being forced to run on Node.js 24: pnpm/action-setup@v4.

GitHub linked the annotation to its
[`Node 20 deprecation notice`](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/).
The warning concerned the deployment runner action, not JavaScript executed by
the risk lab on the iPhone. The deployment succeeded because GitHub forced the
Node.js 20-based action to run on Node.js 24.

The workflow now uses `pnpm/action-setup@v6`, whose action runtime targets
Node.js 24. The tester confirmed that the next successful GitHub Pages
deployment no longer emitted the Node.js 20 annotation. This deployment
maintenance item is resolved.

## 2026-08-24: Home Screen and offline checkpoint

The tester reported that the PWA was added to the iPhone Home Screen, fully
closed, and then cold-launched successfully in airplane mode. The fixed timer
also ran through Complete while the device remained offline.

This is a passing engineering checkpoint for RL-OFF-01 through RL-OFF-04 on
the reported physical iPhone 15. The exact iOS version and exported run JSON
were not supplied to the repository, so the result does not replace the full
environment record or repetition requirement. RL-OFF-05 through RL-OFF-07
remain open.

## 2026-08-24: Screen wake-lock checkpoint

After the wake-lock build was deployed and the installed PWA adopted the new
service-worker version, the tester reported these physical iPhone 15 results:

| Case | Verdict |
| --- | --- |
| RL-WAK-01: retain wake lock while running | Pass |
| RL-WAK-02: retain wake lock while paused | Pass |
| RL-WAK-03: detect release and reacquire after returning | Pass |
| RL-WAK-04: retain through Complete and release on Done | Pass |
| RL-WAK-05: release immediately on early End | Pass |

The repository does not contain the exported run JSON or exact iOS version,
so this remains tester-reported engineering evidence. TV-mirroring coverage
was not confirmed separately.

The first launch after deployment initially showed the prior cached UI. The
tester confirmed that the new build appeared after the installed PWA adopted
the update. This establishes that updates can be retrieved, but it also
demonstrates the need for visible, safe service-worker update activation in the
actual product.
