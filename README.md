# CHARLIE OS

A local-first personal workspace for tasks, projects, and time. `PROJECT_SPEC.md` is the product source of truth; `AGENTS.md` contains contributor guidelines.

This foundation includes a Tauri 2 desktop window and a React/TypeScript shell built with Vite and Tailwind CSS. Today is selected; the remaining navigation sections are explicitly unavailable placeholders. Persistence, planning, task workflows, integrations, and AI are not implemented in this iteration.

## Development

Use Node.js 22.18+ (or a supported newer LTS), pnpm 11.19.0, stable Rust with the `x86_64-pc-windows-msvc` host, Microsoft C++ Build Tools, a Windows SDK, and WebView2.

```powershell
cd C:\dev\charlie-os
pnpm install --frozen-lockfile
pnpm tauri dev
```

Tauri starts Vite on `http://localhost:1420`, compiles the Rust backend, and opens the native CHARLIE OS window. Close the window and stop the terminal with Ctrl+C when finished. Port 1420 must be available. Restart your terminal if it cannot find Cargo after installing Rust.

## Validation commands

- `pnpm typecheck`: check the application and Vite configuration.
- `pnpm build`: type-check and generate the frontend in `dist/`.
- `pnpm lint`: check TypeScript, React, and configuration files.
- `pnpm format:check`: check frontend/documentation formatting.
- `pnpm format`: format files, preserving the supplied specification and guide.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: check Rust formatting.
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`: check the native backend.
- `cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings`: check Rust linting.
- `pnpm tauri build`: build the desktop application and installer packages; packaging is separate from the development validation for this foundation.

No test runner has been added yet because there is no domain or persistence behavior to test. Add meaningful domain tests with the first functional slice.

## Structure and boundaries

- `src/app/`: application composition, shell, and navigation.
- `src/components/ui/`: shared presentation components.
- `src/features/`: feature views, starting with Today.
- `src/domain/`: reserved for pure models, planning, priority, and date logic; no React or Tauri dependencies.
- `src/application/`: reserved for use cases and repository/provider interfaces.
- `src/adapters/`: reserved for concrete bridges such as Tauri commands.
- `src/styles/`: Tailwind and semantic color tokens. System light/dark mode works by default; a future preference can set `data-theme="light"` or `data-theme="dark"` on the document root.
- `public/`: locally bundled static assets, including the CHARLIE mark.
- `src-tauri/`: Rust runtime, window configuration, capabilities, and application icons.

SQLite will live behind Rust repositories and versioned migrations in a later iteration. Zustand can be added when shared frontend state is needed. Neither is required for this static shell.

## Dependencies

Direct runtime dependencies: `react` and `react-dom` render the application; Rust `tauri` provides the native runtime. Rust `tauri-build` is the build dependency for configuration and resources.

Direct frontend development dependencies: `typescript`, `@types/react`, `@types/react-dom`, and `@types/node` provide type checking; `vite` and `@vitejs/plugin-react` provide development serving and bundling; `@tauri-apps/cli` runs desktop development/build commands; `tailwindcss` and `@tailwindcss/vite` compile styles; `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, and `globals` enforce lint rules; `prettier` formats source files. Lockfiles record all resolved transitive dependencies.

The starter greeting command, framework logos, opener plugin, unused Tauri JavaScript API, and unused direct serialization dependencies have been removed.
