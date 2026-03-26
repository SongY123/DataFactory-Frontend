<template>
  <div class="workflow-module-shell" :style="{ '--chat-panel-width': `${resolvedChatPanelWidth}px` }">
    <div class="dataset-page">
    <div v-if="notice" class="alert alert-warning py-2 px-3 mb-3" role="alert">
      {{ notice }}
    </div>

    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Dataset Management</h4>
        <p class="text-muted mb-0">Register, inspect, and organize datasets for downstream synthesis tasks.</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-primary btn-sm dataset-add-icon-btn" type="button" @click="openImportModal" aria-label="Add dataset" title="Add dataset">
          <i class="bi bi-plus-lg"></i>
        </button>
      </div>
    </div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-md-4" v-for="card in statsCards" :key="card.label">
        <article class="dataset-stats-card h-100">
          <div class="dataset-stats-card-body py-3">
            <div class="small text-muted">{{ card.label }}</div>
            <div class="h4 mb-0 mt-1">{{ card.value }}</div>
          </div>
        </article>
      </div>
    </div>

    <section class="toolbar-card">
      <form class="toolbar-top" @submit.prevent="applySearch">
        <label class="search-box">
          <i class="bi bi-search"></i>
          <input
            v-model.trim="pendingSearchKeyword"
            type="text"
            class="form-control"
            placeholder="Search by dataset name"
            @keydown.enter.prevent="applySearch"
          >
        </label>

        <div class="toolbar-actions">
          <span class="toolbar-hint">{{ activeFilterCount }} active filters</span>
          <button class="btn btn-primary toolbar-search" type="submit">
            Search
          </button>
          <button class="btn btn-outline-secondary toolbar-clear" type="button" @click="clearFilters">
            Clear Filters
          </button>
          <button class="btn btn-outline-primary toolbar-toggle" type="button" @click="toggleFiltersCollapsed">
            <i class="bi" :class="isFiltersCollapsed ? 'bi-chevron-down' : 'bi-chevron-up'"></i>
            <span>{{ isFiltersCollapsed ? 'Show Filters' : 'Hide Filters' }}</span>
          </button>
        </div>
      </form>

      <div v-show="!isFiltersCollapsed" class="filter-groups">
        <div class="filter-group">
          <span class="filter-label">Format</span>
          <div class="filter-chip-list">
            <button
              v-for="tag in formatOptions"
              :key="`format-${tag}`"
              class="filter-chip"
              :class="{ active: selectedFormats.includes(tag) }"
              type="button"
              @click="toggleFilterSelection('formats', tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-label">Language</span>
          <div class="filter-chip-list">
            <button
              v-for="tag in languageOptions"
              :key="`language-${tag}`"
              class="filter-chip"
              :class="{ active: selectedLanguages.includes(tag) }"
              type="button"
              @click="toggleFilterSelection('languages', tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-label">Size</span>
          <div class="filter-chip-list">
            <button
              v-for="item in sizeFilterOptions"
              :key="item.value"
              class="filter-chip"
              :class="{ active: selectedSizeLevels.includes(item.value) }"
              type="button"
              @click="toggleFilterSelection('sizes', item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-label">Status</span>
          <div class="filter-chip-list">
            <button
              v-for="status in statusOptions"
              :key="`status-${status}`"
              class="filter-chip"
              :class="{ active: selectedStatuses.includes(status) }"
              type="button"
              @click="toggleFilterSelection('statuses', status)"
            >
              {{ formatStatusLabel(status) }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section ref="datasetSectionRef" class="dataset-section">
      <div class="section-head">
      </div>

      <div v-if="isLoading" class="loading-card">
        <span class="spinner-border spinner-border-sm" role="status"></span>
        <span>Loading datasets...</span>
      </div>

      <div v-else-if="filteredRows.length === 0" class="empty-card">
        <h6 class="mb-2">No datasets match the current filters</h6>
        <p class="text-muted mb-0">Try another dataset name, adjust the active filters, or add a new dataset.</p>
      </div>

      <div v-else class="dataset-grid">
        <article
          v-for="row in filteredRows"
          :key="row.id"
          class="dataset-card"
          @click="goToDatasetDetail(row.id)"
        >
          <div class="dataset-card-media">
            <img
              v-if="row.cover"
              :src="row.cover"
              :alt="`${row.name} cover`"
              class="dataset-cover"
            >
            <div v-else class="dataset-cover-fallback">
              <div class="dataset-cover-name">{{ row.name }}</div>
<!--              <div class="dataset-cover-meta">{{ row.typeLabel }} · {{ row.languageLabel }}</div>-->
            </div>
          </div>

          <div class="dataset-card-body">
            <div class="dataset-card-top">
              <div class="dataset-badges">
                <span class="dataset-badge-muted">#{{ row.id }}</span>
                <span v-if="row.sourceKind !== 'upload'" class="dataset-source">{{ sourceKindLabel(row.sourceKind) }}</span>
                <span v-if="shouldShowDatasetStatus(row.status)" class="status-pill" :class="statusClass(row.status)">{{ formatStatusLabel(row.status) }}</span>
              </div>

              <details class="action-menu" @click.stop>
                <summary class="dataset-more-btn" aria-label="Quick actions">
                  <i class="bi bi-three-dots"></i>
                </summary>
                <div class="action-menu-panel">
                  <button class="action-item" type="button" :disabled="row.isImporting" @click.stop="useInDistillation(row)">Reasoning Synthesis</button>
                  <button class="action-item" type="button" :disabled="row.isImporting" @click.stop="useInTrajectory(row)">Trajectory Synthesis</button>
                </div>
              </details>
            </div>

            <div>
              <h5 class="dataset-name">{{ row.name }}</h5>
              <p class="dataset-summary">
                {{ row.note }}
              </p>
            </div>

            <div v-if="row.isImporting" class="progress-block">
              <div class="progress-copy">
                <span>Downloading Hugging Face dataset</span>
                <span>{{ row.importProgress }}%</span>
              </div>
              <div class="progress">
                <div class="progress-bar" role="progressbar" :style="{ width: `${row.importProgress}%` }"></div>
              </div>
              <div class="progress-meta">
                <span>{{ row.importDownloadedFiles }} / {{ row.importTotalFiles || '?' }} files</span>
                <span v-if="row.importErrorMessage" class="text-danger">{{ row.importErrorMessage }}</span>
              </div>
            </div>

            <div class="tag-groups">
              <div v-if="cardTags(row).length" class="tag-list compact">
                <span v-for="tag in cardTags(row)" :key="`${row.id}-tag-${tag}`" class="tag-chip">{{ tag }}</span>
                <span v-if="extraTagCount(row) > 0" class="tag-chip muted">+{{ extraTagCount(row) }}</span>
              </div>
            </div>

            <div class="dataset-card-footer">
              <div class="footer-copy">
                <span>{{ preciseDateTime(row.insertAt || row.updatedAt) }}</span>
                <span v-if="row.isGenerated">{{ originSummary(row) }}</span>
              </div>
              <span class="footer-size">{{ formatSize(row.size) }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <div class="modal fade dataset-import-modal" tabindex="-1" ref="importModalRef" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content import-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <h5 class="modal-title mb-1">Add Dataset</h5>
              <p class="text-muted mb-0 small">Choose a local folder or import a public dataset from HuggingFace.</p>
            </div>
            <button type="button" class="btn-close" @click="closeImportModal"></button>
          </div>
          <div class="modal-body pt-3">
            <div class="import-mode-switch">
              <button
                class="mode-pill"
                :class="{ active: importMode === 'upload' }"
                type="button"
                @click="importMode = 'upload'"
              >
                Local
              </button>
              <button
                class="mode-pill"
                :class="{ active: importMode === 'huggingface' }"
                type="button"
                @click="importMode = 'huggingface'"
              >
                HuggingFace
              </button>
            </div>

            <form v-if="importMode === 'upload'" class="d-flex flex-column gap-3" @submit.prevent="submitLocalUpload">
              <div class="row g-3">
                <div class="col-12 col-md-7">
                  <label class="form-label">Dataset Name</label>
                  <input v-model.trim="datasetForm.name" type="text" class="form-control" placeholder="Dataset name" required>
                </div>
                <div class="col-6 col-md-3">
                  <label class="form-label">Type</label>
                  <select v-model="datasetForm.type" class="form-select">
                    <option value="instruction">Instruction</option>
                    <option value="conversation">Conversation</option>
                    <option value="evaluation">Evaluation</option>
                    <option value="tool-trace">Tool Trace</option>
                  </select>
                </div>
                <div class="col-6 col-md-2">
                  <label class="form-label">Language</label>
                  <select v-model="datasetForm.language" class="form-select">
                    <option value="zh">ZH</option>
                    <option value="en">EN</option>
                    <option value="multi">Multi</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="form-label">Source</label>
                <input v-model.trim="datasetForm.source" type="text" class="form-control" placeholder="Optional source URL or note">
              </div>

              <div class="upload-grid">
                <div class="upload-panel">
                  <div class="upload-panel-head">
                    <span class="upload-panel-title">Dataset Folder</span>
                    <span class="upload-panel-copy">Keep the full directory structure.</span>
                  </div>
                  <input
                    ref="datasetFilesInputRef"
                    class="d-none"
                    type="file"
                    accept=".csv,.tsv,.json,.jsonl,.txt,.md,.xlsx,.xls,.parquet"
                    multiple
                    webkitdirectory
                    directory
                    @change="onDatasetFilesChange"
                  >
                  <button class="btn btn-outline-dark" type="button" @click="triggerDatasetFolderPicker">
                    Select Folder
                  </button>
                  <div class="upload-status">{{ selectedFolderLabel }}</div>
                </div>

                <div class="upload-panel">
                  <div class="upload-panel-head">
                    <span class="upload-panel-title">Cover Image</span>
                    <span class="upload-panel-copy">Optional card cover.</span>
                  </div>
                  <input
                    ref="coverFileInputRef"
                    class="d-none"
                    type="file"
                    accept="image/*"
                    @change="onCoverFileChange"
                  >
                  <button class="btn btn-outline-dark" type="button" @click="triggerCoverFilePicker">
                    Select Cover
                  </button>
                  <div class="upload-status">{{ selectedCoverLabel }}</div>
                </div>
              </div>

              <div>
                <label class="form-label">Description</label>
                <textarea
                  v-model.trim="datasetForm.note"
                  class="form-control"
                  rows="4"
                  placeholder="Dataset summary, annotation rules, or anything consumers should know"
                ></textarea>
              </div>

              <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-outline-secondary" type="button" @click="closeImportModal">Cancel</button>
                <button class="btn btn-primary" type="submit" :disabled="isSubmittingUpload">
                  <span v-if="isSubmittingUpload" class="spinner-border spinner-border-sm me-1" role="status"></span>
                  Ok
                </button>
              </div>
            </form>

            <form v-else class="d-flex flex-column gap-3" @submit.prevent="submitHuggingFaceImport">
              <div>
                <label class="form-label">Dataset Name on Hugging Face</label>
                <input
                  v-model.trim="huggingFaceForm.repoId"
                  type="text"
                  class="form-control"
                  placeholder="LipengCS/Table-GPT"
                  required
                >
              </div>

              <div class="row g-3">
                <div class="col-12 col-md-7">
                  <label class="form-label">Display Name</label>
                  <input v-model.trim="huggingFaceForm.name" type="text" class="form-control" placeholder="Optional custom name">
                </div>
                <div class="col-12 col-md-5">
                  <label class="form-label">Revision</label>
                  <input v-model.trim="huggingFaceForm.revision" type="text" class="form-control" placeholder="main">
                </div>
              </div>

              <div>
                <label class="form-label">Description Override</label>
                <textarea
                  v-model.trim="huggingFaceForm.note"
                  class="form-control"
                  rows="4"
                  placeholder="Optional local note. If empty, the dataset card metadata will be used."
                ></textarea>
              </div>

              <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-outline-secondary" type="button" @click="closeImportModal">Cancel</button>
                <button class="btn btn-primary" type="submit" :disabled="isSubmittingHuggingFace">
                  <span v-if="isSubmittingHuggingFace" class="spinner-border spinner-border-sm me-1" role="status"></span>
                  Import
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    </div>
    <div
      class="workflow-module-resizer"
      :class="{ disabled: isChatCollapsed }"
      role="separator"
      aria-orientation="vertical"
      title="Resize Factory Agent panel"
      @mousedown.prevent="startChatResize"
    ></div>
    <div class="workflow-chat-pane" :class="{ collapsed: isChatCollapsed }">
      <WorkflowAgentChatPanel
        page-key="dataset_management"
        page-title="Dataset Management"
        page-description="Ask about dataset onboarding, metadata, imports, previews, and downstream workflow choices."
        :page-context="factoryAgentPageContext"
        @collapse-change="handleChatCollapseChange"
        @view-datasets="handleFactoryAgentDatasetView"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import WorkflowAgentChatPanel from '../../components/WorkflowAgentChatPanel.vue'
import {
  fetchCurrentSession,
  importHuggingFaceDataset,
  searchDatasets,
  uploadDataset
} from '../../api/dataAgent'
import { getStoredUsername } from '../../api/auth'
import { formatAppDateTime, toAppTimestamp } from '../../utils/datetime'

const router = useRouter()
const CHAT_PANEL_MIN_WIDTH = 280
const CHAT_PANEL_MAX_WIDTH = 620
const CHAT_PANEL_COLLAPSED_WIDTH = 96
const CHAT_PANEL_STORAGE_KEY = 'datasetManagementChatPanelWidth'

const notice = ref('')
const isLoading = ref(false)
const isSubmittingUpload = ref(false)
const isSubmittingHuggingFace = ref(false)
const autoRefresh = ref(true)
const currentUsername = ref(getStoredUsername())
const rawDatasets = ref([])
const totalDatasetCount = ref(0)
const importingCount = ref(0)
const generatedCount = ref(0)
const pendingSearchKeyword = ref('')
const appliedSearchKeyword = ref('')
const selectedFormats = ref([])
const selectedLanguages = ref([])
const selectedSizeLevels = ref([])
const selectedStatuses = ref([])
const appliedFormats = ref([])
const appliedLanguages = ref([])
const appliedSizeLevels = ref([])
const appliedStatuses = ref([])
const agentDatasetOverrideItems = ref([])
const selectedDatasetFiles = ref([])
const selectedCoverFile = ref(null)
const importMode = ref('upload')
const isFiltersCollapsed = ref(true)

const importModalRef = ref(null)
const datasetFilesInputRef = ref(null)
const coverFileInputRef = ref(null)
const datasetSectionRef = ref(null)
const chatPanelWidth = ref(readStoredChatPanelWidth())
const isChatCollapsed = ref(false)
let importModalInstance = null
let pollingTimer = null
let chatResizeCleanup = null

const datasetForm = ref({
  name: '',
  type: 'instruction',
  language: 'multi',
  source: '',
  note: ''
})

const huggingFaceForm = ref({
  repoId: '',
  revision: '',
  name: '',
  note: ''
})

const typeLabels = {
  instruction: 'Instruction',
  conversation: 'Conversation',
  evaluation: 'Evaluation',
  'tool-trace': 'Tool Trace',
  trajectory: 'Trajectory',
  reasoning: 'Reasoning'
}

const languageLabels = {
  zh: 'Chinese',
  en: 'English',
  multi: 'Multilingual'
}

const statusOrder = {
  downloading: 0,
  uploaded: 1,
  failed: 2
}

const sizeFilterOptions = [
  { value: 'kb', label: 'KB' },
  { value: 'mb', label: 'MB' },
  { value: 'gb', label: 'GB' }
]

const formatFilterPresets = ['csv', 'xlsx', 'xls', 'excel', 'tsv', 'json', 'jsonl', 'parquet', 'text', 'sqlite']
const languageFilterPresets = ['zh', 'en', 'multi']
const statusFilterPresets = ['uploaded', 'downloading', 'failed']

const normalizeDatasetStatus = (status) => {
  const normalized = String(status || 'uploaded').toLowerCase()
  if (normalized === 'ready') return 'uploaded'
  return normalized
}

const formatSize = (size) => {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const sourceKindLabel = (sourceKind) => {
  if (sourceKind === 'huggingface') return 'HuggingFace'
  if (sourceKind === 'generated') return 'Generated'
  return 'Uploaded'
}

const statusClass = (status) => {
  const normalized = normalizeDatasetStatus(status)
  if (normalized === 'downloading') return 'is-downloading'
  if (normalized === 'failed') return 'is-failed'
  if (normalized === 'uploaded') return 'is-uploaded'
  return ''
}

const formatStatusLabel = (status) => {
  const normalized = normalizeDatasetStatus(status)
  if (normalized === 'uploaded') return 'Uploaded'
  if (normalized === 'downloading') return 'Downloading'
  if (normalized === 'failed') return 'Failed'
  return String(normalized || '').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

const shouldShowDatasetStatus = (status) => normalizeDatasetStatus(status) !== 'uploaded'

const originSummary = (row) => {
  const parts = []
  if (row.originStage) parts.push(`Generated by ${row.originStage}`)
  if (row.originDatasetId) parts.push(`source #${row.originDatasetId}`)
  if (row.originTaskType && row.originTaskId) parts.push(`${row.originTaskType} #${row.originTaskId}`)
  return parts.join(' · ')
}

const normalizeDataset = (item = {}, index = 0) => {
  const modalityTags = Array.isArray(item.modality_tags) ? item.modality_tags : []
  const formatTags = Array.isArray(item.format_tags) ? item.format_tags : []
  const languageTags = Array.isArray(item.language_tags) ? item.language_tags : []
  const rawStatus = String(item.status || 'uploaded').toLowerCase()
  const status = normalizeDatasetStatus(rawStatus)
  return {
    id: Number(item.id || item.dataset_id || index + 1),
    name: String(item.name || item.dataset_name || 'Unnamed Dataset'),
    type: String(item.type || 'instruction'),
    typeLabel: typeLabels[String(item.type || 'instruction')] || String(item.type || 'instruction'),
    language: String(item.language || 'multi'),
    languageLabel: languageLabels[String(item.language || 'multi')] || String(item.language || 'multi'),
    size: Number(item.size || 0),
    status,
    note: String(item.note || ''),
    sourceKind: String(item.source_kind || 'upload'),
    cover: String(item.cover_url || ''),
    insertAt: String(item.insert_time || item.inserted_at || ''),
    updatedAt: String(item.update_time || item.updated_at || '-'),
    modalityTags,
    formatTags,
    languageTags,
    readmeExcerpt: String(item.readme_excerpt || ''),
    importProgress: Number(item.import_progress || 0),
    importTotalFiles: Number(item.import_total_files || 0),
    importDownloadedFiles: Number(item.import_downloaded_files || 0),
    importErrorMessage: String(item.import_error_message || ''),
    isImporting: rawStatus === 'downloading',
    originStage: String(item.origin_stage || ''),
    originDatasetId: Number(item.origin_dataset_id || 0),
    originTaskType: String(item.origin_task_type || ''),
    originTaskId: Number(item.origin_task_id || 0),
    isGenerated: Boolean(item.origin_stage || item.origin_task_id || item.origin_dataset_id || ['trajectory', 'reasoning'].includes(String(item.type || '').toLowerCase()))
  }
}

const datasetRows = computed(() => {
  const sourceItems = agentDatasetOverrideItems.value.length ? agentDatasetOverrideItems.value : rawDatasets.value
  return sourceItems.map((item, index) => normalizeDataset(item, index))
})
const formatOptions = computed(() => [...formatFilterPresets])
const languageOptions = computed(() => [...languageFilterPresets])
const statusOptions = computed(() => [...statusFilterPresets])
const statsCards = computed(() => [
  { label: 'Total Datasets', value: totalDatasetCount.value },
  { label: 'Importing Datasets', value: importingCount.value },
  { label: 'Generated Datasets', value: generatedCount.value }
])
const resolvedChatPanelWidth = computed(() => (isChatCollapsed.value ? CHAT_PANEL_COLLAPSED_WIDTH : chatPanelWidth.value))
const factoryAgentPageContext = computed(() => ({
  dataset_count: Number(totalDatasetCount.value || 0),
  importing_count: Number(importingCount.value || 0),
  generated_count: Number(generatedCount.value || 0),
  current_filters: {
    name_keyword: String(appliedSearchKeyword.value || ''),
    format_tags: [...appliedFormats.value],
    language_tags: [...appliedLanguages.value],
    size_levels: [...appliedSizeLevels.value],
    statuses: [...appliedStatuses.value]
  },
  visible_datasets: filteredRows.value.slice(0, 20).map((row) => ({
    id: row.id,
    name: row.name,
    note: row.note,
    status: row.status,
    source_kind: row.sourceKind,
    format_tags: [...row.formatTags],
    language_tags: [...row.languageTags],
    size: row.size
  }))
}))

const filteredRows = computed(() => {
  return [...datasetRows.value].sort((left, right) => {
    const delta = toAppTimestamp(right.updatedAt, right.id) - toAppTimestamp(left.updatedAt, left.id)
    return delta !== 0 ? delta : right.id - left.id
  })
})

const activeFilterCount = computed(
  () =>
    selectedFormats.value.length +
    selectedLanguages.value.length +
    selectedSizeLevels.value.length +
    selectedStatuses.value.length
)

const selectedFolderLabel = computed(() => {
  if (!selectedDatasetFiles.value.length) return 'No folder selected'
  const first = selectedDatasetFiles.value[0]
  const relative = String(first.webkitRelativePath || first.name || '')
  const rootFolder = relative.split('/')[0]
  return `${rootFolder || 'Folder'} · ${selectedDatasetFiles.value.length} files`
})

function clampChatPanelWidth(value) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return 430
  return Math.max(CHAT_PANEL_MIN_WIDTH, Math.min(CHAT_PANEL_MAX_WIDTH, Math.round(numeric)))
}

function readStoredChatPanelWidth() {
  try {
    return clampChatPanelWidth(window.localStorage.getItem(CHAT_PANEL_STORAGE_KEY))
  } catch {
    return 430
  }
}

function persistChatPanelWidth() {
  try {
    window.localStorage.setItem(CHAT_PANEL_STORAGE_KEY, String(chatPanelWidth.value))
  } catch {
    // ignore local persistence failures
  }
}

function handleChatCollapseChange(collapsed) {
  isChatCollapsed.value = !!collapsed
}

function stopChatResize() {
  if (typeof chatResizeCleanup === 'function') {
    chatResizeCleanup()
    chatResizeCleanup = null
  }
}

function startChatResize(event) {
  if (isChatCollapsed.value) return
  const startX = Number(event?.clientX || 0)
  const startWidth = chatPanelWidth.value
  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const handlePointerMove = (moveEvent) => {
    const delta = startX - Number(moveEvent?.clientX || 0)
    chatPanelWidth.value = clampChatPanelWidth(startWidth + delta)
  }

  const cleanup = () => {
    window.removeEventListener('mousemove', handlePointerMove)
    window.removeEventListener('mouseup', cleanup)
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    persistChatPanelWidth()
  }

  chatResizeCleanup = cleanup
  window.addEventListener('mousemove', handlePointerMove)
  window.addEventListener('mouseup', cleanup)
}

const selectedCoverLabel = computed(() => selectedCoverFile.value?.name || 'No cover selected')

const resetLocalForm = () => {
  datasetForm.value = {
    name: '',
    type: 'instruction',
    language: 'multi',
    source: '',
    note: ''
  }
  selectedDatasetFiles.value = []
  selectedCoverFile.value = null
  if (datasetFilesInputRef.value) datasetFilesInputRef.value.value = ''
  if (coverFileInputRef.value) coverFileInputRef.value.value = ''
}

const resetHuggingFaceForm = () => {
  huggingFaceForm.value = {
    repoId: '',
    revision: '',
    name: '',
    note: ''
  }
}

const openImportModal = () => {
  notice.value = ''
  if (!importModalInstance && importModalRef.value) {
    importModalInstance = new Modal(importModalRef.value)
  }
  importModalInstance?.show()
}

const closeImportModal = () => {
  importModalInstance?.hide()
}

const getFilterRef = (group) => {
  if (group === 'formats') return selectedFormats
  if (group === 'languages') return selectedLanguages
  if (group === 'sizes') return selectedSizeLevels
  if (group === 'statuses') return selectedStatuses
  return null
}

const toggleFilterSelection = (group, value) => {
  const targetRef = getFilterRef(group)
  if (!targetRef) return

  const current = Array.isArray(targetRef.value) ? targetRef.value : []
  if (current.includes(value)) {
    targetRef.value = current.filter((item) => item !== value)
  } else {
    targetRef.value = [...current, value]
  }
}

const applySearch = async () => {
  agentDatasetOverrideItems.value = []
  appliedSearchKeyword.value = pendingSearchKeyword.value.trim()
  appliedFormats.value = [...selectedFormats.value]
  appliedLanguages.value = [...selectedLanguages.value]
  appliedSizeLevels.value = [...selectedSizeLevels.value]
  appliedStatuses.value = [...selectedStatuses.value]
  await loadDatasets()
}

const toggleFiltersCollapsed = () => {
  isFiltersCollapsed.value = !isFiltersCollapsed.value
}

const preciseDateTime = (value) => formatAppDateTime(value)

const cardTags = (row) => {
  const values = []
  const seen = new Set()
  const add = (tag) => {
    const normalized = String(tag || '').trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    values.push(normalized)
  }
  add(row.typeLabel)
  row.modalityTags.forEach(add)
  row.languageTags.forEach(add)
  row.formatTags.forEach(add)
  if (row.isGenerated) add('Generated')
  if (row.isImporting) add('Downloading')
  return values.slice(0, 6)
}

const extraTagCount = (row) => {
  const values = new Set()
  values.add(String(row.typeLabel || '').trim())
  row.modalityTags.forEach((tag) => values.add(String(tag || '').trim()))
  row.languageTags.forEach((tag) => values.add(String(tag || '').trim()))
  row.formatTags.forEach((tag) => values.add(String(tag || '').trim()))
  if (row.isGenerated) values.add('Generated')
  if (row.isImporting) values.add('Downloading')
  return Math.max(0, [...values].filter(Boolean).length - 6)
}

const clearFilters = () => {
  agentDatasetOverrideItems.value = []
  selectedFormats.value = []
  selectedLanguages.value = []
  selectedSizeLevels.value = []
  selectedStatuses.value = []
}

const handleFactoryAgentDatasetView = async (payload = {}) => {
  const datasetItems = Array.isArray(payload?.datasetItems)
    ? payload.datasetItems.filter((item) => item && typeof item === 'object')
    : []
  if (!datasetItems.length) return
  agentDatasetOverrideItems.value = datasetItems

  await nextTick()
  datasetSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const goToDatasetDetail = (datasetId) => {
  router.push({ name: 'DataPreparationDetail', params: { datasetId } })
}

const triggerDatasetFolderPicker = () => datasetFilesInputRef.value?.click()
const triggerCoverFilePicker = () => coverFileInputRef.value?.click()

const onDatasetFilesChange = (event) => {
  selectedDatasetFiles.value = Array.from(event?.target?.files || [])
}

const onCoverFileChange = (event) => {
  selectedCoverFile.value = event?.target?.files?.[0] || null
}

const loadSession = async () => {
  try {
    const response = await fetchCurrentSession()
    const user = response?.data || response || {}
    currentUsername.value = user.username || currentUsername.value
  } catch {
    currentUsername.value = getStoredUsername()
  }
}

const refreshPolling = () => {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
  if (autoRefresh.value && importingCount.value > 0) {
    pollingTimer = window.setInterval(() => {
      loadDatasets(true)
    }, 3000)
  }
}

const refreshAll = async () => {
  notice.value = ''
  agentDatasetOverrideItems.value = []
  await loadDatasets()
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  refreshPolling()
}

const buildDatasetQueryPayload = () => ({
  name_keyword: appliedSearchKeyword.value,
  format_tags: [...appliedFormats.value],
  language_tags: [...appliedLanguages.value],
  size_levels: [...appliedSizeLevels.value],
  statuses: [...appliedStatuses.value]
})

const loadDatasets = async (silent = false) => {
  if (!silent) {
    isLoading.value = true
    notice.value = ''
  }
  try {
    const response = await searchDatasets(buildDatasetQueryPayload())
    rawDatasets.value = Array.isArray(response?.data) ? response.data : []
    totalDatasetCount.value = Number(response?.meta?.total_count ?? rawDatasets.value.length)
    importingCount.value = Number(response?.meta?.importing_count ?? rawDatasets.value.filter((item) => normalizeDataset(item).isImporting).length)
    generatedCount.value = Number(response?.meta?.generated_count ?? rawDatasets.value.filter((item) => normalizeDataset(item).isGenerated).length)
  } catch (error) {
    notice.value = error.message || 'Failed to load datasets.'
  } finally {
    refreshPolling()
    if (!silent) isLoading.value = false
  }
}

const submitLocalUpload = async () => {
  if (!datasetForm.value.name.trim()) {
    notice.value = 'Dataset name is required.'
    return
  }
  if (!selectedDatasetFiles.value.length) {
    notice.value = 'Please select a dataset folder.'
    return
  }

  isSubmittingUpload.value = true
  notice.value = ''
  try {
    const formData = new FormData()
    formData.append('name', datasetForm.value.name.trim())
    formData.append('type', datasetForm.value.type)
    formData.append('language', datasetForm.value.language)
    if (datasetForm.value.source.trim()) formData.append('source', datasetForm.value.source.trim())
    if (datasetForm.value.note.trim()) formData.append('note', datasetForm.value.note.trim())
    selectedDatasetFiles.value.forEach((file) => {
      const filename = file.webkitRelativePath || file.name
      formData.append('files', file, filename)
    })
    if (selectedCoverFile.value) {
      formData.append('cover', selectedCoverFile.value, selectedCoverFile.value.name)
    }

    await uploadDataset(formData)
    closeImportModal()
    resetLocalForm()
    await loadDatasets()
  } catch (error) {
    notice.value = error.message || 'Dataset upload failed.'
  } finally {
    isSubmittingUpload.value = false
  }
}

const submitHuggingFaceImport = async () => {
  if (!huggingFaceForm.value.repoId.trim()) {
    notice.value = 'HuggingFace dataset name is required.'
    return
  }

  isSubmittingHuggingFace.value = true
  notice.value = ''
  try {
    await importHuggingFaceDataset({
      repo_id: huggingFaceForm.value.repoId.trim(),
      revision: huggingFaceForm.value.revision.trim() || undefined,
      name: huggingFaceForm.value.name.trim() || undefined,
      note: huggingFaceForm.value.note.trim() || undefined
    })
    closeImportModal()
    resetHuggingFaceForm()
    await loadDatasets()
  } catch (error) {
    notice.value = error.message || 'HuggingFace import failed.'
  } finally {
    isSubmittingHuggingFace.value = false
  }
}

const useInTrajectory = (row) => {
  router.push({ name: 'TrajectorySynthesis', query: { datasetId: row.id } })
}

const useInDistillation = (row) => {
  router.push({ name: 'ReasoningDataDistillation', query: { sourceType: 'dataset', datasetId: row.id } })
}

onMounted(async () => {
  if (importModalRef.value) {
    importModalInstance = new Modal(importModalRef.value)
  }
  await Promise.all([loadSession(), loadDatasets()])
  refreshPolling()
})

onBeforeUnmount(() => {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
  stopChatResize()
  importModalInstance?.dispose()
  importModalInstance = null
})
</script>

<style scoped>
.workflow-module-shell {
  display: flex;
  align-items: stretch;
  gap: 1rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.workflow-module-resizer {
  width: 10px;
  flex: 0 0 10px;
  position: relative;
  cursor: col-resize;
  align-self: stretch;
}

.workflow-module-resizer::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 2px;
  border-radius: 999px;
  background: #d8e0ec;
  transition: background 0.18s ease;
}

.workflow-module-resizer:hover::before {
  background: #9eb5d7;
}

.workflow-module-resizer.disabled {
  cursor: default;
}

.workflow-module-resizer.disabled::before {
  background: #e6ebf3;
}

.workflow-chat-pane {
  width: var(--chat-panel-width);
  min-width: var(--chat-panel-width);
  flex: 0 0 var(--chat-panel-width);
  min-height: 0;
  transition: width 0.18s ease, min-width 0.18s ease, flex-basis 0.18s ease;
}

.dataset-page {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  overflow: auto;
  padding-right: 0.2rem;
}

.dataset-stats-card {
  border: 1px solid rgba(27, 43, 65, 0.08);
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(240, 221, 183, 0.34), transparent 28%),
    linear-gradient(145deg, #fbfaf5 0%, #f4efe4 100%);
  box-shadow: 0 24px 60px rgba(34, 44, 63, 0.08);
}

.toolbar-card,
.dataset-section {
  background: transparent;
  border: 0;
  box-shadow: none;
}

.dataset-stats-card {
  border-radius: 18px;
  background: #fff;
}

.dataset-stats-card-body {
  padding: 1rem 1.1rem;
}

.dataset-add-icon-btn {
  width: 34px;
  height: 34px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbar-card {
  padding: 0.95rem 1rem;
}

.toolbar-top {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin: 0;
}

.toolbar-top .search-box {
  flex: 1;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-shrink: 0;
}

.toolbar-hint {
  color: #67748a;
  font-size: 0.82rem;
  white-space: nowrap;
}

.search-box {
  position: relative;
  display: block;
}

.search-box i {
  position: absolute;
  top: 50%;
  left: 0.95rem;
  transform: translateY(-50%);
  color: #708090;
}

.search-box input {
  padding-left: 2.7rem;
  min-height: 44px;
  border-radius: 16px;
  border-color: rgba(43, 56, 78, 0.12);
  background: rgba(255, 255, 255, 0.9);
}

.toolbar-clear {
  min-height: 40px;
  border-radius: 14px;
}

.toolbar-search,
.toolbar-toggle {
  min-height: 40px;
  border-radius: 14px;
  white-space: nowrap;
}

.filter-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 1rem;
  margin-top: 0.8rem;
}

.filter-group {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
}

.filter-label {
  padding-top: 0.36rem;
  color: #576477;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.filter-chip {
  border: 1px solid rgba(45, 60, 84, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #40506a;
  font-size: 0.74rem;
  font-weight: 600;
  padding: 0.28rem 0.58rem;
  line-height: 1.1;
}

.filter-chip.active {
  background: #172033;
  border-color: #172033;
  color: #fff;
  box-shadow: 0 8px 18px rgba(23, 32, 51, 0.18);
}

.dataset-section {
  padding: 0.95rem 1rem 1rem;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.loading-card,
.empty-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 220px;
  border: 1px dashed rgba(45, 60, 84, 0.16);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.7);
  color: #526077;
  text-align: center;
  padding: 1rem;
}

.empty-card {
  flex-direction: column;
}

.dataset-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
  overflow: visible;
}

.dataset-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid rgba(36, 48, 70, 0.1);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.86);
  overflow: visible;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  position: relative;
}

.dataset-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 22px 50px rgba(35, 47, 69, 0.14);
  border-color: rgba(35, 47, 69, 0.18);
  z-index: 4;
}

