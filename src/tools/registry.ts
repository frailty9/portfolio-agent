/**
 * 工具注册表。
 */

import type { ToolDefinition } from './types'

const registry = new Map<string, ToolDefinition>()

export function registerTool(tool: ToolDefinition): void {
  registry.set(tool.name, tool)
}

export function findTool(name: string): ToolDefinition | undefined {
  return registry.get(name)
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(registry.values())
}
