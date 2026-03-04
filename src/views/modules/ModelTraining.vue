<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Model Training</h4>
        <p class="text-muted mb-0">Configure training recipes and monitor experiment progression for the Data Agent model family.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" type="button" @click="refreshRuns" :disabled="isLoading">Refresh</button>
    </div>

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-xl-5">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="card-title mb-3">Training Config</h6>

            <form class="d-flex flex-column gap-2" @submit.prevent="startTraining">
              <select v-model="trainingForm.baseModel" class="form-select" required>
                <option value="Qwen2.5-7B-Instruct">Qwen2.5-7B-Instruct</option>
                <option value="Llama3.1-8B-Instruct">Llama3.1-8B-Instruct</option>
                <option value="DeepSeek-R1-Distill-7B">DeepSeek-R1-Distill-7B</option>
              </select>

              <input v-model="trainingForm.dataset" type="text" class="form-control" placeholder="Primary dataset" required>

              <div class="row g-2">
                <div class="col-6">
                  <input v-model.number="trainingForm.epochs" min="1" type="number" class="form-control" placeholder="Epochs" required>
                </div>
                <div class="col-6">
                  <input v-model.number="trainingForm.batchSize" min="1" type="number" class="form-control" placeholder="Batch Size" required>
                </div>
              </div>

              <div class="row g-2">
                <div class="col-6">
                  <input v-model.number="trainingForm.learningRate" step="0.000001" min="0" type="number" class="form-control" placeholder="Learning Rate" required>
                </div>
                <div class="col-6">
                  <input v-model.number="trainingForm.warmupRatio" step="0.01" min="0" max="1" type="number" class="form-control" placeholder="Warmup Ratio" required>
                </div>
              </div>

              <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Start Training Run
              </button>
            </form>
          </div>
        </article>
      </div>

      <div class="col-12 col-xl-7">
        <div class="row g-3">
          <div class="col-12 col-md-4" v-for="card in kpiCards" :key="card.label">
            <article class="card border-0 shadow-sm h-100">
              <div class="card-body py-3">
                <div class="small text-muted">{{ card.label }}</div>
                <div class="h4 mb-0 mt-1">{{ card.value }}</div>
              </div>
            </article>
          </div>
        </div>

        <article class="card border-0 shadow-sm mt-3">
          <div class="card-body">
            <h6 class="card-title mb-3">Experiment Notes</h6>
            <ul class="small text-muted mb-0">
              <li>Keep validation split fixed for comparable benchmarks.</li>
              <li>Enable tool-trace replay after loss converges.</li>
              <li>Use guardrail regression suite before promoting checkpoints.</li>
            </ul>
          </div>
        </article>
      </div>
    </div>

    <article class="card border-0 shadow-sm">
      <div class="card-body">
        <h6 class="card-title mb-2">Training Run History</h6>
        <div class="table-responsive">
          <table class="table table-sm table-hover align-middle mb-0">
            <thead class="table-light">
            <tr>
              <th>Run ID</th>
              <th>Model</th>
              <th>Dataset</th>
              <th>Loss</th>
              <th>Eval Score</th>
              <th>Status</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="run in runs" :key="run.id">
              <td>{{ run.id }}</td>
              <td>{{ run.model }}</td>
              <td>{{ run.dataset }}</td>
              <td>{{ run.loss }}</td>
              <td>{{ run.score }}</td>
              <td>
                <span class="badge" :class="statusClass(run.status)">{{ run.status }}</span>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { createTrainingJob, fetchTrainingJobs } from '../../api/dataAgent'

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')

const trainingForm = ref({
  baseModel: 'Qwen2.5-7B-Instruct',
  dataset: 'agent_dialog_zh_v3',
  epochs: 3,
  batchSize: 8,
  learningRate: 0.00002,
  warmupRatio: 0.1
})

const runs = ref([
  { id: 'train-20260304-02', model: 'Qwen2.5-7B-Instruct', dataset: 'agent_dialog_zh_v3', loss: 1.23, score: 0.79, status: 'running' },
  { id: 'train-20260303-11', model: 'Llama3.1-8B-Instruct', dataset: 'tool_trace_sft_v2', loss: 1.11, score: 0.83, status: 'success' },
  { id: 'train-20260302-07', model: 'DeepSeek-R1-Distill-7B', dataset: 'agent_dialog_zh_v2', loss: 1.46, score: 0.72, status: 'failed' }
])

const kpiCards = computed(() => {
  const successRuns = runs.value.filter((item) => item.status === 'success')
  const bestScore = successRuns.length > 0 ? Math.max(...successRuns.map((item) => Number(item.score) || 0)) : 0

  return [
    { label: 'Active Runs', value: runs.value.filter((item) => item.status === 'running').length },
    { label: 'Best Eval Score', value: bestScore.toFixed(2) },
    { label: 'Total Runs', value: runs.value.length }
  ]
})

const statusClass = (status) => {
  if (status === 'success') return 'bg-success-subtle text-success-emphasis'
  if (status === 'running') return 'bg-primary-subtle text-primary-emphasis'
  if (status === 'failed') return 'bg-danger-subtle text-danger-emphasis'
  return 'bg-light text-dark'
}

const mapRuns = (raw) => {
  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : []

  return list.map((item, index) => ({
    id: String(item.id || item.run_id || `training-${index + 1}`),
    model: String(item.model || item.base_model || '-'),
    dataset: String(item.dataset || item.dataset_name || '-'),
    loss: Number(item.loss || item.train_loss || 0),
    score: Number(item.score || item.eval_score || 0),
    status: String(item.status || 'queued')
  }))
}

const refreshRuns = async () => {
  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchTrainingJobs()
    const normalized = mapRuns(response)
    if (normalized.length > 0) {
      runs.value = normalized
    }
  } catch (error) {
    notice.value = `Backend unavailable, showing mock runs. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const startTraining = async () => {
  isSubmitting.value = true
  notice.value = ''

  const newRun = {
    id: `train-local-${Date.now()}`,
    model: trainingForm.value.baseModel,
    dataset: trainingForm.value.dataset,
    loss: '-',
    score: '-',
    status: 'running'
  }

  runs.value.unshift(newRun)

  try {
    await createTrainingJob({ ...trainingForm.value })
  } catch (error) {
    notice.value = `Run created locally only. (${error?.message || 'backend error'})`
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  refreshRuns()
})
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
