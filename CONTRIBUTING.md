# Contributing

Use the GitHub issue forms for reproducible defects and focused feature proposals. All changes to `main` go through a pull request and require code-owner review.

## Setup

```powershell
npm install
npm run build
```

Node.js 22.12 or newer is required locally. The bundled JavaScript Action targets Node 24.

## Quality gate

```powershell
npm run check
```

The command runs:

1. Prettier verification.
2. Typed ESLint rules.
3. TypeScript checking.
4. Vitest tests.
5. Library, CLI and Action builds.
6. CLI and Action smoke tests.
7. An npm package dry run.

Run the network-backed standards gate before requesting review:

```powershell
npm run standards:check
```

## Change rules

| Change                        | Required evidence                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Canonical schema              | Update both JSON schemas, TypeScript types, format documentation and tests.                   |
| Discovery detector            | Add a synthetic positive fixture, a false-positive boundary and a claim-scope assertion.      |
| Evidence semantics            | Demonstrate what the record establishes and what it does not establish.                       |
| CycloneDX or SPDX mapping     | Validate generated output against the official schema and update `docs/STANDARDS-MAPPING.md`. |
| GitHub Action input or output | Update `action.yml`, README documentation and the smoke test.                                 |
| CLI command                   | Add API-level tests and exercise the built command in the smoke test when practical.          |

## Generated Action bundle

GitHub executes `dist/action/index.cjs` directly. Before a release:

```powershell
npm run build
```

The release ref must contain the rebuilt Action bundle. The CLI and library build output can be produced during npm publication, but the Action entry point cannot be absent from the GitHub release ref.

Dependabot cannot rebuild bundled JavaScript. When a dependency update changes the Action bundle, run `npm run build` and include the updated `dist/action/index.cjs` in the same pull request.

## Security and privacy

Do not add:

- real prompts;
- customer data;
- credentials or tokens;
- private model, dataset or deployment identifiers;
- production traces;
- private source material.

Use synthetic fixtures. A detector test should prove that excluded secret paths are not opened or copied into output.
