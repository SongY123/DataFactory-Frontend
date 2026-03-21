<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Agentic Trajectory Synthesis</h4>
        <p class="text-muted mb-0">Configure synthesis prompts and monitor task execution progress from the backend trajectory workflow.</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="refreshTasks" :disabled="isLoading">
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
                v-model="taskForm.prompt"
                @input="markPromptCustomized"
                class="form-control"
                rows="11"
                required
                placeholder="Describe the synthesis objective, schema constraints, and desired output behavior"
              ></textarea>
              <div class="d-flex align-items-center justify-content-between">
                <span class="small text-muted">Trajectory example in prompt uses default action tags.</span>
                <button class="btn btn-link btn-sm py-0" type="button" @click="resetPromptToTemplate">Reset to Template</button>
              </div>

              <div class="mt-1">
                <label class="small text-muted mb-1">Model Type</label>
                <div class="d-flex gap-3">
                  <label class="form-check mb-0">
                    <input class="form-check-input" type="radio" value="api" v-model="taskForm.modelProvider">
                    <span class="form-check-label">API</span>
                  </label>
                  <label class="form-check mb-0">
                    <input class="form-check-input" type="radio" value="local" v-model="taskForm.modelProvider">
                    <span class="form-check-label">Local</span>
                  </label>
                </div>
              </div>

              <div class="row g-2 mt-1">
                <div class="col-12 col-md-4" v-if="taskForm.modelProvider === 'api'">
                  <label class="small text-muted mb-1">LLM API Key</label>
                  <input
                    v-model.trim="taskForm.llmApiKey"
                    type="password"
                    class="form-control"
                    placeholder="sk-..."
                    required
                  >
                </div>
                <div class="col-12 col-md-4">
                  <label class="small text-muted mb-1">{{ taskForm.modelProvider === 'local' ? 'Endpoint' : 'Base URL' }}</label>
                  <input
                    v-model.trim="taskForm.llmBaseUrl"
                    type="text"
                    class="form-control"
                    placeholder="https://api.openai.com/v1"
                    required
                  >
                </div>
                <div class="col-12 col-md-4">
                  <label class="small text-muted mb-1">Model Name</label>
                  <input
                    v-model.trim="taskForm.llmModelName"
                    type="text"
                    class="form-control"
                    placeholder="gpt-4o-mini"
                    required
                  >
                </div>
              </div>

              <div class="mt-1">
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <label class="small text-muted mb-0">Datasets</label>
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
                          type="checkbox"
                          :checked="Number(taskForm.datasetId) === Number(item.id)"
                          @change="selectDataset(item.id)"
                        >
                        <span class="small">{{ item.name }}</span>
                      </label>
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
              <div class="fw-semibold">#{{ selectedTask.id }} · {{ getTaskDatasetName(selectedTask) }}</div>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button v-if="selectedTask.generatedDatasetId" class="btn btn-outline-primary btn-sm" type="button" @click="openGeneratedDataset">
                Open Generated Dataset
              </button>
              <button v-if="selectedTask.id" class="btn btn-outline-dark btn-sm" type="button" @click="useTaskInDistillation">
                Reasoning Data Synthesis
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
                <span class="small text-muted" v-else>Results {{ taskResults.length }}</span>
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
                  <th>Dataset</th>
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
                  <td>{{ getTaskDatasetName(task) }}</td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div class="progress flex-grow-1" role="progressbar" :aria-valuenow="task.progress" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" :style="{ width: `${task.progress}%` }"></div>
                      </div>
                      <span class="small text-muted">{{ task.workspaceProgressText }}</span>
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
                  <template v-if="groupedTaskResults.length">
                    <section v-for="group in groupedTaskResults" :key="group.workspaceName" class="workspace-group">
                      <div class="workspace-group-title">
                        {{ group.workspaceName }}
                        <span class="text-muted">({{ group.items.length }})</span>
                      </div>
                      <table class="table table-sm table-hover align-middle mb-0 results-table-fixed">
                        <thead class="table-light">
                        <tr>
                          <th style="width: 34%">Question</th>
                          <th style="width: 34%">Trajectory</th>
                          <th style="width: 12%">Status</th>
                          <th style="width: 20%">Evaluation</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="item in group.items" :key="item.id">
                          <td>
                            <div class="result-preview result-preview-clickable" @click="openResultField(item, 'Question', item.question)">{{ previewText(item.question) }}</div>
                          </td>
                          <td><div class="result-preview result-preview-clickable" @click="openResultField(item, 'Trajectory', item.trajectory)">{{ previewText(item.trajectory) }}</div></td>
                          <td><span class="badge" :class="statusClass(item.status)">{{ item.status || '-' }}</span></td>
                          <td><div class="result-preview result-preview-clickable" @click="openResultField(item, 'Evaluation', item.evaluation)">{{ previewText(item.evaluation) }}</div></td>
                        </tr>
                        </tbody>
                      </table>
                    </section>
                  </template>
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
import {
  createAgenticSynthesisTask,
  fetchAgenticSynthesisTaskResults,
  fetchAgenticSynthesisTask,
  fetchAgenticSynthesisTasks,
  fetchDatasets,
  importPlatformAsset
} from '../../api/dataAgent'

