<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Data Preparation</h4>
        <p class="text-muted mb-0">Register and govern datasets used for Data Agent supervised and preference training.</p>
      </div>
      <button class="btn btn-outline-primary btn-sm" type="button" @click="refreshDatasets" :disabled="isLoading">
        <span v-if="isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
        Refresh
      </button>
    </div>

    <div v-if="notice" class="alert alert-warning py-2 px-3" role="alert">
      {{ notice }}
    </div>

    <div class="row g-3 mb-3">
      <div class="col-12 col-xl-5">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="card-title mb-3">Dataset Intake</h6>
            <form class="d-flex flex-column gap-2" @submit.prevent="submitDataset">
              <input v-model.trim="datasetForm.name" type="text" class="form-control" placeholder="Dataset name" required>

              <select v-model="datasetForm.type" class="form-select" required>
                <option value="instruction">Instruction</option>
                <option value="conversation">Conversation</option>
                <option value="evaluation">Evaluation</option>
                <option value="tool-trace">Tool Trace</option>
              </select>

              <input v-model.trim="datasetForm.source" type="text" class="form-control" placeholder="Source URI (S3 / OSS / local)">

              <div class="row g-2">
                <div class="col-6">
                  <select v-model="datasetForm.language" class="form-select">
                    <option value="zh">Chinese</option>
                    <option value="en">English</option>
                    <option value="multi">Multilingual</option>
                  </select>
                </div>
                <div class="col-6">
                  <input v-model.number="datasetForm.size" type="number" min="0" class="form-control" placeholder="Sample size">
                </div>
              </div>

              <textarea
                v-model.trim="datasetForm.note"
                class="form-control"
                rows="3"
                placeholder="Description / labeling protocol / source constraints"
              ></textarea>

              <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Register Dataset
              </button>
            </form>
          </div>
        </article>
      </div>

      <div class="col-12 col-xl-7">
        <article class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="card-title mb-3">Quality Gate</h6>
            <div class="d-flex flex-column gap-3">
              <div v-for="item in qualityChecks" :key="item.key">
                <div class="d-flex align-items-center justify-content-between small mb-1">
                  <span>{{ item.label }}</span>
                  <span class="fw-semibold">{{ item.value }}%</span>
                </div>
                <div class="progress" role="progressbar" :aria-valuenow="item.value" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar" :style="{ width: `${item.value}%` }"></div>
                </div>
              </div>
            </div>

            <hr>

            <div class="small text-muted">
              Suggested policy: only promote datasets with schema consistency ≥ 95% and annotation agreement ≥ 90%.
            </div>
          </div>
        </article>
      </div>
    </div>

    <article class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="card-title mb-0">Dataset Registry</h6>
          <span class="badge text-bg-light">{{ datasetRows.length }} datasets</span>
        </div>

        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Language</th>
              <th>Samples</th>
              <th>Status</th>
              <th>Updated At</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="row in datasetRows" :key="row.id">
              <td>{{ row.name }}</td>
              <td>{{ row.type }}</td>
              <td>{{ row.language }}</td>
              <td>{{ row.size }}</td>
              <td>
                <span class="badge" :class="statusClass(row.status)">{{ row.status }}</span>
              </td>
              <td>{{ row.updatedAt }}</td>
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
import { createDataset, fetchDatasets } from '../../api/dataAgent'

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')

const datasetRows = ref([
  {
    id: 'ds-001',
    name: 'agent_dialog_zh_v3',
    type: 'conversation',
    language: 'zh',
    size: 14200,
    status: 'ready',
    updatedAt: '2026-03-04 09:20'
  },
  {
    id: 'ds-002',
    name: 'tool_trace_sft_v2',
    type: 'tool-trace',
    language: 'multi',
    size: 8900,
    status: 'reviewing',
    updatedAt: '2026-03-03 22:14'
  },
  {
    id: 'ds-003',
    name: 'eval_hard_cases_v1',
    type: 'evaluation',
    language: 'en',
    size: 1200,
    status: 'draft',
    updatedAt: '2026-03-02 18:45'
  }
])

const datasetForm = ref({
  name: '',
  type: 'instruction',
  source: '',
  language: 'zh',
  size: 0,
  note: ''
})

const qualityChecks = ref([
  { key: 'schema', label: 'Schema consistency', value: 96 },
  { key: 'dedupe', label: 'Duplicate rate control', value: 93 },
  { key: 'safety', label: 'Safety annotation coverage', value: 91 },
  { key: 'agreement', label: 'Annotation agreement', value: 88 }
])

const statusClass = (status) => {
  if (status === 'ready') return 'bg-success-subtle text-success-emphasis'
  if (status === 'reviewing') return 'bg-warning-subtle text-warning-emphasis'
  if (status === 'draft') return 'bg-secondary-subtle text-secondary-emphasis'
  return 'bg-light text-dark'
}

const mapDatasets = (raw) => {
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
      id: String(item.id || item.dataset_id || `dataset-${index + 1}`),
      name: String(item.name || item.dataset_name || 'unknown'),
      type: String(item.type || item.dataset_type || 'instruction'),
      language: String(item.language || item.lang || 'multi'),
      size: Number(item.size || item.sample_count || 0),
      status: String(item.status || 'draft'),
      updatedAt: String(item.updated_at || item.update_time || '-')
    }))
}

const refreshDatasets = async () => {
  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchDatasets()
    const normalized = mapDatasets(response)
    if (normalized.length > 0) {
      datasetRows.value = normalized
    }
  } catch (error) {
    notice.value = `Backend unavailable, showing mock registry. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const submitDataset = async () => {
  if (!datasetForm.value.name) return
  isSubmitting.value = true
  notice.value = ''

  const optimisticRow = {
    id: `temp-${Date.now()}`,
    name: datasetForm.value.name,
    type: datasetForm.value.type,
    language: datasetForm.value.language,
    size: Number(datasetForm.value.size || 0),
    status: 'draft',
    updatedAt: new Date().toLocaleString()
  }

  datasetRows.value.unshift(optimisticRow)

  try {
    await createDataset({ ...datasetForm.value })
  } catch (error) {
    notice.value = `Dataset registered locally only. (${error?.message || 'backend error'})`
  } finally {
    isSubmitting.value = false
    datasetForm.value = {
      name: '',
      type: 'instruction',
      source: '',
      language: 'zh',
      size: 0,
      note: ''
    }
  }
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
</style>
