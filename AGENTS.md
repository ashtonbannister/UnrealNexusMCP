# Unreal Nexus MCP

This repository curates one public implementation per reviewed semantic operation.
It contains a catalogue, MCP host and lazy backend adapters, not a merged native
plugin or live-qualified Unreal installation. Read `docs/IMPLEMENTATION_SELECTION.md` and
`docs/MASTER_SKILL_GUIDANCE_DRAFT.md` before changing routing.

- For task priorities and progress, read `MASTER_ROADMAP.md` and its linked task
  registers. Planned work does not change the executable allowlist or relax the
  requirements below; record completion with the stated evidence.
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
- Keep source verification, OS process epochs, native/listener identity and live
  capability checks separate. A source checkout is not proof of a loaded DLL.
  Required compatibility patches need exact source hashes AND live markers.
- The master guidance is served as MCP resources/instructions/prompt. Keep its
  section mapping and actual callable canonical operations synchronized.
- Do not copy restricted source or remove upstream licence notices.
- Run `npm ci --ignore-scripts` then `npm run check` (Node 22+). Protocol tests
  launch fixture processes and loopback listeners; they need ordinary local
  process/network permissions. They do not constitute live Unreal qualification.
- Keep master skill guidance a draft; do not install a skill or publish a package.