.dataset-card-media {
  height: 94px;
  border-radius: 20px 20px 0 0;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(255, 220, 150, 0.55), transparent 33%),
    linear-gradient(135deg, #ded4bf 0%, #e8e1d0 45%, #f7f3ea 100%);
}

@media (max-width: 1280px) {
  .workflow-module-shell {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }

  .workflow-module-resizer {
    display: none;
  }

  .workflow-chat-pane {
    width: 100%;
    min-width: 0;
    flex-basis: auto;
  }

  .dataset-page {
    overflow: visible;
  }
}

.dataset-cover,
.dataset-cover-fallback {
  width: 100%;
  height: 100%;
  display: block;
}

.dataset-cover {
  object-fit: cover;
}

.dataset-cover-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.75rem;
  color: #1c2638;
  text-align: center;
}

.dataset-cover-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.15;
}

.dataset-cover-meta {
  font-size: 0.76rem;
  color: #4e5e78;
}

.dataset-card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.85rem;
  border-radius: 0 0 20px 20px;
  background: rgba(255, 255, 255, 0.92);
}

.dataset-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
}

.dataset-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.dataset-badge-muted {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.48rem;
  border-radius: 999px;
  background: rgba(33, 44, 67, 0.06);
  color: #6b7280;
  font-size: 0.72rem;
}