const DEFAULT_ACTION_TAGS = ['Analyze', 'Understand', 'Code', 'Execute', 'Answer']
const route = useRoute()
const router = useRouter()

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')
const noticeType = ref('info')
const autoRefresh = ref(true)

const tasks = ref([])
const taskResults = ref([])
const selectedTaskId = ref(null)
const selectedTask = ref(null)
const taskPanelMode = ref('tasks')
const isLoadingResults = ref(false)
const currentPage = ref(1)
const pageSize = 5
const datasetOptions = ref([])
const datasetDropdownOpen = ref(false)
const datasetDropdownRef = ref(null)
const resultModalRef = ref(null)
const resultModalTitle = ref('Result Detail')
const resultModalContent = ref('')
let resultModalInstance = null

const API_LLM_BASE_URL = 'https://api.openai.com/v1'
const API_LLM_MODEL_NAME = 'gpt-4o-mini'
const LOCAL_LLM_BASE_URL = 'http://127.0.0.1:11434/v1'
const LOCAL_LLM_MODEL_NAME = 'qwen2.5:7b-instruct'

const buildTrajectoryExample = () => DEFAULT_ACTION_TAGS.map((tag) => `<${tag}>...</${tag}>`).join('')

const buildDefaultPrompt = () => {
  const trajectoryExample = buildTrajectoryExample()
  return `You are generating synthetic interaction trajectories to train a data-analysis agent.

Task requirements:
1) Read the provided data file content and create exactly one question in one sentence.
2) The question type must be exactly one of:
   - Dataset Management
   - Data Modeling
   - Open-ended Data Analysis
3) Then produce an interaction trajectory using Action Tags.
4) The trajectory must be grounded in the provided file content.
5) Keep everything in English.

Strict output format (no extra text, no markdown, no explanation):
Question: <one-sentence question>
Trajectory: ${trajectoryExample}

Tag writing rules:
- Use exactly the tag names and order shown in the Trajectory template.
- <Analyze>: brief analysis plan.
- <Understand>: concise interpretation or reasoning.
- <Code>: executable code that interacts with the provided data file.
- <Execute>: realistic execution output of the code.
- <Answer>: final answer to the Question.
- Do not output any sections other than Question and Trajectory.
`
}

const isPromptCustomized = ref(false)

const taskForm = ref({
  prompt: buildDefaultPrompt(),
  modelProvider: 'api',
  llmApiKey: '',
  llmBaseUrl: API_LLM_BASE_URL,
  llmModelName: API_LLM_MODEL_NAME,
  datasetId: null
})

let pollTimer = null
let noticeTimer = null

const statsCards = computed(() => {
  const total = tasks.value.length
  const running = tasks.value.filter((item) => Number(item.progress || 0) < 100).length
  const done = tasks.value.filter((item) => Number(item.progress || 0) >= 100).length

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

const totalPages = computed(() => {
  const pages = Math.ceil(tasks.value.length / pageSize)
  return pages > 0 ? pages : 1
})

const pagedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return tasks.value.slice(start, start + pageSize)
})

