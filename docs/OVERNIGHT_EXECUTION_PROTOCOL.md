Overnight Autonomous Execution Protocol
Purpose

This document defines how the agent must behave during unattended or long-running execution sessions (e.g., overnight).

The goal is:

Prevent drift

Prevent skipping

Prevent schema hallucination

Prevent partial-completion marking

Ensure deterministic continuation

1️⃣ Execution Anchor

Before doing any work, the agent must:

Read:

docs/master-plan-v1.md

docs/codebase-overview.md

prisma/schema.prisma

Identify:

## Last Left Off Here

Current [~] task (or first [ ] if none in progress)

No task may be selected outside the Canonical Order Checklist.

2️⃣ Deterministic Task Selection

Follow the Autonomous Execution Contract strictly:

If a [~] task exists → continue it.

Else → pick first [ ] in top-to-bottom order.

Never skip ahead.

Only one task may be [~].

3️⃣ Scoped Implementation Only

The agent must:

Implement only the currently selected task ID.

Not refactor unrelated modules.

Not expand scope beyond the selected task section.

Not pre-implement future phases.

4️⃣ Mandatory Preflight Gates

Before writing code:

Run reuse/refactor-first scans.

Confirm Prisma schema alignment if database is touched.

Confirm plan section alignment.

No schema guessing.
No duplicate files.

5️⃣ Validation Before Completion

A task may only move [~] → [x] if:

Typecheck passes

Targeted tests pass

Lint passes

Source plan updated

Master plan updated

Changelog updated

No validation → no completion.

6️⃣ Auto-Advance Behavior

If:

Task completes successfully

No stop condition triggered

Then:

Mark [x]

Update completion %

Append Job Summary

Commit changes

Move to next task

Repeat until:

Stop condition occurs

Explicit blocker is encountered

7️⃣ Stop Conditions (Mandatory Halt)

The agent must stop and mark [!] if:

Tests fail and cannot be resolved in task scope

Schema change is ambiguous

Migration risk exists

External credentials are required

Architectural invariant conflict detected

No guessing.
No silent bypassing.

8️⃣ Architectural Invariants Must Not Change

The following may not be altered:

Intake unification model

Correction → Matching pipeline order

Organic as attribute

Provider-agnostic integrations

Master plan as canonical execution order

Prisma schema as authoritative database contract

9️⃣ Logging & Documentation Discipline

After each completed task:

Update ## Latest Job Summary

Update completion %

Append to changelog (newest on top)

Update codebase overview if structure changed

🔟 Behavioral Rule

The agent must behave deterministically and conservatively.

Speed is secondary to correctness.

No speculative refactors.
No architectural experimentation.
No scope expansion.