.dataset-source {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  background: rgba(23, 32, 51, 0.08);
  color: #2f405b;
  font-weight: 600;
  font-size: 0.72rem;
}

.dataset-name {
  margin: 0 0 0.25rem;
  color: #172033;
  font-size: 1rem;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.22rem 0.52rem;
  font-size: 0.72rem;
  font-weight: 700;
  background: rgba(43, 56, 78, 0.08);
  color: #435066;
  white-space: nowrap;
}

.status-pill.is-ready {
  background: rgba(28, 130, 109, 0.14);
  color: #156d5d;
}

.status-pill.is-downloading {
  background: rgba(207, 109, 46, 0.14);
  color: #b05d1e;
}

.status-pill.is-failed {
  background: rgba(180, 53, 69, 0.12);
  color: #a22735;
}

.status-pill.is-uploaded {
  background: rgba(53, 89, 154, 0.12);
  color: #2b5a96;
}

.dataset-summary {
  margin: 0;
  color: #586173;
  line-height: 1.45;
  font-size: 0.83rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.24rem 0.54rem;
  background: rgba(33, 44, 67, 0.06);
  color: #45546b;
  font-size: 0.72rem;
}

.tag-chip.muted {
  opacity: 0.75;
}

.progress-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.72rem;
  border-radius: 16px;
  background: rgba(249, 241, 226, 0.85);
  border: 1px solid rgba(207, 109, 46, 0.12);
}

