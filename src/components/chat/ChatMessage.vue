<script setup lang="ts">
import type { ChatMessage } from '@/composables/useChat'

defineProps<{
  message: ChatMessage
}>()
</script>

<template>
  <div
    :class="[
      'flex',
      message.role === 'user' ? 'justify-end' : 'justify-start',
    ]"
  >
    <div
      :class="[
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
        message.role === 'user'
          ? 'rounded-br-md'
          : 'rounded-bl-md',
      ]"
      :style="
        message.role === 'user'
          ? 'background: var(--color-primary); color: white'
          : 'background: var(--color-surface); color: var(--color-text)'
      "
    >
      <template v-if="message.content">
        {{ message.content }}
      </template>
      <template v-else-if="message.role === 'assistant'">
        <span style="color: var(--color-text-secondary)">...</span>
      </template>
    </div>
  </div>
</template>
