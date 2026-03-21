<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Reasoning Data Synthesis</h4>
        <p class="text-muted mb-0">Synthesize reusable reasoning datasets from uploaded datasets or trajectory task outputs.</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="refreshAll" :disabled="isLoading || isSubmitting">
          <span v-if="isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
          Refresh
        </button>
        <button class="btn btn-outline-primary btn-sm" type="button" @click="toggleAutoRefresh">
          {{ autoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-xxl-5">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body d-flex flex-column gap-3">
            <h6 class="card-title mb-0">Reasoning Data Synthesis Config</h6>

            <form class="d-flex flex-column gap-2" @submit.prevent="startTask">
              <label class="small text-muted mb-0">Source Type</label>
              <select v-model="form.sourceType" class="form-select">
                <option value="dataset">Dataset</option>
                <option value="trajectory_task">Trajectory Task</option>
              </select>

              <template v-if="form.sourceType === 'dataset'">
                <label class="small text-muted mb-0 mt-1">Source Dataset</label>
                <select v-model="form.sourceDatasetId" class="form-select" required>
                  <option disabled value="">Select dataset</option>
                  <option v-for="item in datasetOptions" :key="`dataset-${item.id}`" :value="String(item.id)">{{ item.name }}</option>
                </select>
              </template>

              <template v-else>
                <label class="small text-muted mb-0 mt-1">Trajectory Task</label>
                <select v-model="form.sourceTaskId" class="form-select" required>
                  <option disabled value="">Select trajectory task</option>
                  <option v-for="item in trajectoryTaskOptions" :key="`task-${item.id}`" :value="String(item.id)">{{ item.label }}</option>
                </select>
              </template>

              <label class="small text-muted mb-0 mt-1">Synthesis Strategy</label>
              <select v-model="form.strategy" class="form-select" required>
                <option value="step-pruning">Step Pruning</option>
                <option value="self-consistency">Self-Consistency Voting</option>
                <option value="error-aware">Error-Aware Synthesis</option>
              </select>

              <div class="row g-2 mt-1">
                <div class="col-12 col-md-6">
                  <label class="small text-muted mb-1">Target Max Tokens</label>
                  <input v-model.number="form.targetMaxTokens" type="number" class="form-control" min="128" step="128" required>
                </div>
                <div class="col-12 col-md-6">
                  <label class="small text-muted mb-1">Compression Ratio</label>
                  <input v-model.number="form.compressionRatio" type="number" class="form-control" min="0.1" max="1" step="0.05" required>
                </div>
              </div>

              <div class="form-check mt-1">
                <input id="keep_tool_trace" v-model="form.keepToolTrace" class="form-check-input" type="checkbox">
                <label class="form-check-label" for="keep_tool_trace">Keep tool traces in distilled reasoning</label>
              </div>

              <label class="small text-muted mb-0 mt-1">Model Provider</label>
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

              <div class="row g-2 mt-1">
                <div class="col-12 col-md-4" v-if="form.modelProvider === 'api'">
                  <label class="small text-muted mb-1">LLM API Key</label>
                  <input v-model.trim="form.llmApiKey" type="password" class="form-control" placeholder="sk-..." required>
                </div>
                <div class="col-12 col-md-4">
                  <label class="small text-muted mb-1">{{ form.modelProvider === 'local' ? 'Endpoint' : 'Base URL' }}</label>
                  <input v-model.trim="form.llmBaseUrl" type="text" class="form-control" required>
                </div>
                <div class="col-12 col-md-4">
                  <label class="small text-muted mb-1">Model Name</label>
                  <input v-model.trim="form.llmModelName" type="text" class="form-control" required>
                </div>
              </div>

              <textarea
                v-model.trim="form.note"
                class="form-control mt-1"
                rows="3"
                placeholder="Optional instruction: scoring rule, redaction policy, quality threshold"
              ></textarea>

              <button class="btn btn-primary mt-1" type="submit" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Start Reasoning Data Synthesis Task
              </button>
            </form>
          </div>
        </article>
      </div>

      <div class="col-12 col-xxl-7">
        <div class="row g-3 mb-3">
          <div v-for="card in statsCards" :key="card.label" class="col-12 col-md-4">
            <article class="card border-0 shadow-sm h-100">
              <div class="card-body py-3">
                <div class="small text-muted">{{ card.label }}</div>
                <div class="h4 mb-0 mt-1">{{ card.value }}</div>
              </div>
            </article>
          </div>
        </div>

        <article class="card border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h6 class="card-title mb-0">Reasoning Data Synthesis Tasks</h6>
              <span class="small text-muted">{{ tasks.length }} tasks</span>
            </div>

            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0">
                <thead class="table-light">
                <tr>
                  <th>Task ID</th>
                  <th>Source</th>
                  <th>Strategy</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
                </thead>
                <tbody>
                <tr
                  v-for="task in tasks"
                  :key="task.id"
                  :class="{ 'table-primary': selectedTaskId === task.id }"
                  @click="selectTask(task.id)"
                >
                  <td>{{ task.id }}</td>
                  <td>{{ task.sourceLabel }}</td>
                  <td>{{ task.strategy }}</td>
                  <td>{{ task.progressText }}</td>
                  <td><span class="badge" :class="statusClass(task.status)">{{ task.status }}</span></td>
                </tr>
                <tr v-if="tasks.length === 0">
                  <td colspan="5" class="text-center text-muted py-3">No Reasoning Data Synthesis tasks yet.</td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </div>
    </div>

    <article class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h6 class="card-title mb-1">Selected Task Summary</h6>
            <div v-if="selectedTask" class="small text-muted">{{ selectedTask.sourceLabel }}</div>
          </div>
          <div v-if="selectedTask" class="d-flex gap-2 flex-wrap">
            <button v-if="selectedTask.generatedDatasetId" class="btn btn-outline-primary btn-sm" type="button" @click="openGeneratedDataset">Open Generated Dataset</button>
          </div>
        </div>

        <div v-if="selectedTask" class="summary-grid">
          <div>
            <div class="small text-muted">Task ID</div>
            <div class="fw-semibold">{{ selectedTask.id }}</div>
          </div>
          <div>
            <div class="small text-muted">Created At</div>
            <div>{{ selectedTask.createdAt }}</div>
          </div>
          <div>
            <div class="small text-muted">Distilled Samples</div>
            <div class="fw-semibold">{{ selectedTask.distilledSamples }}</div>
          </div>
          <div>
            <div class="small text-muted">Estimated Avg Tokens</div>
            <div class="fw-semibold">{{ selectedTask.avgTokens }}</div>
          </div>
        </div>
        <div v-else class="small text-muted">No task selected.</div>
      </div>
    </article>

    <article class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="card-title mb-0">Task Results</h6>
          <span class="small text-muted">{{ results.length }} records</span>
        </div>

        <div v-if="!results.length" class="small text-muted">No results yet.</div>
        <div v-else class="table-responsive">
          <table class="table table-sm table-hover align-middle mb-0">
            <thead class="table-light">
            <tr>
              <th>Item</th>
              <th>Prompt</th>
              <th>Reasoning</th>
              <th>Answer</th>
              <th>Status</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="row in results" :key="row.id">
              <td>{{ row.itemKey }}</td>
              <td><div class="cell-preview" :title="row.promptText">{{ previewText(row.promptText) }}</div></td>
              <td><div class="cell-preview" :title="row.reasoningText">{{ previewText(row.reasoningText) }}</div></td>
              <td><div class="cell-preview" :title="row.answerText">{{ previewText(row.answerText) }}</div></td>
              <td><span class="badge" :class="statusClass(row.status)">{{ row.status }}</span></td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createReasoningDistillationTask,
  fetchAgenticSynthesisTasks,
  fetchDatasets,
  fetchReasoningDistillationTask,
  fetchReasoningDistillationTaskResults,
  fetchReasoningDistillationTasks,
  importPlatformAsset
} from '../../api/dataAgent'

const route = useRoute()
const router = useRouter()

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')
const autoRefresh = ref(true)
const datasetOptions = ref([])
const trajectoryTaskOptions = ref([])
const tasks = ref([])
const results = ref([])
const selectedTaskId = ref('')
const selectedTask = ref(null)

const API_LLM_BASE_URL = 'https://api.openai.com/v1'
const API_LLM_MODEL_NAME = 'gpt-4o-mini'
const LOCAL_LLM_BASE_URL = 'http://127.0.0.1:11434/v1'
const LOCAL_LLM_MODEL_NAME = 'qwen2.5:7b-instruct'

const form = ref({
  sourceType: 'dataset',
  sourceDatasetId: '',
  sourceTaskId: '',
  strategy: 'step-pruning',
  targetMaxTokens: 1024,
  compressionRatio: 0.45,
  keepToolTrace: true,
  modelProvider: 'api',
  llmApiKey: '',
  llmBaseUrl: API_LLM_BASE_URL,
  llmModelName: API_LLM_MODEL_NAME,
  note: ''
})

let pollTimer = null

const statsCards = computed(() => {
  const running = tasks.value.filter((item) => ['pending', 'running'].includes(item.status)).length
  const success = tasks.value.filter((item) => item.status === 'completed').length
  const totalSamples = tasks.value.reduce((sum, item) => sum + (Number(item.distilledSamples) || 0), 0)

  return [
    { label: 'Running Tasks', value: running },
    { label: 'Successful Tasks', value: success },
    { label: 'Distilled Samples', value: totalSamples }
  ]
})

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

const mapDatasets = (raw) => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return list.map((item, index) => ({
    id: Number(item?.id || index + 1),
    name: String(item?.name || item?.dataset_name || `dataset-${index + 1}`)
  }))
}