.progress-copy,
.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.82rem;
  color: #7b5a3b;
}

.tag-groups {
  min-height: 1.8rem;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag-list.compact {
  gap: 0.3rem;
}

.dataset-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-top: auto;
  padding-top: 0.1rem;
  border-top: 1px solid rgba(33, 44, 67, 0.08);
}

.footer-copy {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  color: #748094;
  font-size: 0.74rem;
  min-width: 0;
}

.footer-size {
  color: #223147;
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}

.action-menu {
  position: relative;
  z-index: 8;
}

.action-menu summary {
  list-style: none;
}

.action-menu summary::-webkit-details-marker {
  display: none;
}

.dataset-more-btn {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(35, 49, 75, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  color: #34445d;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-menu[open] .action-menu-panel {
  display: flex;
}

.action-menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 0.55rem);
  z-index: 10;
  display: none;
  flex-direction: column;
  min-width: 190px;
  padding: 0.35rem;
  border-radius: 16px;
  border: 1px solid rgba(33, 44, 67, 0.12);
  background: #fffefb;
  box-shadow: 0 18px 36px rgba(30, 40, 59, 0.14);
}

.action-item {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0.65rem 0.75rem;
  text-align: left;
  color: #23314b;
  border-radius: 12px;
}

.action-item:hover:not(:disabled) {
  background: rgba(35, 49, 75, 0.08);
}

