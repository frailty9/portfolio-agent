<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [content: string]
}>()

const input = ref('')

function handleSend() {
  const text = input.value.trim()
  if (!text) return
  emit('send', text)
  input.value = ''
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="px-6 py-4" style="background: var(--color-bg)">
    <div class="flex gap-3 items-end">
      <textarea
        v-model="input"
        @keydown="handleKeydown"
        :disabled="disabled"
        placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
        rows="1"
        class="flex-1 resize-none rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
        style="background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border)"
      />
      <button
        @click="handleSend"
        :disabled="disabled || !input.trim()"
        class="px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        style="background: var(--color-primary); color: white"
      >
        发送
      </button>
    </div>
  </div>
</template>
