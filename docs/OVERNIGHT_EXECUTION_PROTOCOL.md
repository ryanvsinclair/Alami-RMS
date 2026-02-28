# Overnight Execution Autonomy Contract (Full Completion Mode)

Status: Active
Last Updated: 2026-02-28
Purpose: maximize autonomous overnight completion of the v2 master plan while preserving architectural safety.

This contract supersedes conservative overnight behavior that halted on minor uncertainty.

Canonical references:

- `docs/master-plan-v2.md`
- `docs/execution-constitution.md`
- Active source plans referenced by `docs/master-plan-v2.md`

`docs/master-plan-v1.md` is archived and must not be used for active execution selection.

## 1. Core Execution Mandate

The agent is explicitly authorized to:

1. Execute the master plan end-to-end autonomously.
2. Continue across initiatives when sequence gates are satisfied.
3. Resolve minor ambiguities using best-fit interpretation aligned to constitution.
4. Prefer forward progress over pausing for clarification.

Default action:

- Continue safely; do not wait.

## 2. Autonomous Resolution Rule

If a non-destructive ambiguity occurs, the agent must:

1. Choose the safest additive interpretation.
2. Log the assumption as `ASSUMED - SAFE`.
3. Continue execution.

Do not halt for:

1. Minor naming decisions.
2. Internal refactor structure choices.
3. UI layout detail choices.
4. Small enum naming clarifications.
5. Optional field nullability decisions (if non-breaking).

Halt only for destructive or invariant-breaking conflicts.

## 3. Revised Hard Stop Conditions (Strictly Limited)

The agent must halt only if:

1. A destructive DB migration is required (drop/rename/type change).
2. A constitutional invariant would be violated.
3. Live production data would be put at risk.
4. Required external credential is missing and no safe bypass exists.
5. Sequence gates make progression logically impossible for all remaining eligible work.

All other issues must be resolved autonomously.

## 4. DB Migration Policy (Autonomous but Safe)

Allowed autonomously:

1. Create new tables.
2. Add new columns.
3. Add enums.
4. Add indexes.
5. Tighten constraints if non-breaking.
6. Generate and apply additive migrations.

Not allowed without explicit scope approval:

1. Drop tables or columns.
2. Rename existing columns.
3. Change existing column types.
4. Remove enum values.
5. Rewrite RLS policies unless explicitly scoped.

If unsure whether migration is destructive:

- Assume additive-only and continue safely.

## 5. No Permission Loop Clause

The agent is prohibited from stopping solely to request:

1. Style clarification.
2. Minor schema naming clarification.
3. Internal implementation preference.
4. File organization preference.
5. Test formatting preference.
6. Minor UX interpretation.

If in scope and non-destructive:

- Resolve and continue.

## 6. Sequence Gate Optimization

Sequence gates remain enforced from `docs/master-plan-v2.md`.

However:

1. If one stream is gated, continue any other eligible stream whose gates are satisfied.
2. Do not stall the run because one gated stream cannot advance.

Example:

- If `DI-*` is gated behind `LG-00`, continue eligible RPK/RTS/IMG-L/UX-L/LG work.

## 7. Safe Assumption Framework

When assumptions are required, default to:

1. Additive schema.
2. Minimal abstraction.
3. No new dependencies.
4. No UI experimentation.
5. Grayscale/minimal styling.
6. One-level relational hierarchy.
7. Existing patterns over invention.
8. Simplicity unless explicitly told otherwise.

## 8. UI Autonomy Clarification

The agent may:

1. Implement structural UI required for feature completion.
2. Use homepage-approved tokens.
3. Default to neutral minimal styling.

The agent must not:

1. Add glow, gradients, or stylistic experiments.
2. Re-theme existing pages.

If uncertain:

- Use Apple/Tesla/Google-level minimal restraint and continue.

## 9. Controlled Diff Expansion Rule

The agent may expand change surface when:

1. Required to complete a phase coherently.
2. Within initiative boundary.
3. Not introducing architectural redesign.

Do not halt solely due to number of files modified.

If change surface is large:

- Log rationale and continue.

## 10. Phase Completion Priority

The agent is explicitly authorized to:

1. Continue through all eligible phases.
2. Complete the master plan fully where possible.
3. Apply additive migrations.
4. Generate tests.
5. Sync documentation.
6. Advance to next phase automatically.

Default mode:

- Finish everything possible before stopping.

## 11. Soft Stop Instead of Hard Halt

If uncertainty is non-destructive:

1. Log as `ASSUMED - SAFE`.
2. Continue.

Escalate only if continuing risks:

1. Data loss.
2. Invariant violation.
3. Destructive schema impact.

## 12. Execution Goal

By end of overnight run:

1. All additive migrations applied.
2. All scoped eligible initiatives complete.
3. All sequence gates respected.
4. All validation passing for completed tasks.
5. No destructive changes made.
6. No drift outside master plan.
7. No creative scope expansion.

If full completion is possible within constraints, it must be achieved.

## 13. Required Control Rails (Still Mandatory)

This full-completion mode does not remove these controls:

1. Deterministic task selection from `docs/master-plan-v2.md`.
2. Mandatory constitution restatement before each task.
3. Expanded validation gate before marking `[x]`.
4. Source-plan, master-plan, and changelog synchronization.
5. `docs/codebase-overview.md` updates when architecture/behavior changes.
6. One scoped git commit to this repository is required after each completed checklist step before advancing.

Hard rule:

- No validation evidence means no completion mark.

## 14. Operational Loop

Repeat until no eligible work remains or a hard stop condition is hit:

1. Select next eligible task deterministically.
2. Restate constitution and scope.
3. Run scoped preflight.
4. Implement in-scope changes.
5. Run validation.
6. Sync docs and status.
7. Create a scoped git commit to this repository for the completed step and record hash in job summary/changelog.
8. Advance automatically.

Philosophy shift:

- Continue unless dangerous.
