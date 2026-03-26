<template>
  <div class="workflow-module-shell" :style="{ '--chat-panel-width': `${resolvedChatPanelWidth}px` }">
    <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Agentic Trajectory Synthesis</h4>
        <p class="text-muted mb-0">Construct grounded multi-step action trajectories through data interactions</p>
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
              <SandboxEnvironmentSelector
                v-model="taskForm.sandboxEnvironmentId"
                label="Environment"
                description="Choose the Python sandbox used for trajectory execution."
                :disabled="isSubmitting"
              />

              <div class="prompt-toolbar">
                <div class="prompt-tab-bar" role="tablist" aria-label="Trajectory prompt configuration tabs">
                  <button
                    class="prompt-tab-btn active"
                    type="button"
                  >
                    Synthesis Prompt
                  </button>
                </div>
                <button class="btn btn-link btn-sm py-0 prompt-reset-btn" type="button" @click="resetPromptToTemplate">Reset to Template</button>
              </div>
              <textarea
                v-model="taskForm.prompt"
                @input="markPromptCustomized"
                class="form-control prompt-textarea"
                rows="11"
                required
              ></textarea>
              <div class="prompt-placeholder-panel">
                <div class="small text-muted">Placeholders</div>
                <div v-if="promptPlaceholders.length" class="prompt-placeholder-list">
                  <span
                    v-for="placeholder in promptPlaceholders"
                    :key="`trajectory-prompt-chip-${placeholder}`"
                    class="prompt-placeholder-chip"
                    :class="placeholderToneClass(placeholder)"
                  >
                    {{ '{' + placeholder + '}' }}
                  </span>
                </div>
                <div v-else class="small text-muted">No placeholders detected.</div>
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
                          :checked="taskForm.datasetIds.includes(Number(item.id))"
                          @change="selectDataset(item.id)"
                        >
                        <span class="small">{{ item.name }}</span>
                      </label>
                    </div>
                  </div>

                  <div v-if="selectedDatasetItems.length" class="selected-dataset-list">
                    <div
                      v-for="item in selectedDatasetItems"
                      :key="`selected-dataset-${item.id}`"
                      class="selected-dataset-chip"
                    >
                      <span class="selected-dataset-name">{{ item.name }}</span>
                      <button
                        class="selected-dataset-settings"
                        type="button"
                        :aria-label="`Configure ${item.name}`"
                        @click.stop="noopDatasetSettings"
                      >
                        <i class="bi bi-gear"></i>
                      </button>
                      <button
                        class="selected-dataset-remove"
                        type="button"
                        :aria-label="`Remove ${item.name}`"
                        @click="removeSelectedDataset(item.id)"
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
                    v-model.trim="taskForm.savePath"
                    type="text"
                    class="form-control"
                    placeholder="Leave empty to use backend default output path"
                  >
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    :title="browseSavePathTitle"
                    @click="browseSavePath"
                  >
                    Browse
                  </button>
                </div>
                <div class="small text-muted mt-1">
                  {{ savePathHelperText }}
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
                        v-model.number="taskForm.parallelism"
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
                        v-model="taskForm.llmParamsJson"
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

        <article class="card border-0 shadow-sm mt-3 task-overview-card">
          <div class="card-body d-flex flex-column gap-2 h-100">
            <div class="d-flex align-items-center justify-content-between">
              <h6 class="card-title mb-0">{{ taskPanelMode === 'tasks' ? 'Task List' : `Synthesis Results · Task ${selectedTaskId || '-'}` }}</h6>
              <div class="d-flex align-items-center gap-2">
                <span class="small text-muted" v-if="taskPanelMode === 'tasks'">Latest {{ tasks.length }} tasks</span>
                <button
                  v-if="taskPanelMode === 'results'"
                  class="btn btn-outline-secondary btn-sm task-back-btn"
                  type="button"
                  title="Back to Tasks"
                  aria-label="Back to Tasks"
                  @click="backToTaskList"
                >
                  <i class="bi bi-arrow-left"></i>
                </button>
              </div>
            </div>

            <div v-if="taskPanelMode === 'results' && selectedTask" class="task-progress-panel">
              <div class="task-progress-head">
                <div>
                  <div class="small text-muted">Current Task Progress</div>
                  <div class="fw-semibold">{{ getTaskDatasetName(selectedTask) }}</div>
                </div>
                <div class="small text-muted">{{ selectedTask.workspaceProgressText }}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <div class="progress flex-grow-1" role="progressbar" :aria-valuenow="selectedTask.progress" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar" :style="{ width: `${selectedTask.progress}%` }"></div>
                </div>
                <span class="small text-muted progress-percent">{{ selectedTask.progress }}%</span>
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
                      <SynthesisResultsTable
                        :rows="group.items"
                        :columns="trajectoryResultsColumns"
                        :get-status-class="statusClass"
                        :overlay-title="`Agentic Trajectory Synthesis · ${group.workspaceName}`"
                        :count-label-text="`${group.items.length} results`"
                        empty-text="No synthesis results for this workspace."
                        @cell-open="openTrajectoryResultCell"
                      />
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
        page-key="agentic_trajectory_synthesis"
        page-title="Agentic Trajectory Synthesis"
        page-description="Ask about prompts, datasets, environments, save paths, and trajectory synthesis settings."
        :page-context="factoryAgentPageContext"
        @collapse-change="handleChatCollapseChange"
        @apply-prompt="handleFactoryAgentPromptApply"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import SandboxEnvironmentSelector from '../../components/SandboxEnvironmentSelector.vue'
