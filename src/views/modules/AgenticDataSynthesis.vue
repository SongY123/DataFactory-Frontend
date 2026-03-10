<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Agentic Data Synthesis</h4>
        <p class="text-muted mb-0">Configure synthesis prompts and monitor task execution progress from the backend agentic workflow.</p>
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

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

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
                <span class="small text-muted">Trajectory example in prompt follows current Action Tags.</span>
                <button class="btn btn-link btn-sm py-0" type="button" @click="resetPromptToTemplate">
                  Reset to Template
                </button>
              </div>

              <label class="small text-muted mb-0 mt-1">Action Tags (comma separated)</label>
              <input
                v-model.trim="taskForm.actionTags"
                type="text"
                class="form-control"
                placeholder="schema-align, pii-redaction, diversity-boost"
              >

              <div class="row g-2 mt-1">
                <div class="col-12 col-md-4">
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
                  <label class="small text-muted mb-1">Base URL</label>
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
                  <button class="btn btn-link btn-sm py-0" type="button" @click="addDatasetRow">+ Add Dataset</button>
                </div>

                <div class="d-flex flex-column gap-2">
                  <div v-for="(item, index) in taskForm.datasets" :key="`dataset-${index}`" class="dataset-row">
                    <input
                      v-model.trim="item.name"
                      type="text"
                      class="form-control form-control-sm"
                      placeholder="Dataset name"
                    >
                    <input
                      v-model.trim="item.uri"
                      type="text"
                      class="form-control form-control-sm"
                      placeholder="Dataset URI / path"
                    >
                    <button
                      class="btn btn-outline-danger btn-sm"
                      type="button"
                      title="Remove"
                      @click="removeDatasetRow(index)"
                      :disabled="taskForm.datasets.length <= 1"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <label class="small text-muted mb-0 mt-1">Output File Path</label>
              <input
                v-model.trim="taskForm.outputFilePath"
                type="text"
                class="form-control"
                placeholder="./outputs/agentic_synthesis.json"
              >

              <button class="btn btn-primary mt-1" type="submit" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Start Agentic Synthesis Task
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
              <h6 class="card-title mb-0">Task Status Overview</h6>
              <span class="small text-muted">Latest {{ tasks.length }} tasks</span>
            </div>

            <div class="table-responsive task-overview-table-wrap">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                <tr>
                  <th>Task ID</th>
                  <th>Status</th>
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
                  @click="inspectTask(task.id)"
                >
                  <td>{{ task.id }}</td>
                  <td>
                    <span class="badge" :class="statusClass(task.status)">{{ task.status }}</span>
                  </td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div class="progress flex-grow-1" role="progressbar" :aria-valuenow="task.progress" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" :style="{ width: `${task.progress}%` }"></div>
                      </div>
                      <span class="small text-muted">{{ task.progress }}%</span>
                    </div>
                  </td>
                  <td>{{ task.createdAtDisplay }}</td>
                  <td>{{ task.updatedAtDisplay }}</td>
                </tr>
                </tbody>
              </table>
            </div>

            <div class="d-flex align-items-center justify-content-between mt-2">
              <div class="small text-muted">Page {{ currentPage }} / {{ totalPages }}</div>
              <div class="btn-group btn-group-sm" role="group" aria-label="Task pagination">
                <button class="btn btn-outline-secondary" type="button" :disabled="currentPage <= 1" @click="goPrevPage">
                  Prev
                </button>
                <button class="btn btn-outline-secondary" type="button" :disabled="currentPage >= totalPages" @click="goNextPage">
                  Next
                </button>
              </div>
            </div>

            <div class="small text-muted mt-1">
              Click one task row to inspect full metadata and backend execution result.
            </div>
          </div>
        </article>

        <article class="card border-0 shadow-sm mt-3">
          <div class="card-body">
            <h6 class="card-title mb-2">Selected Task Details</h6>
            <div v-if="selectedTask" class="task-detail-grid">
              <div>
                <div class="small text-muted">Task ID</div>
                <div class="fw-semibold">{{ selectedTask.id }}</div>
              </div>
              <div>
                <div class="small text-muted">Status</div>
                <div>
                  <span class="badge" :class="statusClass(selectedTask.status)">{{ selectedTask.status }}</span>
                </div>
              </div>
              <div>
                <div class="small text-muted">Progress</div>
                <div class="fw-semibold">{{ selectedTask.progress }}%</div>
              </div>
              <div>
                <div class="small text-muted">Output Path</div>
                <div class="text-break">{{ selectedTask.outputPath || '-' }}</div>
              </div>
            </div>
            <div v-else class="small text-muted">No task selected.</div>

            <hr>

            <div class="small text-muted mb-1">Raw Payload</div>
            <pre class="payload-box mb-0">{{ selectedTaskRaw }}</pre>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createAgenticSynthesisTask,
  fetchAgenticSynthesisTask,
  fetchAgenticSynthesisTasks
} from '../../api/dataAgent'

