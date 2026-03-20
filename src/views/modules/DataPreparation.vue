<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Data Preparation</h4>
        <p class="text-muted mb-0">Upload datasets, view uploaded list, and inspect sample data.</p>
      </div>
    </div>

    <div v-if="notice" class="alert alert-warning py-2 px-3" role="alert">
      {{ notice }}
    </div>

    <article class="card border-0 shadow-sm mb-3">
      <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h6 class="card-title mb-1">Dataset Upload</h6>
          <p class="text-muted small mb-0">Click to open upload form in a modal. Current user: {{ currentUsername || 'unknown' }}</p>
        </div>
        <button class="btn btn-primary" type="button" @click="openUploadModal">
          Upload
        </button>
      </div>
    </article>

    <article class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h6 class="card-title mb-0">Uploaded Datasets</h6>
          <div class="d-flex align-items-center gap-2">
            <div class="view-mode-toggle" role="group" aria-label="Dataset view mode">
              <button
                class="view-mode-button"
                :class="{ active: viewMode === 'list' }"
                type="button"
                @click="setViewMode('list')"
              >
                <span class="view-mode-icon list" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                <span>List</span>
              </button>
              <button
                class="view-mode-button"
                :class="{ active: viewMode === 'card' }"
                type="button"
                @click="setViewMode('card')"
              >
                <span class="view-mode-icon card" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                <span>Card</span>
              </button>
            </div>
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
                <div class="d-flex gap-2 flex-wrap">
                  <button class="btn btn-primary btn-sm" type="button" @click.stop="goToDatasetDetail(row.id)">Details</button>
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
                  <button class="btn btn-primary btn-sm" type="button" @click.stop="goToDatasetDetail(row.id)">Details</button>
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

              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <div class="upload-picker h-100">
                    <select v-model="datasetForm.language" class="form-select">
                      <option value="zh">Chinese</option>
                      <option value="en">English</option>
                      <option value="multi">Multilingual</option>
                    </select>
                    <input
                      class="d-none"
                      type="file"
                      accept=".csv,.json,.jsonl,.txt,.zip"
                      multiple
                      webkitdirectory
                      directory
                      @change="onDatasetFilesChange"
                      ref="datasetFilesInputRef"
                    >
                    <button class="upload-picker-button" type="button" @click="triggerDatasetFolderPicker">
                      <i class="bi bi-folder2-open" aria-hidden="true"></i>
                      <span>Dataset folder</span>
                    </button>
                    <div class="upload-picker-status">{{ selectedFolderLabel }}</div>
                    <div class="upload-picker-hint">Select the folder that contains your dataset files.</div>
                  </div>
                </div>
                <div class="col-12 col-md-6">
                  <div class="upload-picker h-100">
                    <input
                      class="d-none"
                      type="file"
                      accept="image/*"
                      @change="onCoverFileChange"
                      ref="coverFileInputRef"
                    >
                    <button class="upload-picker-button" type="button" @click="triggerCoverFilePicker">
                      <i class="bi bi-image" aria-hidden="true"></i>
                      <span>Cover image</span>
                    </button>
                    <div class="upload-picker-status">{{ selectedCoverLabel }}</div>
                    <div class="upload-picker-hint">Optional. Add one preview image for this dataset.</div>
                  </div>
                </div>
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
                  Upload
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
import { useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import {
  deleteDataset,
  fetchDatasetDetail,
  fetchDatasets,
  fetchCurrentSession,
  updateDataset,
  updateDatasetCover,
  uploadDataset
} from '../../api/dataAgent'
import { getStoredUsername, isLoggedIn } from '../../api/auth'

const isLoading = ref(false)
const isSubmitting = ref(false)
const isSavingEdit = ref(false)
const isLoadingSampleDetail = ref(false)
const notice = ref('')
const router = useRouter()
const currentUsername = ref(getStoredUsername())
const currentUserId = ref(null)

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
const viewMode = ref('card')
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

const extractFolderNameFromFiles = (fileList = []) => {
  if (!Array.isArray(fileList) || fileList.length === 0) return ''
  const firstPath = String(fileList[0]?.webkitRelativePath || fileList[0]?.name || '')
  if (!firstPath) return ''
  const normalized = firstPath.replaceAll('\\', '/')
  const firstSegment = normalized.split('/')[0] || ''
  if (!firstSegment || firstSegment === normalized) return ''
  return firstSegment.trim()
}

const onDatasetFilesChange = (event) => {
  const files = event?.target?.files
  selectedDatasetFiles.value = files ? Array.from(files) : []

  const folderName = extractFolderNameFromFiles(selectedDatasetFiles.value)
  if (folderName) {
    datasetForm.value.name = folderName
  }
}

const onCoverFileChange = (event) => {
  const files = event?.target?.files
  selectedCoverFile.value = files && files.length > 0 ? files[0] : null
}

const triggerDatasetFolderPicker = () => {
  datasetFilesInputRef.value?.click()
}

const triggerCoverFilePicker = () => {
  coverFileInputRef.value?.click()
}

const onEditCoverChange = (event) => {
  const files = event?.target?.files
  editCoverFile.value = files && files.length > 0 ? files[0] : null
}

const selectedFolderLabel = computed(() => {
  if (selectedDatasetFiles.value.length === 0) return 'No dataset folder selected'
  const first = selectedDatasetFiles.value[0]?.webkitRelativePath || selectedDatasetFiles.value[0]?.name || ''
  const folderName = first.includes('/') ? first.split('/')[0] : 'Selected files'
  return `${folderName} (${selectedDatasetFiles.value.length} files)`
})

const selectedCoverLabel = computed(() => selectedCoverFile.value?.name || 'No cover image selected')
const editCoverLabel = computed(() => editCoverFile.value?.name || 'No new cover selected')

const normalizeSessionUser = (payload) => {
  const session = payload?.data || payload || {}
  const user = session?.user && typeof session.user === 'object' ? session.user : {}
  const rawId = Number(user?.id || session?.user_id || session?.id || 0)

  return {
    id: Number.isFinite(rawId) && rawId > 0 ? rawId : null,
    username: String(user?.username || session?.username || '').trim()
  }
}

const setViewMode = (mode) => {
  viewMode.value = mode === 'card' ? 'card' : 'list'
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

const refreshCurrentSession = async () => {
  currentUsername.value = getStoredUsername()
  currentUserId.value = null

  if (!isLoggedIn()) return

  try {
    const response = await fetchCurrentSession()
    const sessionUser = normalizeSessionUser(response)
    currentUserId.value = sessionUser.id
    currentUsername.value = sessionUser.username || getStoredUsername()
  } catch {
    currentUsername.value = getStoredUsername()
    currentUserId.value = null
  }
}

const refreshDatasets = async () => {
  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchDatasets()
    const normalized = mapDatasets(response)
    datasetRows.value = normalized

    if (normalized.length === 0) {
      return
    }
  } catch (error) {
    notice.value = `Backend unavailable. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

const goToDatasetDetail = (datasetId) => {
  if (!datasetId) return
  router.push(`/data-preparation/${datasetId}`)
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
  if (!isLoggedIn()) {
    notice.value = 'Please login first before uploading datasets.'
    return
  }
  if (!datasetForm.value.name) return
  if (selectedDatasetFiles.value.length === 0) {
    notice.value = 'Please select a dataset folder.'
    return
  }

  isSubmitting.value = true
  notice.value = ''
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
    if (currentUserId.value) {
      formData.append('user_id', String(currentUserId.value))
    }
    if (currentUsername.value) {
      formData.append('username', currentUsername.value)
    }

    await uploadDataset(formData)
    closeUploadModal()
    resetDatasetForm()
    await refreshDatasets()
  } catch (uploadError) {
    notice.value = `Upload failed. (${uploadError?.message || 'unknown error'})`
  } finally {
    isSubmitting.value = false
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

onMounted(async () => {
  await refreshCurrentSession()
  await refreshDatasets()
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


.dataset-card {
  border: 1px solid #e9ecef;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.dataset-card:hover {
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
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

.upload-picker {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.9rem;
  border: 1px dashed #d7dee7;
  border-radius: 14px;
  background: #fbfcfe;
}

.upload-picker-button {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.85rem 1rem;
  border: 1px solid #cfd8e3;
  border-radius: 12px;
  background: #ffffff;
  color: #0f172a;
  font-size: 0.95rem;
  font-weight: 600;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.upload-picker-button:hover {
  border-color: #9fb4cc;
  background: #f8fafc;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.upload-picker-status {
  color: #334155;
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}

.upload-picker-hint {
  color: #64748b;
  font-size: 0.78rem;
  line-height: 1.45;
}

.view-mode-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem;
  border: 1px solid #d7dee7;
  border-radius: 999px;
  background: #f8fafc;
  gap: 0.2rem;
}

.view-mode-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 0;
  background: transparent;
  color: #5f6b7a;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.view-mode-button:hover {
  color: #1f2937;
}

.view-mode-button.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.view-mode-icon {
  display: inline-grid;
  flex-shrink: 0;
}

.view-mode-icon.list {
  grid-template-columns: 1fr;
  gap: 0.16rem;
  width: 0.82rem;
}

.view-mode-icon.list span {
  display: block;
  width: 100%;
  height: 0.12rem;
  border-radius: 999px;
  background: currentColor;
}

.view-mode-icon.card {
  grid-template-columns: repeat(2, 0.28rem);
  gap: 0.12rem;
  width: 0.68rem;
  height: 0.68rem;
}

.view-mode-icon.card span {
  display: block;
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 0.12rem;
  background: currentColor;
}

.sample-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
