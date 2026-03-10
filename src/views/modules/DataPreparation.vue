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

    <article class="card border-0 shadow-sm mb-3">
      <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h6 class="card-title mb-1">Dataset Upload</h6>
          <p class="text-muted small mb-0">Click to open upload form in a modal.</p>
        </div>
        <button class="btn btn-primary" type="button" @click="openUploadModal">
          Upload Dataset
        </button>
      </div>
    </article>

    <article class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="card-title mb-0">Uploaded Datasets</h6>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-outline-secondary btn-sm" type="button" @click="toggleViewMode">
              {{ viewMode === 'list' ? 'Switch to Card View' : 'Switch to List View' }}
            </button>
            <span class="badge text-bg-light">{{ datasetRows.length }} datasets</span>
          </div>
        </div>

        <div v-if="viewMode === 'list'" class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Language</th>
              <th>Size</th>
              <th>Status</th>
              <th>Updated At</th>
              <th style="width: 300px;">Actions</th>
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
              <td>
                <div class="d-flex gap-2">
                  <button class="btn btn-outline-secondary btn-sm" type="button" @click.stop="openSampleDetail(row)">Sample Detail</button>
                  <button class="btn btn-outline-primary btn-sm" type="button" @click.stop="startEditDataset(row)">Edit</button>
                  <button class="btn btn-outline-danger btn-sm" type="button" @click.stop="removeDataset(row)">Delete</button>
                </div>
              </td>
            </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="row g-3">
          <div v-for="row in datasetRows" :key="`card-${row.id}`" class="col-12 col-md-6 col-xl-4">
            <article
              class="card h-100 dataset-card"
              :class="{ active: selectedDatasetId === row.id }"
              @click="openDatasetDetail(row.id)"
            >
              <img
                v-if="row.cover"
                :src="row.cover"
                class="card-img-top dataset-cover"
                :alt="`${row.name} cover`"
              >
              <div v-else class="dataset-cover-placeholder">No Cover</div>
              <div class="card-body">
                <h6 class="card-title mb-1">{{ row.name }}</h6>
                <p class="small text-muted mb-2">{{ row.type }} | {{ row.language }}</p>
                <div class="d-flex align-items-center justify-content-between small mb-2">
                  <span>{{ formatSize(row.size) }}</span>
                  <span class="badge" :class="statusClass(row.status)">{{ row.status }}</span>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  <button class="btn btn-outline-secondary btn-sm" type="button" @click.stop="openSampleDetail(row)">Sample Detail</button>
                  <button class="btn btn-outline-primary btn-sm" type="button" @click.stop="startEditDataset(row)">Edit</button>
                  <button class="btn btn-outline-danger btn-sm" type="button" @click.stop="removeDataset(row)">Delete</button>
                </div>
              </div>
              <div class="card-footer bg-transparent border-0 pt-0 small text-muted">
                Updated: {{ row.updatedAt }}
              </div>
            </article>
          </div>
        </div>
      </div>
    </article>

    <article v-if="editingDatasetId !== null" class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h6 class="card-title mb-0">Edit Dataset</h6>
          <span class="badge text-bg-light">ID {{ editingDatasetId }}</span>
        </div>

        <form class="row g-2" @submit.prevent="saveDatasetEdit">
          <div class="col-12 col-md-6">
            <input v-model.trim="editForm.name" type="text" class="form-control" placeholder="Dataset name" required>
          </div>
          <div class="col-6 col-md-3">
            <select v-model="editForm.type" class="form-select" required>
              <option value="instruction">Instruction</option>
              <option value="conversation">Conversation</option>
              <option value="evaluation">Evaluation</option>
              <option value="tool-trace">Tool Trace</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <select v-model="editForm.language" class="form-select" required>
              <option value="zh">Chinese</option>
              <option value="en">English</option>
              <option value="multi">Multilingual</option>
            </select>
          </div>
          <div class="col-12">
            <input v-model.trim="editForm.source" type="text" class="form-control" placeholder="Source URI (optional)">
          </div>
          <div class="col-12">
            <textarea
              v-model.trim="editForm.note"
              class="form-control"
              rows="2"
              placeholder="Description / labeling protocol / source constraints"
            ></textarea>
          </div>
          <div class="col-12 col-md-8">
            <input class="form-control" type="file" accept="image/*" @change="onEditCoverChange" ref="editCoverInputRef">
            <div class="small text-muted mt-1">New cover: {{ editCoverLabel }}</div>
          </div>
          <div class="col-12 col-md-4 d-flex align-items-end justify-content-md-end gap-2">
            <button class="btn btn-outline-secondary" type="button" @click="cancelEdit">Cancel</button>
            <button class="btn btn-primary" type="submit" :disabled="isSavingEdit">
              <span v-if="isSavingEdit" class="spinner-border spinner-border-sm me-1" role="status"></span>
              Save
            </button>
          </div>
        </form>
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

        <div class="d-flex justify-content-end">
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="openSampleDetail(selectedDataset)">
            View Sample Data
          </button>
        </div>
      </div>
    </article>

    <div class="modal fade" tabindex="-1" ref="uploadModalRef" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h6 class="modal-title mb-0">Dataset Upload</h6>
            <button type="button" class="btn-close" @click="closeUploadModal"></button>
          </div>
          <div class="modal-body">
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
                <div class="col-12 col-md-6">
                  <select v-model="datasetForm.language" class="form-select">
                    <option value="zh">Chinese</option>
                    <option value="en">English</option>
                    <option value="multi">Multilingual</option>
                  </select>
                </div>
                <div class="col-12 col-md-6">
                  <input
                    class="form-control"
                    type="file"
                    accept=".csv,.json,.jsonl,.txt,.zip"
                    multiple
                    webkitdirectory
                    directory
                    @change="onDatasetFilesChange"
                    ref="datasetFilesInputRef"
                    required
                  >
                </div>
              </div>
              <div class="small text-muted">
                Dataset folder: {{ selectedFolderLabel }}
              </div>

              <div>
                <input
                  class="form-control"
                  type="file"
                  accept="image/*"
                  @change="onCoverFileChange"
                  ref="coverFileInputRef"
                >
              </div>
              <div class="small text-muted">
                Cover image: {{ selectedCoverLabel }}
              </div>

              <textarea
                v-model.trim="datasetForm.note"
                class="form-control"
                rows="3"
                placeholder="Description / labeling protocol / source constraints"
              ></textarea>

              <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-outline-secondary" type="button" @click="closeUploadModal">Cancel</button>
                <button class="btn btn-primary" type="submit" :disabled="isSubmitting">
                  <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
                  Upload Dataset
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" tabindex="-1" ref="sampleModalRef" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h6 class="modal-title mb-0">Sample Data - {{ sampleDetailDatasetName || 'Dataset' }}</h6>
            <button type="button" class="btn-close" @click="closeSampleModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="isLoadingSampleDetail" class="d-flex align-items-center gap-2 text-muted">
              <span class="spinner-border spinner-border-sm" role="status"></span>
              <span>Loading sample data...</span>
            </div>
            <div v-else-if="sampleDetailRows.length === 0" class="text-muted small">No sample data.</div>
            <div v-else class="table-responsive">
              <table class="table table-sm table-bordered align-middle mb-0">
                <thead class="table-light">
                <tr>
                  <th style="width: 50px;">#</th>
                  <th>Content</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(sample, index) in sampleDetailRows" :key="index">
                  <td>{{ index + 1 }}</td>
                  <td><pre class="sample-pre">{{ stringifySample(sample) }}</pre></td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" type="button" @click="closeSampleModal">Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Modal } from 'bootstrap'