const selectedDatasetNames = computed(() => {
  const selectedId = Number(taskForm.value.datasetId || 0)
  return datasetOptions.value
    .filter((item) => Number(item.id) === selectedId)
    .map((item) => item.name)
})

const datasetDropdownLabel = computed(() => {
  if (!taskForm.value.datasetId) return 'Select one dataset'
  return selectedDatasetNames.value[0] || 'Select one dataset'
})

const markPromptCustomized = () => {
  isPromptCustomized.value = true
}

const resetPromptToTemplate = () => {
  isPromptCustomized.value = false
  taskForm.value.prompt = buildDefaultPrompt()
}

watch(
  () => taskForm.value.modelProvider,
  (provider) => {
    if (provider === 'local') {
      if (!taskForm.value.llmBaseUrl || taskForm.value.llmBaseUrl === API_LLM_BASE_URL) {
        taskForm.value.llmBaseUrl = LOCAL_LLM_BASE_URL
      }
      if (!taskForm.value.llmModelName || taskForm.value.llmModelName === API_LLM_MODEL_NAME) {
        taskForm.value.llmModelName = LOCAL_LLM_MODEL_NAME
      }
    } else if (provider === 'api') {
      if (!taskForm.value.llmBaseUrl || taskForm.value.llmBaseUrl === LOCAL_LLM_BASE_URL) {
        taskForm.value.llmBaseUrl = API_LLM_BASE_URL
      }
      if (!taskForm.value.llmModelName || taskForm.value.llmModelName === LOCAL_LLM_MODEL_NAME) {
        taskForm.value.llmModelName = API_LLM_MODEL_NAME
      }
    }
  }
)

const normalizeProgress = (item) => {
  const raw = item?.progress ?? item?.progress_rate ?? item?.percentage ?? item?.percent

  if (raw === undefined || raw === null || raw === '') return 0

  const val = Number(raw)
  if (!Number.isFinite(val)) return 0

  if (val <= 1) return Math.max(0, Math.min(100, Math.round(val * 100)))
  return Math.max(0, Math.min(100, Math.round(val)))
}

const firstFiniteNumber = (values = []) => {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

const computeWorkspaceProgress = (item) => {
  const workspace = item?.workspace || {}

  const totalRaw = firstFiniteNumber([
    item?.workspace_total,
    item?.workspace_count,
    item?.total_workspace,
    item?.total_workspaces,
    item?.workspace_total_count,
    item?.total_folders,
    item?.total_dirs,
    workspace?.total,
    workspace?.total_count,
    workspace?.count
  ])

  const doneRaw = firstFiniteNumber([
    item?.workspace_done,
    item?.workspace_processed,
    item?.processed_workspace,
    item?.processed_workspaces,
    item?.done_workspace,
    item?.done_workspaces,
    item?.workspace_current,
    item?.processed_folders,
    item?.done_folders,
    workspace?.done,
    workspace?.processed,
    workspace?.current
  ])

  const total = totalRaw !== null ? Math.max(0, Math.round(totalRaw)) : 0
  const doneUnclamped = doneRaw !== null ? Math.max(0, Math.round(doneRaw)) : 0
  const done = total > 0 ? Math.min(doneUnclamped, total) : doneUnclamped

  if (total > 0) {
    const progress = Math.max(0, Math.min(100, Math.round((done / total) * 100)))
    return {
      progress,
      workspaceProcessed: done,
      workspaceTotal: total,
      workspaceProgressText: `${done}/${total}`
    }
  }

  const fallback = normalizeProgress(item)
  return {
    progress: fallback,
    workspaceProcessed: done,
    workspaceTotal: total,
    workspaceProgressText: `${fallback}%`
  }
}

const formatDateTime = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
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

const mapTask = (item, index = 0) => {
  const workspaceProgress = computeWorkspaceProgress(item)

  return {
    id: String(item?.id || item?.task_id || `task-${index + 1}`),
    datasetId: Number(item?.dataset_id || item?.dataset?.id || item?.datasetId || 0),
    status: String(item?.status || item?.state || 'pending').toLowerCase(),
    progress: workspaceProgress.progress,
    workspaceProcessed: workspaceProgress.workspaceProcessed,
    workspaceTotal: workspaceProgress.workspaceTotal,
    workspaceProgressText: workspaceProgress.workspaceProgressText,
    datasetName: String(item?.dataset_name || item?.dataset?.name || item?.datasetName || '-'),
    generatedDatasetId: Number(item?.generated_dataset_id || item?.generated_dataset?.id || 0),
    createdAt: String(item?.created_at || item?.insert_time || item?.createdAt || '-'),
    updatedAt: String(item?.updated_at || item?.update_time || item?.updatedAt || '-'),
    createdAtDisplay: formatDateTime(item?.created_at || item?.insert_time || item?.createdAt || '-'),
    updatedAtDisplay: formatDateTime(item?.updated_at || item?.update_time || item?.updatedAt || '-'),
    outputPath: String(item?.output_file_path || item?.outputPath || '-')
  }
}

const getDatasetNameById = (datasetId) => {
  const idNum = Number(datasetId || 0)
  if (!Number.isFinite(idNum) || idNum <= 0) return ''
  const found = datasetOptions.value.find((item) => Number(item.id) === idNum)
  return found?.name || ''
}

const getTaskDatasetName = (task) => {
  const direct = String(task?.datasetName || '').trim()
  if (direct && direct !== '-') return direct
  const byId = getDatasetNameById(task?.datasetId)
  return byId || '-'
}

const mapTaskList = (raw) => {
  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : []

  return list.map((item, index) => mapTask(item, index))
}

const mapDatasetList = (raw) => {
  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : []

  return list
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      id: Number(item.id || item.dataset_id || index + 1),
      name: String(item.name || item.dataset_name || `dataset-${index + 1}`)
    }))
    .filter((item) => Number.isFinite(item.id) && item.id > 0)
}