.action-item:disabled {
  color: #a1a8b3;
}

.import-modal {
  border: 0;
  border-radius: 28px;
  background: linear-gradient(180deg, #fffdf8 0%, #f5f0e5 100%);
}

:global(.dataset-import-modal) {
  z-index: 1400;
}

:global(.modal-backdrop) {
  z-index: 1390;
}

.import-mode-switch {
  display: inline-flex;
  gap: 0.55rem;
  padding: 0.3rem;
  border-radius: 999px;
  background: rgba(27, 43, 65, 0.08);
  margin-bottom: 1rem;
}

.mode-pill {
  border: 0;
  border-radius: 999px;
  padding: 0.55rem 1rem;
  background: transparent;
  color: #41516d;
  font-weight: 600;
}

.mode-pill.active {
  background: #172033;
  color: #fff;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.upload-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 20px;
  border: 1px solid rgba(36, 48, 70, 0.1);
  background: rgba(255, 255, 255, 0.82);
}

.upload-panel-head {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.upload-panel-title {
  color: #1d2738;
  font-weight: 700;
}

.upload-panel-copy,
.upload-status,
.hf-hint {
  color: #667085;
  font-size: 0.88rem;
  line-height: 1.55;
}

.hf-hint {
  padding: 0.95rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(36, 48, 70, 0.08);
}

@media (max-width: 992px) {
  .toolbar-top {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .filter-group {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .upload-grid {
    grid-template-columns: 1fr;
  }

  .dataset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-groups {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dataset-section,
  .toolbar-card {
    padding: 1rem;
  }

  .dataset-grid {
    grid-template-columns: 1fr;
  }

  .dataset-card-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .action-menu-panel {
    left: 0;
    right: auto;
  }

}

@media (min-width: 993px) and (max-width: 1320px) {
  .dataset-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
