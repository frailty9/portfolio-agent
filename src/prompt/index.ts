/**
 * System prompt 构建 + 上下文注入。
 */

import type { SessionMemory } from '@/session/types';
import { toPromptContext } from '@/session/memory';

const BASE_SYSTEM_PROMPT = `你是一个个人作品集智能助手。你的职责是回答关于这个作品集主人的能力、项目、技术栈的问题。

## 你的能力
- 你可以通过工具读取作品集数据（个人简介、项目列表、技能栈）
- 你可以搜索 GitHub 仓库信息
- 你可以在作品集数据中搜索特定内容

## 回答原则
- 基于事实回答，不要编造信息
- 如果作品集数据中没有相关信息，坦诚说明
- 回答要简洁、有条理，适合展示场景
- 使用中文回答（除非用户用英文提问）
- 当被问到具体项目时，主动调用工具获取详细信息

## 工具使用
- 被问到"有哪些项目"时，使用 list_projects
- 被问到具体技能时，使用 read_portfolio 读取 skills
- 被问到个人背景时，使用 read_portfolio 读取 profile
- 被问到 GitHub 仓库时，使用 search_github
- 需要搜索特定内容时，使用 content_search`;

export function buildSystemPrompt(): string {
    return BASE_SYSTEM_PROMPT;
}

/**
 * 构建带上下文的完整 system prompt。
 * 当 memory 中有 taskSummary / constraints / findings 时，追加到 system prompt 末尾。
 */
export function buildFullSystemPrompt(memory: SessionMemory): string {
    const context = toPromptContext(memory);
    if (!context) return BASE_SYSTEM_PROMPT;
    return `${BASE_SYSTEM_PROMPT}\n\n## 会话上下文\n\n${context}`;
}

/**
 * 刷新 memory 中的 system 消息，注入最新的上下文。
 * 在每次 agent loop 开始前调用。
 */
export function refreshSystemMessage(memory: SessionMemory): void {
    const fullPrompt = buildFullSystemPrompt(memory);
    if (memory.recentMessages.length > 0 && memory.recentMessages[0].role === 'system') {
        memory.recentMessages[0].content = fullPrompt;
    } else {
        // 没有 system 消息时插入到最前面
        memory.recentMessages.unshift({ role: 'system', content: fullPrompt });
    }
}
