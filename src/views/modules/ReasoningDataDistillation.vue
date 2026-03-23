<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Reasoning Data Synthesis</h4>
        <p class="text-muted mb-0">Configure reasoning synthesis prompts and monitor distilled dataset generation from selected datasets.</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="refreshAll" :disabled="isLoading">
          <span v-if="isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
          Refresh
        </button>
        <button class="btn btn-outline-primary btn-sm" type="button" @click="toggleAutoRefresh">
          {{ autoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="notice" class="floating-notice-wrap">
      <div class="alert py-2 px-3 mb-0 d-flex align-items-center justify-content-between gap-2 floating-notice" :class="noticeClass" role="alert">
        <span>{{ notice }}</span>
        <button type="button" class="btn-close" aria-label="Close" @click="setNotice('')"></button>
      </div>
    </div>

    <div class="row g-3 mb-3 synthesis-main-row">
      <div class="col-12 col-xxl-5">
        <article class="card border-0 shadow-sm">
          <div class="card-body">
            <h6 class="card-title mb-3">Task Configuration</h6>

            <form class="d-flex flex-column gap-3 task-config-form" @submit.prevent="startTask">
              <label class="small text-muted mb-0">Prompt</label>
              <textarea
                v-model="form.prompt"
                @input="markPromptCustomized"
                class="form-control"
                rows="11"
                required
                placeholder="Describe how the model should synthesize reasoning supervision for the selected dataset."
              ></textarea>
              <div class="d-flex align-items-center justify-content-between gap-2">
                <span class="small text-muted">Prompt template enforces reasoning output wrapped in <code>&lt;think&gt;&lt;/think&gt;</code>.</span>
                <button class="btn btn-link btn-sm py-0" type="button" @click="resetPromptToTemplate">Reset to Template</button>
              </div>

              <div class="mt-1">
                <label class="small text-muted mb-1">Model Type</label>
                <div class="d-flex gap-3">
                  <label class="form-check mb-0">
                    <input class="form-check-input" type="radio" value="api" v-model="form.modelProvider">
                    <span class="form-check-label">API</span>
                  </label>
                  <label class="form-check mb-0">
                    <input class="form-check-input" type="radio" value="local" v-model="form.modelProvider">
                    <span class="form-check-label">Local</span>
                  </label>
                </div>
              </div>

              <div class="row g-2 mt-1">
                <div class="col-12 col-md-4" v-if="form.modelProvider === 'api'">
                  <label class="small text-muted mb-1">LLM API Key</label>
                  <input
                    v-model.trim="form.llmApiKey"
                    type="password"
                    class="form-control"
                    placeholder="sk-..."
                    required
                  >
                </div>
                <div class="col-12 col-md-4">
                  <label class="small text-muted mb-1">{{ form.modelProvider === 'local' ? 'Endpoint' : 'Base URL' }}</label>
                  <input
                    v-model.trim="form.llmBaseUrl"
                    type="text"
                    class="form-control"
                    placeholder="https://api.openai.com/v1"
                    required
                  >
                </div>
                <div class="col-12 col-md-4">
                  <label class="small text-muted mb-1">Model Name</label>
                  <input
                    v-model.trim="form.llmModelName"
                    type="text"
                    class="form-control"
                    placeholder="gpt-4o-mini"
                    required
                  >
                </div>
              </div>

              <div class="mt-1">
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <label class="small text-muted mb-0">Dataset</label>
                </div>

                <div v-if="datasetOptions.length === 0" class="small text-muted border rounded p-2">
                  No datasets found. Please upload datasets first.
                </div>
                <div v-else>
                  <div class="dataset-dropdown" ref="datasetDropdownRef">
                    <button
                      class="dataset-dropdown-trigger"
                      type="button"
                      @click="toggleDatasetDropdown"
                      :aria-expanded="datasetDropdownOpen ? 'true' : 'false'"
                    >
                      <span>{{ datasetDropdownLabel }}</span>
                      <span class="dataset-dropdown-caret" :class="{ open: datasetDropdownOpen }">▾</span>
                    </button>

                    <div v-if="datasetDropdownOpen" class="dataset-dropdown-menu">
                      <label v-for="item in datasetOptions" :key="`dataset-option-${item.id}`" class="dataset-select-item">
                        <input
                          class="form-check-input"
                          type="radio"
                          name="reasoning-dataset-selection"
                          :checked="String(form.datasetId) === String(item.id)"
                          @change="selectDataset(item.id)"
                        >
                        <span class="small">{{ item.name }}</span>
                      </label>
                    </div>
                  </div>

                  <div v-if="selectedDatasetItem" class="selected-dataset-list">
                    <div class="selected-dataset-chip">
                      <span class="selected-dataset-name">{{ selectedDatasetItem.name }}</span>
                      <button
                        class="selected-dataset-remove"
                        type="button"
                        :aria-label="`Remove ${selectedDatasetItem.name}`"
                        @click="clearSelectedDataset"
                      >
                        <i class="bi bi-x-lg"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-1">
                <label class="small text-muted mb-1">Save Path</label>
                <div class="save-path-row">
                  <input
                    v-model.trim="form.savePath"
                    type="text"
                    class="form-control"
                    placeholder="Leave empty to use backend default output path"
                  >
                  <button class="btn btn-outline-secondary" type="button" @click="browseSavePath">
                    Browse
                  </button>
                </div>
                <div class="small text-muted mt-1">
                  {{ form.savePath || 'Choose a local directory on this computer. In browser mode you can also type an absolute path manually.' }}
                </div>
              </div>

              <div class="advanced-config-panel">
                <button
                  class="advanced-config-toggle"
                  type="button"
                  @click="advancedConfigOpen = !advancedConfigOpen"
                  :aria-expanded="advancedConfigOpen ? 'true' : 'false'"
                >
                  <span>Advanced Config</span>
                  <span class="dataset-dropdown-caret" :class="{ open: advancedConfigOpen }">▾</span>
                </button>

                <div v-if="advancedConfigOpen" class="advanced-config-body">
                  <div class="row g-2">
                    <div class="col-12">
                      <label class="small text-muted mb-1">Parallelism</label>
                      <input
                        v-model.number="form.parallelism"
                        type="number"
                        class="form-control"
                        min="1"
                        max="32"
                        step="1"
                      >
                      <div class="small text-muted mt-1">Controls concurrent synthesis threads per task.</div>
                    </div>
                    <div class="col-12">
                      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                        <label class="small text-muted mb-0">LLM API Config (JSON)</label>
                        <div class="d-flex flex-wrap gap-2">
                          <button class="btn btn-outline-primary btn-sm" type="button" @click="applyDefaultLlmParamsTemplate">
                            Apply Default Template
                          </button>
                          <button class="btn btn-outline-secondary btn-sm" type="button" @click="clearLlmParamsTemplate">
                            Clear
                          </button>
                        </div>
                      </div>
                      <textarea
                        v-model="form.llmParamsJson"
                        class="form-control advanced-config-textarea"
                        rows="7"
                        placeholder="Leave empty to use backend defaults"
                      ></textarea>
                      <div class="small text-muted mt-1">Optional raw request parameters such as temperature, top_p, max_tokens, or frequency_penalty.</div>
                    </div>
                  </div>
                </div>
              </div>

              <button class="btn btn-primary mt-1" type="submit" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Start Task
              </button>
            </form>
          </div>
        </article>
      </div>

      <div class="col-12 col-xxl-7 right-panel-col">
        <div class="row g-3">
          <div class="col-12 col-md-4" v-for="card in statsCards" :key="card.label">
            <article class="card border-0 shadow-sm h-100">
              <div class="card-body py-3">
                <div class="small text-muted">{{ card.label }}</div>
                <div class="h4 mb-0 mt-1">{{ card.value }}</div>
              </div>
            </article>
          </div>
        </div>

        <article v-if="selectedTask" class="card border-0 shadow-sm mt-3">
          <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <div class="small text-muted">Selected Task</div>
              <div class="fw-semibold">#{{ selectedTask.id }} · {{ selectedTask.sourceLabel }}</div>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button v-if="selectedTask.generatedDatasetId" class="btn btn-outline-primary btn-sm" type="button" @click="openGeneratedDataset">
                Open Generated Dataset
              </button>
            </div>
          </div>
        </article>

        <article class="card border-0 shadow-sm mt-3 task-overview-card">
          <div class="card-body d-flex flex-column gap-2 h-100">
            <div class="d-flex align-items-center justify-content-between">
              <h6 class="card-title mb-0">{{ taskPanelMode === 'tasks' ? 'Task List' : `Synthesis Results · Task ${selectedTaskId || '-'}` }}</h6>
              <div class="d-flex align-items-center gap-2">
                <span class="small text-muted" v-if="taskPanelMode === 'tasks'">Latest {{ tasks.length }} tasks</span>
                <span class="small text-muted" v-else>Results {{ results.length }}</span>
                <button v-if="taskPanelMode === 'results'" class="btn btn-outline-secondary btn-sm" type="button" @click="backToTaskList">
                  Back to Tasks
                </button>
              </div>
            </div>

            <div class="table-responsive task-overview-table-wrap">
              <table v-if="taskPanelMode === 'tasks'" class="table table-sm table-hover align-middle mb-0 task-table-centered">
                <thead class="table-light">
                <tr>
                  <th>Task ID</th>
                  <th>Source</th>
                  <th>Progress</th>
                  <th>Created At</th>
                  <th>Updated At</th>
                </tr>
                </thead>
                <tbody>
                <tr
                  v-for="task in pagedTasks"
                  :key="task.id"
                  class="task-row"
                  :class="{ selected: selectedTaskId === task.id }"
                  @click="openTaskResults(task.id)"
                >
                  <td>{{ task.id }}</td>
                  <td>{{ task.sourceLabel }}</td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div class="progress flex-grow-1" role="progressbar" :aria-valuenow="task.progress" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" :style="{ width: `${task.progress}%` }"></div>
                      </div>
                      <span class="small text-muted">{{ task.progressText }}</span>
                    </div>
                  </td>
                  <td>{{ task.createdAtDisplay }}</td>
                  <td>{{ task.updatedAtDisplay }}</td>
                </tr>
                <tr v-if="pagedTasks.length === 0">
                  <td colspan="5" class="text-center text-muted py-3">No tasks.</td>
                </tr>
                </tbody>
              </table>

              <div v-else class="h-100">
                <div v-if="isLoadingResults" class="d-flex align-items-center justify-content-center h-100 text-muted">
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Loading results...
                </div>
                <div v-else class="result-groups-wrap">
                  <table v-if="results.length" class="table table-sm table-hover align-middle mb-0 results-table-fixed">
                    <thead class="table-light">
                    <tr>
                      <th style="width: 16%">Item</th>
                      <th style="width: 24%">Prompt</th>
                      <th style="width: 28%">Reasoning</th>
                      <th style="width: 22%">Answer</th>
                      <th style="width: 10%">Status</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="row in results" :key="row.id">
                      <td>{{ row.itemKey }}</td>
                      <td>
                        <div class="result-preview result-preview-clickable" @click="openResultField(row, 'Prompt', row.promptText)">
                          {{ previewText(row.promptText) }}
                        </div>
                      </td>
                      <td>
                        <div class="result-preview result-preview-clickable" @click="openResultField(row, 'Reasoning', row.reasoningText)">
                          {{ previewText(row.reasoningText) }}
                        </div>
                      </td>
                      <td>
                        <div class="result-preview result-preview-clickable" @click="openResultField(row, 'Answer', row.answerText)">
                          {{ previewText(row.answerText) }}
                        </div>
                      </td>
                      <td><span class="badge" :class="statusClass(row.status)">{{ row.status }}</span></td>
                    </tr>
                    </tbody>
                  </table>
                  <div v-else class="text-center text-muted py-3">No synthesis results for this task.</div>
                </div>
              </div>
            </div>

            <div v-if="taskPanelMode === 'tasks'" class="d-flex align-items-center justify-content-between mt-2">
              <div class="small text-muted">Page {{ currentPage }} / {{ totalPages }}</div>
              <div class="btn-group btn-group-sm" role="group" aria-label="Task pagination">
                <button class="btn btn-outline-secondary" type="button" :disabled="currentPage <= 1" @click="goPrevPage">Prev</button>
                <button class="btn btn-outline-secondary" type="button" :disabled="currentPage >= totalPages" @click="goNextPage">Next</button>
              </div>
            </div>

            <div class="small text-muted mt-1" v-if="taskPanelMode === 'tasks'">Click one task row to inspect synthesis results.</div>
          </div>
        </article>
      </div>
    </div>

    <div class="modal fade" tabindex="-1" ref="resultModalRef" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h6 class="modal-title mb-0">{{ resultModalTitle }}</h6>
            <button type="button" class="btn-close" @click="closeResultModal"></button>
          </div>
          <div class="modal-body">
            <pre class="result-modal-pre mb-0">{{ resultModalContent }}</pre>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" type="button" @click="closeResultModal">Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import { chooseLocalDirectory } from '../../utils/desktop'
import {
  createReasoningDistillationTask,
  fetchDatasets,
  fetchReasoningDistillationTask,
  fetchReasoningDistillationTaskResults,
  fetchReasoningDistillationTasks
} from '../../api/dataAgent'

const route = useRoute()
const router = useRouter()

const DEFAULT_STRATEGY = 'step-pruning'
const DEFAULT_TARGET_MAX_TOKENS = 1024
const DEFAULT_COMPRESSION_RATIO = 0.45
const DEFAULT_KEEP_TOOL_TRACE = true

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')
const noticeType = ref('info')
const autoRefresh = ref(true)
const datasetOptions = ref([])
const tasks = ref([])
const results = ref([])
const selectedTaskId = ref(null)
const selectedTask = ref(null)
const taskPanelMode = ref('tasks')
const isLoadingResults = ref(false)
const currentPage = ref(1)
const pageSize = 5
const datasetDropdownOpen = ref(false)
const datasetDropdownRef = ref(null)
const resultModalRef = ref(null)
const resultModalTitle = ref('Result Detail')
const resultModalContent = ref('')
const advancedConfigOpen = ref(false)
let resultModalInstance = null

const API_LLM_BASE_URL = 'https://api.openai.com/v1'
const API_LLM_MODEL_NAME = 'gpt-4o-mini'
const LOCAL_LLM_BASE_URL = 'http://127.0.0.1:11434/v1'
const LOCAL_LLM_MODEL_NAME = 'qwen2.5:7b-instruct'
const DEFAULT_LLM_PARAMS_TEMPLATE = {
  temperature: 0.2,
  top_p: 0.95,
  max_tokens: 4096
}

const buildDefaultPrompt = () => {
  return `You are generating one reasoning-synthesis training record for a data-analysis model.

Task requirements:
1) Ground the reasoning and answer in the provided source item only.
2) The reasoning field must be wrapped in exactly one pair of <think></think> tags.
3) Keep the reasoning concise, useful, and faithful to the source.
4) Keep the final answer direct and plain.
5) Do not add markdown fences or extra sections.
`
}

const form = ref({
  datasetId: '',
  prompt: buildDefaultPrompt(),
  modelProvider: 'api',
  llmApiKey: '',
  llmBaseUrl: API_LLM_BASE_URL,
  llmModelName: API_LLM_MODEL_NAME,
  parallelism: 1,
  savePath: '',
  llmParamsJson: JSON.stringify(DEFAULT_LLM_PARAMS_TEMPLATE, null, 2)
})

let pollTimer = null
let noticeTimer = null

const statsCards = computed(() => {
  const total = tasks.value.length
  const running = tasks.value.filter((item) => ['pending', 'running'].includes(item.status)).length
  const done = tasks.value.filter((item) => item.status === 'completed').length

  return [
    { label: 'Total Tasks', value: total },
    { label: 'Running Tasks', value: running },
    { label: 'Completed Tasks', value: done }
  ]
})

const noticeClass = computed(() => {
  if (noticeType.value === 'success') return 'alert-success'
  if (noticeType.value === 'error') return 'alert-danger'
  return 'alert-info'
})

const totalPages = computed(() => {
  const pages = Math.ceil(tasks.value.length / pageSize)
  return pages > 0 ? pages : 1
})

const pagedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return tasks.value.slice(start, start + pageSize)
})

