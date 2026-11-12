# CAP-18A WebSocket ingress fixture

Historical note: this is an isolated local protocol fixture, **not a production receiver, a native patch, an Unreal qualification, or a configured application budget**. The original held route was unchanged when this fixture was written.

The pinned UE-MCP lock at `62bb9a8f4a41b8ce5ff9a0fbbd5fbe0f49a39c7d` records `ws` 8.22.0 with tarball integrity `sha512-Ydggc987+RO0AnWtZ/7Wq9FtNvcrL1b/RO0ud9mWjUPgDrsAAwQSF51sm2hm1XofbU/4jkpGEsLFsZZxU+1DOg==`. Acquire that package separately, verify its complete archive against the lock integrity, extract it into a trusted disposable directory, and set `NEXUS_WS_FIXTURE_ROOT` to its absolute package directory. The fixture checks the package name/version but does **not** itself authenticate the package or its extracted files. It runs without installing a dependency into Nexus:

```sh
NEXUS_WS_FIXTURE_ROOT=/absolute/path/to/verified/package node scripts/cap18-ws-ingress-fixture.mjs
```

The fixture starts an ephemeral loopback server and client using that package. It checks delivery at 1024 bytes, rejection of an oversized frame declared by its header before a body is sent, an uncompressed fragmented message exceeding the aggregate bound, and a compressed message whose inflated size exceeds it. The positive compression case is a library observation, not a recommendation to enable it for production. The observed errors must occur without a completed `message` event.

At the pin, the native gateway bridge uses `new WebSocket(url)` on its shared connection and parses `message` data as JSON before request correlation; this fixture does not exercise that bridge. `ws` 8.22.0 checks declared aggregate lengths before consuming a complete uncompressed message and also tracks decompressed lengths. Its use of JavaScript's signed 32-bit coercion for `maxPayload` means a production policy must validate numeric bounds before passing them in. This demonstration does **not** prove the OS, Node stream, network buffers, or decompressor make no allocations before rejection: an incoming chunk is already allocated, and compressed data is inflated in chunks. It does not establish a CPU, concurrent-memory, native capture, JSON/base64, or MCP-output budget.

Before use, the selected direct-byte route still needs scoped socket ownership, a reviewed end-to-end budget, identity/epoch and request correlation, post-dispatch fencing, secure loaded artifact evidence, an engine-specific capture allocation bound and actual live qualification. A global limit applied to the existing shared connection could break unrelated operations; no such change is made here. See [direct patch plan](CAP18A_DIRECT_PATCH_PLAN.md) and [transport decision evidence](CAP18A_TRANSPORT_DECISION_EVIDENCE.md).
