# Candidate PWA stack

## Decision

The risk lab uses a production-representative client stack:

- React
- TypeScript
- Vite
- `vite-plugin-pwa` using `injectManifest`
- a custom Workbox-backed service worker
- Dexie over IndexedDB
- plain CSS

GitHub Pages remains the public HTTPS host. The lab has no backend.

## Why this stack is in the lab

The lab now tests two things together:

1. whether an iPhone PWA can satisfy the platform requirements; and
2. whether this candidate stack exposes enough control and observability to
   implement those requirements safely.

React exercises realistic UI and lifecycle integration. Dexie exercises the
candidate local-first persistence layer. Vite and the custom service worker
exercise repository-path deployment, offline launch, caching, and updates.

## Boundary

Using this stack for risk assessment does not make the lab production
scaffolding. Lab code remains disposable, and findings—not source files—carry
forward unless a separate main-application design review approves reuse.

The first slice implements only RL-TIM-01 and RL-TIM-02 plus the minimum PWA,
local evidence, and export surfaces needed to exercise them.