const selectedDatasetItem = computed(() => {
  const targetId = String(form.value.datasetId || '')
  if (!targetId) return null
  return datasetOptions.value.find((item) => String(item.id) === targetId) || null
})

const datasetDropdownLabel = computed(() => {
  if (selectedDatasetItem.value) return selectedDatasetItem.value.name
  return 'Select dataset'
})

const setNotice = (message, type = 'info') => {
  notice.value = String(message || '')
  noticeType.value = type

  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }

  if (!notice.value) return

  const timeoutMs = type === 'error' ? 6000 : type === 'success' ? 3500 : 2500
  noticeTimer = setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, timeoutMs)
}

const formatDateTime = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).replace('T', ' ').slice(0, 19)
  }

  const pad = (num) => String(num).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())

  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const mapDatasets = (raw) => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return list.map((item, index) => ({
    id: Number(item?.id || index + 1),
    name: String(item?.name || item?.dataset_name || `dataset-${index + 1}`)
  }))
}

const mapTask = (item, index = 0) => {
  const processedItems = Number(item?.processed_items || 0)
  const totalItems = Number(item?.total_items || 0)
  const progress = totalItems > 0
    ? Math.max(0, Math.min(100, Math.round((processedItems / totalItems) * 100)))
    : 0

  return {
    id: String(item?.id || index + 1),
    sourceLabel: String(item?.source_label || `Dataset #${item?.source_dataset_id || '-'}`),
    processedItems,
    totalItems,
    progress,
    progressText: totalItems > 0 ? `${processedItems}/${totalItems}` : `${processedItems}`,
    status: String(item?.status || 'pending').toLowerCase(),
    distilledSamples: Number(item?.distilled_samples || 0),
    avgTokens: Number(item?.avg_tokens || 0),
    generatedDatasetId: Number(item?.generated_dataset_id || item?.generated_dataset?.id || 0),
    createdAtDisplay: formatDateTime(item?.created_at || item?.insert_time || item?.createdAt || '-'),
    updatedAtDisplay: formatDateTime(item?.updated_at || item?.update_time || item?.updatedAt || '-')
  }
}