const statusClass = (status) => {
  if (['completed', 'success', 'done', 'finished'].includes(status)) return 'bg-success-subtle text-success-emphasis'
  if (['running', 'in_progress', 'queued', 'pending'].includes(status)) return 'bg-primary-subtle text-primary-emphasis'
  if (['failed', 'error', 'cancelled', 'aborted'].includes(status)) return 'bg-danger-subtle text-danger-emphasis'
  return 'bg-light text-dark'
}

const refreshDatasetOptions = async () => {
  try {
    const response = await fetchDatasets()
    datasetOptions.value = mapDatasetList(response)
    const validIds = new Set(datasetOptions.value.map((item) => Number(item.id)))
    if (!validIds.has(Number(taskForm.value.datasetId))) {
      taskForm.value.datasetId = null
    }
    hydrateQuerySelection()
  } catch {
    datasetOptions.value = []
    taskForm.value.datasetId = null
  }
}

const selectDataset = (datasetId) => {
  const nextId = Number(datasetId)
  if (!Number.isFinite(nextId) || nextId <= 0) return
  if (Number(taskForm.value.datasetId) === nextId) {
    taskForm.value.datasetId = null
  } else {
    taskForm.value.datasetId = nextId
  }
  datasetDropdownOpen.value = false
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

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    refreshTasks({ silent: true })
    if (taskPanelMode.value === 'results' && selectedTaskId.value) {
      refreshTaskResults(selectedTaskId.value, { silent: true })
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
    refreshTasks({ silent: true })
    if (taskPanelMode.value === 'results' && selectedTaskId.value) {
      refreshTaskResults(selectedTaskId.value, { silent: true })
    }
  } else {
    stopPolling()
  }
}

const goPrevPage = () => {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
}

const goNextPage = () => {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
}

const refreshTasks = async ({ silent = false } = {}) => {
  if (!silent) isLoading.value = true
  if (!silent) setNotice('')

  try {
    const response = await fetchAgenticSynthesisTasks()
    const normalized = mapTaskList(response)
    tasks.value = normalized

    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value
    }

    if (!selectedTaskId.value && normalized.length > 0) {
      selectedTaskId.value = normalized[0].id
      await inspectTask(selectedTaskId.value, { silent: true })
      return
    }

    if (selectedTaskId.value) {
      const selectedInList = normalized.find((item) => item.id === selectedTaskId.value)
      if (!selectedInList && normalized.length > 0) {
        selectedTaskId.value = normalized[0].id
      }
      if (selectedTaskId.value) {
        await inspectTask(selectedTaskId.value, { silent: true })
      }
    }

    if (taskPanelMode.value === 'results' && selectedTaskId.value) {
      await refreshTaskResults(selectedTaskId.value, { silent: true })
    }
  } catch (error) {
    setNotice(`Backend unavailable. (${error?.message || 'unknown error'})`, 'error')
  } finally {
    if (!silent) isLoading.value = false
  }
}

