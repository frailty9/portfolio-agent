/**
 * 会话持久化：localStorage 版。
 *
 * 移植自 docforge/src/session/store.ts，存储介质从文件系统换到 localStorage。
 *
 * localStorage 结构：
 *   pa:session:index  → SessionIndexItem[]    索引，按 savedAt 降序
 *   pa:session:<id>   → SessionData           完整会话数据
 *
 * 容量注意：localStorage 通常 5~10 MiB，单个会话约 50~200 KB，
 * 可存储 25~200 个会话。超限时自动清理最旧的会话。
 */

import type { SessionData, SessionMemory, DisplayMessage } from './types';
import { toSerializable, fromSerializable } from './memory';

const SESSION_VERSION = 1;
const KEY_PREFIX = 'pa:session:';
const INDEX_KEY = `${KEY_PREFIX}index`;
const MAX_SESSIONS = 30;

// ============================================================================
// 类型
// ============================================================================

export interface SessionIndexItem {
    sessionId: string;
    savedAt: string;
    title: string;
    messageCount: number;
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 生成 session ID。
 */
export function generateSessionId(): string {
    return crypto.randomUUID().slice(0, 8);
}

/**
 * 保存会话。同一 sessionId 始终覆盖。
 * 不传 sessionId 则自动生成。
 * displayMessages 为完整展示历史（与 LLM 上下文独立）。
 * 返回实际使用的 sessionId。
 */
export function saveSession(
    memory: SessionMemory,
    sessionId?: string,
    displayMessages?: DisplayMessage[],
): string {
    const sid = sessionId ?? generateSessionId();
    const data: SessionData = {
        version: SESSION_VERSION,
        savedAt: new Date().toISOString(),
        memory: toSerializable(memory),
        displayMessages,
    };

    try {
        localStorage.setItem(`${KEY_PREFIX}${sid}`, JSON.stringify(data));
        updateIndex(sid, data);
    } catch {
        // 静默：存储失败不中断主流程
    }

    return sid;
}

/**
 * 加载最新的会话。
 */
export function loadLatestSession(): (SessionData & { sessionId: string }) | null {
    const index = getIndex();
    if (index.length === 0) return null;

    // 按 savedAt 降序，取最新的
    index.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    const latest = index[0]!;
    return loadSession(latest.sessionId);
}

/**
 * 加载指定 sessionId 的会话。
 */
export function loadSession(sessionId: string): (SessionData & { sessionId: string }) | null {
    try {
        const raw = localStorage.getItem(`${KEY_PREFIX}${sessionId}`);
        if (!raw) return null;
        const data = JSON.parse(raw) as SessionData;
        if (data.version !== SESSION_VERSION || !data.memory) return null;
        data.memory = fromSerializable(data.memory);
        return { ...data, sessionId };
    } catch {
        return null;
    }
}

/**
 * 列出所有会话（按 savedAt 降序）。
 */
export function listSessions(): SessionIndexItem[] {
    const index = getIndex();
    return index.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

/**
 * 删除指定会话。
 */
export function deleteSession(sessionId: string): void {
    try {
        localStorage.removeItem(`${KEY_PREFIX}${sessionId}`);
        removeFromIndex(sessionId);
    } catch {
        // 静默
    }
}

/**
 * 删除所有会话。
 */
export function deleteAllSessions(): void {
    const index = getIndex();
    for (const item of index) {
        try {
            localStorage.removeItem(`${KEY_PREFIX}${item.sessionId}`);
        } catch {
            // 静默
        }
    }
    try {
        localStorage.removeItem(INDEX_KEY);
    } catch {
        // 静默
    }
}

// ============================================================================
// 内部：索引管理
// ============================================================================

function getIndex(): SessionIndexItem[] {
    try {
        const raw = localStorage.getItem(INDEX_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as SessionIndexItem[];
    } catch {
        return [];
    }
}

function setIndex(index: SessionIndexItem[]): void {
    try {
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    } catch {
        // 静默
    }
}

function updateIndex(sessionId: string, data: SessionData): void {
    const index = getIndex();
    const existing = index.findIndex((item) => item.sessionId === sessionId);
    const firstUserMsg = data.displayMessages?.find((m) => m.role === 'user');
    const entry: SessionIndexItem = {
        sessionId,
        savedAt: data.savedAt,
        title: firstUserMsg?.content?.slice(0, 40) || '新会话',
        messageCount: data.displayMessages?.length ?? data.memory.recentMessages.length,
    };

    if (existing >= 0) {
        index[existing] = entry;
    } else {
        index.push(entry);
    }

    // 按 savedAt 降序
    index.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    // 超限清理
    while (index.length > MAX_SESSIONS) {
        const removed = index.pop();
        if (removed) {
            try {
                localStorage.removeItem(`${KEY_PREFIX}${removed.sessionId}`);
            } catch {
                // 静默
            }
        }
    }

    setIndex(index);
}

function removeFromIndex(sessionId: string): void {
    const index = getIndex().filter((item) => item.sessionId !== sessionId);
    setIndex(index);
}
