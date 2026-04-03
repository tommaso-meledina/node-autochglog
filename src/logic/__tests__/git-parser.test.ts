import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeAutoChglogConfig } from '../../config/NodeAutochglogConfig';

const execMock = vi.hoisted(() => vi.fn());

vi.mock('node:util', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    default: {
      ...(actual.default as Record<string, unknown>),
      promisify: () => execMock
    }
  };
});

import { getGitLogInfo } from '../git-parser';

const makeConfig = (
  overrides?: Partial<NodeAutoChglogConfig>
): NodeAutoChglogConfig => ({
  tagFilter: '^\\d+\\.\\d+\\.\\d+$',
  initialTag: 'Unreleased',
  templateLocation: '',
  targetBranch: 'main',
  outputFilepath: 'CHANGELOG.md',
  allowedCategories: [
    { key: 'feat', label: 'Features' },
    { key: 'fix', label: 'Fixes' }
  ],
  stripPRNumbers: false,
  ...overrides
});

const setupExecMock = (responses: {
  ids: string;
  dates: string;
  messages: string;
  tagDates: string;
  tagDecorations: string;
}) => {
  let callIndex = 0;
  const order = [
    responses.ids,
    responses.dates,
    responses.messages,
    responses.tagDates,
    responses.tagDecorations
  ];

  execMock.mockImplementation(() => {
    const stdout = order[callIndex++] ?? '';
    return Promise.resolve({ stdout, stderr: '' });
  });
};

describe('getGitLogInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses conventional commits into structured data', async () => {
    setupExecMock({
      ids: 'abc1234',
      dates: '2025-01-15 10:00:00 +0000',
      messages: 'feat: add login page',
      tagDates: '2025-01-10 10:00:00 +0000',
      tagDecorations: ' (tag: 1.0.0)'
    });

    const config = makeConfig();
    const result = await getGitLogInfo(config);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0].category).toBe('feat');
    expect(result.commits[0].message).toBe('add login page');
    expect(result.commits[0].id).toBe('abc1234');
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe('1.0.0');
  });

  it('filters out non-conventional commits', async () => {
    setupExecMock({
      ids: 'abc1234\ndef5678',
      dates: '2025-01-15 10:00:00 +0000\n2025-01-16 10:00:00 +0000',
      messages: 'feat: add login\nrandom message without type prefix',
      tagDates: '',
      tagDecorations: ''
    });

    const config = makeConfig();
    const result = await getGitLogInfo(config);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0].message).toBe('add login');
  });

  it('strips PR numbers when configured', async () => {
    setupExecMock({
      ids: 'abc1234',
      dates: '2025-01-15 10:00:00 +0000',
      messages: 'feat: add feature (#42)',
      tagDates: '',
      tagDecorations: ''
    });

    const config = makeConfig({ stripPRNumbers: true });
    const result = await getGitLogInfo(config);

    expect(result.commits[0].message).toBe('add feature');
  });

  it('extracts semver tags and filters by tagFilter', async () => {
    setupExecMock({
      ids: 'abc1234',
      dates: '2025-01-15 10:00:00 +0000',
      messages: 'feat: something',
      tagDates: '2025-01-10 10:00:00 +0000\n2025-01-15 10:00:00 +0000',
      tagDecorations: ' (tag: 1.0.0)\n (HEAD -> main, tag: not-semver)'
    });

    const config = makeConfig();
    const result = await getGitLogInfo(config);

    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe('1.0.0');
  });

  it('handles multiple tags in the same decoration', async () => {
    setupExecMock({
      ids: 'abc1234',
      dates: '2025-01-15 10:00:00 +0000',
      messages: 'feat: something',
      tagDates: '2025-01-10 10:00:00 +0000',
      tagDecorations: ' (HEAD -> main, tag: 1.0.0, origin/main)'
    });

    const config = makeConfig();
    const result = await getGitLogInfo(config);

    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].name).toBe('1.0.0');
  });

  it('handles git command errors', async () => {
    execMock.mockRejectedValue(new Error('fatal: not a git repository'));

    const config = makeConfig();
    await expect(getGitLogInfo(config)).rejects.toThrow(
      'fatal: not a git repository'
    );
  });

  it('handles empty repository with no commits', async () => {
    setupExecMock({
      ids: '',
      dates: '',
      messages: '',
      tagDates: '',
      tagDecorations: ''
    });

    const config = makeConfig();
    const result = await getGitLogInfo(config);

    expect(result.commits).toHaveLength(0);
    expect(result.tags).toHaveLength(0);
  });
});
