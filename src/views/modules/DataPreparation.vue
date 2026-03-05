<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Data Preparation</h4>
        <p class="text-muted mb-0">Upload datasets, view uploaded list, and inspect sample data.</p>
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
            <h6 class="card-title mb-3">Dataset Upload</h6>
            <form class="d-flex flex-column gap-2" @submit.prevent="submitDataset">
              <input v-model.trim="datasetForm.name" type="text" class="form-control" placeholder="Dataset name" required>

              <select v-model="datasetForm.type" class="form-select" required>
                <option value="instruction">Instruction</option>
                <option value="conversation">Conversation</option>
                <option value="evaluation">Evaluation</option>
                <option value="tool-trace">Tool Trace</option>
              </select>

              <input v-model.trim="datasetForm.source" type="text" class="form-control" placeholder="Source URI (optional)">

              <div class="row g-2">
                <div class="col-6">
                  <select v-model="datasetForm.language" class="form-select">
                    <option value="zh">Chinese</option>
                    <option value="en">English</option>
                    <option value="multi">Multilingual</option>
                  </select>
                </div>
                <div class="col-6">
                  <input
                    class="form-control"
                    type="file"
                    accept=".csv,.json,.jsonl,.txt"
                    @change="onFileChange"
                    required
                  >
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
                Upload Dataset
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
              Suggested policy: only promote datasets with schema consistency >= 95% and annotation agreement >= 90%.
            </div>
          </div>
        </article>
      </div>
    </div>

    <article class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="card-title mb-0">Uploaded Datasets</h6>
          <span class="badge text-bg-light">{{ datasetRows.length }} datasets</span>
        </div>

        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Language</th>
              <th>Size</th>
              <th>Status</th>
              <th>Updated At</th>
            </tr>
            </thead>
            <tbody>
            <tr
              v-for="row in datasetRows"
              :key="row.id"
              class="dataset-row"
              :class="{ active: selectedDatasetId === row.id }"
              @click="openDatasetDetail(row.id)"
            >
              <td>{{ row.name }}</td>
              <td>{{ row.type }}</td>
              <td>{{ row.language }}</td>
              <td>{{ formatSize(row.size) }}</td>
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

    <article v-if="selectedDataset" class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="card-title mb-0">Dataset Detail</h6>
          <span class="badge text-bg-primary">{{ selectedDataset.name }}</span>
        </div>

        <div class="row g-2 small mb-3">
          <div class="col-6 col-lg-3"><strong>ID:</strong> {{ selectedDataset.id }}</div>
          <div class="col-6 col-lg-3"><strong>Type:</strong> {{ selectedDataset.type }}</div>
          <div class="col-6 col-lg-3"><strong>Language:</strong> {{ selectedDataset.language }}</div>
          <div class="col-6 col-lg-3"><strong>Size:</strong> {{ formatSize(selectedDataset.size) }}</div>
          <div class="col-12"><strong>Source:</strong> {{ selectedDataset.source || '-' }}</div>
          <div class="col-12"><strong>Note:</strong> {{ selectedDataset.note || '-' }}</div>
        </div>

        <h6 class="mb-2">Sample Data</h6>
        <div v-if="sampleRows.length === 0" class="text-muted small">No sample data.</div>
        <div v-else class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light">
            <tr>
              <th style="width: 50px;">#</th>
              <th>Content</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="(sample, index) in sampleRows" :key="index">
              <td>{{ index + 1 }}</td>
              <td><pre class="sample-pre">{{ stringifySample(sample) }}</pre></td>
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
import { createDataset, fetchDatasetDetail, fetchDatasets, uploadDataset } from '../../api/dataAgent'

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')

const selectedDatasetId = ref(null)
const selectedDataset = ref(null)
const sampleRows = ref([])
const selectedFile = ref(null)

const datasetRows = ref([])

const datasetForm = ref({
  name: '',
  type: 'instruction',
  source: '',
  language: 'zh',
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
  if (status === 'uploaded') return 'bg-primary-subtle text-primary-emphasis'
  return 'bg-light text-dark'
}

const formatSize = (size) => {
  const n = Number(size || 0)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

const stringifySample = (sample) => JSON.stringify(sample, null, 2)

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
      id: Number(item.id || item.dataset_id || index + 1),
      name: String(item.name || item.dataset_name || 'unknown'),
      type: String(item.type || item.dataset_type || 'instruction'),
      language: String(item.language || item.lang || 'multi'),
      size: Number(item.size || item.sample_count || 0),
      status: String(item.status || 'draft'),
      source: String(item.source || ''),
      note: String(item.note || ''),
      updatedAt: String(item.update_time || item.updated_at || '-')
    }))
}

const onFileChange = (event) => {
  const files = event?.target?.files
  selectedFile.value = files && files.length > 0 ? files[0] : null
}

const refreshDatasets = async () => {
  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchDatasets()
    const normalized = mapDatasets(response)
    datasetRows.value = normalized

    if (normalized.length > 0 && selectedDatasetId.value == null) {
      await openDatasetDetail(normalized[0].id)
    }
  } catch (error) {
    notice.value = `Backend unavailable. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const openDatasetDetail = async (datasetId) => {
  selectedDatasetId.value = datasetId
  const row = datasetRows.value.find((item) => item.id === datasetId)

  try {
    const response = await fetchDatasetDetail(datasetId)
    const detail = response?.data || response
    selectedDataset.value = {
      id: detail?.id ?? row?.id,
      name: detail?.name ?? row?.name,
      type: detail?.type ?? row?.type,
      language: detail?.language ?? row?.language,
      size: Number(detail?.size ?? row?.size ?? 0),
      source: detail?.source ?? row?.source ?? '',
      note: detail?.note ?? row?.note ?? ''
    }
    sampleRows.value = Array.isArray(detail?.sample_data) ? detail.sample_data : []
  } catch {
    selectedDataset.value = row || null
    sampleRows.value = []
  }
}

const submitDataset = async () => {
  if (!datasetForm.value.name) return
  if (!selectedFile.value) {
    notice.value = 'Please select a dataset file.'
    return
  }

  isSubmitting.value = true
  notice.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('name', datasetForm.value.name)
    formData.append('type', datasetForm.value.type)
    formData.append('language', datasetForm.value.language)
    formData.append('source', datasetForm.value.source || '')
    formData.append('note', datasetForm.value.note || '')

    await uploadDataset(formData)
  } catch (uploadError) {
    try {
      await createDataset({
        ...datasetForm.value,
        size: 0,
        sample_data: []
      })
    } catch (createError) {
      notice.value = `Upload failed. (${createError?.message || uploadError?.message || 'unknown error'})`
    }
  } finally {
    isSubmitting.value = false
    datasetForm.value = {
      name: '',
      type: 'instruction',
      source: '',
      language: 'zh',
      note: ''
    }
    selectedFile.value = null
    await refreshDatasets()
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

.dataset-row {
  cursor: pointer;
}

.dataset-row.active {
  --bs-table-bg: #f0f8ff;
}

.sample-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