import SynthesisResultsTable from '../../components/SynthesisResultsTable.vue'
import WorkflowAgentChatPanel from '../../components/WorkflowAgentChatPanel.vue'
import { formatAppDateTime } from '../../utils/datetime'
import { chooseLocalDirectory, isElectronRuntime } from '../../utils/desktop'
import {
  createAgenticSynthesisTask,
  fetchAgenticSynthesisTaskResults,
  fetchAgenticSynthesisTask,
  fetchAgenticSynthesisTasks,
  fetchDatasets,
  fetchUserPreference,
  importPlatformAsset,
  saveUserPreference
} from '../../api/dataAgent'

const DEFAULT_ACTION_TAGS = ['Analyze', 'Understand', 'Code', 'Execute', 'Answer']
const trajectoryResultsColumns = [
  { key: 'question', label: 'Question', width: '22rem', expandedWidth: '28rem' },
  { key: 'trajectory', label: 'Trajectory', width: '28rem', expandedWidth: '40rem' },
  { key: 'status', label: 'Status', width: '8rem', kind: 'status' },
  { key: 'evaluation', label: 'Evaluation', width: '18rem', expandedWidth: '24rem' }
]
const route = useRoute()
const router = useRouter()
const CHAT_PANEL_MIN_WIDTH = 280
const CHAT_PANEL_MAX_WIDTH = 620
const CHAT_PANEL_COLLAPSED_WIDTH = 96
const CHAT_PANEL_STORAGE_KEY = 'trajectorySynthesisChatPanelWidth'

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')
const noticeType = ref('info')
const canBrowseLocalDirectory = isElectronRuntime()
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
const chatPanelWidth = ref(readStoredChatPanelWidth())
const isChatCollapsed = ref(false)
const resultModalTitle = ref('Result Detail')
const resultModalContent = ref('')
let resultModalInstance = null
let chatResizeCleanup = null

