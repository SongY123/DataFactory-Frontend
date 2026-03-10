<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Reasoning Data Distillation</h4>
        <p class="text-muted mb-0">Compress long-chain trajectories into compact, high-signal reasoning data for efficient training.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" type="button" @click="refreshDatasets" :disabled="isLoading">
        <span v-if="isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
        Refresh Datasets
      </button>
    </div>

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-xxl-5">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body d-flex flex-column gap-3">
            <h6 class="card-title mb-0">Distillation Config</h6>

            <form class="d-flex flex-column gap-2" @submit.prevent="startDistillationTask">
              <label class="small text-muted mb-0">Source Trajectory Dataset</label>
              <select v-model="distillForm.sourceDataset" class="form-select" required>
                <option disabled value="">Select dataset</option>
                <option v-for="item in datasetOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>

              <label class="small text-muted mb-0 mt-1">Distillation Strategy</label>
              <select v-model="distillForm.strategy" class="form-select" required>
                <option value="step-pruning">Step Pruning</option>
                <option value="self-consistency">Self-Consistency Voting</option>
                <option value="error-aware">Error-Aware Distillation</option>
              </select>

              <div class="row g-2 mt-1">
                <div class="col-12 col-md-6">
                  <label class="small text-muted mb-1">Target Max Tokens</label>
                  <input
                    v-model.number="distillForm.targetMaxTokens"
                    type="number"
                    class="form-control"
                    min="128"
                    step="128"
                    required
                  >
                </div>
                <div class="col-12 col-md-6">
                  <label class="small text-muted mb-1">Compression Ratio</label>
                  <input
                    v-model.number="distillForm.compressionRatio"
                    type="number"
                    class="form-control"
                    min="0.1"
                    max="1"
                    step="0.05"
                    required
                  >
                </div>
              </div>

              <div class="form-check mt-1">
                <input id="keep_tool_trace" v-model="distillForm.keepToolTrace" class="form-check-input" type="checkbox">
                <label class="form-check-label" for="keep_tool_trace">Keep tool call traces in distilled data</label>
              </div>

              <textarea
                v-model.trim="distillForm.note"
                class="form-control mt-1"
                rows="3"
                placeholder="Optional instruction: scoring rule, redaction policy, quality threshold"
              ></textarea>

              <button class="btn btn-primary mt-1" type="submit">Start Distillation Task</button>
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
              <h6 class="card-title mb-0">Distillation Tasks</h6>
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
                  @click="selectedTaskId = task.id"
                >
                  <td>{{ task.id }}</td>
                  <td>{{ task.sourceDataset }}</td>
                  <td>{{ task.strategy }}</td>
                  <td>{{ task.progress }}%</td>
                  <td><span class="badge" :class="statusClass(task.status)">{{ task.status }}</span></td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </div>
    </div>

    <article class="card border-0 shadow-sm">
      <div class="card-body">
        <h6 class="card-title mb-2">Selected Task Summary</h6>
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchDatasets } from '../../api/dataAgent'

const isLoading = ref(false)
const notice = ref('')

const datasetOptions = ref([
  { value: 'agent_traj_v4', label: 'agent_traj_v4' },
  { value: 'tool_trace_v3', label: 'tool_trace_v3' }
])

const distillForm = ref({
  sourceDataset: 'agent_traj_v4',
  strategy: 'step-pruning',
  targetMaxTokens: 1024,
  compressionRatio: 0.45,
  keepToolTrace: true,
  note: ''
})

const tasks = ref([
  {
    id: 'distill-20260310-01',
    sourceDataset: 'agent_traj_v4',
    strategy: 'step-pruning',
    progress: 100,
    status: 'success',
    distilledSamples: 12600,
    avgTokens: 742,
    createdAt: '2026-03-10 09:10'
  },
  {
    id: 'distill-20260309-03',
    sourceDataset: 'tool_trace_v3',
    strategy: 'error-aware',
    progress: 62,
    status: 'running',
    distilledSamples: 5100,
    avgTokens: 801,
    createdAt: '2026-03-09 20:35'
  },
  {
    id: 'distill-20260308-05',
    sourceDataset: 'agent_traj_v3',
    strategy: 'self-consistency',
    progress: 100,
    status: 'failed',
    distilledSamples: 0,
    avgTokens: '-',
    createdAt: '2026-03-08 16:02'
  }
])

const selectedTaskId = ref(tasks.value[0]?.id || '')

const selectedTask = computed(() => tasks.value.find((item) => item.id === selectedTaskId.value) || null)

const statsCards = computed(() => {
  const running = tasks.value.filter((item) => item.status === 'running').length
  const success = tasks.value.filter((item) => item.status === 'success').length
  const totalSamples = tasks.value.reduce((sum, item) => sum + (Number(item.distilledSamples) || 0), 0)

  return [
    { label: 'Running Tasks', value: running },
    { label: 'Successful Tasks', value: success },
    { label: 'Distilled Samples', value: totalSamples }
  ]
})

const statusClass = (status) => {
  if (status === 'success') return 'bg-success-subtle text-success-emphasis'
  if (status === 'running') return 'bg-primary-subtle text-primary-emphasis'
  if (status === 'failed') return 'bg-danger-subtle text-danger-emphasis'
  return 'bg-light text-dark'
}

const refreshDatasets = async () => {
  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchDatasets()
    const list = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : []

    const mapped = list
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => ({
        value: String(item.id || item.name || `dataset-${index + 1}`),
        label: String(item.name || item.dataset_name || item.id || `dataset-${index + 1}`)
      }))

    if (mapped.length > 0) {
      datasetOptions.value = mapped
      if (!datasetOptions.value.some((item) => item.value === distillForm.value.sourceDataset)) {
        distillForm.value.sourceDataset = datasetOptions.value[0].value
      }
    }
  } catch (error) {
    notice.value = `Backend unavailable, showing cached dataset options. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const startDistillationTask = () => {
  const newTask = {
    id: `distill-local-${Date.now()}`,
    sourceDataset: distillForm.value.sourceDataset,
    strategy: distillForm.value.strategy,
    progress: 0,
    status: 'running',
    distilledSamples: 0,
    avgTokens: distillForm.value.targetMaxTokens,
    createdAt: new Date().toLocaleString()
  }

  tasks.value.unshift(newTask)
  selectedTaskId.value = newTask.id
  notice.value = 'Distillation task has been queued locally. Connect backend task API for real execution state.'
}

onMounted(() => {
  refreshDatasets()
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
</style>
