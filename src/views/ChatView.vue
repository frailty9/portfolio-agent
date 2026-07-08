<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useChat } from '@/composables/useChat';
import ChatContainer from '@/components/chat/ChatContainer.vue';
import ChatInput from '@/components/chat/ChatInput.vue';
import SessionList from '@/components/session/SessionList.vue';

const {
    messages,
    sessions,
    isGenerating,
    agentState,
    error,
    configLoaded,
    init,
    sendMessage,
    clearMessages,
    newSession,
    loadSessionById,
    deleteSessionById,
    currentSessionId,
} = useChat();

onMounted(() => {
    init();
});

const sessionTitle = computed(() => {
    if (!currentSessionId.value) return '新会话';
    const s = sessions.value.find((s) => s.id === currentSessionId.value);
    return s?.title ?? '新会话';
});
</script>

<template>
    <div class="root-layout">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1 class="app-title">Portfolio Agent</h1>
            </div>
            <SessionList
                :sessions="sessions"
                :current-id="currentSessionId"
                :is-generating="isGenerating"
                @new="newSession"
                @select="loadSessionById"
                @delete="deleteSessionById"
            />
        </aside>

        <!-- Content -->
        <main class="content">
            <div class="content-header">
                <h2 class="session-title">{{ sessionTitle }}</h2>
                <button
                    class="clear-btn"
                    @click="clearMessages"
                    :disabled="isGenerating"
                >
                    清空
                </button>
            </div>

            <ChatContainer
                :messages="messages"
                :agent-state="agentState"
                class="message-area"
            />

            <div v-if="error" class="error-bar">
                {{ error }}
            </div>

            <ChatInput
                :disabled="isGenerating || !configLoaded"
                @send="sendMessage"
            />
        </main>
    </div>
</template>

<style scoped>
.root-layout {
    display: flex;
    height: 100vh;
    overflow: hidden;
}

/* ── Sidebar ── */
.sidebar {
    width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--color-border);
    background: var(--color-bg);
    padding: 16px;
    overflow: hidden;
}

.sidebar-header {
    flex-shrink: 0;
    margin-bottom: 12px;
}

.app-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
}

/* ── Content ── */
.content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--color-surface);
}

.content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
}

.session-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.clear-btn {
    padding: 4px 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
}

.clear-btn:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.clear-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.message-area {
    flex: 1;
    overflow: hidden;
}

.error-bar {
    padding: 8px 24px;
    font-size: 13px;
    color: #ef4444;
    background: #fef2f2;
    border-top: 1px solid #fecaca;
    flex-shrink: 0;
}
</style>