const API_LLM_BASE_URL = 'https://api.openai.com/v1'
const API_LLM_MODEL_NAME = 'gpt-4o-mini'
const LOCAL_LLM_BASE_URL = 'http://127.0.0.1:11434/v1'
const LOCAL_LLM_MODEL_NAME = 'qwen2.5:7b-instruct'
const TRAJECTORY_PREFERENCE_KEY = 'trajectory_synthesis'
const DEFAULT_LLM_PARAMS_TEMPLATE = {
  temperature: 0.2,
  top_p: 0.95,
  max_tokens: 4096
}
const PROMPT_PLACEHOLDER_TONES = ['tone-blue', 'tone-green', 'tone-amber', 'tone-rose', 'tone-cyan', 'tone-violet']
const PROMPT_PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g

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

Seed question placeholder:
{question}

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
const advancedConfigOpen = ref(false)
const isHydratingPreference = ref(false)

const taskForm = ref({
  prompt: buildDefaultPrompt(),
  modelProvider: 'api',
  llmApiKey: '',
  llmBaseUrl: API_LLM_BASE_URL,
  llmModelName: API_LLM_MODEL_NAME,
  datasetIds: [],
  parallelism: 1,
  savePath: '',
  sandboxEnvironmentId: '',
  llmParamsJson: JSON.stringify(DEFAULT_LLM_PARAMS_TEMPLATE, null, 2)
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
  return datasetOptions.value
    .filter((item) => taskForm.value.datasetIds.includes(Number(item.id)))
    .map((item) => item.name)
})

const selectedDatasetItems = computed(() => {
  return datasetOptions.value.filter((item) => taskForm.value.datasetIds.includes(Number(item.id)))
})

const factoryAgentPageContext = computed(() => ({
  active_prompt_tab: 'synthesis',
  synthesis_prompt: String(taskForm.value.prompt || ''),
  default_synthesis_prompt: buildDefaultPrompt(),
  default_action_tags: [...DEFAULT_ACTION_TAGS],
  selected_dataset_ids: taskForm.value.datasetIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0),
  selected_dataset_names: [...selectedDatasetNames.value],
  selected_task: selectedTask.value
    ? {
        id: selectedTask.value.id,
        status: selectedTask.value.status,
        dataset_name: getTaskDatasetName(selectedTask.value),
        progress: selectedTask.value.progress
      }
    : null
}))

const promptPlaceholders = computed(() => {
  const promptText = String(taskForm.value.prompt || '')
  const matches = promptText.match(PROMPT_PLACEHOLDER_PATTERN) || []
  const values = []
  const seen = new Set()
  matches.forEach((match) => {
    const normalized = match.slice(1, -1).trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    values.push(normalized)
  })
  return values
})

const placeholderToneClass = (placeholder) => {
  const normalized = String(placeholder || '').trim()
  const index = promptPlaceholders.value.findIndex((item) => item === normalized)
  return PROMPT_PLACEHOLDER_TONES[index >= 0 ? index % PROMPT_PLACEHOLDER_TONES.length : 0]
}

const datasetDropdownLabel = computed(() => {
  if (!taskForm.value.datasetIds.length) return 'Select datasets'
  if (taskForm.value.datasetIds.length === 1) return selectedDatasetNames.value[0] || 'Select datasets'
  return `${taskForm.value.datasetIds.length} datasets selected`
})

const browseSavePathTitle = computed(() => {
  if (canBrowseLocalDirectory) return 'Choose a local directory'
  return 'Directory browsing is available in the Electron desktop app only'
})

const savePathHelperText = computed(() => {
  if (taskForm.value.savePath) return taskForm.value.savePath
  if (canBrowseLocalDirectory) return 'Choose a local directory on this computer.'
  return 'Browser mode cannot open a local directory chooser. Enter an absolute path manually or use the Electron desktop app.'
})

const resolvedChatPanelWidth = computed(() => (isChatCollapsed.value ? CHAT_PANEL_COLLAPSED_WIDTH : chatPanelWidth.value))

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