const mapTrajectoryTasks = (raw) => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return list.map((item, index) => ({
    id: Number(item?.id || index + 1),
    label: `#${item?.id || index + 1} · ${String(item?.dataset_name || item?.dataset?.name || item?.datasetName || 'dataset')}`
  }))
}

const mapTask = (item, index = 0) => ({
  id: String(item?.id || index + 1),
  sourceType: String(item?.source_type || ''),
  sourceDatasetId: Number(item?.source_dataset_id || 0),
  sourceTaskId: Number(item?.source_task_id || 0),
  sourceLabel: String(item?.source_label || (item?.source_type === 'dataset' ? `Dataset #${item?.source_dataset_id || '-'}` : `Trajectory Task #${item?.source_task_id || '-'}`)),
  strategy: String(item?.strategy || '-'),
  processedItems: Number(item?.processed_items || 0),
  totalItems: Number(item?.total_items || 0),
  progressText: `${Number(item?.processed_items || 0)}/${Number(item?.total_items || 0)}`,
  status: String(item?.status || 'pending').toLowerCase(),
  distilledSamples: Number(item?.distilled_samples || 0),
  avgTokens: Number(item?.avg_tokens || 0),
  generatedDatasetId: Number(item?.generated_dataset_id || item?.generated_dataset?.id || 0),
  createdAt: String(item?.insert_time || '-')
})

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

