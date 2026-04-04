import util from 'node:util';
import { FALLBACK_ERROR_MESSAGE } from '../messages';
import childProcess from 'child_process';
import { GitLogInfo } from '../model/GitLogInfo';
import { Tag } from '../model/Tag';
import { NodeAutoChglogConfig } from '../config/NodeAutochglogConfig';

const exec = util.promisify(childProcess.exec);

const COMMIT_IDS_PATTERN = '%h';
const COMMIT_DATES_PATTERN = '%ci';
const COMMIT_MESSAGES_PATTERN = '%s';
const COMMIT_DECORATIONS_PATTERN = '%d';

const invokeGitLog = async (
  targetBranch: string,
  outputPattern: string,
  excludeMergeCommits: boolean
) => {
  try {
    const commandResult = await exec(
      `git log --oneline ${excludeMergeCommits ? '--no-merges' : ''} --pretty=format:"${outputPattern}" ${targetBranch}`
    );
    return commandResult.stdout;
  } catch (error: unknown) {
    if (typeof error === 'string') {
      throw new Error(error);
    }
    if (error instanceof Error) {
      throw new Error(error.message || FALLBACK_ERROR_MESSAGE);
    }
    throw new Error(FALLBACK_ERROR_MESSAGE);
  }
};

const getCommitIds = async (targetBranch: string) => {
  return await invokeGitLog(targetBranch, COMMIT_IDS_PATTERN, true);
};
const getCommitDates = async (
  targetBranch: string,
  excludeMergeCommits: boolean
) => {
  return await invokeGitLog(
    targetBranch,
    COMMIT_DATES_PATTERN,
    excludeMergeCommits
  );
};
const getCommitMessages = async (targetBranch: string) => {
  return await invokeGitLog(targetBranch, COMMIT_MESSAGES_PATTERN, true);
};
const getCommitDecorations = async (
  targetBranch: string,
  excludeMergeCommits: boolean
) => {
  return await invokeGitLog(
    targetBranch,
    COMMIT_DECORATIONS_PATTERN,
    excludeMergeCommits
  );
};

const extractTagName = (decoration: string): string | null => {
  const parenMatch = decoration.trim().match(/\((.*)\)/);
  if (!parenMatch) return null;

  const tagEntry = parenMatch[1]
    .split(',')
    .map((s) => s.trim())
    .find((s) => s.startsWith('tag: '));
  if (!tagEntry) return null;

  return tagEntry.replace('tag: ', '').trim();
};

export const getGitLogInfo = async (config: NodeAutoChglogConfig) => {
  const commitIds = (await getCommitIds(config.targetBranch)).split('\n');
  const commitDates = (await getCommitDates(config.targetBranch, true)).split(
    '\n'
  );
  const commitMessages = (await getCommitMessages(config.targetBranch))
    .split('\n')
    .map((message) =>
      config.stripPRNumbers ? message.replace(/\s*\(#\d+\)\s*$/, '') : message
    );

  const tagDates = (await getCommitDates(config.targetBranch, false)).split(
    '\n'
  );
  const tagDecorations = (
    await getCommitDecorations(config.targetBranch, false)
  ).split('\n');

  const tags: Tag[] = tagDecorations
    .map((decoration, index) => ({
      name: extractTagName(decoration),
      date: new Date(tagDates[index])
    }))
    .filter((tag): tag is Tag => tag.name !== null)
    .filter((tag) => new RegExp(config.tagFilter).test(tag.name));

  const response: GitLogInfo = {
    commits: [],
    tags
  };

  Array.from({ length: commitIds.length }).forEach((_, i) => {
    const match = commitMessages[i]?.match(
      /^([^(:!]+)(?:\(([^)]*)\))?!?:\s*(.*)/
    );
    if (match) {
      response.commits.push({
        id: commitIds[i],
        date: new Date(commitDates[i]),
        message: match[3],
        category: match[1],
        ...(match[2] ? { scope: match[2] } : {})
      });
    }
  });
  return response;
};
