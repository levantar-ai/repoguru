import { describe, it, expect } from 'vitest';
import { generateMermaidDiagram } from '../repoStructure';
import type { TreeEntry } from '../../../types';

function makeBlob(path: string): TreeEntry {
  return { path, mode: '100644', type: 'blob', sha: 'abc123' };
}

function makeTree(path: string): TreeEntry {
  return { path, mode: '040000', type: 'tree', sha: 'def456' };
}

describe('generateMermaidDiagram', () => {
  // ── Empty tree ──

  it('produces a diagram with "graph TD" and ROOT for an empty tree', () => {
    const result = generateMermaidDiagram([]);
    expect(result).toContain('graph TD');
    expect(result).toContain('ROOT["/"]');
  });

  it('does not add ROOT_FILES node when there are no root files', () => {
    const result = generateMermaidDiagram([]);
    expect(result).not.toContain('ROOT_FILES');
  });

  // ── Root files counted ──

  it('counts root-level files and shows a ROOT_FILES node', () => {
    const tree: TreeEntry[] = [
      makeBlob('README.md'),
      makeBlob('package.json'),
      makeBlob('tsconfig.json'),
    ];
    const result = generateMermaidDiagram(tree);
    expect(result).toContain('ROOT_FILES["3 files"]');
    expect(result).toContain('ROOT --> ROOT_FILES');
  });

  it('counts only root-level blobs, not nested ones', () => {
    const tree: TreeEntry[] = [
      makeBlob('README.md'),
      makeBlob('src/index.ts'),
      makeBlob('src/utils/helper.ts'),
    ];
    const result = generateMermaidDiagram(tree);
    // Only README.md is a root-level file
    expect(result).toContain('ROOT_FILES["1 files"]');
  });

  // ── Directories connected to ROOT ──

  it('connects top-level directories to ROOT', () => {
    const tree: TreeEntry[] = [makeTree('src'), makeTree('tests')];
    const result = generateMermaidDiagram(tree);
    expect(result).toContain('ROOT --> src');
    expect(result).toContain('ROOT --> tests');
  });

  it('labels top-level directories with their name', () => {
    const tree: TreeEntry[] = [makeTree('src')];
    const result = generateMermaidDiagram(tree);
    expect(result).toContain('src["src');
  });

  // ── Nested directories connected to parent ──

  it('connects nested directories to their parent', () => {
    const tree: TreeEntry[] = [makeTree('src'), makeTree('src/components')];
    const result = generateMermaidDiagram(tree);
    expect(result).toContain('ROOT --> src');
    expect(result).toContain('src --> src_components');
    expect(result).toContain('src_components["components"]');
  });

  it('handles deeply nested directories within maxDepth', () => {
    const tree: TreeEntry[] = [
      makeTree('src'),
      makeTree('src/components'),
      makeTree('src/components/ui'),
    ];
    const result = generateMermaidDiagram(tree, 3);
    expect(result).toContain('src_components --> src_components_ui');
    expect(result).toContain('src_components_ui["ui"]');
  });

  // ── maxDepth limits directory depth ──

  it('limits directory depth with maxDepth parameter', () => {
    const tree: TreeEntry[] = [
      makeTree('src'),
      makeTree('src/components'),
      makeTree('src/components/ui'),
      makeTree('src/components/ui/buttons'),
    ];
    // default maxDepth = 2
    const result = generateMermaidDiagram(tree);
    expect(result).toContain('src["src');
    expect(result).toContain('src_components["components"]');
    // depth 3 (src/components/ui) should be excluded at maxDepth=2
    expect(result).not.toContain('src_components_ui');
    expect(result).not.toContain('buttons');
  });

  it('with maxDepth=1 only shows top-level directories', () => {
    const tree: TreeEntry[] = [
      makeTree('src'),
      makeTree('src/components'),
      makeTree('tests'),
      makeTree('tests/unit'),
    ];
    const result = generateMermaidDiagram(tree, 1);
    expect(result).toContain('ROOT --> src');
    expect(result).toContain('ROOT --> tests');
    expect(result).not.toContain('components');
    expect(result).not.toContain('unit');
  });

  it('with maxDepth=3 shows three levels deep', () => {
    const tree: TreeEntry[] = [
      makeTree('src'),
      makeTree('src/components'),
      makeTree('src/components/ui'),
      makeTree('src/components/ui/deep'),
    ];
    const result = generateMermaidDiagram(tree, 3);
    expect(result).toContain('src_components_ui["ui"]');
    // depth 4 should be excluded
    expect(result).not.toContain('deep');
  });

  // ── File count per top-level dir ──

  it('shows file count per top-level directory', () => {
    const tree: TreeEntry[] = [
      makeTree('src'),
      makeBlob('src/index.ts'),
      makeBlob('src/app.ts'),
      makeBlob('src/utils.ts'),
      makeTree('tests'),
      makeBlob('tests/test1.ts'),
    ];
    const result = generateMermaidDiagram(tree);
    // src has 3 files
    expect(result).toContain('src["src (3)"]');
    // tests has 1 file
    expect(result).toContain('tests["tests (1)"]');
  });

  it('does not show file count for directories with zero files', () => {
    const tree: TreeEntry[] = [makeTree('empty-dir')];
    const result = generateMermaidDiagram(tree);
    expect(result).toContain('empty_dir["empty-dir"]');
    expect(result).not.toContain('(0)');
  });

  it('counts nested files towards the top-level directory total', () => {
    const tree: TreeEntry[] = [
      makeTree('src'),
      makeTree('src/components'),
      makeBlob('src/index.ts'),
      makeBlob('src/components/Button.tsx'),
    ];
    const result = generateMermaidDiagram(tree);
    // Both files belong to top-level "src" directory
    expect(result).toContain('src["src (2)"]');
  });

  // ── Node ID sanitization ──

  it('sanitizes directory names with special characters in node IDs', () => {
    const tree: TreeEntry[] = [makeTree('.github'), makeTree('.github/workflows')];
    const result = generateMermaidDiagram(tree);
    // .github becomes _github in the node ID
    expect(result).toContain('_github[".github');
    expect(result).toContain('ROOT --> _github');
  });

  // ── No duplicate node definitions ──

  it('does not duplicate node definitions', () => {
    const tree: TreeEntry[] = [makeTree('src'), makeTree('src/a'), makeTree('src/b')];
    const result = generateMermaidDiagram(tree);
    const srcDefMatches = result.match(/src\["src/g);
    // Should appear exactly once as a node definition
    expect(srcDefMatches).toHaveLength(1);
  });

  it('handles directories that produce the same node ID', () => {
    // Two directories at depth=2 under the same parent produce same parent node ID
    const tree: TreeEntry[] = [
      makeTree('src'),
      makeTree('src/utils'),
      makeTree('src/helpers'),
      makeBlob('src/utils/a.ts'),
      makeBlob('src/helpers/b.ts'),
    ];
    const result = generateMermaidDiagram(tree);
    expect(result).toContain('src_utils["utils"]');
    expect(result).toContain('src_helpers["helpers"]');
    // The parent "src" should appear exactly once
    const srcDefs = result.match(/src\["src/g);
    expect(srcDefs).toHaveLength(1);
  });

  it('sorts directories alphabetically', () => {
    const tree: TreeEntry[] = [makeTree('zoo'), makeTree('alpha'), makeTree('middle')];
    const result = generateMermaidDiagram(tree);
    const alphaIdx = result.indexOf('alpha');
    const middleIdx = result.indexOf('middle');
    const zooIdx = result.indexOf('zoo');
    expect(alphaIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(zooIdx);
  });
});