const DEFAULT_ACTION_TAGS = 'Analyze, Understand, Code, Execute, Answer'

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')
const autoRefresh = ref(true)

const tasks = ref([])
const selectedTaskId = ref(null)
const selectedTask = ref(null)
const selectedTaskRaw = ref('{}')
const currentPage = ref(1)
const pageSize = 5

const buildTrajectoryExample = (actionTags = []) =>
  actionTags.map((tag) => `<${tag}>...</${tag}>`).join('')

const buildDefaultPrompt = (actionTags = []) => {
  const trajectoryExample = buildTrajectoryExample(actionTags)
  return `You are generating synthetic interaction trajectories to train a data-analysis agent.

Task requirements:
1) Read the provided data file content and create exactly one question in one sentence.
2) The question type must be exactly one of:
   - Data Preparation
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

const defaultActionTagList = DEFAULT_ACTION_TAGS.split(',').map((item) => item.trim()).filter(Boolean)
const isPromptCustomized = ref(false)

const taskForm = ref({
  prompt: buildDefaultPrompt(defaultActionTagList),
  actionTags: DEFAULT_ACTION_TAGS,
  llmApiKey: '',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmModelName: 'gpt-4o-mini',
  datasets: [{ name: 'agent_dialog_zh_v3', uri: '' }],
  outputFilePath: './outputs/agentic_synthesis.json'
})

let pollTimer = null

const statsCards = computed(() => {
  const total = tasks.value.length
  const running = tasks.value.filter((item) => ['running', 'queued', 'pending', 'in_progress'].includes(item.status)).length
  const done = tasks.value.filter((item) => ['completed', 'success', 'done', 'finished'].includes(item.status)).length

  return [
    { label: 'Total Tasks', value: total },
    { label: 'Running Tasks', value: running },
    { label: 'Completed Tasks', value: done }
  ]
})

const totalPages = computed(() => {
  const pages = Math.ceil(tasks.value.length / pageSize)
  return pages > 0 ? pages : 1
})

const pagedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return tasks.value.slice(start, start + pageSize)
})

const parseActionTags = (raw) =>
  String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const markPromptCustomized = () => {
  isPromptCustomized.value = true
}

const resetPromptToTemplate = () => {
  isPromptCustomized.value = false
  taskForm.value.prompt = buildDefaultPrompt(parseActionTags(taskForm.value.actionTags))
}

watch(
  () => taskForm.value.actionTags,
  (tagsRaw) => {
    if (isPromptCustomized.value) return
    taskForm.value.prompt = buildDefaultPrompt(parseActionTags(tagsRaw))
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

const mapTask = (item, index = 0) => ({
  id: String(item?.id || item?.task_id || `task-${index + 1}`),
  status: String(item?.status || item?.state || 'pending').toLowerCase(),
  progress: normalizeProgress(item),
  createdAt: String(item?.created_at || item?.insert_time || item?.createdAt || '-'),
  updatedAt: String(item?.updated_at || item?.update_time || item?.updatedAt || '-'),
  createdAtDisplay: formatDateTime(item?.created_at || item?.insert_time || item?.createdAt || '-'),
  updatedAtDisplay: formatDateTime(item?.updated_at || item?.update_time || item?.updatedAt || '-'),
  outputPath: String(item?.output_file_path || item?.outputPath || '-')
})

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

const statusClass = (status) => {
  if (['completed', 'success', 'done', 'finished'].includes(status)) return 'bg-success-subtle text-success-emphasis'
  if (['running', 'in_progress', 'queued', 'pending'].includes(status)) return 'bg-primary-subtle text-primary-emphasis'
  if (['failed', 'error', 'cancelled', 'aborted'].includes(status)) return 'bg-danger-subtle text-danger-emphasis'
  return 'bg-light text-dark'
}

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    refreshTasks({ silent: true })
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
  notice.value = ''

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
  } catch (error) {
    notice.value = `Backend unavailable. (${error?.message || 'unknown error'})`
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
    selectedTaskRaw.value = JSON.stringify(raw, null, 2)
    selectedTask.value = mapTask(raw)
  } catch (error) {
    const fallback = tasks.value.find((item) => item.id === selectedTaskId.value)
    if (fallback) {
      selectedTask.value = fallback
      selectedTaskRaw.value = JSON.stringify(fallback, null, 2)
    }
    if (!silent) {
      notice.value = `Failed to fetch task detail. (${error?.message || 'unknown error'})`
    }
  } finally {
    if (!silent) isLoading.value = false
  }
}

const addDatasetRow = () => {
  taskForm.value.datasets.push({ name: '', uri: '' })
}

const removeDatasetRow = (index) => {
  if (taskForm.value.datasets.length <= 1) return
  taskForm.value.datasets.splice(index, 1)
}

const startTask = async () => {
  if (!taskForm.value.prompt || !taskForm.value.llmApiKey || !taskForm.value.llmBaseUrl || !taskForm.value.llmModelName) {
    notice.value = 'Please complete prompt and LLM connection fields before submitting.'
    return
  }

  isSubmitting.value = true
  notice.value = ''

  let normalizedOutputFilePath = String(taskForm.value.outputFilePath || '').trim()
  if (normalizedOutputFilePath && !normalizedOutputFilePath.toLowerCase().endsWith('.json')) {
    normalizedOutputFilePath = `${normalizedOutputFilePath}.json`
    taskForm.value.outputFilePath = normalizedOutputFilePath
  }

  const payload = {
    prompt: taskForm.value.prompt,
    action_tags: parseActionTags(taskForm.value.actionTags),
    llm_api_key: taskForm.value.llmApiKey,
    llm_base_url: taskForm.value.llmBaseUrl,
    llm_model_name: taskForm.value.llmModelName,
    datasets: taskForm.value.datasets
      .filter((item) => item.name || item.uri)
      .map((item, index) => ({
        id: index + 1,
        name: item.name || `dataset-${index + 1}`,
        uri: item.uri || ''
      })),
    output_file_path: normalizedOutputFilePath || ''
  }

  try {
    const response = await createAgenticSynthesisTask(payload)
    const created = response?.data ?? response
    const optimisticTask = mapTask(created)

    if (!tasks.value.some((item) => item.id === optimisticTask.id)) {
      tasks.value.unshift(optimisticTask)
    }

    selectedTaskId.value = optimisticTask.id
    await inspectTask(optimisticTask.id, { silent: true })
    notice.value = 'Agentic synthesis task started successfully.'
  } catch (error) {
    notice.value = `Failed to start task. (${error?.message || 'backend error'})`
  } finally {
    isSubmitting.value = false
    await refreshTasks({ silent: true })
  }
}

onMounted(() => {
  refreshTasks()
  if (autoRefresh.value) {
    startPolling()
  }
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.synthesis-main-row {
  align-items: flex-start;
}

.dataset-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr auto;
  gap: 0.5rem;
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
  height: 230px;
  max-height: 230px;
  min-height: 230px;
  overflow: auto;
}

.right-panel-col {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.task-config-form {
  row-gap: 0.7rem !important;
}

.task-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
}

.payload-box {
  border: 1px solid #dbe4f0;
  background: #fbfdff;
  border-radius: 10px;
  padding: 0.75rem;
  max-height: 260px;
  overflow: auto;
  font-size: 0.82rem;
}

@media (max-width: 992px) {
  .dataset-row {
    grid-template-columns: 1fr;
  }

  .task-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>