const mapResults = (raw) => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return list.map((item, index) => ({
    id: String(item?.id || index + 1),
    itemKey: String(item?.item_key || `item-${index + 1}`),
    promptText: String(item?.prompt_text || ''),
    reasoningText: String(item?.reasoning_text || ''),
    answerText: String(item?.answer_text || ''),
    status: String(item?.status || 'unknown').toLowerCase()
  }))
}

const statusClass = (status) => {
  if (['completed', 'success', 'done', 'finished'].includes(status)) return 'bg-success-subtle text-success-emphasis'
  if (['running', 'in_progress', 'queued', 'pending'].includes(status)) return 'bg-primary-subtle text-primary-emphasis'
  if (['failed', 'error', 'cancelled', 'aborted'].includes(status)) return 'bg-danger-subtle text-danger-emphasis'
  return 'bg-light text-dark'
}

const previewText = (text, limit = 120) => {
  const content = String(text || '').trim()
  if (!content) return '-'
  return content.length > limit ? `${content.slice(0, limit)}...` : content
}

const markPromptCustomized = () => {}

const resetPromptToTemplate = () => {
  form.value.prompt = buildDefaultPrompt()
}

const applyDefaultLlmParamsTemplate = () => {
  form.value.llmParamsJson = JSON.stringify(DEFAULT_LLM_PARAMS_TEMPLATE, null, 2)
  advancedConfigOpen.value = true
}

