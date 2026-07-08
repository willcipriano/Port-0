import { TOOL_REGISTRY, type ToolRegistryKey } from './registry';

export type ToolMenuNode = {
  label: string;
  children?: ToolMenuNode[];
  toolKey?: ToolRegistryKey;
};

export function buildToolMenuTree(): ToolMenuNode[] {
  const roots: ToolMenuNode[] = [];

  for (const [key, def] of Object.entries(TOOL_REGISTRY)) {
    const toolKey = key as ToolRegistryKey;
    let level = roots;

    for (const segment of def.menuPath) {
      let node = level.find(n => n.label === segment && !n.toolKey);
      if (!node) {
        node = { label: segment, children: [] };
        level.push(node);
      }
      if (!node.children) node.children = [];
      level = node.children;
    }

    level.push({ label: def.label, toolKey });
  }

  return roots;
}