const refreshSourceOptions = async () => {
  const [datasetsResponse, tasksResponse] = await Promise.all([
    fetchDatasets(),
    fetchAgenticSynthesisTasks(100)
  ])
  datasetOptions.value = mapDatasets(datasetsResponse)
  trajectoryTaskOptions.value = mapTrajectoryTasks(tasksResponse)
}

const refreshTasks = async () => {
  const response = await fetchReasoningDistillationTasks(100)
  tasks.value = (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []).map(mapTask)
  if (!selectedTaskId.value && tasks.value.length > 0) {
    selectedTaskId.value = tasks.value[0].id
  }
  if (selectedTaskId.value) {
    const exists = tasks.value.find((item) => item.id === selectedTaskId.value)
    if (!exists && tasks.value.length > 0) selectedTaskId.value = tasks.value[0].id
  }
}

const refreshSelectedTask = async () => {
  if (!selectedTaskId.value) {
    selectedTask.value = null
    results.value = []
    return
  }
  const [taskResponse, resultResponse] = await Promise.all([
    fetchReasoningDistillationTask(selectedTaskId.value),
    fetchReasoningDistillationTaskResults(selectedTaskId.value, 200)
  ])
  selectedTask.value = mapTask(taskResponse?.data || taskResponse)
  results.value = mapResults(resultResponse)
}