function handleFactoryAgentPromptApply(payload) {
  const prompt = String(payload?.prompt || '').trim()
  if (!prompt) return
  taskForm.value.prompt = prompt
  isPromptCustomized.value = true
  const changes = Array.isArray(payload?.changes)
    ? payload.changes.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const actionSequence = Array.isArray(payload?.actionSequence || payload?.action_sequence)
    ? (payload?.actionSequence || payload?.action_sequence).map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const summaryParts = []
  if (changes.length) {
    summaryParts.push(changes.slice(0, 3).join(' · '))
  }
  if (actionSequence.length) {
    summaryParts.push(`Action sequence: ${actionSequence.join(' → ')}`)
  }
  const suffix = summaryParts.length ? ` ${summaryParts.join(' | ')}` : ''
  // setNotice(`Applied Synthesis Prompt from Factory Agent.${suffix}`, 'success')
  void persistPreference()
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

const markPromptCustomized = () => {
  isPromptCustomized.value = true
}

const clampParallelism = (value) => Math.max(1, Math.min(32, Number(value) || 1))

const buildPreferencePayload = () => ({
  prompt: String(taskForm.value.prompt || ''),
  modelProvider: taskForm.value.modelProvider === 'local' ? 'local' : 'api',
  llmApiKey: String(taskForm.value.llmApiKey || ''),
  llmBaseUrl: String(taskForm.value.llmBaseUrl || ''),
  llmModelName: String(taskForm.value.llmModelName || ''),
  datasetIds: taskForm.value.datasetIds
    .map((id) => Number(id))
    .filter((id, index, array) => Number.isFinite(id) && id > 0 && array.indexOf(id) === index),
  parallelism: clampParallelism(taskForm.value.parallelism),
  savePath: String(taskForm.value.savePath || ''),
  sandboxEnvironmentId: String(taskForm.value.sandboxEnvironmentId || ''),
  llmParamsJson: String(taskForm.value.llmParamsJson || ''),
  advancedConfigOpen: !!advancedConfigOpen.value
})

const hydratePreferencePayload = (value) => {
  if (!value || typeof value !== 'object') return

  isHydratingPreference.value = true
  try {
    const provider = value.modelProvider === 'local' ? 'local' : 'api'
    taskForm.value.modelProvider = provider
    taskForm.value.prompt = String(value.prompt || '').trim() || buildDefaultPrompt()
    taskForm.value.llmApiKey = String(value.llmApiKey || '')
    taskForm.value.llmBaseUrl = String(value.llmBaseUrl || '').trim() || (provider === 'local' ? LOCAL_LLM_BASE_URL : API_LLM_BASE_URL)
    taskForm.value.llmModelName = String(value.llmModelName || '').trim() || (provider === 'local' ? LOCAL_LLM_MODEL_NAME : API_LLM_MODEL_NAME)
    taskForm.value.datasetIds = Array.isArray(value.datasetIds)
      ? value.datasetIds
        .map((id) => Number(id))
        .filter((id, index, array) => Number.isFinite(id) && id > 0 && array.indexOf(id) === index)
      : []
    taskForm.value.parallelism = clampParallelism(value.parallelism)
    taskForm.value.savePath = String(value.savePath || '').trim()
    taskForm.value.sandboxEnvironmentId = String(value.sandboxEnvironmentId || '').trim()
    taskForm.value.llmParamsJson = String(value.llmParamsJson || '').trim() || JSON.stringify(DEFAULT_LLM_PARAMS_TEMPLATE, null, 2)
    advancedConfigOpen.value = !!value.advancedConfigOpen
    isPromptCustomized.value = taskForm.value.prompt !== buildDefaultPrompt()
  } finally {
    isHydratingPreference.value = false
  }
}

const loadStoredPreference = async () => {
  try {
    const response = await fetchUserPreference(TRAJECTORY_PREFERENCE_KEY)
    hydratePreferencePayload(response?.data?.value ?? null)
  } catch {
    // preference loading is best-effort
  }
}

const persistPreference = async () => {
  await saveUserPreference(TRAJECTORY_PREFERENCE_KEY, buildPreferencePayload())
}

const resetPromptToTemplate = () => {
  isPromptCustomized.value = false
  taskForm.value.prompt = buildDefaultPrompt()
}

const applyDefaultLlmParamsTemplate = () => {
  taskForm.value.llmParamsJson = JSON.stringify(DEFAULT_LLM_PARAMS_TEMPLATE, null, 2)
  advancedConfigOpen.value = true
}

const clearLlmParamsTemplate = () => {
  taskForm.value.llmParamsJson = ''
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
  if (!canBrowseLocalDirectory) {
    setNotice('Browse is available only in the Electron desktop app. In browser mode, enter an absolute path manually.', 'info')
    return
  }
  const selected = await chooseLocalDirectory()
  if (selected) {
    taskForm.value.savePath = selected
  }
}

watch(
  () => taskForm.value.modelProvider,
  (provider) => {
    if (isHydratingPreference.value) return
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

const formatDateTime = (value) => formatAppDateTime(value)

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
    taskForm.value.datasetIds = taskForm.value.datasetIds.filter((id) => validIds.has(Number(id)))
    hydrateQuerySelection()
  } catch {
    datasetOptions.value = []
    taskForm.value.datasetIds = []
  }
}

const selectDataset = (datasetId) => {
  const nextId = Number(datasetId)
  if (!Number.isFinite(nextId) || nextId <= 0) return
  if (taskForm.value.datasetIds.includes(nextId)) {
    taskForm.value.datasetIds = taskForm.value.datasetIds.filter((id) => Number(id) !== nextId)
    return
  }
  taskForm.value.datasetIds = [...taskForm.value.datasetIds, nextId]
}

const removeSelectedDataset = (datasetId) => {
  const targetId = Number(datasetId)
  if (!Number.isFinite(targetId) || targetId <= 0) return
  taskForm.value.datasetIds = taskForm.value.datasetIds.filter((id) => Number(id) !== targetId)
}

const noopDatasetSettings = () => {}

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
  resultModalInstance = Modal.getOrCreateInstance(resultModalRef.value, {
    backdrop: false
  })
  return resultModalInstance
}