const clearLlmParamsTemplate = () => {
  form.value.llmParamsJson = ''
}

const normalizeLlmParamsJson = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  const parsed = JSON.parse(text)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('LLM API Config must be a JSON object.')
  }
  return JSON.stringify(parsed)
}

const browseSavePath = async () => {
  const selected = await chooseLocalDirectory()
  if (selected) {
    form.value.savePath = selected
  }
}

const selectDataset = (datasetId) => {
  const nextId = Number(datasetId)
  if (!Number.isFinite(nextId) || nextId <= 0) return
  form.value.datasetId = String(nextId)
  datasetDropdownOpen.value = false
}

const clearSelectedDataset = () => {
  form.value.datasetId = ''
}

const toggleDatasetDropdown = () => {
  datasetDropdownOpen.value = !datasetDropdownOpen.value
}

const handleClickOutsideDatasetDropdown = (event) => {
  if (!datasetDropdownRef.value) return
  if (!datasetDropdownRef.value.contains(event.target)) {
    datasetDropdownOpen.value = false
  }
}

const refreshDatasetOptions = async () => {
  const response = await fetchDatasets()
  datasetOptions.value = mapDatasets(response)
  const validIds = new Set(datasetOptions.value.map((item) => String(item.id)))
  if (form.value.datasetId && !validIds.has(String(form.value.datasetId))) {
    form.value.datasetId = ''
  }
  applyRouteSelection()
}

