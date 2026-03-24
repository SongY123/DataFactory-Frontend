<template>
  <div class="dataset-detail-page">
    <div v-if="notice" class="alert alert-warning py-2 px-3 mb-3" role="alert">
      {{ notice }}
    </div>

    <div v-if="isLoading" class="detail-loading">
      <span class="spinner-border spinner-border-sm" role="status"></span>
      <span>Loading dataset details...</span>
    </div>

    <template v-else-if="dataset">
      <section class="detail-hero">
        <div class="detail-hero-main">
          <button class="back-link" type="button" @click="goBack">
            <i class="bi bi-arrow-left"></i>
            <span>Back to datasets</span>
          </button>

          <div class="hero-badges">
            <span class="badge badge-soft">Dataset</span>
            <span class="badge badge-soft">{{ sourceKindLabel(dataset.sourceKind) }}</span>
            <span class="badge status-badge" :class="statusClass(dataset.status)">{{ formatStatusLabel(dataset.status) }}</span>
          </div>

          <h1 class="hero-title">{{ dataset.name }}</h1>
          <p class="hero-copy">
            {{ dataset.note }}
          </p>

          <a
            v-if="huggingFaceDatasetUrl"
            class="hero-hf-link"
            :href="huggingFaceDatasetUrl"
            target="_blank"
            rel="noreferrer"
          >
            <i class="bi bi-box-arrow-up-right"></i>
            <span>{{ huggingFaceDatasetUrl }}</span>
          </a>

          <div class="hero-meta">
            <span>{{ dataset.typeLabel }}</span>
            <span>{{ dataset.languageLabel }}</span>
            <span>{{ formatSize(dataset.size) }}</span>
            <span>Updated {{ formatDateTime(dataset.updatedAt) }}</span>
          </div>

          <div class="hero-tag-cloud">
            <span v-for="tag in heroTags" :key="`hero-${tag}`" class="hero-tag">{{ tag }}</span>
          </div>

          <div v-if="dataset.isImporting" class="hero-progress">
            <div class="hero-progress-copy">
              <span>Downloading HuggingFace dataset</span>
              <span>{{ dataset.importProgress }}%</span>
            </div>
            <div class="progress">
              <div class="progress-bar" role="progressbar" :style="{ width: `${dataset.importProgress}%` }"></div>
            </div>
            <div class="hero-progress-meta">
              <span>{{ dataset.importDownloadedFiles }} / {{ dataset.importTotalFiles || '?' }} files downloaded</span>
              <span v-if="dataset.importErrorMessage" class="text-danger">{{ dataset.importErrorMessage }}</span>
            </div>
          </div>

          <div class="hero-actions">
            <button class="btn btn-outline-dark" type="button" :disabled="dataset.isImporting" @click="useInDistillation">
              Reasoning Synthesis
            </button>
            <button class="btn btn-outline-dark" type="button" :disabled="dataset.isImporting" @click="useInTrajectory">
              Trajectory Synthesis
            </button>
          </div>
        </div>

        <div class="detail-hero-cover">
          <img v-if="dataset.cover" :src="dataset.cover" :alt="`${dataset.name} cover`" class="cover-image">
          <div v-else class="cover-fallback">
            <div class="cover-name">{{ dataset.name }}</div>
            <div class="cover-meta">{{ dataset.typeLabel }} · {{ dataset.languageLabel }}</div>
          </div>
        </div>
      </section>

      <section class="detail-layout">
        <div class="detail-main">
          <article class="panel-card">
            <div class="detail-tabs">
              <button
                class="detail-tab"
                :class="{ active: activeContentTab === 'readme' }"
                type="button"
                @click="activeContentTab = 'readme'"
              >
                README
              </button>
              <button
                class="detail-tab"
                :class="{ active: activeContentTab === 'explorer' }"
                type="button"
                @click="activeContentTab = 'explorer'"
              >
                Data Explorer
              </button>
              <button
                class="detail-tab"
                :class="{ active: activeContentTab === 'files' }"
                type="button"
                @click="activeContentTab = 'files'"
              >
                File Directory
              </button>
            </div>

            <div v-if="activeContentTab === 'readme'" class="tab-panel">
              <div class="panel-head">
                <div>
                  <h5 class="panel-title mb-1">README</h5>
                </div>
              </div>

              <div v-if="isLoadingReadme" class="panel-loading">
                <span class="spinner-border spinner-border-sm" role="status"></span>
                <span>Loading README...</span>
              </div>
              <div v-else-if="!readmeContent" class="empty-state small">No README is available for this dataset.</div>
              <MarkdownRenderer v-else class="readme-body" :content="readmeContent" front-matter-label="metadata" />
            </div>

            <div v-else-if="activeContentTab === 'explorer'" class="tab-panel">
              <div class="panel-head panel-head-spread">
                <div>
                  <h5 class="panel-title mb-1">Data Explorer</h5>
                  <p class="text-muted small mb-0">
                    Frontend sorting and filtering on the loaded preview. For CSV, XLSX and similar files you can also
                    run a simple SQL query.
                  </p>
                </div>

                <div class="explorer-head-tools">
                  <select v-model="selectedFilePath" class="form-select" :disabled="!fileOptions.length || dataset.isImporting" @change="handleFileSelection">
                    <option value="">Select a data file</option>
                    <option v-for="item in fileOptions" :key="item.path" :value="item.path">
                      {{ item.path }}
                    </option>
                  </select>
                  <button class="btn btn-outline-secondary" type="button" :disabled="!selectedFilePath || isLoadingPreview" @click="reloadPreview">
                    Refresh
                  </button>
                </div>
              </div>

              <div v-if="dataset.isImporting" class="explorer-placeholder">
                Files and table previews will be available after the HuggingFace download finishes.
              </div>
              <div v-else-if="previewError" class="explorer-placeholder">
                {{ previewError }}
              </div>
              <div v-else-if="isLoadingPreview" class="panel-loading">
                <span class="spinner-border spinner-border-sm" role="status"></span>
                <span>Loading dataset preview...</span>
              </div>
              <div v-else-if="!previewState.rows.length" class="explorer-placeholder">
                Select a file from the File Directory tab to inspect its contents.
              </div>
              <div v-else class="explorer-body">
                <div class="explorer-tools">
                  <label class="explorer-search">
                    <i class="bi bi-search"></i>
                    <input v-model.trim="tableSearch" type="text" class="form-control" placeholder="Filter loaded rows">
                  </label>
                  <div class="explorer-meta">
                    <span class="meta-chip">{{ previewState.format }}</span>
                    <span class="meta-chip">{{ previewDisplayRows.length }} rows shown</span>
                    <span class="meta-chip">{{ previewState.selectedTable }}</span>
                  </div>
                </div>

                <div class="table-responsive preview-table-wrap">
                  <table class="table preview-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th
                          v-for="column in previewColumns"
                          :key="`head-${column}`"
                          class="sortable-head"
                          @click="toggleTableSort(column)"
                        >
                          <span>{{ column }}</span>
                          <i v-if="tableSort.column === column" class="bi" :class="tableSort.direction === 'asc' ? 'bi-sort-down-alt' : 'bi-sort-down'"></i>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, index) in previewDisplayRows" :key="`row-${index}`">
                        <td v-for="column in previewColumns" :key="`row-${index}-${column}`">
                          <div class="cell-content" :title="displayCell(row[column], 800)">
                            {{ displayCell(row[column]) }}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="sql-card">
                  <div class="sql-head">
                    <div>
                      <h6 class="mb-1">Simple SQL Query</h6>
                      <p class="text-muted small mb-0">
                        {{ previewState.sqlSupported ? 'Runs against the selected file in an in-memory local query engine.' : 'SQL is not available for the selected file.' }}
                      </p>
                    </div>
                    <button class="btn btn-dark" type="button" :disabled="!previewState.sqlSupported || isRunningSql" @click="runSqlQuery">
                      <span v-if="isRunningSql" class="spinner-border spinner-border-sm me-1" role="status"></span>
                      Run Query
                    </button>
                  </div>

                  <textarea
                    v-model="sqlQuery"
                    class="form-control sql-editor"
                    rows="5"
                    :disabled="!previewState.sqlSupported"
                  ></textarea>

                  <div v-if="sqlError" class="alert alert-warning py-2 px-3 mb-0">{{ sqlError }}</div>

                  <div v-if="sqlResult.rows.length" class="sql-result">
                    <div class="sql-result-head">
                      <span class="meta-chip">{{ sqlResult.rowCount }} rows</span>
                      <span v-if="sqlResult.truncated" class="meta-chip">Truncated</span>
                    </div>
                    <div class="table-responsive">
                      <table class="table preview-table align-middle mb-0">
                        <thead>
                          <tr>
                            <th v-for="column in sqlResult.columns" :key="`sql-head-${column}`">{{ column }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(row, index) in sqlResult.rows" :key="`sql-row-${index}`">
                            <td v-for="column in sqlResult.columns" :key="`sql-${index}-${column}`">
                              <div class="cell-content" :title="displayCell(row[column], 800)">{{ displayCell(row[column]) }}</div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="tab-panel">
              <div class="panel-head">
                <div>
                  <h5 class="panel-title mb-1">File Directory</h5>
                  <p class="text-muted small mb-0">Available after the dataset is fully ready.</p>
                </div>
              </div>

              <div v-if="isLoadingFiles" class="panel-loading">
                <span class="spinner-border spinner-border-sm" role="status"></span>
                <span>Loading file tree...</span>
              </div>
              <div v-else-if="dataset.isImporting" class="empty-state small">
                The file tree is hidden until the HuggingFace dataset finishes downloading.
              </div>
              <div v-else-if="!flattenedFileTree.length" class="empty-state small">
                No files are available for this dataset.
              </div>
              <div v-else class="file-tree">
                <button
                  v-for="node in flattenedFileTree"
                  :key="node.key"
                  class="file-tree-item"
                  :class="{ active: node.type === 'file' && selectedFilePath === node.path, folder: node.type === 'folder' }"
                  type="button"
                  :style="{ paddingLeft: `${node.depth * 16 + 12}px` }"
                  @click="node.type === 'file' ? selectPreviewFile(node.path) : null"
                >
                  <i class="bi" :class="node.type === 'folder' ? 'bi-folder2-open' : 'bi-file-earmark-text'"></i>
                  <span>{{ node.name }}</span>
                </button>
              </div>
            </div>
          </article>
        </div>

        <aside class="detail-side">
          <article class="panel-card">
            <div class="panel-head">
              <div>
                <h5 class="panel-title mb-1">Dataset Info</h5>
                <p class="text-muted small mb-0">Core metadata and source information.</p>
              </div>
            </div>

            <dl class="info-list mb-0">
              <div>
                <dt>ID</dt>
                <dd>{{ dataset.id }}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{{ dataset.typeLabel }}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{{ dataset.languageLabel }}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{{ sourceKindLabel(dataset.sourceKind) }}</dd>
              </div>
              <div>
                <dt>Repo</dt>
                <dd>{{ dataset.hfRepoId || 'Local dataset' }}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{{ formatSize(dataset.size) }}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{{ formatStatusLabel(dataset.status) }}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{{ formatDateTime(dataset.updatedAt) }}</dd>
              </div>
              <div v-if="dataset.source">
                <dt>Source URL</dt>
                <dd class="source-break"><a :href="dataset.source" target="_blank" rel="noreferrer">{{ dataset.source }}</a></dd>
              </div>
              <div v-if="dataset.isGenerated">
                <dt>Generated From</dt>
                <dd>{{ originSummary(dataset) }}</dd>
              </div>
            </dl>
          </article>

          <article class="panel-card">
            <div class="panel-head">
              <div>
                <h5 class="panel-title mb-1">Tag Management</h5>
                <p class="text-muted small mb-0">Manage modality, format and language tags.</p>
              </div>
            </div>

            <div class="tag-editor">
              <div class="tag-editor-block">
                <span class="tag-editor-label">Modality</span>
                <div class="preset-grid">
                  <button
                    v-for="tag in modalityPresets"
                    :key="`modality-${tag}`"
                    class="tag-toggle"
                    :class="{ active: tagEditor.modality.includes(tag) }"
                    type="button"
                    @click="toggleEditorTag('modality', tag)"
                  >
                    {{ tag }}
                  </button>
                </div>
                <div class="chip-editor">
                  <span v-for="tag in tagEditor.modality" :key="`chosen-modality-${tag}`" class="editable-chip">
                    {{ tag }}
                    <button type="button" @click="removeEditorTag('modality', tag)">&times;</button>
                  </span>
                </div>
                <div class="input-group input-group-sm">
                  <input v-model.trim="customModalityTag" type="text" class="form-control" placeholder="Custom modality tag">
                  <button class="btn btn-outline-secondary" type="button" @click="appendCustomTag('modality')">Add</button>
                </div>
              </div>

              <div class="tag-editor-block">
                <span class="tag-editor-label">Format</span>
                <div class="preset-grid">
                  <button
                    v-for="tag in formatPresets"
                    :key="`format-${tag}`"
                    class="tag-toggle"
                    :class="{ active: tagEditor.format.includes(tag) }"
                    type="button"
                    @click="toggleEditorTag('format', tag)"
                  >
                    {{ tag }}
                  </button>
                </div>
                <div class="chip-editor">
                  <span v-for="tag in tagEditor.format" :key="`chosen-format-${tag}`" class="editable-chip">
                    {{ tag }}
                    <button type="button" @click="removeEditorTag('format', tag)">&times;</button>
                  </span>
                </div>
                <div class="input-group input-group-sm">
                  <input v-model.trim="customFormatTag" type="text" class="form-control" placeholder="Custom format tag">
                  <button class="btn btn-outline-secondary" type="button" @click="appendCustomTag('format')">Add</button>
                </div>
              </div>

              <div class="tag-editor-block">
                <span class="tag-editor-label">Language</span>
                <div class="chip-editor">
                  <span v-for="tag in tagEditor.language" :key="`chosen-language-${tag}`" class="editable-chip">
                    {{ tag }}
                    <button type="button" @click="removeEditorTag('language', tag)">&times;</button>
                  </span>
                </div>
                <div class="input-group input-group-sm">
                  <input v-model.trim="customLanguageTag" type="text" class="form-control" placeholder="Language tag, for example en or zh">
                  <button class="btn btn-outline-secondary" type="button" @click="appendCustomTag('language')">Add</button>
                </div>
              </div>
              <button class="btn btn-dark w-100" type="button" :disabled="isSavingTags" @click="saveTags">
                <span v-if="isSavingTags" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Save Tags
              </button>
            </div>
          </article>

          <article class="panel-card danger-card">
            <div class="panel-head">
              <div>
                <h5 class="panel-title mb-1">Danger Zone</h5>
                <p class="text-muted small mb-0">Delete is available only from the dataset detail page.</p>
              </div>
            </div>

            <button class="btn btn-outline-danger w-100" type="button" :disabled="isDeleting" @click="deleteCurrentDataset">
              <span v-if="isDeleting" class="spinner-border spinner-border-sm me-1" role="status"></span>
              Delete Dataset
            </button>
          </article>
        </aside>
      </section>
    </template>

    <div v-else class="panel-card">
      <button class="back-link mb-3" type="button" @click="goBack">
        <i class="bi bi-arrow-left"></i>
        <span>Back to datasets</span>
      </button>
      <h5 class="mb-2">Dataset not found</h5>
      <p class="text-muted mb-0">The requested dataset could not be loaded.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownRenderer from '../../components/MarkdownRenderer.vue'
import {
  deleteDataset,
  fetchDatasetDetail,
  fetchDatasetFiles,
  fetchDatasetPreview,
  fetchDatasetReadme,
  queryDatasetSql,
  updateDataset
} from '../../api/dataAgent'
import { formatAppDateTime } from '../../utils/datetime'

const route = useRoute()
const router = useRouter()

const isLoading = ref(false)
const isLoadingReadme = ref(false)
const isLoadingFiles = ref(false)
const isLoadingPreview = ref(false)
const isRunningSql = ref(false)
const isSavingTags = ref(false)
const isDeleting = ref(false)

const notice = ref('')
const dataset = ref(null)
const readmeContent = ref('')
const filesState = ref({ ready: false, tree: null, data_files: [], default_preview_path: null })
const previewState = ref({
  path: '',
  format: '',
  columns: [],
  rows: [],
  selectedTable: '',
  sqlSupported: false,
  defaultSql: ''
})
const sqlResult = ref({
  columns: [],
  rows: [],
  rowCount: 0,
  truncated: false
})

const previewError = ref('')
const sqlError = ref('')
const selectedFilePath = ref('')
const tableSearch = ref('')
const sqlQuery = ref('')
const tableSort = ref({ column: '', direction: 'asc' })
const activeContentTab = ref('readme')

const tagEditor = ref({
  modality: [],
  format: [],
  language: []
})
const customModalityTag = ref('')
const customFormatTag = ref('')
const customLanguageTag = ref('')

let pollingTimer = null

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

const modalityPresets = ['text', 'tabular', 'image', 'audio', 'video', 'timeseries', 'geospatial', '3d']
const formatPresets = ['csv', 'tsv', 'json', 'jsonl', 'parquet', 'excel', 'sqlite', 'text', 'imagefolder', 'audiofolder', 'webdataset']

const sourceKindLabel = (sourceKind) => {
  if (sourceKind === 'huggingface') return 'HuggingFace'
  if (sourceKind === 'generated') return 'Generated'
  return 'Uploaded'
}

const normalizeDatasetStatus = (status) => {
  const normalized = String(status || 'uploaded').toLowerCase()
  if (normalized === 'ready') return 'uploaded'
  return normalized
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

const formatSize = (size) => {
  const value = Number(size || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatDateTime = (value) => formatAppDateTime(value)

const originSummary = (row) => {
  const parts = []
  if (row.originStage) parts.push(`Generated by ${row.originStage}`)
  if (row.originDatasetId) parts.push(`source #${row.originDatasetId}`)
  if (row.originTaskType && row.originTaskId) parts.push(`${row.originTaskType} #${row.originTaskId}`)
  return parts.join(' · ')
}

const normalizeDatasetDetail = (detail = {}) => ({
  id: Number(detail.id || detail.dataset_id || 0),
  name: String(detail.name || detail.dataset_name || 'Unknown dataset'),
  type: String(detail.type || 'instruction'),
  typeLabel: typeLabels[String(detail.type || 'instruction')] || String(detail.type || 'instruction'),
  language: String(detail.language || 'multi'),
  languageLabel: languageLabels[String(detail.language || 'multi')] || String(detail.language || 'multi'),
  size: Number(detail.size || 0),
  status: normalizeDatasetStatus(detail.status),
  note: String(detail.note || ''),
  source: String(detail.source || ''),
  sourceKind: String(detail.source_kind || 'upload'),
  hfRepoId: String(detail.hf_repo_id || ''),
  cover: String(detail.cover_url || ''),
  updatedAt: String(detail.update_time || detail.updated_at || '-'),
  modalityTags: Array.isArray(detail.modality_tags) ? detail.modality_tags : [],
  formatTags: Array.isArray(detail.format_tags) ? detail.format_tags : [],
  languageTags: Array.isArray(detail.language_tags) ? detail.language_tags : [],
  tags: Array.isArray(detail.tags) ? detail.tags : [],
  readmeExcerpt: String(detail.readme_excerpt || ''),
  importProgress: Number(detail.import_progress || 0),
  importTotalFiles: Number(detail.import_total_files || 0),
  importDownloadedFiles: Number(detail.import_downloaded_files || 0),
  importErrorMessage: String(detail.import_error_message || ''),
  isImporting: String(detail.status || '').toLowerCase() === 'downloading',
  originStage: String(detail.origin_stage || ''),
  originDatasetId: Number(detail.origin_dataset_id || 0),
  originTaskType: String(detail.origin_task_type || ''),
  originTaskId: Number(detail.origin_task_id || 0)
})

const heroTags = computed(() => {
  if (!dataset.value) return []
  const values = [...dataset.value.modalityTags, ...dataset.value.formatTags, ...dataset.value.languageTags]
  return [...new Set(values)].slice(0, 12)
})

const huggingFaceDatasetUrl = computed(() => {
  if (!dataset.value || dataset.value.sourceKind !== 'huggingface') return ''
  const repoId = String(dataset.value.hfRepoId || dataset.value.name || '').trim()
  if (!repoId) return ''
  const encodedRepoId = repoId
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `https://huggingface.co/datasets/${encodedRepoId}`
})

const fileOptions = computed(() => Array.isArray(filesState.value.data_files) ? filesState.value.data_files : [])

const flattenedFileTree = computed(() => {
  const result = []
  const walk = (node, depth = 0) => {
    if (!node) return
    result.push({
      key: `${node.type}-${node.path || 'root'}`,
      name: node.name,
      path: node.path,
      type: node.type,
      depth
    })
    ;(node.children || []).forEach((child) => walk(child, depth + 1))
  }
  walk(filesState.value.tree, 0)
  return result
})

const previewColumns = computed(() => Array.isArray(previewState.value.columns) ? previewState.value.columns : [])

const previewDisplayRows = computed(() => {
  let rows = Array.isArray(previewState.value.rows) ? [...previewState.value.rows] : []
  const keyword = tableSearch.value.trim().toLowerCase()
  if (keyword) {
    rows = rows.filter((row) => previewColumns.value.some((column) => displayCell(row?.[column], 2000).toLowerCase().includes(keyword)))
  }
  if (tableSort.value.column) {
    const { column, direction } = tableSort.value
    rows.sort((left, right) => {
      const leftValue = displayCell(left?.[column], 4000)
      const rightValue = displayCell(right?.[column], 4000)
      if (leftValue === rightValue) return 0
      return direction === 'asc' ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue)
    })
  }
  return rows
})

const displayCell = (value, limit = 160) => {
  let text = ''
  if (typeof value === 'string') {
    text = value
  } else if (value == null) {
    text = ''
  } else {
    try {
      text = JSON.stringify(value)
    } catch {
      text = String(value)
    }
  }
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

const syncTagEditor = () => {
  if (!dataset.value) return
  tagEditor.value = {
    modality: [...dataset.value.modalityTags],
    format: [...dataset.value.formatTags],
    language: [...dataset.value.languageTags]
  }
}

const loadDataset = async () => {
  isLoading.value = true
  notice.value = ''
  try {
    const response = await fetchDatasetDetail(route.params.datasetId)
    const detail = response?.data || response || null
    dataset.value = detail ? normalizeDatasetDetail(detail) : null
    syncTagEditor()
  } catch (error) {
    notice.value = error.message || 'Failed to load dataset.'
    dataset.value = null
  } finally {
    isLoading.value = false
  }
}

const loadReadme = async () => {
  if (!dataset.value) return
  isLoadingReadme.value = true
  try {
    const response = await fetchDatasetReadme(dataset.value.id)
    readmeContent.value = String(response?.data?.content || '')
  } catch (error) {
    readmeContent.value = ''
    notice.value = error.message || 'Failed to load dataset README.'
  } finally {
    isLoadingReadme.value = false
  }
}

const loadFiles = async () => {
  if (!dataset.value) return
  isLoadingFiles.value = true
  try {
    const response = await fetchDatasetFiles(dataset.value.id)
    filesState.value = response?.data || { ready: false, tree: null, data_files: [], default_preview_path: null }
    const defaultPath = filesState.value.default_preview_path || filesState.value.data_files?.[0]?.path || ''
    if (!selectedFilePath.value && defaultPath) {
      selectedFilePath.value = defaultPath
    }
  } catch (error) {
    filesState.value = { ready: false, tree: null, data_files: [], default_preview_path: null }
    notice.value = error.message || 'Failed to load dataset files.'
  } finally {
    isLoadingFiles.value = false
  }
}

const loadPreview = async (path) => {
  if (!dataset.value || !path) return
  isLoadingPreview.value = true
  previewError.value = ''
  sqlError.value = ''
  sqlResult.value = { columns: [], rows: [], rowCount: 0, truncated: false }
  try {
    const response = await fetchDatasetPreview(dataset.value.id, { path, limit: 200 })
    const data = response?.data || {}
    previewState.value = {
      path: String(data.path || ''),
      format: String(data.format || ''),
      columns: Array.isArray(data.columns) ? data.columns : [],
      rows: Array.isArray(data.rows) ? data.rows : [],
      selectedTable: String(data.selected_table || ''),
      sqlSupported: Boolean(data.sql_supported),
      defaultSql: String(data.default_sql || '')
    }
    sqlQuery.value = previewState.value.defaultSql || sqlQuery.value
    tableSearch.value = ''
    tableSort.value = { column: '', direction: 'asc' }
  } catch (error) {
    previewState.value = {
      path: '',
      format: '',
      columns: [],
      rows: [],
      selectedTable: '',
      sqlSupported: false,
      defaultSql: ''
    }
    previewError.value = error.message || 'Failed to load dataset preview.'
  } finally {
    isLoadingPreview.value = false
  }
}

const handleFileSelection = async () => {
  if (!selectedFilePath.value) return
  await loadPreview(selectedFilePath.value)
}

const reloadPreview = async () => {
  if (selectedFilePath.value) {
    await loadPreview(selectedFilePath.value)
  }
}

const selectPreviewFile = async (path) => {
  selectedFilePath.value = path
  await handleFileSelection()
  activeContentTab.value = 'explorer'
}

const toggleTableSort = (column) => {
  if (tableSort.value.column === column) {
    tableSort.value.direction = tableSort.value.direction === 'asc' ? 'desc' : 'asc'
    return
  }
  tableSort.value = { column, direction: 'asc' }
}

const runSqlQuery = async () => {
  if (!dataset.value || !selectedFilePath.value || !previewState.value.sqlSupported) return
  isRunningSql.value = true
  sqlError.value = ''
  try {
    const response = await queryDatasetSql(dataset.value.id, {
      path: selectedFilePath.value,
      sql: sqlQuery.value,
      limit: 100
    })
    const data = response?.data || {}
    sqlResult.value = {
      columns: Array.isArray(data.columns) ? data.columns : [],
      rows: Array.isArray(data.rows) ? data.rows : [],
      rowCount: Number(data.row_count || 0),
      truncated: Boolean(data.truncated)
    }
  } catch (error) {
    sqlResult.value = { columns: [], rows: [], rowCount: 0, truncated: false }
    sqlError.value = error.message || 'SQL query failed.'
  } finally {
    isRunningSql.value = false
  }
}

const toggleEditorTag = (group, tag) => {
  const current = Array.isArray(tagEditor.value[group]) ? tagEditor.value[group] : []
  if (current.includes(tag)) {
    tagEditor.value[group] = current.filter((item) => item !== tag)
    return
  }
  tagEditor.value[group] = [...current, tag]
}

const removeEditorTag = (group, tag) => {
  const current = Array.isArray(tagEditor.value[group]) ? tagEditor.value[group] : []
  tagEditor.value[group] = current.filter((item) => item !== tag)
}

const appendCustomTag = (group) => {
  const sourceMap = {
    modality: customModalityTag,
    format: customFormatTag,
    language: customLanguageTag
  }
  const inputRef = sourceMap[group]
  const value = String(inputRef?.value || '').trim().toLowerCase()
  if (!value) return
  const current = Array.isArray(tagEditor.value[group]) ? tagEditor.value[group] : []
  if (!current.includes(value)) {
    tagEditor.value[group] = [...current, value]
  }
  inputRef.value = ''
}

const saveTags = async () => {
  if (!dataset.value) return
  isSavingTags.value = true
  notice.value = ''
  try {
    const response = await updateDataset(dataset.value.id, {
      modality_tags: tagEditor.value.modality,
      format_tags: tagEditor.value.format,
      language_tags: tagEditor.value.language
    })
    dataset.value = normalizeDatasetDetail(response?.data || response || {})
    syncTagEditor()
    notice.value = 'Dataset tags updated.'
  } catch (error) {
    notice.value = error.message || 'Failed to save dataset tags.'
  } finally {
    isSavingTags.value = false
  }
}

const deleteCurrentDataset = async () => {
  if (!dataset.value) return
  const confirmed = window.confirm(`Delete dataset "${dataset.value.name}"? This only affects the local workspace.`)
  if (!confirmed) return
  isDeleting.value = true
  notice.value = ''
  try {
    await deleteDataset(dataset.value.id)
    router.push({ name: 'DataPreparation' })
  } catch (error) {
    notice.value = error.message || 'Failed to delete dataset.'
  } finally {
    isDeleting.value = false
  }
}

const useInTrajectory = () => {
  if (!dataset.value) return
  router.push({ name: 'TrajectorySynthesis', query: { datasetId: dataset.value.id } })
}

const useInDistillation = () => {
  if (!dataset.value) return
  router.push({ name: 'ReasoningDataDistillation', query: { sourceType: 'dataset', datasetId: dataset.value.id } })
}

const goBack = () => router.push({ name: 'DataPreparation' })

const refreshPolling = () => {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
  if (dataset.value?.isImporting) {
    pollingTimer = window.setInterval(async () => {
      await loadDataset()
      await Promise.all([loadReadme(), loadFiles()])
      if (selectedFilePath.value && !dataset.value?.isImporting) {
        await loadPreview(selectedFilePath.value)
      }
      if (!dataset.value?.isImporting && pollingTimer) {
        window.clearInterval(pollingTimer)
        pollingTimer = null
      }
    }, 3000)
  }
}

onMounted(async () => {
  await loadDataset()
  if (dataset.value) {
    await Promise.all([loadReadme(), loadFiles()])
    if (selectedFilePath.value) {
      await loadPreview(selectedFilePath.value)
    }
    refreshPolling()
  }
})

onBeforeUnmount(() => {
  if (pollingTimer) {
    window.clearInterval(pollingTimer)
    pollingTimer = null
  }
})

watch(
  () => route.params.datasetId,
  async () => {
    activeContentTab.value = 'readme'
    readmeContent.value = ''
    filesState.value = { ready: false, tree: null, data_files: [], default_preview_path: null }
    previewState.value = {
      path: '',
      format: '',
      columns: [],
      rows: [],
      selectedTable: '',
      sqlSupported: false,
      defaultSql: ''
    }
    sqlResult.value = { columns: [], rows: [], rowCount: 0, truncated: false }
    selectedFilePath.value = ''
    tableSearch.value = ''
    sqlQuery.value = ''
    previewError.value = ''
    sqlError.value = ''
    await loadDataset()
    if (dataset.value) {
      await Promise.all([loadReadme(), loadFiles()])
      if (selectedFilePath.value) {
        await loadPreview(selectedFilePath.value)
      }
      refreshPolling()
    }
  }
)
</script>

<style scoped>
.dataset-detail-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-loading,
.panel-card {
  border: 1px solid rgba(27, 43, 65, 0.08);
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(240, 221, 183, 0.26), transparent 30%),
    linear-gradient(145deg, #fffdf8 0%, #f4efe4 100%);
  box-shadow: 0 24px 60px rgba(34, 44, 63, 0.08);
}

.detail-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.1rem 1.2rem;
  color: #5f6879;
}

.detail-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) 320px;
  gap: 1rem;
  padding: 1.4rem;
  border: 1px solid rgba(27, 43, 65, 0.08);
  border-radius: 30px;
  background:
    radial-gradient(circle at top right, rgba(250, 214, 133, 0.42), transparent 26%),
    linear-gradient(135deg, #fdfbf5 0%, #efe6d5 100%);
  box-shadow: 0 26px 68px rgba(33, 44, 67, 0.1);
}

.detail-hero-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  color: #36506f;
  font-weight: 600;
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.badge-soft,
.status-badge,
.hero-tag,
.meta-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.35rem 0.72rem;
  font-size: 0.8rem;
}

.badge-soft {
  background: rgba(27, 43, 65, 0.08);
  color: #39506e;
}

.status-badge {
  text-transform: capitalize;
  font-weight: 700;
}

.status-badge.is-ready {
  background: rgba(28, 130, 109, 0.14);
  color: #156d5d;
}

.status-badge.is-downloading {
  background: rgba(207, 109, 46, 0.14);
  color: #a85a22;
}

.status-badge.is-failed {
  background: rgba(180, 53, 69, 0.12);
  color: #a22735;
}

.status-badge.is-uploaded {
  background: rgba(53, 89, 154, 0.12);
  color: #2b5a96;
}

.hero-title {
  margin: 0;
  color: #172033;
  font-size: clamp(2rem, 3vw, 2.7rem);
  line-height: 1.05;
}

.hero-copy {
  margin: 0;
  color: #5b6679;
  line-height: 1.65;
  max-width: 72ch;
}

.hero-hf-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  width: fit-content;
  color: #1d4a8f;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  word-break: break-all;
}

