<template>
  <div class="sandbox-environment-panel">
    <div class="sandbox-environment-label-row">
      <div class="sandbox-environment-copy">
        <label class="small text-muted mb-0">{{ label }}</label>
        <div v-if="description" class="sandbox-environment-description">{{ description }}</div>
      </div>
    </div>

    <div class="sandbox-environment-select-row">
      <select
        class="form-select"
        :value="modelValue || ''"
        :disabled="disabled || isLoading || environments.length === 0"
        @change="handleSelectionChange"
      >
        <option v-if="environments.length === 0" value="">No environments available</option>
        <option v-for="item in environments" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
      </select>

      <button
        class="environment-settings-btn"
        type="button"
        :disabled="disabled || isLoading"
        title="Manage environments"
        aria-label="Manage environments"
        @click="openManager"
      >
        <i class="bi bi-gear"></i>
      </button>
    </div>
  </div>

  <div class="modal fade environment-manager-modal" tabindex="-1" ref="managerModalRef" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h6 class="modal-title mb-1">Environment Management</h6>
            <p class="text-muted small mb-0">Create or remove server-side Python sandbox environments. At least one environment must remain.</p>
          </div>
          <button type="button" class="btn-close" aria-label="Close" @click="closeManager"></button>
        </div>

        <div class="modal-body">
          <div v-if="errorMessage" class="alert alert-danger py-2 px-3" role="alert">{{ errorMessage }}</div>

          <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
            <div class="small text-muted">Current selected environment: {{ selectedEnvironment?.name || 'None' }}</div>
            <button
              class="btn btn-outline-secondary btn-sm"
              type="button"
              :disabled="isLoading || isCreating || isDeleting"
              @click="refreshEnvironments"
            >
              Refresh
            </button>
          </div>

          <div class="environment-manager-list">
            <div
              v-for="item in environments"
              :key="item.id"
              class="environment-manager-card"
              :class="{ active: String(item.id) === String(modelValue || '') }"
            >
              <div class="environment-manager-card-head">
                <div>
                  <div class="environment-manager-name">{{ item.name }}</div>
                  <div class="environment-manager-path">{{ item.python_path }}</div>
                </div>
                <div class="environment-manager-badges">
                  <span v-if="item.is_default" class="badge text-bg-light">Default</span>
                  <span v-if="String(item.id) === String(modelValue || '')" class="badge text-bg-primary">Selected</span>
                </div>
              </div>

              <div class="environment-manager-meta">
                Updated {{ formatDateTime(item.updated_at) }}
              </div>

              <div class="environment-manager-actions">
                <button
                  class="btn btn-outline-primary btn-sm"
                  type="button"
                  :disabled="disabled || isCreating || isDeleting"
                  @click="selectEnvironmentFromManager(item.id)"
                >
                  Use
                </button>
                <button
                  class="btn btn-outline-danger btn-sm"
                  type="button"
                  :disabled="disabled || isCreating || isDeleting || environments.length <= 1"
                  @click="handleDelete(item.id)"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div class="environment-creator-panel">
            <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
              <h6 class="mb-0">Create Environment</h6>
              <button
                v-if="creatorOpen"
                class="btn btn-outline-secondary btn-sm"
                type="button"
                :disabled="isCreating || isDeleting"
                @click="resetCreator"
              >
                Cancel
              </button>
            </div>

            <button
              v-if="!creatorOpen"
              class="btn btn-outline-primary btn-sm"
              type="button"
              :disabled="disabled || isCreating || isDeleting"
              @click="creatorOpen = true"
            >
              New Environment
            </button>

            <div v-else class="row g-2">
              <div class="col-12 col-lg-4">
                <label class="small text-muted mb-1">Environment Name</label>
                <input
                  v-model.trim="creatorForm.name"
                  type="text"
                  class="form-control"
                  maxlength="120"
                  placeholder="Example: Python 3.11 venv"
                  :disabled="disabled || isCreating || isDeleting"
                >
              </div>
              <div class="col-12 col-lg-8">
                <label class="small text-muted mb-1">Server Python Path</label>
                <input
                  v-model.trim="creatorForm.pythonPath"
                  type="text"
                  class="form-control"
                  maxlength="1000"
                  placeholder="C:\\Users\\name\\.conda\\envs\\data-agent\\python.exe or /opt/venvs/data-agent/bin/python"
                  :disabled="disabled || isCreating || isDeleting"
                >
              </div>
              <div class="col-12">
                <button
                  class="btn btn-primary btn-sm"
                  type="button"
                  :disabled="disabled || isCreating || isDeleting"
                  @click="handleCreate"
                >
                  <span v-if="isCreating" class="spinner-border spinner-border-sm me-1" role="status"></span>
                  Create Environment
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline-secondary" type="button" @click="closeManager">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Modal } from 'bootstrap'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createSandboxEnvironment,
  deleteSandboxEnvironment,
  fetchSandboxEnvironments
} from '../api/dataAgent'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: 'Environment'
  },
  description: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const environments = ref([])
const defaultEnvironmentId = ref('')
const isLoading = ref(false)
const isCreating = ref(false)
const isDeleting = ref(false)
const creatorOpen = ref(false)
const errorMessage = ref('')
const managerModalRef = ref(null)
const creatorForm = ref({
  name: '',
  pythonPath: ''
})

let managerModalInstance = null

const selectedEnvironment = computed(() => {
  const current = String(props.modelValue || '').trim()
  return environments.value.find((item) => String(item.id) === current) || null
})

const formatDateTime = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw.replace('T', ' ').slice(0, 19)

  const pad = (num) => String(num).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const getManagerModal = () => {
  if (!managerModalRef.value) return null
  managerModalInstance = Modal.getOrCreateInstance(managerModalRef.value)
  return managerModalInstance
}