const openResultField = (item, fieldLabel, fieldValue) => {
  resultModalTitle.value = `Result ${item?.id || ''} · ${String(fieldLabel || 'Detail')}`
  resultModalContent.value = String(fieldValue || '-')
  getResultModal()?.show()
}

const openTrajectoryResultCell = ({ row, column, value }) => {
  openResultField(row, column?.label || 'Detail', value)
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
  if (!taskForm.value.datasetIds.length) {
    setNotice('Please select at least one dataset.', 'error')
    return
  }

  isSubmitting.value = true
  // setNotice('Starting tasks...', 'info')

  const selectedDatasetIds = taskForm.value.datasetIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)

  if (!selectedDatasetIds.length) {
    setNotice('Selected datasets are invalid.', 'error')
    isSubmitting.value = false
    return
  }

  try {
    const llmParamsJson = normalizeLlmParamsJson(taskForm.value.llmParamsJson)
    try {
      await persistPreference()
    } catch {
      // keep task submission usable even if preference persistence fails
    }
    const response = await createAgenticSynthesisTask({
      prompt: taskForm.value.prompt,
      action_tags: [...DEFAULT_ACTION_TAGS],
      llm_api_key: taskForm.value.modelProvider === 'local' ? 'local' : taskForm.value.llmApiKey,
      llm_base_url: taskForm.value.llmBaseUrl,
      llm_model_name: taskForm.value.llmModelName,
      dataset_ids: selectedDatasetIds,
      parallelism: clampParallelism(taskForm.value.parallelism),
      save_path: String(taskForm.value.savePath || '').trim() || undefined,
      sandbox_environment_id: String(taskForm.value.sandboxEnvironmentId || '').trim() || undefined,
      llm_params_json: llmParamsJson
    })

    const createdTask = mapTask(response?.data ?? response)
    if (!tasks.value.some((item) => item.id === createdTask.id)) {
      tasks.value.unshift(createdTask)
    }

    selectedTaskId.value = createdTask?.id || null
    taskPanelMode.value = 'tasks'
    if (createdTask?.id) {
      await inspectTask(createdTask.id, { silent: true })
    }
    // setNotice('Task started successfully.', 'success')
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
    taskForm.value.datasetIds = [datasetId]
    return
  }
  if (route.query.datasetId != null && route.query.datasetId !== '') {
    taskForm.value.datasetIds = []
  }
}