.hero-hf-link:hover {
  color: #143267;
  text-decoration: underline;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: #6b7280;
  font-size: 0.92rem;
}

.hero-tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.hero-tag,
.meta-chip {
  background: rgba(35, 49, 75, 0.08);
  color: #46546a;
}

.hero-progress {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.95rem;
  border-radius: 20px;
  background: rgba(252, 245, 231, 0.85);
  border: 1px solid rgba(207, 109, 46, 0.12);
}

.hero-progress-copy,
.hero-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: #7b5a3b;
  font-size: 0.85rem;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}

.detail-hero-cover {
  min-height: 280px;
  border-radius: 26px;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(255, 223, 171, 0.5), transparent 34%),
    linear-gradient(150deg, #ddd0b8 0%, #f3ece1 100%);
}

.cover-image,
.cover-fallback {
  width: 100%;
  height: 100%;
  display: block;
}

.cover-image {
  object-fit: cover;
}

.cover-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  padding: 1.2rem;
  color: #1c2638;
  text-align: center;
}

.cover-name {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
}

.cover-meta {
  color: #53627a;
  font-size: 0.95rem;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 380px;
  gap: 1rem;
  align-items: start;
}

.detail-main,
.detail-side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-card {
  padding: 1.1rem;
}

.detail-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.detail-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0.55rem 1rem;
  border: 1px solid rgba(27, 43, 65, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: #415069;
  font-weight: 700;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.detail-tab:hover {
  border-color: rgba(23, 32, 51, 0.24);
  color: #172033;
}

.detail-tab.active {
  background: #172033;
  border-color: #172033;
  color: #fff;
  box-shadow: 0 14px 32px rgba(23, 32, 51, 0.18);
}

.tab-panel {
  min-height: 220px;
}

.panel-head,
.panel-head-spread,
.sql-head,
.sql-result-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel-title {
  color: #172033;
}

.panel-loading,
.empty-state,
.explorer-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  min-height: 140px;
  border-radius: 20px;
  border: 1px dashed rgba(45, 60, 84, 0.16);
  background: rgba(255, 255, 255, 0.68);
  color: #5f6b7f;
  text-align: center;
  padding: 1rem;
}

