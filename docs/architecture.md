# Architecture

`node-autochglog` is a CLI tool that parses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) from a git repository and renders a changelog via a [Mustache](https://mustache.github.io/) template.

## Data flow

```
git log  ──►  getGitLogInfo()  ──►  organizeCommitsByTagsAndCategories()  ──►  buildChangelogMetadata()  ──►  Mustache.render()  ──►  file
```

1. **`getGitLogInfo`** (`logic/git-parser.ts`) invokes `git log` to obtain commit IDs, dates, messages, and tag decorations. It filters commits matching the `type: description` Conventional Commits pattern and extracts semver-like tags via the `extractTagName` helper.
2. **`organizeCommitsByTagsAndCategories`** (`logic/util.ts`) groups commits under their nearest subsequent tag (release), then sub-groups them by category (the Conventional Commit type prefix). Commits newer than all tags are assigned to the configurable `initialTag`.
3. **`buildChangelogMetadata`** (`logic/util.ts`) transforms the nested map into a `Changelog` object for Mustache rendering, filtering out categories absent from `allowedCategories`, resolving display labels, and sorting releases by date descending.
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
    ├── Category.ts                 A group of commits under a release
    ├── Commit.ts                   A single parsed commit
    ├── GitLogInfo.ts               Raw parsed output from git log
    └── Tag.ts                      A git tag with its date
```

## Layers

| Layer | Responsibility | Side effects |
|-------|---------------|--------------|
| **config** | Load user config JSON, merge with defaults, resolve file paths | Reads filesystem |
| **logic/git-parser** | Invoke `git log`, parse raw output into `GitLogInfo` | Spawns child processes |
| **logic/util** | Organise commits by tags and categories; build `Changelog` metadata | None (pure) |
| **model** | TypeScript interfaces for the data model | None |
| **index** | Orchestrate the pipeline, render template, write output | Reads/writes filesystem |

## Configuration

`NodeAutochglogConfig.ts` is the single source of truth for the config shape and defaults. `configService.ts` handles runtime resolution:

1. Read `node-autochglog.config.json` from `process.cwd()` (optional; missing file is silently ignored).
2. Shallow-merge custom values over `defaultConfig`.
3. Post-process paths: `outputFilepath` is resolved relative to `process.cwd()`; `templateLocation` is resolved relative to `process.cwd()` when non-empty, or falls back to the bundled `DEFAULT_TEMPLATE.mustache`.

Default config values are stored as raw (relative) strings; path resolution is deferred to `processConfig` at runtime.

## Model

- **`Changelog`** — `{ releases: Release[] }`
- **`Release`** — `{ name, categories, date, actualTag }`
- **`Category`** — `{ key, name, commits }`
- **`Commit`** — `{ id, date, message, category }`
- **`GitLogInfo`** — `{ commits, tags }`
- **`Tag`** — `{ name, date }`

## Commit parsing

Commit messages are matched against `/^([^:]+):\s*(.*)/`:

- **Group 1** (everything before the first colon) becomes the `category`.
- **Group 2** (everything after the colon and optional whitespace) becomes the `message`.

Non-matching messages are silently excluded from the changelog.

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

- **`util.ts`** — pure function tests for `organizeCommitsByCategory`, `organizeCommitsByTags`, `organizeCommitsByTagsAndCategories`, and `buildChangelogMetadata`.
- **`git-parser.ts`** — tests with `exec` mocked via `vi.mock('node:util')`, verifying commit parsing, tag extraction, PR-number stripping, and error handling.
- **`configService.ts`** — tests with `fs` mocked, verifying default config, custom config merging, and path resolution.

## Known limitations

- `getGitLogInfo` invokes `git log` five times (IDs, dates, messages, tag dates, tag decorations). A single call with a composite `--pretty=format` would be more efficient and eliminate potential race conditions between calls.
- The `organizeCommitsByTags` function mutates its input by sorting `gitLogInfo.commits` in place.

## Conventions

- **UK English** for identifiers and documentation.
- **Conventional Commits** (without scope) for commit messages.
- **ESLint + Prettier** enforced via pre-commit hook.
