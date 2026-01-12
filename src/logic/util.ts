import { NodeAutoChglogConfig } from '../config/NodeAutochglogConfig';
import { Changelog } from '../model/Changelog';
import { Commit } from '../model/Commit';
import { GitLogInfo } from '../model/GitLogInfo';
import { Tag } from '../model/Tag';

export const organizeCommitsByCategory = (
  commits: Commit[]
): Record<string, Commit[]> => {
  return commits.reduce(
    (acc, commit) => {
      (acc[commit.category] ||= []).push(commit);
      return acc;
    },
    {} as Record<string, Commit[]>
  );
};

export const organizeCommitsByTags = (
  gitLogInfo: GitLogInfo,
  config: NodeAutoChglogConfig
): Record<string, Commit[]> => {
  const commitByTagsMap: Record<string, Commit[]> = {};
  gitLogInfo.commits.sort((a, b) => {
    return b.date > a.date ? -1 : +1;
  });

  let buffer: Commit[] = [];
  for (const commit of gitLogInfo.commits) {
    //console.debug(`Processing commit: ${commit.message} (${commit.date})`);
    buffer.push(commit);
    const relevantTag = gitLogInfo.tags
      .filter((tag) => {
        return tag.date >= commit.date;
      })
      .reduce(
        (min, tag) => {
          return !min || tag.date < min.date ? tag : min;
        },
        undefined as Tag | undefined
      );
    if (relevantTag) {
      (commitByTagsMap[relevantTag.name] ||= []).push(...buffer);
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    commitByTagsMap[config.initialTag] = buffer;
  }

  return commitByTagsMap;
};

export const organizeCommitsByTagsAndCategories = (
  gitLogInfo: GitLogInfo,
  config: NodeAutoChglogConfig
): Record<string, Record<string, Commit[]>> => {
  const commitsByTagsAndCategories: Record<
    string,
    Record<string, Commit[]>
  > = {};
  const commitsByTags = organizeCommitsByTags(gitLogInfo, config);
  for (const tag in commitsByTags) {
    commitsByTagsAndCategories[tag] = organizeCommitsByCategory(
      commitsByTags[tag]
    );
  }

  return commitsByTagsAndCategories;
};

export const buildChangelogMetadata = (
  commitsByTagsAndCategories: Record<string, Record<string, Commit[]>>,
  tags: Tag[],
  config: NodeAutoChglogConfig
): Changelog => {
  return {
    releases: Object.entries(commitsByTagsAndCategories)
      .map(([releaseName, categoriesMap]) => ({
        name: releaseName,
        categories: Object.entries(categoriesMap)
          .map(([categoryKey, commits]) => ({
            key: categoryKey,
            name:
              config.allowedCategories.find(
                (category) => category.key === categoryKey
              )?.label || categoryKey,
            commits: commits
          }))
          .filter((category) =>
            config.allowedCategories
              .map((allowed) => allowed.key)
              .includes(category.key)
          ),
        date:
          tags.filter((tag) => tag.name === releaseName)[0]?.date || new Date(),
        actualTag: releaseName != config.initialTag
      }))
      .sort((rel1, rel2) => (rel1.date > rel2.date ? -1 : +1))
  };
};
