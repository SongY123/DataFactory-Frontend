<template>
  <div class="synthesis-results-surface">
    <div class="synthesis-results-toolbar">
      <div class="small text-muted">{{ countLabel }}</div>
      <button
        class="btn btn-outline-secondary btn-sm"
        type="button"
        :disabled="!rows.length"
        title="Expand table"
        aria-label="Expand table"
        @click="expandTable"
      >
        <i class="bi bi-arrows-angle-expand"></i>
      </button>
    </div>

    <div class="table-responsive synthesis-results-table-wrap">
      <table class="table table-sm table-hover align-top mb-0 synthesis-results-grid">
        <thead class="table-light">
          <tr>
            <th class="serial-col">#</th>
            <th
              v-for="column in columns"
              :key="`header-${column.key}`"
              class="synthesis-results-th"
              :style="getColumnStyle(column)"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td :colspan="columns.length + 1" class="text-center text-muted py-3">{{ emptyText }}</td>
          </tr>
          <tr v-for="(row, rowIndex) in rows" :key="rowKeyValue(row, rowIndex)">
            <td class="serial-col">{{ serialOffset + rowIndex + 1 }}</td>
            <td
              v-for="column in columns"
              :key="`${rowKeyValue(row, rowIndex)}-${column.key}`"
              class="synthesis-results-td"
              :style="getColumnStyle(column)"
            >
              <span
                v-if="column.kind === 'status'"
                class="badge"
                :class="statusClassFor(row, column)"
              >
                {{ getCellText(row, column) || '-' }}
              </span>
              <button
                v-else-if="column.kind === 'action'"
                class="btn btn-outline-secondary btn-sm synthesis-action-button"
                type="button"
                :disabled="isActionDisabled(row, column)"
                :title="getActionTitle(row, column)"
                @click="emitCellOpen(row, column)"
              >
                {{ getActionText(row, column) }}
              </button>
              <button
                v-else
                class="synthesis-cell-button"
                type="button"
                :title="getCellTitle(row, column, cellCharLimit)"
                @click="emitCellOpen(row, column)"
              >
                <span class="synthesis-cell-text">{{ getPreviewText(row, column, cellCharLimit) }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div v-if="isExpanded" class="synthesis-results-overlay">
        <div class="synthesis-results-overlay-card">
          <div class="synthesis-results-overlay-head">
            <div>
              <h5 class="mb-1">{{ overlayTitle }}</h5>
              <div class="small text-muted">{{ countLabel }}</div>
            </div>
            <button
              class="btn btn-outline-secondary btn-sm"
              type="button"
              title="Collapse table"
              aria-label="Collapse table"
              @click="collapseTable"
            >
              <i class="bi bi-arrows-angle-contract"></i>
            </button>
          </div>

          <div class="synthesis-results-overlay-body">
            <div class="table-responsive synthesis-results-table-wrap expanded">
              <table class="table table-sm table-hover align-top mb-0 synthesis-results-grid">
                <thead class="table-light">
                  <tr>
                    <th class="serial-col">#</th>
                    <th
                      v-for="column in columns"
                      :key="`overlay-header-${column.key}`"
                      class="synthesis-results-th"
                      :style="getExpandedColumnStyle(column)"
                    >
                      {{ column.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!rows.length">
                    <td :colspan="columns.length + 1" class="text-center text-muted py-3">{{ emptyText }}</td>
                  </tr>
                  <tr v-for="(row, rowIndex) in rows" :key="`overlay-${rowKeyValue(row, rowIndex)}`">
                    <td class="serial-col">{{ serialOffset + rowIndex + 1 }}</td>
                    <td
                      v-for="column in columns"
                      :key="`overlay-${rowKeyValue(row, rowIndex)}-${column.key}`"
                      class="synthesis-results-td"
                      :style="getExpandedColumnStyle(column)"
                    >
                      <span
                        v-if="column.kind === 'status'"
                        class="badge"
                        :class="statusClassFor(row, column)"
                      >
                        {{ getCellText(row, column) || '-' }}
                      </span>
                      <button
                        v-else-if="column.kind === 'action'"
                        class="btn btn-outline-secondary btn-sm synthesis-action-button"
                        type="button"
                        :disabled="isActionDisabled(row, column)"
                        :title="getActionTitle(row, column)"
                        @click="emitCellOpen(row, column)"
                      >
                        {{ getActionText(row, column) }}
                      </button>
                      <button
                        v-else
                        class="synthesis-cell-button"
                        type="button"
                        :title="getCellTitle(row, column, expandedCellCharLimit)"
                        @click="emitCellOpen(row, column)"
                      >
                        <span class="synthesis-cell-text">{{ getPreviewText(row, column, expandedCellCharLimit) }}</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  emptyText: {
    type: String,
    default: 'No results.'
  },
  serialOffset: {
    type: Number,
    default: 0
  },
  countLabelText: {
    type: String,
    default: ''
  },
  overlayTitle: {
    type: String,
    default: 'Synthesis Results'
  },
  cellCharLimit: {
    type: Number,
    default: 320
  },
  expandedCellCharLimit: {
    type: Number,
    default: 1200
  },
  getStatusClass: {
    type: Function,
    default: () => 'bg-light text-dark'
  }
})

const emit = defineEmits(['cell-open'])

const isExpanded = ref(false)
let previousBodyOverflow = ''

const countLabel = computed(() => {
  if (String(props.countLabelText || '').trim()) return props.countLabelText
  return `${props.rows.length} results`
})

const rowKeyValue = (row, rowIndex) => {
  const key = row?.[props.rowKey]
  return key == null || key === '' ? `row-${rowIndex + 1}` : String(key)
}

const getColumnStyle = (column) => {
  const width = String(column?.width || '').trim()
  return width ? { minWidth: width, width } : null
}

const getExpandedColumnStyle = (column) => {
  const width = String(column?.expandedWidth || column?.width || '').trim()
  return width ? { minWidth: width, width } : null
}

const normalizeCellValue = (value) => {
  if (value == null) return '-'
  if (typeof value === 'string') {
    const text = value.trim()
    return text || '-'
  }
  try {
    return JSON.stringify(value)
  } catch {
    const text = String(value)
    return text.trim() || '-'
  }
}

const getRawCellValue = (row, column) => {
  if (typeof column?.accessor === 'function') return column.accessor(row)
  return row?.[column?.key]
}

const getCellText = (row, column) => normalizeCellValue(getRawCellValue(row, column))

const buildPreviewText = (text, limit) => {
  const normalized = String(text || '').trim()
  if (!normalized) return '-'
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 3)).trimEnd()}...`
}

const getPreviewText = (row, column, limit) => buildPreviewText(getCellText(row, column), limit)

const getCellTitle = (row, column, limit) => {
  const fullText = getCellText(row, column)
  if (fullText.length <= limit) return ''
  return fullText.length > 4000 ? `${fullText.slice(0, 3997)}...` : fullText
}

const emitCellOpen = (row, column) => {
  if (column?.kind === 'action' && isActionDisabled(row, column)) return
  emit('cell-open', {
    row,
    column,
    value: getCellText(row, column)
  })
}

const getActionText = (row, column) => {
  const value = getRawCellValue(row, column)
  const text = String(value == null ? '' : value).trim()
  return text || String(column?.actionLabel || column?.label || 'Open')
}

const getActionTitle = (row, column) => {
  if (typeof column?.actionTitle === 'function') {
    return String(column.actionTitle(row) || '').trim()
  }
  return getActionText(row, column)
}

const isActionDisabled = (row, column) => {
  if (typeof column?.isDisabled === 'function') return !!column.isDisabled(row)
  return false
}

const statusClassFor = (row, column) => {
  const value = getRawCellValue(row, column)
  return props.getStatusClass(value, row, column)
}

const applyBodyOverflow = (locked) => {
  if (typeof document === 'undefined') return
  if (locked) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = previousBodyOverflow
  }
}

const expandTable = () => {
  if (!props.rows.length) return
  isExpanded.value = true
}

const collapseTable = () => {
  isExpanded.value = false
}

watch(isExpanded, (value) => {
  applyBodyOverflow(value)
})

onBeforeUnmount(() => {
  applyBodyOverflow(false)
})
</script>

<style scoped>
.synthesis-results-surface {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.synthesis-results-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.synthesis-results-table-wrap {
  overflow: auto;
}

.synthesis-results-table-wrap.expanded {
  flex: 1;
  min-height: 0;
}

.synthesis-results-grid {
  width: max-content;
  min-width: 100%;
  table-layout: auto;
}

.synthesis-results-th,
.synthesis-results-td {
  vertical-align: top;
}

.serial-col {
  width: 64px;
  min-width: 64px;
  text-align: center;
  color: #66758c;
}

.synthesis-cell-button {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.synthesis-cell-button:hover .synthesis-cell-text {
  color: #174d94;
}

.synthesis-action-button {
  white-space: nowrap;
}

.synthesis-cell-text {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.45;
}

.synthesis-results-overlay {
  position: fixed;
  top: var(--app-navbar-height, 58px);
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1085;
  background: rgba(244, 247, 252, 0.96);
  backdrop-filter: blur(4px);
  padding: 1rem;
}

.synthesis-results-overlay-card {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  background: #fff;
  border: 1px solid #dbe4f0;
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(16, 24, 40, 0.12);
  padding: 1rem;
}

.synthesis-results-overlay-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.synthesis-results-overlay-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.synthesis-results-overlay-body .synthesis-results-table-wrap.expanded {
  height: 100%;
  max-height: 100%;
  overflow: auto;
}

@media (max-width: 768px) {
  .synthesis-results-overlay {
    padding: 0.6rem;
  }

  .synthesis-results-overlay-card {
    padding: 0.75rem;
  }

  .synthesis-results-overlay-head {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
