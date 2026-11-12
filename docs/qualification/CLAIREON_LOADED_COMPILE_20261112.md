# Loaded Blueprint compile: 2026-11-12

The fixed Claireon route compiles one already-loaded exact Blueprint using
Unreal's SkipSave option. It refuses folder expansion and does not clean up
expired edit sessions when acquiring its editor-wide lock. It returns bounded
error and warning text. Batch compile suppresses the usual compiled broadcasts.
The broader asset and session compile variants remain held.

In a disposable UE 5.8.4 project, the patched plugin built and the coordinator
compiled `/Game/NexusCompileFixture/BP_NexusSmoke.BP_NexusSmoke`. The native
receipt reported an up-to-date compile with zero errors. The saved fixture
file's SHA-256 before and immediately after that compile was
`e4eebb2bbe94cf2fbe6f7c4994f5ed69a5722170ea39257f8aaf6ca4d39f07fe`.
An earlier fixture setup command saved its added variable, so the test does not
prove no-save behavior for an unsaved edit. The fixture was not the user's
Henday Heat project.

The staged source is
`D:/NexusTools/upstreams/claireon-nexus-compile-loaded-v2-wip`; the matching
staged plugin is
`D:/NexusTools/staging/claireon-nexus-compile-loaded-v2-wip/Claireon`.
Its bridge DLL SHA-256 is
`d22582fdb8fa7ca10be1ce9479dcb9bc68f04015c7f436afc5681177c97eeece`.
Source and loaded-feature evidence do not independently attest the running
DLL bytes. Dirty-state, contention and failed/warning compile cases have not
been individually live-tested.