const inspectTask = async (taskId, { silent = false } = {}) => {
  if (!taskId) return

  selectedTaskId.value = String(taskId)
  if (!silent) isLoading.value = true

  try {
    const response = await fetchReasoningDistillationTask(selectedTaskId.value)
    selectedTask.value = mapTask(response?.data || response)
  } catch (error) {
    const fallback = tasks.value.find((item) => item.id === selectedTaskId.value)
    if (fallback) {
      selectedTask.value = fallback
    }
    if (!silent) {
      setNotice(`Failed to load task detail. (${error?.message || 'unknown error'})`, 'error')
    }
  } finally {
    if (!silent) isLoading.value = false
  }
}

const refreshTaskResults = async (taskId, { silent = false, reset = false } = {}) => {
  if (!taskId) return

  if (!silent) isLoadingResults.value = true
  if (reset) results.value = []

  try {
    const resultResponse = await fetchReasoningDistillationTaskResults(taskId, 200)
    results.value = mapResults(resultResponse)
  } catch (error) {
    if (!silent) {
      setNotice(`Failed to load task results. (${error?.message || 'unknown error'})`, 'error')
    }
  } finally {
    if (!silent) isLoadingResults.value = false
  }
}

const refreshTasks = async ({ silent = false } = {}) => {
  if (!silent) isLoading.value = true
  if (!silent) setNotice('')

  try {
    const response = await fetchReasoningDistillationTasks(100)
    tasks.value = (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []).map(mapTask)

    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value
    }

    if (!selectedTaskId.value && tasks.value.length > 0) {
      selectedTaskId.value = tasks.value[0].id
      await inspectTask(selectedTaskId.value, { silent: true })
      return
    }

    if (selectedTaskId.value) {
      const exists = tasks.value.find((item) => item.id === selectedTaskId.value)
      if (!exists && tasks.value.length > 0) {
        selectedTaskId.value = tasks.value[0].id
      }
      if (selectedTaskId.value) {
        await inspectTask(selectedTaskId.value, { silent: true })
      }
    }

    if (taskPanelMode.value === 'results' && selectedTaskId.value) {
      await refreshTaskResults(selectedTaskId.value, { silent: true })
    }
  } catch (error) {
    setNotice(`Refresh failed. (${error?.message || 'unknown error'})`, 'error')
  } finally {
    if (!silent) isLoading.value = false
  }
}

