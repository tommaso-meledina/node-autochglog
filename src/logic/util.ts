import { NodeAutoChglogConfig } from '../config/NodeAutochglogConfig';
import { Changelog } from '../model/Changelog';
import { Category } from '../model/Category';
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

export const organizeCommitsByScope = (
  commits: Commit[]
): Record<string, Commit[]> => {
  return commits.reduce(
    (acc, commit) => {
      const scope = commit.scope ?? '';
      (acc[scope] ||= []).push(commit);
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

export const organizeCommitsByTagsScopesAndCategories = (
  gitLogInfo: GitLogInfo,
  config: NodeAutoChglogConfig
): Record<string, Record<string, Record<string, Commit[]>>> => {
  const result: Record<string, Record<string, Record<string, Commit[]>>> = {};
  const commitsByTags = organizeCommitsByTags(gitLogInfo, config);
  for (const tag in commitsByTags) {
    const commits = config.ignoreScope
      ? commitsByTags[tag].map((c) => ({ ...c, scope: undefined }))
      : commitsByTags[tag];
    const byScope = organizeCommitsByScope(commits);
    result[tag] = {};
    for (const scope in byScope) {
      result[tag][scope] = organizeCommitsByCategory(byScope[scope]);
    }
  }
  return result;
};

const buildCategories = (
  categoriesMap: Record<string, Commit[]>,
  config: NodeAutoChglogConfig
): Category[] => {
  return Object.entries(categoriesMap)
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
    );
};

export const buildChangelogMetadata = (
  commitsByTagsScopesAndCategories: Record<
    string,
    Record<string, Record<string, Commit[]>>
  >,
  tags: Tag[],
  config: NodeAutoChglogConfig
): Changelog => {
  const anyScopeExists = Object.values(commitsByTagsScopesAndCategories).some(
    (scopeMap) => Object.keys(scopeMap).some((scope) => scope !== '')
  );

  return {
    scopesEnabled: anyScopeExists,
    releases: Object.entries(commitsByTagsScopesAndCategories)
      .map(([releaseName, scopesMap]) => ({
        name: releaseName,
        scopes: anyScopeExists
          ? Object.entries(scopesMap)
              .map(([scopeKey, categoriesMap]) => ({
                name: scopeKey || config.unscopedLabel,
                categories: buildCategories(categoriesMap, config)
              }))
              .filter((scope) => scope.categories.length > 0)
              .sort((a, b) => {
                if (a.name === config.unscopedLabel) return 1;
                if (b.name === config.unscopedLabel) return -1;
                return a.name.localeCompare(b.name);
              })
          : [],
        categories: !anyScopeExists
          ? buildCategories(
              Object.values(scopesMap).reduce(
                (merged, catMap) => {
                  for (const [catKey, commits] of Object.entries(catMap)) {
                    (merged[catKey] ||= []).push(...commits);
                  }
                  return merged;
                },
                {} as Record<string, Commit[]>
              ),
              config
            )
          : [],
        date:
          tags.filter((tag) => tag.name === releaseName)[0]?.date || new Date(),
        actualTag: releaseName != config.initialTag
      }))
      .sort((rel1, rel2) => (rel1.date > rel2.date ? -1 : +1))
  };
};
