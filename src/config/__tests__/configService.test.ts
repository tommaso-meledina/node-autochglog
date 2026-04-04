import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRuntimeConfig } from '../configService';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('getRuntimeConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default config when no custom config file exists', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const config = getRuntimeConfig();

    expect(config.targetBranch).toBe('develop');
    expect(config.initialTag).toBe('Unreleased');
    expect(config.stripPRNumbers).toBe(false);
    expect(config.allowedCategories).toHaveLength(4);
    expect(config.outputFilepath).toContain('CHANGELOG.md');
    expect(config.ignoreScope).toBe(false);
    expect(config.unscopedLabel).toBe('not scoped');
  });

  it('merges custom config over defaults', () => {
    const customConfig = {
      targetBranch: 'main',
      stripPRNumbers: true
    };

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(customConfig));

    const config = getRuntimeConfig();

    expect(config.targetBranch).toBe('main');
    expect(config.stripPRNumbers).toBe(true);
    expect(config.initialTag).toBe('Unreleased');
  });

  it('resolves outputFilepath relative to cwd', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const config = getRuntimeConfig();

    expect(path.isAbsolute(config.outputFilepath)).toBe(true);
    expect(config.outputFilepath).toContain('CHANGELOG.md');
  });

  it('falls back to default template when templateLocation is empty', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const config = getRuntimeConfig();

    expect(config.templateLocation).toContain('DEFAULT_TEMPLATE.mustache');
  });

  it('resolves custom templateLocation relative to cwd', () => {
    const customConfig = {
      templateLocation: 'custom-template.mustache'
    };

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(customConfig));

    const config = getRuntimeConfig();

    expect(path.isAbsolute(config.templateLocation)).toBe(true);
    expect(config.templateLocation).toContain('custom-template.mustache');
  });

  it('sanitises scope syntax from allowedCategories keys', () => {
    const customConfig = {
      allowedCategories: [
        { key: 'feat(ui)', label: 'Features' },
        { key: 'fix(auth)', label: 'Fixes' }
      ]
    };

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(customConfig));

    const config = getRuntimeConfig();

    expect(config.allowedCategories).toEqual([
      { key: 'feat', label: 'Features' },
      { key: 'fix', label: 'Fixes' }
    ]);
  });

  it('deduplicates allowedCategories after sanitisation', () => {
    const customConfig = {
      allowedCategories: [
        { key: 'feat', label: 'Features' },
        { key: 'feat(ui)', label: 'UI Features' }
      ]
    };

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(customConfig));

    const config = getRuntimeConfig();

    expect(config.allowedCategories).toHaveLength(1);
    expect(config.allowedCategories[0]).toEqual({
      key: 'feat',
      label: 'Features'
    });
  });

  it('merges custom ignoreScope and unscopedLabel', () => {
    const customConfig = {
      ignoreScope: true,
      unscopedLabel: 'misc'
    };

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(customConfig));

    const config = getRuntimeConfig();

    expect(config.ignoreScope).toBe(true);
    expect(config.unscopedLabel).toBe('misc');
  });

  it('defaults allowedScopes to an empty array', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const config = getRuntimeConfig();

    expect(config.allowedScopes).toEqual([]);
  });

  it('merges custom allowedScopes', () => {
    const customConfig = {
      allowedScopes: [{ key: 'api', label: 'API' }]
    };

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(customConfig));

    const config = getRuntimeConfig();

    expect(config.allowedScopes).toEqual([{ key: 'api', label: 'API' }]);
  });
});