import {
  createDataset,
  deleteDataset,
  fetchDatasetDetail,
  fetchDatasets,
  updateDataset,
  updateDatasetCover,
  uploadDataset
} from '../../api/dataAgent'

const isLoading = ref(false)
const isSubmitting = ref(false)
const isSavingEdit = ref(false)
const isLoadingSampleDetail = ref(false)
const notice = ref('')

const selectedDatasetId = ref(null)
const selectedDataset = ref(null)
const sampleDetailRows = ref([])
const sampleDetailDatasetName = ref('')
const selectedDatasetFiles = ref([])
const selectedCoverFile = ref(null)
const editCoverFile = ref(null)
const datasetFilesInputRef = ref(null)
const coverFileInputRef = ref(null)
const editCoverInputRef = ref(null)
const uploadModalRef = ref(null)
const sampleModalRef = ref(null)
const viewMode = ref('list')
let uploadModalInstance = null
let sampleModalInstance = null

const datasetRows = ref([])
const editingDatasetId = ref(null)
const editForm = ref({
  name: '',
  type: 'instruction',
  source: '',
  language: 'zh',
  note: ''
})

const datasetForm = ref({
  name: '',
  type: 'instruction',
  source: '',
  language: 'zh',
  note: ''
})

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
      cover: String(item.cover_url || item.cover || item.cover_path || item.thumbnail || ''),
      updatedAt: String(item.update_time || item.updated_at || '-')
    }))
}