.explorer-head-tools {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 280px;
}

.explorer-head-tools .form-select {
  min-width: 0;
}

.explorer-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.explorer-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.explorer-search {
  position: relative;
  display: block;
  flex: 1;
}

.explorer-search i {
  position: absolute;
  top: 50%;
  left: 0.9rem;
  transform: translateY(-50%);
  color: #778195;
}

.explorer-search input {
  padding-left: 2.6rem;
  min-height: 46px;
  border-radius: 16px;
}

.explorer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preview-table-wrap,
.sql-result {
  border: 1px solid rgba(27, 43, 65, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.7);
  overflow: hidden;
}

.preview-table thead th {
  background: rgba(247, 244, 236, 0.95);
  border-bottom-color: rgba(27, 43, 65, 0.08);
  color: #2f3d54;
  font-weight: 700;
  white-space: nowrap;
}

.sortable-head {
  cursor: pointer;
}

.sortable-head span {
  margin-right: 0.35rem;
}

.preview-table td {
  max-width: 320px;
}

.cell-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: #425066;
}

.sql-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem;
  border-radius: 22px;
  background: rgba(249, 246, 239, 0.8);
  border: 1px solid rgba(27, 43, 65, 0.08);
}

.sql-editor {
  min-height: 140px;
  border-radius: 18px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.info-list {
  display: grid;
  gap: 0.85rem;
}

.info-list div {
  display: grid;
  gap: 0.2rem;
}

.info-list dt {
  color: #6b7280;
  font-size: 0.82rem;
  font-weight: 600;
}

.info-list dd {
  margin: 0;
  color: #223147;
  line-height: 1.6;
}

.source-break {
  word-break: break-all;
}

.file-tree {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  max-height: 520px;
  overflow: auto;
}

.file-tree-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  min-height: 38px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #34425a;
  text-align: left;
}

