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
  let commandResult: { stdout: string; stderr: string };
  try {
    commandResult = await exec(
      `git log --oneline ${excludeMergeCommits ? '--no-merges' : ''} --pretty=format:"${outputPattern}" ${targetBranch}`
    );
    //console.debug(`Git log command result: ${commandResult.stdout}`)
  } catch (error: unknown) {
    let errorMessage;
    if (typeof error == 'string') {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorMessage = error.message || FALLBACK_ERROR_MESSAGE;
    }
    throw new Error(errorMessage);
  }
  return commandResult.stdout;
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
  const tagNames = (
    await getCommitDecorations(config.targetBranch, false)
  ).split('\n');

  const originalTags: Tag[] = tagNames.map((_, index) => ({
    name: tagNames[index],
    date: new Date(tagDates[index])
  }));

  const tags = originalTags
    .filter((tag) => tag.name.includes('tag: '))
    .map((rawTag) => ({
      name: rawTag.name
        .trim()
        .matchAll(/\((.*)\)/g)
        .next()
        .value![1].split(',')
        .filter((subTag) => subTag.includes('tag: '))[0]
        .matchAll(/tag: (.*)/g)
        .next().value![1],
      date: rawTag.date
    }))
    .filter((tag) => new RegExp(config.tagFilter).test(tag.name));

  const response: GitLogInfo = {
    commits: [],
    tags: tags
  };

  Array.from({ length: commitIds.length }).forEach((_, i) => {
    if (new RegExp('.*: .*').test(commitMessages[i])) {
      response.commits.push({
        id: commitIds[i],
        date: new Date(commitDates[i]),
        message: commitMessages[i]
          .matchAll(/.*:(.*)/g)
          .next()
          .value![1].trim(),
        category: commitMessages[i].matchAll(/(.*):/g).next().value![1]
      });
    }
  });
  return response;
};
