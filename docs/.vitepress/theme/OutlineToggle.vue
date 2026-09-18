<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'

const STORAGE_KEY = 'eino-doc-outline-collapsed'
const route = useRoute()
const collapsed = ref(false)
const available = ref(false)

function applyState(): void {
  document.documentElement.classList.toggle('outline-collapsed', collapsed.value)
}

function refreshAvailability(): void {
  available.value = document.querySelector('.VPDoc.has-aside') !== null
}

function toggleOutline(): void {
  collapsed.value = !collapsed.value
  applyState()

  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed.value ? '1' : '0')
  } catch {
    // The layout still works when storage is unavailable (for example, strict
    // privacy mode); only persistence across reloads is skipped.
  }
}

watch(
  () => route.path,
  async () => {
    await nextTick()
    refreshAvailability()
  }
)

onMounted(async () => {
  try {
    collapsed.value = window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    collapsed.value = false
  }

  applyState()
  await nextTick()
  refreshAvailability()
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('outline-collapsed')
})
</script>

<template>
  <Teleport to="body">
    <button
      v-if="available"
      class="outline-toggle"
      type="button"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? '展开本页目录' : '收起本页目录'"
      :title="collapsed ? '展开本页目录' : '收起本页目录'"
      @click="toggleOutline"
    >
      <span>{{ collapsed ? '展开目录' : '收起目录' }}</span>
      <span class="outline-toggle__arrow" aria-hidden="true">
        {{ collapsed ? '‹' : '›' }}
      </span>
    </button>
  </Teleport>
</template>
