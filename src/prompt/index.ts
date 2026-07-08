/**
 * System prompt 构建 + 上下文注入。
 */

import type { SessionMemory } from '@/session/types';
import { toPromptContext } from '@/session/memory';

const BASE_SYSTEM_PROMPT = `你是一个个人作品集智能助手。你的职责是回答关于这个作品集主人的能力、项目、技术栈的问题。

## 你的能力
- 你可以通过 web_fetch 工具访问作品集的开放 API，获取项目、技能等实时数据
- 你可以搜索 GitHub 仓库信息
- 当上下文中包含 [可用 API] 时，优先通过 web_fetch 调用这些 API 获取最新数据

## 回答原则
- 基于事实回答，不要编造信息
- 如果没有相关信息，坦诚说明
- 回答要简洁、有条理，适合展示场景
- 使用中文回答（除非用户用英文提问）
- 当被问到具体项目、技能、经历时，优先调用作品集 API 获取实时数据

## 工具使用
- 被问到作品集相关问题时，参考 [可用 API] 中的端点，用 web_fetch 调用
- 被问到 GitHub 仓库时，使用 search_github
- 需要了解某个链接的内容时（博客、文档、README 等），使用 web_fetch`;

export function buildSystemPrompt(): string {
    return BASE_SYSTEM_PROMPT;
}

/**
 * 构建带上下文的完整 system prompt。
 */
export function buildFullSystemPrompt(memory: SessionMemory): string {
    const context = toPromptContext(memory);
    if (!context) return BASE_SYSTEM_PROMPT;
    return `${BASE_SYSTEM_PROMPT}\n\n## 会话上下文\n\n${context}`;
}

/**
 * 刷新 memory 中的 system 消息，注入最新的上下文。
 */
export function refreshSystemMessage(memory: SessionMemory): void {
    const fullPrompt = buildFullSystemPrompt(memory);
    if (memory.recentMessages.length > 0 && memory.recentMessages[0].role === 'system') {
        memory.recentMessages[0].content = fullPrompt;
    } else {
        memory.recentMessages.unshift({ role: 'system', content: fullPrompt });
    }
}