const refreshAll = async () => {
  isLoading.value = true
  setNotice('')
  try {
    await refreshDatasetOptions()
    await refreshTasks({ silent: true })
    if (selectedTaskId.value) {
      await inspectTask(selectedTaskId.value, { silent: true })
      if (taskPanelMode.value === 'results') {
        await refreshTaskResults(selectedTaskId.value, { silent: true })
      }
    }
  } catch (error) {
    setNotice(`Refresh failed. (${error?.message || 'unknown error'})`, 'error')
  } finally {
    isLoading.value = false
  }
}

const openTaskResults = async (taskId) => {
  await inspectTask(taskId, { silent: true })
  taskPanelMode.value = 'results'
  await refreshTaskResults(taskId, { silent: false, reset: true })
}

const backToTaskList = () => {
  taskPanelMode.value = 'tasks'
}

const goPrevPage = () => {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
}

const goNextPage = () => {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
}

const startTask = async () => {
  if (!form.value.datasetId) {
    setNotice('Please select a dataset.', 'error')
    return
  }
  if (!form.value.prompt || !form.value.llmBaseUrl || !form.value.llmModelName) {
    setNotice('Please complete prompt and model fields before submitting.', 'error')
    return
  }
  if (form.value.modelProvider === 'api' && !form.value.llmApiKey) {
    setNotice('API model type requires LLM API Key.', 'error')
    return
  }

  isSubmitting.value = true
  setNotice('Starting task...', 'info')
  try {
    const llmParamsJson = normalizeLlmParamsJson(form.value.llmParamsJson)
    const payload = {
      source_type: 'dataset',
      source_dataset_id: Number(form.value.datasetId),
      prompt: form.value.prompt,
      strategy: DEFAULT_STRATEGY,
      target_max_tokens: DEFAULT_TARGET_MAX_TOKENS,
      compression_ratio: DEFAULT_COMPRESSION_RATIO,
      keep_tool_trace: DEFAULT_KEEP_TOOL_TRACE,
      note: '',
      llm_api_key: form.value.modelProvider === 'local' ? 'local' : form.value.llmApiKey,
      llm_base_url: form.value.llmBaseUrl,
      llm_model_name: form.value.llmModelName,
      parallelism: Math.max(1, Math.min(32, Number(form.value.parallelism) || 1)),
      save_path: String(form.value.savePath || '').trim() || undefined,
      llm_params_json: llmParamsJson
    }
    const response = await createReasoningDistillationTask(payload)
    const created = mapTask(response?.data || response)
    selectedTaskId.value = created.id
    selectedTask.value = created
    taskPanelMode.value = 'tasks'
    setNotice('Reasoning Data Synthesis task started.', 'success')
    await refreshTasks({ silent: true })
    await inspectTask(selectedTaskId.value, { silent: true })
  } catch (error) {
    setNotice(`Failed to start task. (${error?.message || 'backend error'})`, 'error')
  } finally {
    isSubmitting.value = false
  }
}

