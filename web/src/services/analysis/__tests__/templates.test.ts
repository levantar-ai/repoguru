import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../templates';

describe('TEMPLATES', () => {
  it('is a non-empty record', () => {
    const keys = Object.keys(TEMPLATES);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('each entry has filename and content strings', () => {
    for (const [, entry] of Object.entries(TEMPLATES)) {
      expect(typeof entry.filename).toBe('string');
      expect(typeof entry.content).toBe('string');
    }
  });

  it('contains expected template keys', () => {
    const expectedKeys = [
      'SECURITY.md',
      'CODE_OF_CONDUCT.md',
      'CONTRIBUTING.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.github/ISSUE_TEMPLATE/bug_report.md',
      '.github/FUNDING.yml',
      '.github/dependabot.yml',
      '.editorconfig',
    ];
    for (const key of expectedKeys) {
      expect(TEMPLATES).toHaveProperty(key);
    }
  });

  it('each template filename matches its key', () => {
    for (const [key, entry] of Object.entries(TEMPLATES)) {
      expect(entry.filename).toBe(key);
    }
  });

  it('content is non-empty for each template', () => {
    for (const [, entry] of Object.entries(TEMPLATES)) {
      expect(entry.content.length).toBeGreaterThan(0);
    }
  });

  it('SECURITY.md template contains security-related content', () => {
    const security = TEMPLATES['SECURITY.md'];
    expect(security.content).toContain('Security');
    expect(security.content).toContain('Vulnerability');
  });

  it('CODE_OF_CONDUCT.md template contains conduct-related content', () => {
    const coc = TEMPLATES['CODE_OF_CONDUCT.md'];
    expect(coc.content).toContain('Code of Conduct');
    expect(coc.content).toContain('Pledge');
  });

  it('CONTRIBUTING.md template contains contributing guidelines', () => {
    const contributing = TEMPLATES['CONTRIBUTING.md'];
    expect(contributing.content).toContain('Contributing');
    expect(contributing.content).toContain('Pull Request');
  });

  it('dependabot.yml template contains dependabot configuration', () => {
    const dependabot = TEMPLATES['.github/dependabot.yml'];
    expect(dependabot.content).toContain('version: 2');
    expect(dependabot.content).toContain('package-ecosystem');
  });

  it('.editorconfig template contains editor settings', () => {
    const editorconfig = TEMPLATES['.editorconfig'];
    expect(editorconfig.content).toContain('root = true');
    expect(editorconfig.content).toContain('indent_style');
  });
});
