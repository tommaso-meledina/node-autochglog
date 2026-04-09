# Architecture

`node-autochglog` is a CLI tool that parses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) from a git repository and renders a changelog via a [Mustache](https://mustache.github.io/) template.

## Data flow

```
git log  ──►  getGitLogInfo()  ──►  organizeCommitsByTagsScopesAndCategories()  ──►  buildChangelogMetadata()  ──►  Mustache.render()  ──►  file
```

1. **`getGitLogInfo`** (`logic/git-parser.ts`) invokes `git log` to obtain commit IDs, dates, messages, and tag decorations. It applies `stripPRNumbers` to each subject line, then drops lines matching `excludeCommitMessagePattern` when that string is non-empty (JavaScript `RegExp` syntax, same idea as `tagFilter` but excluding matches). Remaining lines are parsed with the Conventional Commits pattern (`type(scope): description`, scope optional). Semver-like tags are extracted via `extractTagName`.
2. **`organizeCommitsByTagsScopesAndCategories`** (`logic/util.ts`) groups commits under their nearest subsequent tag (release), then sub-groups by scope, then by category (the Conventional Commit type prefix). When `ignoreScope` is `true`, all scope information is cleared before grouping. Commits newer than all tags are assigned to the configurable `initialTag`.
3. **`buildChangelogMetadata`** (`logic/util.ts`) transforms the nested map into a `Changelog` object for Mustache rendering, filtering out categories absent from `allowedCategories` and scopes absent from `allowedScopes` (when the latter is non-empty), resolving display labels for both categories and scopes, and sorting releases by date descending. When at least one commit across the entire changelog has a scope, `scopesEnabled` is set to `true` and scope headings are included; otherwise scope headings are omitted. Scope display names are resolved via `allowedScopes` labels (falling back to the raw scope key when no label is provided). Scopes are sorted alphabetically ascending by resolved name, with unscoped commits placed last under the configurable `unscopedLabel`.
4. **Mustache** renders the `Changelog` object against a template (bundled default or user-supplied) and the result is written to disk.

## Project layout

```
src/
├── index.ts                        CLI entry point; orchestrates the pipeline
├── messages.ts                     Shared string constants
├── config/
│   ├── NodeAutochglogConfig.ts     Config interfaces + canonical defaultConfig
│   ├── configService.ts            Runtime config resolution (merge + path processing)
│   └── DEFAULT_TEMPLATE.mustache   Bundled Mustache template
├── logic/
│   ├── git-parser.ts               Git log invocation, tag extraction, commit parsing
│   └── util.ts                     Pure functions: commit organisation and metadata building
└── model/
    ├── Changelog.ts                Top-level changelog structure
    ├── Release.ts                  A tagged release
    ├── Scope.ts                    A scope group within a release
    ├── Category.ts                 A group of commits under a scope or release
    ├── Commit.ts                   A single parsed commit
    ├── GitLogInfo.ts               Raw parsed output from git log
    └── Tag.ts                      A git tag with its date
```

## Layers

| Layer | Responsibility | Side effects |
|-------|---------------|--------------|
| **config** | Load user config JSON, merge with defaults, resolve file paths | Reads filesystem |
| **logic/git-parser** | Invoke `git log`, parse raw output into `GitLogInfo` | Spawns child processes |
| **logic/util** | Organise commits by tags, scopes, and categories; build `Changelog` metadata | None (pure) |
| **model** | TypeScript interfaces for the data model | None |
| **index** | Orchestrate the pipeline, render template, write output | Reads/writes filesystem |

## Configuration

`NodeAutochglogConfig.ts` is the single source of truth for the config shape and defaults. `configService.ts` handles runtime resolution:

1. Read `node-autochglog.config.json` from `process.cwd()` (optional; missing file is silently ignored).
2. Shallow-merge custom values over `defaultConfig`.
3. Post-process paths: `outputFilepath` is resolved relative to `process.cwd()`; `templateLocation` is resolved relative to `process.cwd()` when non-empty, or falls back to the bundled `DEFAULT_TEMPLATE.mustache`.
4. Sanitise `allowedCategories`: any `(scope)` suffix on keys is stripped and duplicates are removed. This prevents breakage when keys contain legacy scope syntax.

Default config values are stored as raw (relative) strings; path resolution is deferred to `processConfig` at runtime.

## Model

- **`Changelog`** — `{ scopesEnabled, releases }`
- **`Release`** — `{ name, scopes, categories, date, actualTag }`. When `scopesEnabled` is `true`, `scopes` is populated and `categories` is empty; when `false`, `categories` is populated and `scopes` is empty.
- **`Scope`** — `{ name, categories }`
- **`Category`** — `{ key, name, commits }`
- **`Commit`** — `{ id, date, message, category, scope? }`
- **`GitLogInfo`** — `{ commits, tags }`
- **`Tag`** — `{ name, date }`

The output heading hierarchy is: **version > scope > type**. When scope headings are active, types render one heading level deeper than without scopes.

## Commit parsing

Commit messages are matched against `/^([^(:!]+)(?:\(([^)]*)\))?!?:\s*(.*)/`:

- **Group 1** (type prefix before parentheses or colon) becomes the `category`.
- **Group 2** (text inside parentheses, optional) becomes the `scope`.
- **Group 3** (everything after the colon and optional whitespace) becomes the `message`.

Non-matching messages are silently excluded from the changelog. Commits whose full one-line subject (after `stripPRNumbers`) matches `excludeCommitMessagePattern` are omitted before parsing; an empty pattern disables this filter.

Tag decorations are parsed by `extractTagName`, which extracts the first `tag: <name>` entry from the parenthesised decoration string.

## Build pipeline

TypeScript is type-checked with `tsc --noEmit`. Babel (`@babel/preset-typescript`) compiles `.ts` sources to JavaScript in `dist/`. The published package exposes `dist/index.js` as both `main` and `bin`.

## Quality checks

| Script | Tool | Purpose |
|--------|------|---------|
| `npm run lint` | ESLint + Prettier | Lint and format |
| `npm run type-check` | TypeScript | Static type verification |
| `npm run test` | Vitest | Unit tests |

The Husky pre-commit hook runs `npm run lint`.

## Test strategy

Tests live alongside their source in `__tests__/` directories. The test suite covers:

### Unit tests

- **`util.ts`** — pure function tests for `organizeCommitsByCategory`, `organizeCommitsByScope`, `organizeCommitsByTags`, `organizeCommitsByTagsScopesAndCategories`, and `buildChangelogMetadata`.
- **`scope.ts`** — dedicated tests for scope grouping, `ignoreScope` flag, `unscopedLabel`, `allowedScopes` filtering and label mapping, scope sorting, and scoped changelog metadata building.
- **`git-parser.ts`** — tests with `exec` mocked via `vi.mock('node:util')`, verifying commit parsing (including scope extraction), tag extraction, PR-number stripping, and error handling.
- **`configService.ts`** — tests with `fs` mocked, verifying default config, custom config merging, path resolution, and `allowedCategories` sanitisation.

### Integration test

- **`integration.ts`** (`src/__tests__/`) — end-to-end test that creates a temporary git repository with known commits and tags, runs the full pipeline (git log parsing → organising → metadata building → Mustache rendering), and asserts on the generated markdown output. Covers release structure, scope headings, `allowedScopes` filtering/labelling, `ignoreScope` flattening, `stripPRNumbers`, `unscopedLabel`, and `excludeCommitMessagePattern`. The temp repo is created in `beforeAll` and cleaned up in `afterAll`.

## Known limitations

- `getGitLogInfo` invokes `git log` five times (IDs, dates, messages, tag dates, tag decorations). A single call with a composite `--pretty=format` would be more efficient and eliminate potential race conditions between calls.
- The `organizeCommitsByTags` function mutates its input by sorting `gitLogInfo.commits` in place.

## Conventions

- **UK English** for identifiers and documentation.
- **Conventional Commits** (with optional scope) for commit messages.
- **ESLint + Prettier** enforced via pre-commit hook.
