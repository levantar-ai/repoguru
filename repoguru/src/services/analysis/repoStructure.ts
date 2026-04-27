import type { TreeEntry } from '../../types';

function countFilesPerTopDir(tree: TreeEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of tree) {
    if (entry.type === 'blob' && entry.path.includes('/')) {
      const topDir = entry.path.split('/')[0];
      counts.set(topDir, (counts.get(topDir) || 0) + 1);
    }
  }
  return counts;
}

function buildDirectoryNode(
  dir: string,
  topLevelCounts: Map<string, number>,
  added: Set<string>,
): string {
  let mermaid = '';
  const parts = dir.split('/');
  const nodeId = dir.replace(/[^a-zA-Z0-9]/g, '_');
  const label = parts[parts.length - 1];
  const count = topLevelCounts.get(parts[0]) || 0;
  const countLabel = parts.length === 1 && count > 0 ? ` (${count})` : '';

  if (!added.has(nodeId)) {
    mermaid += `  ${nodeId}["${label}${countLabel}"]\n`;
    added.add(nodeId);
  }

  if (parts.length === 1) {
    mermaid += `  ROOT --> ${nodeId}\n`;
  } else {
    const parentPath = parts.slice(0, -1).join('/');
    const parentId = parentPath.replace(/[^a-zA-Z0-9]/g, '_');
    mermaid += `  ${parentId} --> ${nodeId}\n`;
  }

  return mermaid;
}

export function generateMermaidDiagram(tree: TreeEntry[], maxDepth = 2): string {
  const dirs = tree
    .filter((e) => e.type === 'tree')
    .map((e) => e.path)
    .filter((p) => {
      const depth = p.split('/').length;
      return depth <= maxDepth;
    })
    .sort((a, b) => a.localeCompare(b));

  const topLevelCounts = countFilesPerTopDir(tree);
  const rootFiles = tree.filter((e) => e.type === 'blob' && !e.path.includes('/')).length;

  let mermaid = 'graph TD\n';
  mermaid += '  ROOT["/"]\n';

  // Add root files indicator
  if (rootFiles > 0) {
    mermaid += `  ROOT_FILES["${rootFiles} files"]\n`;
    mermaid += '  ROOT --> ROOT_FILES\n';
  }

  // Build parent-child for directories
  const added = new Set<string>();
  for (const dir of dirs) {
    mermaid += buildDirectoryNode(dir, topLevelCounts, added);
  }

  return mermaid;
}
