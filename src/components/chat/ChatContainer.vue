<script setup lang="ts">
import { watch, nextTick, ref } from 'vue'
import type { ChatMessage } from '@/composables/useChat'
import type { AgentLifecycleState } from '@/agent/types'
import ChatMessageBubble from './ChatMessage.vue'
import ToolCallCard from './ToolCallCard.vue'

const props = defineProps<{
  messages: ChatMessage[]
  agentState: AgentLifecycleState
}>()

const scrollRef = ref<HTMLDivElement>()

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  },
)

// 也监听内容变化（流式更新）
watch(
  () => props.messages.map((m) => m.content).join(''),
  async () => {
    await nextTick()
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  },
)
</script>

<template>
  <div ref="scrollRef" class="overflow-y-auto px-6 py-4 space-y-4">
    <!-- 空状态 -->
    <div v-if="messages.length === 0" class="flex items-center justify-center h-full">
      <div class="text-center" style="color: var(--color-text-secondary)">
        <div class="text-4xl mb-4">💬</div>
        <p class="text-lg mb-2">你好！我是作品集助手</p>
        <p class="text-sm">你可以问我关于项目、技能、经历等问题</p>
      </div>
    </div>

    <!-- 消息列表 -->
    <template v-for="msg in messages" :key="msg.id">
      <ChatMessageBubble :message="msg" />

      <!-- 工具调用卡片 -->
      <div v-if="msg.toolCalls && msg.toolCalls.length > 0" class="ml-10 space-y-2">
        <ToolCallCard
          v-for="(tc, i) in msg.toolCalls"
          :key="i"
          :name="tc.name"
          :input="tc.input"
          :ok="tc.ok"
          :preview="tc.preview"
        />
      </div>
    </template>

    <!-- 生成状态指示 -->
    <div
      v-if="agentState === 'thinking'"
      class="flex items-center gap-2 text-sm"
      style="color: var(--color-text-secondary)"
    >
      <div class="flex gap-1">
        <span class="w-2 h-2 rounded-full animate-bounce" style="background: var(--color-primary); animation-delay: 0ms" />
        <span class="w-2 h-2 rounded-full animate-bounce" style="background: var(--color-primary); animation-delay: 150ms" />
        <span class="w-2 h-2 rounded-full animate-bounce" style="background: var(--color-primary); animation-delay: 300ms" />
      </div>
      <span>思考中...</span>
    </div>
  </div>
</template>