const openGeneratedDataset = () => {
  if (!selectedTask.value?.generatedDatasetId) return
  router.push(`/data-preparation/${selectedTask.value.generatedDatasetId}`)
}

const applyRouteSelection = () => {
  const datasetId = String(route.query.datasetId || '').trim()
  if (datasetId && datasetOptions.value.some((item) => String(item.id) === datasetId)) {
    form.value.datasetId = datasetId
  }
}

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    try {
      await refreshTasks({ silent: true })
      if (taskPanelMode.value === 'results' && selectedTaskId.value) {
        await refreshTaskResults(selectedTaskId.value, { silent: true })
      }
    } catch {
      // ignore silent polling failures
    }
  }, 5000)
}

const stopPolling = () => {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startPolling()
  } else {
    stopPolling()
  }
}

const getResultModal = () => {
  if (!resultModalRef.value) return null
  resultModalInstance = Modal.getOrCreateInstance(resultModalRef.value)
  return resultModalInstance
}

const openResultField = (row, fieldLabel, fieldValue) => {
  resultModalTitle.value = `Result ${row?.id || ''} · ${String(fieldLabel || 'Detail')}`
  resultModalContent.value = String(fieldValue || '-')
  getResultModal()?.show()
}

const closeResultModal = () => {
  getResultModal()?.hide()
}