const onDatasetFilesChange = (event) => {
  const files = event?.target?.files
  selectedDatasetFiles.value = files ? Array.from(files) : []
}

const onCoverFileChange = (event) => {
  const files = event?.target?.files
  selectedCoverFile.value = files && files.length > 0 ? files[0] : null
}

const onEditCoverChange = (event) => {
  const files = event?.target?.files
  editCoverFile.value = files && files.length > 0 ? files[0] : null
}

const selectedFolderLabel = computed(() => {
  if (selectedDatasetFiles.value.length === 0) return 'No folder selected'
  const first = selectedDatasetFiles.value[0]?.webkitRelativePath || selectedDatasetFiles.value[0]?.name || ''
  const folderName = first.includes('/') ? first.split('/')[0] : 'selected files'
  return `${folderName} (${selectedDatasetFiles.value.length} files)`
})

const selectedCoverLabel = computed(() => selectedCoverFile.value?.name || 'No cover selected')
const editCoverLabel = computed(() => editCoverFile.value?.name || 'No new cover selected')

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'list' ? 'card' : 'list'
}

const resetUploadInputs = () => {
  if (datasetFilesInputRef.value) datasetFilesInputRef.value.value = ''
  if (coverFileInputRef.value) coverFileInputRef.value.value = ''
}

const getUploadModal = () => {
  if (!uploadModalRef.value) return null
  uploadModalInstance = Modal.getOrCreateInstance(uploadModalRef.value)
  return uploadModalInstance
}

const getSampleModal = () => {
  if (!sampleModalRef.value) return null
  sampleModalInstance = Modal.getOrCreateInstance(sampleModalRef.value)
  return sampleModalInstance
}

const openUploadModal = () => {
  getUploadModal()?.show()
}

const closeUploadModal = () => {
  getUploadModal()?.hide()
}

const openSampleModal = () => {
  getSampleModal()?.show()
}

const closeSampleModal = () => {
  getSampleModal()?.hide()
}

