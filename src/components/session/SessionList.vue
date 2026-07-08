<script setup lang="ts">
import type { SessionIndexItem } from '@/session/store'

defineProps<{
  sessions: SessionIndexItem[]
  currentId: string | null
  isGenerating: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  delete: [id: string]
  new: []
}>()

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '…'
}
</script>

<template>
  <div class="session-list">
    <button
      class="new-session-btn"
      :disabled="isGenerating"
      @click="emit('new')"
    >
      <span class="icon">+</span>
      <span>新建会话</span>
    </button>

    <div class="session-items">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="session-item"
        :class="{ active: session.id === currentId }"
        @click="emit('select', session.id)"
      >
        <div class="session-info">
          <div class="session-title">{{ truncate(session.title, 20) }}</div>
          <div class="session-time">{{ formatTime(session.updatedAt) }}</div>
        </div>
        <button
          class="delete-btn"
          :disabled="isGenerating"
          @click.stop="emit('delete', session.id)"
          title="删除会话"
        >
          ×
        </button>
      </div>

      <div v-if="sessions.length === 0" class="empty-hint">
        暂无会话
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.new-session-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.new-session-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-surface-hover);
}

.new-session-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.new-session-btn .icon {
  font-size: 16px;
  font-weight: 600;
}

.session-items {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 8px;
}

.session-item:hover {
  background: var(--color-surface-hover);
}

.session-item.active {
  background: var(--color-surface);
  border-left: 3px solid var(--color-primary);
  padding-left: 9px;
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.delete-btn {
  display: none;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

.session-item:hover .delete-btn {
  display: flex;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.empty-hint {
  text-align: center;
  padding: 24px 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
