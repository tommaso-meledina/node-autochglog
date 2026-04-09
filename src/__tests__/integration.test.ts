import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import Mustache from 'mustache';
import { getGitLogInfo } from '../logic/git-parser';
import {
  buildChangelogMetadata,
  organizeCommitsByTagsScopesAndCategories
} from '../logic/util';
import { NodeAutoChglogConfig } from '../config/NodeAutochglogConfig';

const TEMPLATE_PATH = join(__dirname, '../config/DEFAULT_TEMPLATE.mustache');

const makeConfig = (
  overrides?: Partial<NodeAutoChglogConfig>
): NodeAutoChglogConfig => ({
  tagFilter: '^\\d+\\.\\d+\\.\\d+$',
  initialTag: 'Unreleased',
  templateLocation: TEMPLATE_PATH,
  targetBranch: 'main',
  outputFilepath: 'CHANGELOG.md',
  allowedCategories: [
    { key: 'feat', label: 'Features' },
    { key: 'fix', label: 'Fixes' },
    { key: 'refactor', label: 'Refactoring' }
  ],
  allowedScopes: [],
  stripPRNumbers: false,
  ignoreScope: false,
  unscopedLabel: 'not scoped',
  excludeCommitMessagePattern: '',
  ...overrides
});

const renderChangelog = async (
  config: NodeAutoChglogConfig
): Promise<string> => {
  const gitLogInfo = await getGitLogInfo(config);
  const organised = organizeCommitsByTagsScopesAndCategories(
    gitLogInfo,
    config
  );
  const changelog = buildChangelogMetadata(organised, gitLogInfo.tags, config);
  const template = readFileSync(TEMPLATE_PATH, 'utf-8');
  return Mustache.render(template, changelog);
};

const gitCommit = (tempDir: string, message: string, date: string) => {
  execSync(
    `GIT_AUTHOR_DATE="${date}" GIT_COMMITTER_DATE="${date}" git commit --allow-empty -m "${message}"`,
    { cwd: tempDir, stdio: 'pipe' }
  );
};

const gitTag = (tempDir: string, name: string, date: string) => {
  execSync(`GIT_COMMITTER_DATE="${date}" git tag -a "${name}" -m "${name}"`, {
    cwd: tempDir,
    stdio: 'pipe'
  });
};

describe('integration: full pipeline against a real git repository', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), 'autochglog-integration-'));

    execSync('git init', { cwd: tempDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', {
      cwd: tempDir,
      stdio: 'pipe'
    });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });

    // --- Release 1.0.0 ---
    gitCommit(tempDir, 'feat(api): add users endpoint', '2025-01-01T12:00:00');
    gitCommit(
      tempDir,
      'fix(ui): correct button alignment',
      '2025-01-02T12:00:00'
    );
    gitCommit(tempDir, 'chore: update dependencies', '2025-01-03T12:00:00');
    execSync('git branch -M main', { cwd: tempDir, stdio: 'pipe' });
    gitTag(tempDir, '1.0.0', '2025-01-03T12:00:00');

    // --- Release 2.0.0 ---
    gitCommit(tempDir, 'feat(api): add roles endpoint', '2025-01-05T12:00:00');
    gitCommit(
      tempDir,
      'refactor(arch): restructure service layer',
      '2025-01-06T12:00:00'
    );
    gitCommit(
      tempDir,
      'fix: resolve startup crash (#42)',
      '2025-01-07T12:00:00'
    );
    gitTag(tempDir, '2.0.0', '2025-01-07T12:00:00');

    // --- Unreleased ---
    gitCommit(tempDir, 'feat: add logging', '2025-01-09T12:00:00');

    process.chdir(tempDir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates a changelog with correct release structure and scope headings', async () => {
    const output = await renderChangelog(makeConfig());

    expect(output).toContain('# Changelog');

    expect(output).toContain('## Unreleased');
    expect(output).toContain('## 2.0.0');
    expect(output).toContain('## 1.0.0');

    // Releases are sorted descending (Unreleased first, then 2.0.0, then 1.0.0)
    expect(output.indexOf('## Unreleased')).toBeLessThan(
      output.indexOf('## 2.0.0')
    );
    expect(output.indexOf('## 2.0.0')).toBeLessThan(output.indexOf('## 1.0.0'));

    // Scoped commits produce scope headings (### level)
    expect(output).toContain('### api');
    expect(output).toContain('### ui');
    expect(output).toContain('### arch');
    expect(output).toContain('### not scoped');

    // Category labels are resolved (#### level)
    expect(output).toContain('#### Features');
    expect(output).toContain('#### Fixes');
    expect(output).toContain('#### Refactoring');

    // Commit messages are present
    expect(output).toContain('* add users endpoint');
    expect(output).toContain('* correct button alignment');
    expect(output).toContain('* add roles endpoint');
    expect(output).toContain('* restructure service layer');
    expect(output).toContain('* resolve startup crash (#42)');
    expect(output).toContain('* add logging');

    // chore category is filtered out (not in allowedCategories)
    expect(output).not.toContain('update dependencies');
  });

  it('filters and labels scopes via allowedScopes', async () => {
    const output = await renderChangelog(
      makeConfig({
        allowedScopes: [
          { key: 'api', label: 'API' },
          { key: 'arch', label: 'Architecture' }
        ]
      })
    );

    // Labelled scopes appear with their label
    expect(output).toContain('### API');
    expect(output).toContain('### Architecture');

    // Raw scope keys no longer appear as headings
    expect(output).not.toContain('### api');
    expect(output).not.toContain('### arch');

    // Scopes not in allowedScopes are filtered out
    expect(output).not.toContain('### ui');
    expect(output).not.toContain('correct button alignment');

    // Unscoped group is preserved
    expect(output).toContain('### not scoped');
    expect(output).toContain('* resolve startup crash (#42)');
    expect(output).toContain('* add logging');
  });

  it('flattens scope structure when ignoreScope is true', async () => {
    const output = await renderChangelog(makeConfig({ ignoreScope: true }));

    // No scope headings (### api, ### ui, etc.)
    expect(output).not.toContain('### api');
    expect(output).not.toContain('### ui');
    expect(output).not.toContain('### arch');
    expect(output).not.toContain('### not scoped');

    // Categories appear at ### level directly under releases
    expect(output).toContain('### Features');
    expect(output).toContain('### Fixes');

    // All commit messages still present
    expect(output).toContain('* add users endpoint');
    expect(output).toContain('* correct button alignment');
    expect(output).toContain('* add logging');
  });

  it('strips PR numbers and applies custom unscopedLabel', async () => {
    const output = await renderChangelog(
      makeConfig({
        stripPRNumbers: true,
        unscopedLabel: 'General'
      })
    );

    expect(output).not.toContain('(#42)');
    expect(output).toContain('* resolve startup crash');

    expect(output).toContain('### General');
    expect(output).not.toContain('### not scoped');
  });

  it('omits commits matching excludeCommitMessagePattern', async () => {
    const output = await renderChangelog(
      makeConfig({
        excludeCommitMessagePattern: 'add logging'
      })
    );

    expect(output).not.toContain('* add logging');
    expect(output).toContain('* add users endpoint');
  });
});
