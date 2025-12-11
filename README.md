# setup-seal
GitHub Action to programmatically install the Luau runtime [_seal_](https://github.com/seal-runtime/seal) for CI pipelines.

## Features
- Supports all platforms supported by _seal_ (Windows, MacOS & Linux) and their supported architectures (ARM64 for MacOS and x64 for Windows and Linux)
- Caches _seal_ with tool cache to reduce loading time for workflows under the same runner