const inspectTask = async (taskId, { silent = false } = {}) => {
  if (!taskId) return

  selectedTaskId.value = String(taskId)
  if (!silent) isLoading.value = true

  try {
    const response = await fetchAgenticSynthesisTask(selectedTaskId.value)
    const raw = response?.data ?? response
    selectedTask.value = mapTask(raw)
  } catch (error) {
    const fallback = tasks.value.find((item) => item.id === selectedTaskId.value)
    if (fallback) {
      selectedTask.value = fallback
    }
    if (!silent) {
      setNotice(`Failed to fetch task detail. (${error?.message || 'unknown error'})`, 'error')
    }
  } finally {
    if (!silent) isLoading.value = false
  }
}

const mapTaskResults = (raw) => {
  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : []

  return list.map((item, index) => ({
    id: String(item?.id || item?.result_id || `result-${index + 1}`),
    workspaceName: (() => {
      const workspaceRaw = item?.workspace
      const candidates = [
        item?.workspace_name,
        item?.workspaceName,
        item?.workspace_path,
        item?.workspacePath,
        item?.folder_name,
        item?.folderName,
        item?.folder,
        item?.dir_name,
        item?.directory,
        typeof workspaceRaw === 'string' ? workspaceRaw : null,
        typeof workspaceRaw === 'object' ? workspaceRaw?.name : null,
        typeof workspaceRaw === 'object' ? workspaceRaw?.path : null,
        typeof workspaceRaw === 'object' ? workspaceRaw?.id : null,
        item?.workspace_id,
        item?.workspaceId
      ]

      for (const value of candidates) {
        const text = String(value ?? '').trim()
        if (text) return text
      }
      return 'Workspace -'
    })(),
    question: String(item?.question || item?.question_text || ''),
    trajectory: String(item?.trajectory || item?.trajectory_text || item?.synthesis || ''),
    status: String(item?.status || item?.state || 'unknown').toLowerCase(),
    evaluation: typeof item?.evaluation === 'string'
      ? item.evaluation
      : item?.evaluation
        ? JSON.stringify(item.evaluation, null, 2)
        : ''
  }))
}

const groupedTaskResults = computed(() => {
  const groups = []
  const indexMap = new Map()

  for (const item of taskResults.value) {
    const key = String(item?.workspaceName || 'Workspace -')
    if (!indexMap.has(key)) {
      indexMap.set(key, groups.length)
      groups.push({ workspaceName: key, items: [] })
    }
    groups[indexMap.get(key)].items.push(item)
  }

  return groups
})

const previewText = (text, limit = 120) => {
  const content = String(text || '').trim()
  if (!content) return '-'
  return content.length <= limit ? content : `${content.slice(0, limit)}...`
}

