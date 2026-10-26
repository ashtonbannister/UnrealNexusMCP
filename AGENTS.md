# Unreal Nexus MCP

This repository curates one public implementation per reviewed semantic operation.
It contains a catalogue and routing core, not a deployed MCP transport or merged
native plugin. Read `docs/IMPLEMENTATION_SELECTION.md` and
`docs/MASTER_SKILL_GUIDANCE_DRAFT.md` before changing routing.

- Keep revisions pinned in `catalog/upstreams.lock.json`.
- Every exposed operation needs an evidence-backed decision. Unreviewed and
  adapter-required operations must not become callable by accident.
- Preserve world/client targeting, save scope, warnings, partial results, native
  guards, transport failures and MCP image blocks.
- Never add arbitrary backend/Python/console calls, blind mutation retries or
  automatic provider failover.
- A gateway queue is single-process; it cannot replace native game-thread/state
  checks or coordinate other gateway processes/direct backend clients.
- A post-dispatch timeout is an unknown outcome, not rollback. Reconcile externally before
  restarting; do not add a model-callable reset or label cancellation as rollback.
- Backend connections and editor-identity attestation remain integration work.
  Configuration declarations alone are not proof of target identity.
- Do not copy restricted source or remove upstream licence notices.
- Run `npm run check` (Node 22+; no dependencies/install required). Tests use
  simulated backends, not a live editor or native compilation.
- Keep master skill guidance a draft; do not install a skill or publish a package.
