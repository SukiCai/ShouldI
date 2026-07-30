# ShouldI Explore Live Voting Acceptance

Use this checklist when validating Explore live-voting behavior in QA and release sign-off.

## Primary UX Metrics

- **3-second recognition:** A new user can identify the voting action in under 3 seconds.
- **Interaction count:** Completing one vote from Explore requires at most 2 required interactions (optional reason excluded).
- **Primary-action clarity:** Explore cards present voting as the dominant action; overflow menu actions remain secondary.

## Interaction Contracts

- `...` always opens a bottom sheet with clear utility actions:
  - `View discussion`
  - `Save decision`
  - `Follow updates`
  - `Report issue`
- `Vote now` opens a light vote flow (`VoteSheet`), not a heavy detail page.
- Vote feedback appears immediately after submit:
  - percentage row transitions
  - subtle haptic
  - `Vote recorded` toast

## Copy and Naming Checks

- CTA language uses short verbs (`Vote now`, `Change vote`, `View discussion`).
- No reintroduction of legacy labels in user-facing copy.
- Explore copy remains calm and action-oriented.

## Safety / Trust Checks

- Users can change vote without dead ends.
- Secondary actions do not block core voting flow.
- Recommendation ownership remains with user in downstream discussion surfaces.
