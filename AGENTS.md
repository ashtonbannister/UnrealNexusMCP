# Unreal Nexus MCP

This repository exposes the complete supported toolsets of configured Unreal MCP
providers through one Nexus entrypoint. Preserve provider implementations and
input/output contracts; namespace public names as `<provider>__<original-name>`.
The optional canonical catalogue retains selected workflows and their existing
contracts alongside the full provider surface. Read `docs/IMPLEMENTATION_SELECTION.md`
and `docs/MASTER_SKILL_GUIDANCE_DRAFT.md` before changing routing.

- For task priorities and progress, read `MASTER_ROADMAP.md` and its linked task
  registers for historical canonical work. The current deliverable is the complete
  combined provider interface; do not reduce it to that canonical backlog.
- Keep revisions pinned in `catalog/upstreams.lock.json`.
- Publish each configured provider's full live manifest without filtering its
  tools or inner gateway actions through the canonical catalogue. Canonical
  additions retain their evidence-backed decisions and compatibility requirements.
- Preserve world/client targeting, save scope, warnings, partial results, native
  guards, transport failures and MCP image blocks.
- Reuse provider-native tools, including their supported gateway interfaces,
  without rewriting their behavior. Never add blind mutation retries or automatic
  provider failover.
- A gateway queue is single-process; it cannot replace native game-thread/state
  checks or coordinate other gateway processes/direct backend clients.
- A post-dispatch timeout is an unknown outcome, not rollback. Reconcile externally before
  restarting; do not add a model-callable reset or label cancellation as rollback.
- Keep source verification, OS process epochs, native/listener identity and live
  capability checks separate. A source checkout is not proof of a loaded DLL.
  Required compatibility patches need exact source hashes AND live markers.
- The master guidance is served as MCP resources/instructions/prompt. Keep its
  section mapping and actual callable canonical operations synchronized. Serve
  provider-native guidance separately and preserve namespaced prompts/resources.
- Do not copy restricted source or remove upstream licence notices.
- After implementation, run one host build and the minimal targeted integration
  checks (`npm run build`, `npm run test:integration`; Node 22+). Fix actual
  failures and verify only affected behavior. Avoid repetitive full-suite runs.
  Protocol fixtures do not constitute native Unreal build or live qualification.
- Keep master skill guidance a draft; do not install a skill or publish a package.
