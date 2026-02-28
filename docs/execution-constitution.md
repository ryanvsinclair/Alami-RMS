# Execution Constitution (Immutable)

Status: ACTIVE
Created: 2026-02-28
Last Updated: 2026-02-28
Primary Purpose: define non-negotiable execution rules that apply to every active plan phase.

## Immutable Rules

1. Launch priority is fixed: `restaurant` full support first; other industries follow post-launch.
2. No silent scope expansion: any scope change requires a documented deviation proposal and approval.
3. No product forks: use shared engines with industry packaging/configuration, not duplicated feature codepaths.
4. Intake invariant: receipts do not auto-create inventory.
5. Intake invariant: inventory writes are explicit and eligibility-gated.
6. Intake invariant: unresolved parsed-produce decisions must land in Inventory Fix Later.
7. Validation must confirm more than typecheck/lint:
   - diff size is proportional to the scoped task
   - unrelated files are not modified
   - no new dependencies are introduced unless approved
   - no new environment variables are introduced unless approved
8. Multi-tenant and permission boundaries must not regress.
9. Canonical docs must stay synchronized after each completed slice:
   - active source plan(s)
   - `docs/master-plan-v2.md`
   - `docs/codebase-changelog.md`
   - `docs/codebase-overview.md` when behavior/architecture changes
10. Each completed checklist step/slice must be committed before advancing:
   - create one scoped git commit per completed step
   - include task ID in commit message
   - record commit hash in session summary/changelog evidence

## UI and UX Design Constitution (Required For UI Work)

1. Visual minimalism mandate:
   - Disallowed: glow effects, gradient buttons, heavy shadows, glassmorphism, decorative motion, animated color flair.
   - Allowed: thin borders, clean hierarchy, functional hover states, very subtle elevation only when needed.
2. Color governance:
   - Use only homepage-defined tokens, neutral grayscale, or transparent variants of approved colors.
   - Do not introduce new hex values, random Tailwind accents, or ad-hoc accent colors.
   - Red/green/yellow only when semantically required (error/success/warning).
3. No-invention rule:
   - If uncertain about color/spacing/animation, use minimal system defaults (Apple/Tesla/Google-style restraint).
   - Default to neutral surfaces, thin borders, soft radius, clean typography, no decorative effects.
4. Design-is-placeholder rule:
   - Refactor-phase UI is structural, not final brand exploration.
   - Prioritize functional clarity, layout correctness, and component consistency.
5. Shadow and depth policy:
   - Allowed: subtle `0px 1-2px` soft neutral shadow.
   - Disallowed: multi-layer shadows, colored shadows, outer glow.
   - If unsure, use border instead of shadow.
6. Typography constraints:
   - Use existing font stack only; no new fonts or stylized display typography.
   - Maintain restrained hierarchy and spacing.
7. Motion policy:
   - Disallowed in autonomous refactors: Framer Motion additions, animated gradients, decorative micro-animations.
   - Allowed: minimal functional transitions only.
   - If unsure, use no animation.
8. Component fallback rule when uncertain:
   - Neutral background, thin border, subtle radius (6-10px), optional soft shadow, primary token only for primary actions.
9. Design surface freeze:
   - Do not redesign existing page hierarchy, reposition major blocks, or change homepage color tokens during autonomous runs.
   - Implement missing structure only.
10. Mandatory design restatement before UI tasks:
   - confirm no new colors, no glow, no gradients
   - confirm homepage tokens only
   - confirm minimal fallback system used where uncertain
11. Hard mode default:
   - If a design decision requires creative judgment, default to grayscale.

## Mandatory Restatement Template

Paste this before starting any task:

```
Constitution Restatement
- Task ID:
- Scope (1 sentence):
- Invariants confirmed:
  1) no silent scope expansion
  2) no product fork
  3) receipts do not auto-create inventory
  4) inventory writes remain explicit and eligibility-gated
  5) unresolved produce decisions route to Fix Later
- Validation controls confirmed:
  1) proportional diff check will be recorded
  2) unrelated file check will be recorded
  3) dependency change check will be recorded
  4) env var change check will be recorded
  5) per-step commit checkpoint will be recorded
- UI/UX confirmations (required when task touches UI):
  1) no new colors introduced
  2) no glow introduced
  3) no gradients introduced
  4) styling uses homepage tokens only
  5) minimal fallback system used where uncertain
```

## Deviation Proposal Template

Use this when any plan change is needed:

```
Deviation Proposal
- Related Task ID:
- Requested Change:
- Why current plan is insufficient:
- Alternatives considered:
- Impact:
  - scope
  - risk
  - timeline
  - rollback
- New dependencies: yes/no (details)
- New environment variables: yes/no (details)
- Approval status: pending/approved/rejected
```