const refreshDatasets = async () => {
  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchDatasets()
    const normalized = mapDatasets(response)
    datasetRows.value = normalized

    if (normalized.length === 0) {
      selectedDatasetId.value = null
      selectedDataset.value = null
      return
    }

    const stillExists = normalized.some((item) => item.id === selectedDatasetId.value)
    if (!stillExists) {
      selectedDatasetId.value = normalized[0].id
    }
    await openDatasetDetail(selectedDatasetId.value)
  } catch (error) {
    notice.value = `Backend unavailable. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const openDatasetDetail = async (datasetId) => {
  if (!datasetId) return
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
  } catch {
    selectedDataset.value = row || null
  }
}

const openSampleDetail = async (row) => {
  if (!row?.id) return

  sampleDetailDatasetName.value = row.name || `ID ${row.id}`
  sampleDetailRows.value = []
  isLoadingSampleDetail.value = true
  openSampleModal()

  try {
    const response = await fetchDatasetDetail(row.id)
    const detail = response?.data || response
    sampleDetailRows.value = Array.isArray(detail?.sample_data) ? detail.sample_data : []
  } catch (error) {
    notice.value = `Load sample failed. (${error?.message || 'unknown error'})`
  } finally {
    isLoadingSampleDetail.value = false
  }
}

const resetDatasetForm = () => {
  datasetForm.value = {
    name: '',
    type: 'instruction',
    source: '',
    language: 'zh',
    note: ''
  }
  selectedDatasetFiles.value = []
  selectedCoverFile.value = null
  resetUploadInputs()
}

const submitDataset = async () => {
  if (!datasetForm.value.name) return
  if (selectedDatasetFiles.value.length === 0) {
    notice.value = 'Please select a dataset folder.'
    return
  }

  isSubmitting.value = true
  notice.value = ''
  let uploadSucceeded = false

  try {
    const formData = new FormData()
    selectedDatasetFiles.value.forEach((file, index) => {
      formData.append('files', file, file.webkitRelativePath || file.name)
      if (index === 0) formData.append('file', file, file.name)
    })
    if (selectedCoverFile.value) {
      formData.append('cover', selectedCoverFile.value, selectedCoverFile.value.name)
    }

    formData.append('name', datasetForm.value.name)
    formData.append('type', datasetForm.value.type)
    formData.append('language', datasetForm.value.language)
    formData.append('source', datasetForm.value.source || '')
    formData.append('note', datasetForm.value.note || '')

    await uploadDataset(formData)
    uploadSucceeded = true
  } catch (uploadError) {
    try {
      await createDataset({
        ...datasetForm.value,
        size: 0,
        sample_data: []
      })
      uploadSucceeded = true
    } catch (createError) {
      notice.value = `Upload failed. (${createError?.message || uploadError?.message || 'unknown error'})`
    }
  } finally {
    isSubmitting.value = false
  }

  if (uploadSucceeded) {
    closeUploadModal()
    resetDatasetForm()
    await refreshDatasets()
  }
}

const startEditDataset = (row) => {
  editingDatasetId.value = row.id
  editForm.value = {
    name: row.name || '',
    type: row.type || 'instruction',
    source: row.source || '',
    language: row.language || 'multi',
    note: row.note || ''
  }
  editCoverFile.value = null
  if (editCoverInputRef.value) editCoverInputRef.value.value = ''
}

const cancelEdit = () => {
  editingDatasetId.value = null
  editCoverFile.value = null
  if (editCoverInputRef.value) editCoverInputRef.value.value = ''
}

const saveDatasetEdit = async () => {
  if (!editingDatasetId.value) return

  isSavingEdit.value = true
  notice.value = ''

  try {
    await updateDataset(editingDatasetId.value, {
      name: editForm.value.name,
      type: editForm.value.type,
      language: editForm.value.language,
      source: editForm.value.source || null,
      note: editForm.value.note || null
    })

    if (editCoverFile.value) {
      await updateDatasetCover(editingDatasetId.value, editCoverFile.value)
    }

    cancelEdit()
    await refreshDatasets()
  } catch (error) {
    notice.value = `Update failed. (${error?.message || 'unknown error'})`
  } finally {
    isSavingEdit.value = false
  }
}

const removeDataset = async (row) => {
  const yes = window.confirm(`Delete dataset "${row.name}"? This action cannot be undone.`)
  if (!yes) return

  notice.value = ''
  try {
    await deleteDataset(row.id)
    if (editingDatasetId.value === row.id) {
      cancelEdit()
    }
    await refreshDatasets()
  } catch (error) {
    notice.value = `Delete failed. (${error?.message || 'unknown error'})`
  }
}

onMounted(() => {
  refreshDatasets()
})

onBeforeUnmount(() => {
  uploadModalInstance?.dispose()
  sampleModalInstance?.dispose()
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

.dataset-card {
  cursor: pointer;
  border: 1px solid #e9ecef;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.dataset-card:hover {
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.dataset-card.active {
  border-color: #0d6efd;
}

.dataset-cover {
  height: 150px;
  object-fit: cover;
}

.dataset-cover-placeholder {
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  color: #6c757d;
  font-size: 0.875rem;
}

.sample-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