const openManager = () => {
  creatorOpen.value = false
  errorMessage.value = ''
  getManagerModal()?.show()
}

const closeManager = () => {
  getManagerModal()?.hide()
}

const syncSelection = (preferredId = '') => {
  const preferred = String(preferredId || props.modelValue || '').trim()
  const availableIds = new Set(environments.value.map((item) => String(item.id)))
  const fallbackId = String(defaultEnvironmentId.value || environments.value[0]?.id || '').trim()
  const nextId = availableIds.has(preferred) ? preferred : fallbackId
  if (nextId && nextId !== String(props.modelValue || '').trim()) {
    emit('update:modelValue', nextId)
  } else if (!nextId && props.modelValue) {
    emit('update:modelValue', '')
  }
}

const applyPayload = (payload = {}, preferredId = '') => {
  const items = Array.isArray(payload?.items) ? payload.items : []
  environments.value = items
    .map((item) => ({
      id: String(item?.id || '').trim(),
      name: String(item?.name || '').trim(),
      python_path: String(item?.python_path || '').trim(),
      updated_at: String(item?.updated_at || '').trim(),
      is_default: Boolean(item?.is_default)
    }))
    .filter((item) => item.id && item.name)
  defaultEnvironmentId.value = String(payload?.default_id || environments.value.find((item) => item.is_default)?.id || environments.value[0]?.id || '').trim()
  syncSelection(preferredId)
}

const refreshEnvironments = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const response = await fetchSandboxEnvironments()
    applyPayload(response?.data || response || {})
  } catch (error) {
    environments.value = []
    defaultEnvironmentId.value = ''
    errorMessage.value = error?.message || 'Failed to load sandbox environments.'
  } finally {
    isLoading.value = false
  }
}

const handleSelectionChange = (event) => {
  emit('update:modelValue', String(event?.target?.value || '').trim())
}

const resetCreator = () => {
  creatorOpen.value = false
  creatorForm.value = {
    name: '',
    pythonPath: ''
  }
}

const handleCreate = async () => {
  const name = String(creatorForm.value.name || '').trim()
  const pythonPath = String(creatorForm.value.pythonPath || '').trim()
  if (!name || !pythonPath) {
    errorMessage.value = 'Environment name and server Python path are required.'
    return
  }

  isCreating.value = true
  errorMessage.value = ''
  try {
    const response = await createSandboxEnvironment({
      name,
      python_path: pythonPath
    })
    const payload = response?.data || response || {}
    const selectedId = String(payload?.selected?.id || '').trim()
    applyPayload(payload, selectedId)
    resetCreator()
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to create sandbox environment.'
  } finally {
    isCreating.value = false
  }
}

const handleDelete = async (environmentId = props.modelValue) => {
  const targetId = String(environmentId || '').trim()
  const target = environments.value.find((item) => String(item.id) === targetId)
  if (!targetId || !target) return
  if (environments.value.length <= 1) {
    errorMessage.value = 'At least one sandbox environment must be retained.'
    return
  }

  const confirmed = typeof window === 'undefined'
    ? true
    : window.confirm(`Delete sandbox environment "${target.name}"? This only removes it from the system list.`)
  if (!confirmed) return

  isDeleting.value = true
  errorMessage.value = ''
  try {
    const response = await deleteSandboxEnvironment(targetId)
    const payload = response?.data || response || {}
    applyPayload(payload, String(payload?.default_id || '').trim())
  } catch (error) {
    errorMessage.value = error?.message || 'Failed to delete sandbox environment.'
  } finally {
    isDeleting.value = false
  }
}

const selectEnvironmentFromManager = (environmentId) => {
  emit('update:modelValue', String(environmentId || '').trim())
}

watch(
  () => props.modelValue,
  () => {
    syncSelection()
  }
)

onMounted(() => {
  refreshEnvironments()
})

onBeforeUnmount(() => {
  managerModalInstance?.dispose()
})
</script>

<style scoped>
:global(.environment-manager-modal) {
  z-index: 1400;
}

:global(.modal-backdrop) {
  z-index: 1390;
}

.sandbox-environment-panel {
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  background: linear-gradient(180deg, #fbfdff 0%, #f6f9fc 100%);
  padding: 0.85rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.sandbox-environment-label-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.sandbox-environment-copy {
  min-width: 0;
}

.sandbox-environment-description {
  font-size: 0.78rem;
  color: #5f7392;
  line-height: 1.4;
  margin-top: 0.15rem;
}

.sandbox-environment-select-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.55rem;
}

.environment-settings-btn {
  width: 40px;
  height: 38px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fff;
  color: #3b5578;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.environment-settings-btn:hover:not(:disabled) {
  border-color: #9fb8e5;
  background: #f4f8ff;
  color: #234267;
}

.environment-settings-btn:disabled {
  opacity: 0.65;
}

.environment-manager-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.environment-manager-card {
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #fbfdff;
  padding: 0.85rem;
}

.environment-manager-card.active {
  border-color: #6a9ae6;
  box-shadow: 0 0 0 0.18rem rgba(13, 110, 253, 0.1);
}

.environment-manager-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.environment-manager-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #223854;
}

.environment-manager-path {
  margin-top: 0.2rem;
  font-size: 0.8rem;
  color: #5f7392;
  word-break: break-all;
}

.environment-manager-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.environment-manager-meta {
  margin-top: 0.55rem;
  font-size: 0.76rem;
  color: #74849a;
}

.environment-manager-actions {
  display: flex;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.environment-creator-panel {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed #d7e0ea;
}

@media (max-width: 767px) {
  .sandbox-environment-select-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .environment-settings-btn {
    width: 100%;
  }

  .environment-manager-card-head {
    flex-direction: column;
  }
}
</style>
