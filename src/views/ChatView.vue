<script setup lang="ts">
import { onMounted } from 'vue';
import { useChat } from '@/composables/useChat';
import ChatContainer from '@/components/chat/ChatContainer.vue';
import ChatInput from '@/components/chat/ChatInput.vue';

const {
    messages,
    isGenerating,
    agentState,
    error,
    configLoaded,
    init,
    sendMessage,
    clearMessages,
    newSession,
} = useChat();

onMounted(() => {
    init();
});
</script>

<template>
    <div class="flex h-screen max-w-3xl flex-col mx-auto">
        <!-- Header -->
        <header
            class="flex items-center justify-between px-6 py-4 border-b"
            style="border-color: var(--color-border)"
        >
            <div>
                <h1 class="text-lg font-semibold" style="color: var(--color-text)">
                    Portfolio Agent
                </h1>
                <p class="text-sm" style="color: var(--color-text-secondary)">
                    问我关于这个作品集的任何问题
                </p>
            </div>
            <div class="flex gap-2">
                <button
                    @click="newSession"
                    class="rounded-lg px-3 py-1.5 text-sm transition-colors"
                    style="background: var(--color-surface); color: var(--color-text-secondary)"
                    :disabled="isGenerating"
                >
                    新会话
                </button>
                <button
                    @click="clearMessages"
                    class="rounded-lg px-3 py-1.5 text-sm transition-colors"
                    style="background: var(--color-surface); color: var(--color-text-secondary)"
                    :disabled="isGenerating"
                >
                    清空
                </button>
            </div>
        </header>

        <!-- Messages -->
        <ChatContainer
            :messages="messages"
            :agent-state="agentState"
            class="flex-1 overflow-hidden"
        />

        <!-- Error -->
        <div v-if="error" class="px-6 py-2 text-sm text-red-400 bg-red-900/20">
            {{ error }}
        </div>

        <!-- Input -->
        <ChatInput
            :disabled="isGenerating || !configLoaded"
            @send="sendMessage"
            class="border-t"
            style="border-color: var(--color-border)"
        />
    </div>
</template>