const refreshTaskResults = async (taskId, { silent = false, reset = false } = {}) => {
  if (!taskId) return

  if (!silent) {
    isLoadingResults.value = true
  }
  if (reset) {
    taskResults.value = []
  }

  try {
    const response = await fetchAgenticSynthesisTaskResults(taskId)
    taskResults.value = mapTaskResults(response)
  } catch (error) {
    if (!silent) {
      setNotice(`Failed to fetch task results. (${error?.message || 'unknown error'})`, 'error')
    }
  } finally {
    if (!silent) {
      isLoadingResults.value = false
    }
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

const getResultModal = () => {
  if (!resultModalRef.value) return null
  resultModalInstance = Modal.getOrCreateInstance(resultModalRef.value)
  return resultModalInstance
}

const openResultField = (item, fieldLabel, fieldValue) => {
  resultModalTitle.value = `Result ${item?.id || ''} · ${String(fieldLabel || 'Detail')}`
  resultModalContent.value = String(fieldValue || '-')
  getResultModal()?.show()
}

const closeResultModal = () => {
  getResultModal()?.hide()
}

const startTask = async () => {
  if (!taskForm.value.prompt || !taskForm.value.llmBaseUrl || !taskForm.value.llmModelName) {
    setNotice('Please complete prompt and model fields before submitting.', 'error')
    return
  }
  if (taskForm.value.modelProvider === 'api' && !taskForm.value.llmApiKey) {
    setNotice('API model type requires LLM API Key.', 'error')
    return
  }
  if (!taskForm.value.datasetId) {
    setNotice('Please select one dataset.', 'error')
    return
  }

  isSubmitting.value = true
  setNotice('Starting task...', 'info')

  const selectedDatasetId = Number(taskForm.value.datasetId)
  if (!Number.isFinite(selectedDatasetId) || selectedDatasetId <= 0) {
    setNotice('Selected dataset is invalid.', 'error')
    isSubmitting.value = false
    return
  }

  const payload = {
    prompt: taskForm.value.prompt,
    action_tags: [...DEFAULT_ACTION_TAGS],
    llm_api_key: taskForm.value.modelProvider === 'local' ? 'local' : taskForm.value.llmApiKey,
    llm_base_url: taskForm.value.llmBaseUrl,
    llm_model_name: taskForm.value.llmModelName,
    dataset_id: selectedDatasetId
  }

  try {
    const response = await createAgenticSynthesisTask(payload)
    const created = response?.data ?? response
    const optimisticTask = mapTask(created)

    if (!tasks.value.some((item) => item.id === optimisticTask.id)) {
      tasks.value.unshift(optimisticTask)
    }

    selectedTaskId.value = optimisticTask.id
    taskPanelMode.value = 'tasks'
    await inspectTask(optimisticTask.id, { silent: true })
    setNotice('Task started successfully.', 'success')
  } catch (error) {
    setNotice(`Failed to start task. (${error?.message || 'backend error'})`, 'error')
  } finally {
    isSubmitting.value = false
    await refreshTasks({ silent: true })
  }
}

const hydrateQuerySelection = () => {
  const datasetId = Number(route.query.datasetId || 0)
  if (Number.isFinite(datasetId) && datasetId > 0 && datasetOptions.value.some((item) => Number(item.id) === datasetId)) {
    taskForm.value.datasetId = datasetId
  }
}

const openGeneratedDataset = () => {
  if (!selectedTask.value?.generatedDatasetId) return
  router.push(`/data-preparation/${selectedTask.value.generatedDatasetId}`)
}

const useTaskInDistillation = () => {
  if (!selectedTask.value?.id) return
  router.push({
    path: '/reasoning-data-distillation',
    query: {
      sourceType: 'trajectory_task',
      taskId: String(selectedTask.value.id)
    }
  })
}

const useTaskInChat = () => {
  if (!selectedTask.value?.id) return
  router.push({
    path: '/agent-interaction',
    query: {
      contextType: 'trajectory_task',
      contextId: String(selectedTask.value.id),
      contextLabel: getTaskDatasetName(selectedTask.value)
    }
  })
}

const importTaskIntoAssets = async () => {
  if (!selectedTask.value?.id) return
  try {
    await importPlatformAsset({
      source_type: 'trajectory_task',
      source_id: Number(selectedTask.value.id),
      target_folder_path: ''
    })
    setNotice(`Imported task #${selectedTask.value.id} into Agent Interaction assets.`, 'success')
  } catch (error) {
    setNotice(`Import failed. (${error?.message || 'unknown error'})`, 'error')
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutsideDatasetDropdown)
  await refreshDatasetOptions()
  await refreshTasks()
  if (autoRefresh.value) {
    startPolling()
  }
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

watch(
  () => route.query.datasetId,
  () => {
    hydrateQuerySelection()
  }
)
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

.workspace-group {
  border: 1px solid #e1e9f5;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.workspace-group-title {
  padding: 0.45rem 0.65rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #2a4166;
  background: #f6f9ff;
  border-bottom: 1px solid #e1e9f5;
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

.task-config-form {
  row-gap: 0.7rem !important;
}

.task-table-centered th,
.task-table-centered td {
  text-align: center;
  vertical-align: middle;
}

.task-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
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

@media (max-width: 992px) {
  .task-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