watch(
  () => form.value.modelProvider,
  (provider) => {
    if (provider === 'local') {
      if (!form.value.llmBaseUrl || form.value.llmBaseUrl === API_LLM_BASE_URL) {
        form.value.llmBaseUrl = LOCAL_LLM_BASE_URL
      }
      if (!form.value.llmModelName || form.value.llmModelName === API_LLM_MODEL_NAME) {
        form.value.llmModelName = LOCAL_LLM_MODEL_NAME
      }
    } else {
      if (!form.value.llmBaseUrl || form.value.llmBaseUrl === LOCAL_LLM_BASE_URL) {
        form.value.llmBaseUrl = API_LLM_BASE_URL
      }
      if (!form.value.llmModelName || form.value.llmModelName === LOCAL_LLM_MODEL_NAME) {
        form.value.llmModelName = API_LLM_MODEL_NAME
      }
    }
  }
)

watch(
  () => route.query.datasetId,
  () => {
    applyRouteSelection()
  }
)

onMounted(async () => {
  document.addEventListener('click', handleClickOutsideDatasetDropdown)
  await refreshAll()
  applyRouteSelection()
  if (autoRefresh.value) startPolling()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutsideDatasetDropdown)
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }
  resultModalInstance?.dispose()
  stopPolling()
})
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.floating-notice-wrap {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  width: min(760px, calc(100vw - 24px));
}

.floating-notice {
  box-shadow: 0 8px 24px rgba(16, 36, 66, 0.18);
  border-radius: 10px;
}

.synthesis-main-row {
  align-items: flex-start;
}

.dataset-dropdown {
  position: relative;
}

.dataset-dropdown-trigger {
  width: 100%;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fff;
  min-height: 38px;
  padding: 0.45rem 0.7rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #23364f;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dataset-dropdown-trigger:hover {
  border-color: #9fb8e5;
}

.dataset-dropdown-trigger:focus-visible {
  outline: none;
  border-color: #6a9ae6;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}

.dataset-dropdown-caret {
  color: #5f7392;
  transition: transform 0.15s ease;
}

.dataset-dropdown-caret.open {
  transform: rotate(180deg);
}

.dataset-dropdown-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 30;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fff;
  max-height: 220px;
  overflow: auto;
  padding: 0.45rem 0.5rem;
  box-shadow: 0 10px 24px rgba(32, 55, 90, 0.12);
}

.dataset-select-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.3rem;
  border-radius: 8px;
}

.dataset-select-item:hover {
  background: #f4f8ff;
}

.selected-dataset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.75rem;
}

.selected-dataset-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 34px;
  max-width: 100%;
  padding: 0.38rem 0.45rem 0.38rem 0.7rem;
  border: 1px solid #dbe4f0;
  border-radius: 999px;
  background: #f7faff;
  color: #2a4166;
}

.selected-dataset-name {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
}

.selected-dataset-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: rgba(42, 65, 102, 0.08);
  color: #466287;
}

.selected-dataset-remove:hover {
  background: rgba(42, 65, 102, 0.16);
  color: #223854;
}

.save-path-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.6rem;
}

.advanced-config-panel {
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #fbfdff;
}

.advanced-config-toggle {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0.7rem 0.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.92rem;
  font-weight: 600;
  color: #294268;
}

.advanced-config-toggle:hover {
  background: #f4f8ff;
}

.advanced-config-body {
  padding: 0 0.8rem 0.8rem;
  border-top: 1px solid #e2ebf7;
}

.advanced-config-textarea {
  font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.82rem;
}

.task-config-form {
  row-gap: 0.7rem !important;
}

.result-preview {
  display: block;
  width: 100%;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-preview-clickable {
  cursor: pointer;
}

.result-preview-clickable:hover {
  text-decoration: underline;
}

.result-groups-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.task-row {
  cursor: pointer;
}

.task-row.selected {
  background: #eef4ff;
}

.task-overview-card {
  height: auto;
}

.task-overview-table-wrap {
  height: 360px;
  max-height: 360px;
  min-height: 360px;
  overflow-y: auto;
  overflow-x: hidden;
}

.results-table-fixed {
  width: 100%;
  table-layout: fixed;
}

.results-table-fixed th,
.results-table-fixed td {
  overflow: hidden;
}

.right-panel-col {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.task-table-centered th,
.task-table-centered td {
  text-align: center;
  vertical-align: middle;
}

.result-modal-pre {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 65vh;
  overflow: auto;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fbfdff;
  padding: 0.8rem;
}
</style>
