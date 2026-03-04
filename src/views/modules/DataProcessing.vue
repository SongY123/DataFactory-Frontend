<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Data Processing</h4>
        <p class="text-muted mb-0">Build deterministic and traceable data pipelines before training release.</p>
      </div>
      <button class="btn btn-primary btn-sm" type="button" @click="launchProcessingJob" :disabled="isCreating">
        <span v-if="isCreating" class="spinner-border spinner-border-sm me-1" role="status"></span>
        Launch Processing Job
      </button>
    </div>

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-xl-6">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="card-title mb-3">Pipeline Blueprint</h6>
            <ol class="list-group list-group-numbered">
              <li v-for="stage in pipelineStages" :key="stage.id" class="list-group-item d-flex justify-content-between align-items-start">
                <div class="ms-2 me-auto">
                  <div class="fw-semibold">{{ stage.name }}</div>
                  <div class="small text-muted">{{ stage.description }}</div>
                </div>
                <span class="badge" :class="stage.done ? 'text-bg-success' : 'text-bg-secondary'">
                  {{ stage.done ? 'Done' : 'Pending' }}
                </span>
              </li>
            </ol>
          </div>
        </article>
      </div>

      <div class="col-12 col-xl-6">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="card-title mb-3">Current Processing Config</h6>

            <div class="form-check mb-2" v-for="option in processingOptions" :key="option.key">
              <input :id="option.key" v-model="option.enabled" class="form-check-input" type="checkbox">
              <label class="form-check-label" :for="option.key">{{ option.label }}</label>
            </div>

            <hr>

            <div class="small text-muted mb-1">Sampling ratio for quick debug</div>
            <input v-model.number="debugSampling" type="range" min="1" max="100" class="form-range">
            <div class="small fw-semibold">{{ debugSampling }}%</div>
          </div>
        </article>
      </div>
    </div>

    <article class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="card-title mb-0">Processing Job History</h6>
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="refreshJobs" :disabled="isLoading">
            Refresh
          </button>
        </div>

        <div class="table-responsive">
          <table class="table table-sm table-hover align-middle mb-0">
            <thead class="table-light">
            <tr>
              <th>Job ID</th>
              <th>Dataset</th>
              <th>Triggered At</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="job in processingJobs" :key="job.id">
              <td>{{ job.id }}</td>
              <td>{{ job.dataset }}</td>
              <td>{{ job.createdAt }}</td>
              <td>{{ job.duration }}</td>
              <td>
                <span class="badge" :class="statusClass(job.status)">{{ job.status }}</span>
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
import { onMounted, ref } from 'vue'
import { createProcessingJob, fetchProcessingJobs } from '../../api/dataAgent'

const isLoading = ref(false)
const isCreating = ref(false)
const notice = ref('')

const debugSampling = ref(20)

const pipelineStages = ref([
  { id: 'stage-1', name: 'Schema normalization', description: 'Unify fields and enforce schema contracts.', done: true },
  { id: 'stage-2', name: 'Noise filtering', description: 'Remove outliers and malformed records.', done: true },
  { id: 'stage-3', name: 'Instruction balancing', description: 'Control domain and intent distribution.', done: false },
  { id: 'stage-4', name: 'Safety redaction', description: 'Mask sensitive and non-compliant content.', done: false }
])

const processingOptions = ref([
  { key: 'option-dedupe', label: 'Semantic deduplication', enabled: true },
  { key: 'option-pii', label: 'PII redaction', enabled: true },
  { key: 'option-hardneg', label: 'Hard negative mining', enabled: false },
  { key: 'option-simcheck', label: 'Cross-split leakage check', enabled: true }
])

const processingJobs = ref([
  { id: 'proc-20260304-01', dataset: 'agent_dialog_zh_v3', createdAt: '2026-03-04 08:42', duration: '12m', status: 'success' },
  { id: 'proc-20260303-09', dataset: 'tool_trace_sft_v2', createdAt: '2026-03-03 23:10', duration: '17m', status: 'running' },
  { id: 'proc-20260303-05', dataset: 'eval_hard_cases_v1', createdAt: '2026-03-03 16:28', duration: '6m', status: 'failed' }
])

const statusClass = (status) => {
  if (status === 'success') return 'bg-success-subtle text-success-emphasis'
  if (status === 'running') return 'bg-primary-subtle text-primary-emphasis'
  if (status === 'failed') return 'bg-danger-subtle text-danger-emphasis'
  return 'bg-light text-dark'
}

const mapJobs = (raw) => {
  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : []

  return list.map((item, index) => ({
    id: String(item.id || item.job_id || `processing-${index + 1}`),
    dataset: String(item.dataset || item.dataset_name || '-'),
    createdAt: String(item.created_at || item.insert_time || '-'),
    duration: String(item.duration || item.duration_ms || '-'),
    status: String(item.status || 'queued')
  }))
}

const refreshJobs = async () => {
  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchProcessingJobs()
    const normalized = mapJobs(response)
    if (normalized.length > 0) {
      processingJobs.value = normalized
    }
  } catch (error) {
    notice.value = `Backend unavailable, showing mock jobs. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const launchProcessingJob = async () => {
  isCreating.value = true
  notice.value = ''

  const newJob = {
    id: `proc-local-${Date.now()}`,
    dataset: 'agent_dialog_zh_v3',
    createdAt: new Date().toLocaleString(),
    duration: '-',
    status: 'running'
  }

  processingJobs.value.unshift(newJob)

  try {
    await createProcessingJob({
      dataset: newJob.dataset,
      sampling_ratio: debugSampling.value,
      options: processingOptions.value
    })
  } catch (error) {
    notice.value = `Job created locally only. (${error?.message || 'backend error'})`
  } finally {
    isCreating.value = false
  }
}

onMounted(() => {
  refreshJobs()
})
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
