<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  name: string
  input: unknown
  ok?: boolean
  preview?: string
}>()

const expanded = ref(false)

const statusIcon = computed(() => {
  if (props.ok === undefined) return '⏳'
  return props.ok ? '✅' : '❌'
})

const statusText = computed(() => {
  if (props.ok === undefined) return '执行中...'
  return props.ok ? '成功' : '失败'
})

const inputSummary = computed(() => {
  if (!props.input || typeof props.input !== 'object') return String(props.input)
  const entries = Object.entries(props.input as Record<string, unknown>)
  return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')
})
</script>

<template>
  <div
    class="rounded-lg px-3 py-2 text-xs cursor-pointer transition-colors"
    style="background: var(--color-surface); border: 1px solid var(--color-border)"
    @click="expanded = !expanded"
  >
    <div class="flex items-center gap-2">
      <span>{{ statusIcon }}</span>
      <span class="font-medium" style="color: var(--color-text)">{{ name }}</span>
      <span style="color: var(--color-text-secondary)">{{ statusText }}</span>
      <span class="ml-auto" style="color: var(--color-text-secondary)">
        {{ expanded ? '▼' : '▶' }}
      </span>
    </div>

    <div v-if="expanded" class="mt-2 space-y-1">
      <div style="color: var(--color-text-secondary)">
        <span class="font-medium">参数：</span>{{ inputSummary }}
      </div>
      <div v-if="preview" style="color: var(--color-text-secondary)">
        <span class="font-medium">结果：</span>{{ preview }}
      </div>
    </div>
  </div>
</template>