const openGeneratedDataset = () => {
  if (!selectedTask.value?.generatedDatasetId) return
  router.push(`/data-preparation/${selectedTask.value.generatedDatasetId}`)
}

const useTaskInDistillation = () => {
  if (!selectedTask.value?.id) return
  const datasetId = Number(selectedTask.value.generatedDatasetId || selectedTask.value.datasetId || 0)
  router.push({
    path: '/reasoning-data-distillation',
    query: datasetId > 0 ? { datasetId: String(datasetId) } : {}
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
  await loadStoredPreference()
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
  stopChatResize()
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

.module-page {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow: auto;
  padding-right: 0.2rem;
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
  align-items: stretch;
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

  .module-page {
    overflow: visible;
  }
}

.synthesis-main-row > [class*='col-'] {
  display: flex;
  flex-direction: column;
}

.prompt-textarea {
  min-height: 260px;
  resize: vertical;
  font-size: 0.9rem;
  line-height: 1.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.prompt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.prompt-tab-bar {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #f7faff;
  width: fit-content;
  max-width: 100%;
}

.prompt-tab-btn {
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #5f7392;
  padding: 0.38rem 0.68rem;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.2;
}

.prompt-tab-btn.active {
  background: #ffffff;
  color: #174d94;
  box-shadow: 0 6px 16px rgba(23, 77, 148, 0.1);
}

.prompt-reset-btn {
  margin-left: auto;
  white-space: nowrap;
}

.prompt-placeholder-panel {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.1rem 0;
}

.prompt-placeholder-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.prompt-placeholder-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.78rem;
  font-weight: 600;
}

.prompt-placeholder-chip.tone-blue {
  color: #0b63d1;
  background: rgba(11, 99, 209, 0.14);
  border-color: rgba(11, 99, 209, 0.2);
}

.prompt-placeholder-chip.tone-green {
  color: #18794e;
  background: rgba(24, 121, 78, 0.14);
  border-color: rgba(24, 121, 78, 0.2);
}

.prompt-placeholder-chip.tone-amber {
  color: #9a5a00;
  background: rgba(203, 132, 0, 0.16);
  border-color: rgba(203, 132, 0, 0.22);
}

.prompt-placeholder-chip.tone-rose {
  color: #b42363;
  background: rgba(180, 35, 99, 0.14);
  border-color: rgba(180, 35, 99, 0.2);
}

.prompt-placeholder-chip.tone-cyan {
  color: #0f6d7a;
  background: rgba(15, 109, 122, 0.14);
  border-color: rgba(15, 109, 122, 0.2);
}

.prompt-placeholder-chip.tone-violet {
  color: #6d3cc5;
  background: rgba(109, 60, 197, 0.14);
  border-color: rgba(109, 60, 197, 0.2);
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

.selected-dataset-settings,
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

.selected-dataset-settings:hover,
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

.task-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
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
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}

.task-overview-card :deep(.card-body) {
  flex: 1;
  min-height: 0;
}

.task-overview-table-wrap {
  flex: 0 0 auto;
  height: 500px;
  min-height: 500px;
  max-height: 500px;
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
  min-height: 0;
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

.task-progress-panel {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #f8fbff;
}

.task-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.progress-percent {
  min-width: 3rem;
  text-align: right;
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

  .task-progress-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
