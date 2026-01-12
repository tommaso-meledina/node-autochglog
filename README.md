# Node Auto-Changelog

> `node-autochglog` is a CLI tool that generates a changelog based on commit messages, assuming that they're written using the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) syntax. It is meant to be used in CI/CD pipelines, or in pre-commit hooks.

## Data model

Here are some concepts to better understand the logic behind the tool:

- to the purpose of this tool, a `Changelog` is a list of `Release` items;
- each `Release` item contains a list of `Category` items;
- each `Category` item contains a list of `Commit items`.

In other words, a _changelog_ is a list of _releases_, each _release_ contains a number of _commits_, that are arranged in _categories_ within the _release_ they belong to.

_Releases_ are defined by git tags, _categories_ are defined by Conventional Commit prefixes of _commit_ messages.

## Installation

`node-autochglog` can be launched through `npx`, so no installation is required. If you still want to install it, this section explains how to do that.

For making it available within a project:

```bash
npm install save-dev node-autochglog
```

For making it available globally:

```bash
npm install -g node-autochglog
```

## Usage

In order to use `node-autochglog`, just run the following command in the root of the project you want to generate a changelog for:

```bash
npx node-autochglog
```

## Configuration

The tool accepts configuration from a `node-autochglog.config.json`, expected to be found in the directory where the `node-autochglog` command is executed; the file is expected to contain a single JSON object adhering to the [NodeAutoChglogConfig](./src/config/NodeAutochglogConfig.ts) interface:

```typescript
export interface NodeAutoChglogConfig {
  tagFilter: string;
  initialTag: string;
  templateLocation: string;
  targetBranch: string;
  outputFilepath: string;
  allowedCategories: { key: string; label?: string }[];
  stripPRNumbers: boolean;
}
```

<table>
  <tr>
    <th>Config key</th>
    <th>Purpose</th>
    <th>Default</th>
  </tr>
  <tr>
    <td><code>tagFilter</code></td>
    <td>RegEx used for determining which tags are considered as versions; tags not matching the RegEx will be ignored</td>
    <td><a href='https://semver.org/'>SemVer</a></td>
  </tr>
  <tr>
    <td><code>initialTag</code></td>
    <td>Fallback "tag" to be used as release name when no tags exist yet, or for recent commits that do not (yet) fall under a version tag</td>
    <td><code>Unreleased</code></td>
  </tr>
  <tr>
    <td><code>templateLocation</code></td>
    <td>Path to the <a href='https://mustache.github.io/'>Mustache</a> template to be used for the changelog; <b>whatever custom template you provide, it will have to work with the metadata provided by the tool, represented by the <a href='./src/model/Changelog.ts'><code>Changelog</code></a> interface</b></td>
    <td><a href='./src/config/DEFAULT_TEMPLATE.mustache'>DEFAULT_TEMPLATE.mustache</a></td>
  </tr>
  <tr>
    <td><code>targetBranch</code></td>
    <td>Branch from which the commits shall be read for composing the changelog</td>
    <td><code>develop</code></td>
  </tr>
  <tr>
    <td><code>outputFilepath</code></td>
    <td>Path where the generated changelog shall be written</td>
    <td>Project root</td>
  </tr>
  <tr>
    <td><code>stripPRNumbers</code></td>
    <td>Whether the tool should strip PR numbers from the end of commit messages</td>
    <td><code>false</code></td>
  </tr>
  <tr>
    <td><code>allowedCategories</code></td>
    <td>List of key/label objects defining which commit prefixes (<code>key</code>) shall be considered as valid categories and which labels (<code>label</code>) shall be used in order to represent them; the <code>label</code> property is optional, if absent the <code>key</code> property will be used in its place.</td>
    <td>
      <pre lang="json">
{
  "key": "feat",
  "label": "Features"
},
{
  "key": "refactor",
  "label": "Refactoring"
},
{
  "key": "ci",
  "label": "Integration"
},
{
  "key": "fix",
  "label": "Fixes"
}
      </pre>
    </td>
  </tr>
</table>