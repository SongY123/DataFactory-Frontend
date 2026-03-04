<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Model Evaluation</h4>
        <p class="text-muted mb-0">Measure online readiness with benchmark suites, behavior slices, and failure-focused diagnostics.</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="refreshReports" :disabled="isLoading">Refresh</button>
        <button class="btn btn-primary btn-sm" type="button" @click="runEvaluation" :disabled="isRunning">
          <span v-if="isRunning" class="spinner-border spinner-border-sm me-1" role="status"></span>
          Run Evaluation
        </button>
      </div>
    </div>

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-md-6 col-xl-3" v-for="metric in metrics" :key="metric.label">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body py-3">
            <div class="small text-muted">{{ metric.label }}</div>
            <div class="h4 mb-0 mt-1">{{ metric.value }}</div>
            <div class="small" :class="metric.delta >= 0 ? 'text-success' : 'text-danger'">
              {{ metric.delta >= 0 ? '+' : '' }}{{ metric.delta }}%
            </div>
          </div>
        </article>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-12 col-xl-7">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="card-title mb-2">Benchmark Report</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light">
                <tr>
                  <th>Suite</th>
                  <th>Coverage</th>
                  <th>Accuracy</th>
                  <th>Latency P95</th>
                  <th>Status</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="item in reports" :key="item.id">
                  <td>{{ item.name }}</td>
                  <td>{{ item.coverage }}</td>
                  <td>{{ item.accuracy }}</td>
                  <td>{{ item.latency }}</td>
                  <td><span class="badge" :class="item.pass ? 'text-bg-success' : 'text-bg-danger'">{{ item.pass ? 'pass' : 'fail' }}</span></td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </div>

      <div class="col-12 col-xl-5">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="card-title mb-2">Failure Slices</h6>
            <div class="d-flex flex-column gap-2">
              <div v-for="slice in failureSlices" :key="slice.name" class="slice-row">
                <div class="d-flex align-items-center justify-content-between">
                  <span class="fw-semibold">{{ slice.name }}</span>
                  <span class="small text-muted">{{ slice.count }} samples</span>
                </div>
                <div class="small text-muted">{{ slice.reason }}</div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createEvaluationTask, fetchEvaluationReports } from '../../api/dataAgent'

const isLoading = ref(false)
const isRunning = ref(false)
const notice = ref('')

const metrics = ref([
  { label: 'Overall Success', value: '82.4%', delta: 1.8 },
  { label: 'Tool Use Accuracy', value: '88.1%', delta: 2.5 },
  { label: 'Hallucination Rate', value: '4.7%', delta: -0.9 },
  { label: 'Safety Pass Rate', value: '97.2%', delta: 0.4 }
])

const reports = ref([
  { id: 'rep-1', name: 'Instruction Following', coverage: '3,200', accuracy: '86.1%', latency: '1.1s', pass: true },
  { id: 'rep-2', name: 'Tool Routing', coverage: '1,050', accuracy: '89.8%', latency: '1.7s', pass: true },
  { id: 'rep-3', name: 'Long Context', coverage: '420', accuracy: '73.4%', latency: '2.4s', pass: false }
])

const failureSlices = ref([
  { name: 'Ambiguous intent', count: 62, reason: 'Multiple candidate actions with weak disambiguation.' },
  { name: 'Tool timeout', count: 37, reason: 'External dependency timeout under concurrent requests.' },
  { name: 'Policy over-blocking', count: 19, reason: 'Safety policy too strict for low-risk domain tasks.' }
])

const mapReports = (raw) => {
  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : []

  return list.map((item, index) => ({
    id: String(item.id || item.report_id || `report-${index + 1}`),
    name: String(item.name || item.suite || '-'),
    coverage: String(item.coverage || item.sample_count || '-'),
    accuracy: String(item.accuracy || item.score || '-'),
    latency: String(item.latency || item.p95_latency || '-'),
    pass: Boolean(item.pass ?? item.status === 'pass')
  }))
}

const refreshReports = async () => {
  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchEvaluationReports()
    const normalized = mapReports(response)
    if (normalized.length > 0) {
      reports.value = normalized
    }
  } catch (error) {
    notice.value = `Backend unavailable, showing mock reports. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const runEvaluation = async () => {
  isRunning.value = true
  notice.value = ''

  try {
    await createEvaluationTask({
      suites: reports.value.map((item) => item.name),
      model_tag: 'latest-candidate'
    })
  } catch (error) {
    notice.value = `Evaluation task created locally only. (${error?.message || 'backend error'})`
  } finally {
    isRunning.value = false
  }
}
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slice-row {
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  padding: 0.65rem;
  background: #fbfdff;
}
</style>
