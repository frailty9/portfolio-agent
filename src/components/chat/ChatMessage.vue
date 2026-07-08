<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import type { ChatMessage } from '@/composables/useChat'

const props = defineProps<{
  message: ChatMessage
}>()

const renderedContent = computed(() => {
  if (!props.message.content) return ''
  return marked.parse(props.message.content, { breaks: true, gfm: true })
})
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
        'message-bubble',
        message.role === 'user' ? 'user-bubble' : 'assistant-bubble',
      ]"
    >
      <!-- 用户消息：纯文本 -->
      <template v-if="message.role === 'user'">
        <span class="whitespace-pre-wrap">{{ message.content }}</span>
      </template>

      <!-- 助手消息：Markdown 渲染 -->
      <template v-else-if="message.content">
        <div class="markdown-body" v-html="renderedContent" />
      </template>

      <!-- 助手空内容（流式占位） -->
      <template v-else>
        <span class="text-secondary">...</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.message-bubble {
  max-width: 80%;
  border-radius: 16px;
  padding: 10px 16px;
  font-size: 14px;
  line-height: 1.6;
}

.user-bubble {
  background: var(--color-primary);
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.assistant-bubble {
  background: var(--color-surface);
  color: var(--color-text);
  border-bottom-left-radius: 4px;
  border: 1px solid var(--color-border);
}

.text-secondary {
  color: var(--color-text-secondary);
}
</style>

<style>
/* Markdown 正文样式（非 scoped，作用于 v-html 内容） */
.markdown-body {
  word-break: break-word;
}

.markdown-body > *:first-child {
  margin-top: 0;
}

.markdown-body > *:last-child {
  margin-bottom: 0;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4 {
  font-weight: 600;
  margin: 16px 0 8px;
  line-height: 1.3;
}

.markdown-body h1 { font-size: 1.3em; }
.markdown-body h2 { font-size: 1.15em; }
.markdown-body h3 { font-size: 1.05em; }

.markdown-body p {
  margin: 8px 0;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 1.5em;
  margin: 8px 0;
}

.markdown-body li {
  margin: 4px 0;
}

.markdown-body code {
  background: var(--color-surface-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
}

.markdown-body pre {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  margin: 10px 0;
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
  font-size: 0.85em;
  line-height: 1.5;
}

.markdown-body blockquote {
  border-left: 3px solid var(--color-primary);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--color-text-secondary);
}

.markdown-body a {
  color: var(--color-primary);
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body table {
  border-collapse: collapse;
  margin: 10px 0;
  width: 100%;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--color-border);
  padding: 6px 10px;
  text-align: left;
  font-size: 0.9em;
}

.markdown-body th {
  background: var(--color-surface-hover);
  font-weight: 600;
}

.markdown-body hr {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 16px 0;
}
</style>