const refreshAll = async () => {
  isLoading.value = true
  notice.value = ''
  try {
    await refreshSourceOptions()
    await refreshTasks()
    await refreshSelectedTask()
  } catch (error) {
    notice.value = `Refresh failed. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const selectTask = async (taskId) => {
  selectedTaskId.value = String(taskId || '')
  try {
    await refreshSelectedTask()
  } catch (error) {
    notice.value = `Failed to load task detail. (${error?.message || 'unknown error'})`
  }
}

const startTask = async () => {
  if (form.value.sourceType === 'dataset' && !form.value.sourceDatasetId) {
    notice.value = 'Please select a dataset.'
    return
  }
  if (form.value.sourceType === 'trajectory_task' && !form.value.sourceTaskId) {
    notice.value = 'Please select a trajectory task.'
    return
  }
  if (form.value.modelProvider === 'api' && !form.value.llmApiKey) {
    notice.value = 'API model type requires LLM API Key.'
    return
  }

  isSubmitting.value = true
  notice.value = ''
  try {
    const payload = {
      source_type: form.value.sourceType,
      source_dataset_id: form.value.sourceType === 'dataset' ? Number(form.value.sourceDatasetId) : undefined,
      source_task_id: form.value.sourceType === 'trajectory_task' ? Number(form.value.sourceTaskId) : undefined,
      strategy: form.value.strategy,
      target_max_tokens: Number(form.value.targetMaxTokens),
      compression_ratio: Number(form.value.compressionRatio),
      keep_tool_trace: Boolean(form.value.keepToolTrace),
      note: form.value.note || '',
      llm_api_key: form.value.modelProvider === 'local' ? 'local' : form.value.llmApiKey,
      llm_base_url: form.value.llmBaseUrl,
      llm_model_name: form.value.llmModelName
    }
    const response = await createReasoningDistillationTask(payload)
    const created = mapTask(response?.data || response)
    selectedTaskId.value = created.id
    notice.value = 'Reasoning Data Synthesis task started.'
    await refreshTasks()
    await refreshSelectedTask()
  } catch (error) {
    notice.value = `Failed to start task. (${error?.message || 'backend error'})`
  } finally {
    isSubmitting.value = false
  }
}

const openGeneratedDataset = () => {
  if (!selectedTask.value?.generatedDatasetId) return
  router.push(`/data-preparation/${selectedTask.value.generatedDatasetId}`)
}

const useTaskInChat = () => {
  if (!selectedTask.value?.id) return
  router.push({
    path: '/agent-interaction',
    query: {
      contextType: 'distillation_task',
      contextId: String(selectedTask.value.id),
      contextLabel: selectedTask.value.sourceLabel || ''
    }
  })
}

const importTaskIntoAssets = async () => {
  if (!selectedTask.value?.id) return
  try {
    await importPlatformAsset({
      source_type: 'distillation_task',
      source_id: Number(selectedTask.value.id),
      target_folder_path: ''
    })
    notice.value = `Imported task #${selectedTask.value.id} into Agent Interaction assets.`
  } catch (error) {
    notice.value = `Import failed. (${error?.message || 'unknown error'})`
  }
}

const hydrateFromQuery = () => {
  const sourceType = String(route.query.sourceType || '').trim()
  if (sourceType === 'dataset' || sourceType === 'trajectory_task') {
    form.value.sourceType = sourceType
  }
  const datasetId = String(route.query.datasetId || '').trim()
  const taskId = String(route.query.taskId || '').trim()
  if (datasetId) form.value.sourceDatasetId = datasetId
  if (taskId) form.value.sourceTaskId = taskId
}

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    try {
      await refreshTasks()
      await refreshSelectedTask()
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
  () => route.query,
  () => {
    hydrateFromQuery()
  }
)

onMounted(async () => {
  hydrateFromQuery()
  await refreshAll()
  if (autoRefresh.value) startPolling()
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

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.85rem;
}

.cell-preview {
  max-width: 360px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
