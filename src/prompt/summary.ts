/**
 * 摘要系统：prompt 构建 + 响应解析。
 *
 * 移植自 docforge/src/prompt.ts 的 SUMMARY_SYSTEM_PROMPT / buildSummaryPrompt / parseSummaryResponse。
 * 用 summaryModel（或主模型）对对话历史生成结构化摘要，
 * 提取 taskSummary / constraints / findings 写入 SessionMemory。
 */

import type { LlmMessage } from '@/llm/types';

const SUMMARY_SYSTEM_PROMPT = `你是一个作品集助手，正在总结当前的对话进展。
请根据以下对话历史，输出结构化摘要。

## 输出格式

严格按以下七段输出，每段不可省略（无内容写"（无）"）：

[当前任务] 一句话描述当前在做什么
[已完成] 列出已完成的步骤（每行一个 - 开头）
[待完成] 列出还未完成的事项（每行一个 - 开头）
[讨论中的决策] 列出用户和你正在讨论但尚未确定的事项（每行一个 - 开头）
[用户约束] 提取用户明确提出的要求、偏好、限制条件（每行一个 - 开头）
[项目发现] 提取关于用户技能、项目、经历等有价值的观察（每行一个 - 开头）
[会话标题] 如果对话主题与当前标题偏差较大，输出一个新标题（15字以内）；否则输出（无）

## 注意

- 只提取事实，不要推测
- 保持简洁，每段不超过 5 行
- [用户约束] 只记录用户明确表达的，不要自己推断
- [项目发现] 只记录已确认的事实，不要猜测
- [会话标题] 只在主题明显变化时才输出新标题，频繁小幅变化不要改
- 不要输出额外解释，直接输出七段结构`;

/**
 * 构造摘要请求的消息序列。
 * system = 摘要提示词，user = 对话历史序列化。
 */
export function buildSummaryPrompt(messages: LlmMessage[], currentTitle?: string): LlmMessage[] {
    const lines: string[] = [];
    for (const msg of messages) {
        if (msg.role === 'system') continue;
        const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : msg.role;
        lines.push(`[${role}] ${msg.content.slice(0, 500)}`);
    }
    const titleHint = currentTitle
        ? `\n\n当前会话标题："${currentTitle}"。请对比对话内容与该标题，若偏差较大则在[会话标题]中输出新标题，否则输出（无）。`
        : '';
    return [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: lines.join('\n\n') + titleHint },
    ];
}

/**
 * 解析摘要 LLM 输出的六段结构。
 * 前四段合并为 taskSummary，后两段分别提取列表项。
 */
export function parseSummaryResponse(content: string): {
    summary: string;
    constraints: string[];
    findings: string[];
    newTitle: string | null;
} {
    const sections = [
        '当前任务',
        '已完成',
        '待完成',
        '讨论中的决策',
        '用户约束',
        '项目发现',
        '会话标题',
    ];
    const parsed = new Map<string, string[]>();

    for (let i = 0; i < sections.length; i++) {
        const label = sections[i]!;
        const nextLabel = sections[i + 1];
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = nextLabel
            ? `\\[${escaped}\\]\\s*([\\s\\S]*?)(?=\\[${nextLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]|$)`
            : `\\[${escaped}\\]\\s*([\\s\\S]*)`;
        const match = content.match(new RegExp(pattern));
        if (match) {
            const raw = match[1]?.trim() ?? '';
            const lines = raw
                .split('\n')
                .map((l) => l.replace(/^-\s*/, '').trim())
                .filter((l) => l.length > 0 && l !== '（无）');
            parsed.set(label, lines);
        }
    }

    // 前四段合并为 taskSummary
    const summaryParts: string[] = [];
    for (const label of sections.slice(0, 4)) {
        const lines = parsed.get(label) ?? [];
        if (lines.length > 0) {
            summaryParts.push(`[${label}] ${lines.join('; ')}`);
        }
    }

    // 会话标题：取第一个有效行，（无）则返回 null
    const titleLines = parsed.get('会话标题') ?? [];
    const newTitle =
        titleLines.length > 0 && titleLines[0] !== '（无）' ? titleLines[0] : null;

    return {
        summary: summaryParts.join('\n'),
        constraints: parsed.get('用户约束') ?? [],
        findings: parsed.get('项目发现') ?? [],
        newTitle,
    };
}
