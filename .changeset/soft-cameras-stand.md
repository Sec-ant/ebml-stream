---
"@sec-ant/ebml-stream": minor
---

This release includes several improvements, internal refactors, and developer tooling updates across the repository. Highlights:

- Performance: the decoder's buffering strategy was rewritten to use a resizable `Uint8Array` with offset management and exponential growth, reducing repeated ArrayBuffer concatenation and dramatically improving performance for workloads that write many small chunks (the old concat-on-every-write approach caused O(N^2) copying).
- API & runtime: many internals were migrated from `ArrayBuffer` to `Uint8Array` for more efficient parsing and encoding. The package now targets modern ES modules and a Vite-based build.
- Correctness: fixes to VINT parsing (`readVint`), UTF-8 handling, and error handling reduce edge-case bugs and improve type safety.
- Developer experience: added a `bench` npm script to run Vitest benchmarks (`vitest bench`), upgraded build/test tooling (Vite, Vitest 4, Biome linting, and additional dev-deps), and added git/commit tooling.

Notes for consumers:

- Import path / package name: ensure you import from `@sec-ant/ebml-stream` (this package) rather than older `ebml-web-stream` if you upgrade.
- Data type difference: many APIs now accept/return `Uint8Array` instead of raw `ArrayBuffer`. Converting is straightforward (`new Uint8Array(buf)` / `.buffer`), but please verify any custom integrations.
- Module format: the package is published as an ES module; CommonJS consumers may need to use dynamic import or a bundler that supports ESM interop.

These changes are primarily improvements and fixes. Consumers should review the notes above and test their integration when upgrading.
