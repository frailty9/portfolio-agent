/**
 * SessionMemory 管理：滑动窗口 + 任务摘要。
 *
 * 纯函数设计，就地修改（性能考虑）。
 */

import type { LlmMessage } from '@/llm/types';
import type { SessionMemory } from './types';

const DEFAULT_MAX_RECENT = 40;

export function createMemory(maxRecent = DEFAULT_MAX_RECENT): SessionMemory {
    return {
        recentMessages: [],
        maxRecent,
        taskSummary: '',
        projectContext: {
            constraints: [],
            findings: [],
        },
    };
}

export function pushMessage(mem: SessionMemory, msg: LlmMessage): void {
    mem.recentMessages.push(msg);
    trimToMax(mem);
}

export function pushMessages(mem: SessionMemory, msgs: LlmMessage[]): void {
    for (const msg of msgs) {
        mem.recentMessages.push(msg);
    }
    trimToMax(mem);
}

export function addConstraint(mem: SessionMemory, constraint: string): void {
    const trimmed = constraint.trim();
    if (trimmed && !mem.projectContext.constraints.includes(trimmed)) {
        mem.projectContext.constraints.push(trimmed);
    }
}

export function addFinding(mem: SessionMemory, finding: string): void {
    const trimmed = finding.trim();
    if (trimmed && !mem.projectContext.findings.includes(trimmed)) {
        mem.projectContext.findings.push(trimmed);
    }
}

export function toSerializable(mem: SessionMemory): SessionMemory {
    return {
        recentMessages: mem.recentMessages.map((m) => ({ ...m })),
        maxRecent: mem.maxRecent,
        taskSummary: mem.taskSummary,
        projectContext: {
            constraints: [...mem.projectContext.constraints],
            findings: [...mem.projectContext.findings],
        },
    };
}

/**
 * 把 memory 渲染为可注入 system prompt 的上下文片段。
 * 只在有实质内容时才输出对应段落。
 */
export function toPromptContext(mem: SessionMemory): string {
    const parts: string[] = [];

    if (mem.taskSummary) {
        parts.push(`[当前任务]\n${mem.taskSummary}`);
    }

    const { constraints, findings } = mem.projectContext;
    if (constraints.length > 0) {
        parts.push(`[用户约束]\n${constraints.map((c) => `- ${c}`).join('\n')}`);
    }
    if (findings.length > 0) {
        parts.push(`[项目认知]\n${findings.map((f) => `- ${f}`).join('\n')}`);
    }

    return parts.join('\n\n');
}

/**
 * 从持久化数据恢复 SessionMemory。
 * 缺失字段用默认值填充（向前兼容）。
 */
export function fromSerializable(data: unknown): SessionMemory {
    const d = data as Partial<SessionMemory> | undefined;
    if (!d || typeof d !== 'object') {
        return createMemory();
    }
    return {
        recentMessages: Array.isArray(d.recentMessages) ? d.recentMessages : [],
        maxRecent: typeof d.maxRecent === 'number' ? d.maxRecent : DEFAULT_MAX_RECENT,
        taskSummary: typeof d.taskSummary === 'string' ? d.taskSummary : '',
        projectContext: {
            constraints: Array.isArray(d.projectContext?.constraints)
                ? d.projectContext.constraints
                : [],
            findings: Array.isArray(d.projectContext?.findings) ? d.projectContext.findings : [],
        },
    };
}

/**
 * 裁剪到 maxRecent。始终保留 system 消息。
 * 安全裁剪：不切断 tool call → tool result 配对。
 */
function trimToMax(mem: SessionMemory): void {
    const msgs = mem.recentMessages;
    if (msgs.length <= mem.maxRecent) return;

    let systemCount = 0;
    while (systemCount < msgs.length && msgs[systemCount].role === 'system') {
        systemCount++;
    }

    const keep = mem.maxRecent;
    if (systemCount >= keep) {
        mem.recentMessages = msgs.slice(0, keep);
        return;
    }

    const nonSystemKeep = keep - systemCount;
    const nonSystemTotal = msgs.length - systemCount;
    let trimStart = systemCount + (nonSystemTotal - nonSystemKeep);

    // 不落在 tool result 序列中间
    while (trimStart > systemCount && trimStart < msgs.length && msgs[trimStart].role === 'tool') {
        trimStart--;
    }

    mem.recentMessages = [...msgs.slice(0, systemCount), ...msgs.slice(trimStart)];
}