.file-tree-item:hover {
  background: rgba(35, 49, 75, 0.07);
}

.file-tree-item.active {
  background: rgba(35, 49, 75, 0.12);
  color: #162132;
}

.file-tree-item.folder {
  font-weight: 700;
}

.tag-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tag-editor-block {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.tag-editor-label {
  color: #36455d;
  font-weight: 700;
}

.preset-grid,
.chip-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-toggle,
.editable-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 999px;
  padding: 0.4rem 0.75rem;
  border: 1px solid rgba(35, 49, 75, 0.12);
  background: rgba(255, 255, 255, 0.7);
  color: #3b4a63;
  font-size: 0.82rem;
}

.tag-toggle.active {
  background: #172033;
  border-color: #172033;
  color: #fff;
}

.editable-chip button {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  line-height: 1;
}

.danger-card {
  border-color: rgba(180, 53, 69, 0.14);
}

@media (max-width: 1200px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

}

@media (max-width: 992px) {
  .detail-hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .detail-hero,
  .panel-card {
    padding: 1rem;
  }

  .panel-head,
  .panel-head-spread,
  .sql-head {
    flex-direction: column;
  }

  .explorer-tools {
    flex-direction: column;
    align-items: stretch;
  }

  .explorer-head-tools {
    width: 100%;
    min-width: 0;
  }
}
</style>
