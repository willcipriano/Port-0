export const TOOL_REGISTRY = {
  brute_force: {
    menuPath: ['AUTH'] as const,
    label: 'Brute Force Password Guesser',
    description: '~10–15s dictionary attack',
    icon: '[KEY]',
    toolId: 'cracker_l1',
    maxSecurityLevel: 1,
    estimatedDurationSeconds: 12,
    component: 'BruteForceTool',
    windowTitle: 'BRUTE FORCE // PASSWORD GUESSER',
  },
} as const;

export function getToolRegistryEntry(toolId: string) {
  return Object.values(TOOL_REGISTRY).find(entry => entry.toolId === toolId);
}

export type ToolRegistryKey = keyof typeof TOOL_REGISTRY;
