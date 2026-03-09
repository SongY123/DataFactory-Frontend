<template>
  <div class="module-page h-100">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Agent Interaction</h4>
        <p class="text-muted mb-0">File and Model workspaces use fixed size with scrollable content.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" type="button" @click="resetSession" :disabled="isBusy">
        Clear Session
      </button>
    </div>

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

    <article class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-12 col-lg-6">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <label class="form-label small fw-semibold mb-0">File</label>
              <span class="small text-muted">{{ uploadedFiles.length }} files</span>
            </div>
            <input
              ref="fileInputRef"
              class="form-control mb-2"
              type="file"
              multiple
              @change="onFilesChange"
              :disabled="isBusy"
            >

            <div class="workspace-box file-workspace">
              <div v-if="uploadedFiles.length === 0" class="small text-muted">No file uploaded.</div>
              <div v-else class="file-grid">
                <div
                  v-for="item in uploadedFiles"
                  :key="item.id"
                  class="file-item"
                  :class="{ active: item.id === activeFileId }"
                >
                  <button class="file-main" type="button" @click="setActiveFile(item.id)">
                    <div class="file-name" :title="item.file.name">{{ item.file.name }}</div>
                    <div class="file-meta">{{ formatFileSize(item.file.size) }}</div>
                  </button>
                  <button class="btn btn-outline-danger btn-sm file-remove-btn" type="button" :disabled="isBusy" @click="removeFile(item.id)">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-lg-6">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <label class="form-label small fw-semibold mb-0">Model</label>
              <button class="btn btn-outline-primary btn-sm" type="button" @click="openCreateModelModal">
                Add Model
              </button>
            </div>

            <div class="workspace-box model-workspace">
              <div v-if="models.length === 0" class="small text-muted">No configured model.</div>
              <ul v-else class="list-group model-list">
                <li v-for="item in models" :key="item.id" class="list-group-item model-row-item">
                  <button
                    class="btn btn-link text-start d-flex align-items-center justify-content-between model-item-btn"
                    type="button"
                    :class="{ active: item.id === selectedModel }"
                    @click="setActiveModel(item.id)"
                  >
                    <span class="fw-semibold text-truncate" :title="item.label">{{ item.label }}</span>
                    <span class="badge text-bg-light ms-2">{{ item.llm_provider === 'local' ? 'Local' : 'API' }}</span>
                  </button>
                  <button class="btn btn-outline-secondary btn-sm model-config-btn" type="button" @click="openModelConfigModal(item.id)">
                    Configure
                  </button>
                </li>
              </ul>
            </div>

            <div class="small text-muted mt-2">Current model: {{ selectedModelLabel }}</div>
          </div>
        </div>
      </div>
    </article>

    <div class="interaction-layout">
      <article class="card border-0 shadow-sm d-flex flex-column chat-shell">
        <div class="card-body chat-body">
          <div v-for="msg in messages" :key="msg.id" class="message-row" :class="msg.role">
            <div class="message-bubble">
              <div class="small fw-semibold mb-1">{{ msg.role === 'user' ? 'You' : 'Agent' }}</div>
              <pre class="message-text">{{ msg.text }}</pre>
            </div>
          </div>
        </div>

        <div class="card-footer bg-white border-0 pt-0">
          <form class="d-flex gap-2" @submit.prevent="submitPrompt">
            <input
              v-model.trim="chatPrompt"
              type="text"
              class="form-control"
              placeholder="Send a prompt. First send will generate a report."
              :disabled="isBusy"
            >
            <button class="btn btn-primary" type="submit" :disabled="!chatPrompt || isBusy">
              <span v-if="isBusy" class="spinner-border spinner-border-sm" role="status"></span>
              <span v-else>Send</span>
            </button>
          </form>
        </div>
      </article>

      <article class="card border-0 shadow-sm report-shell">
        <div class="card-body d-flex flex-column report-body">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <h6 class="card-title mb-0">Current Report</h6>
            <span class="badge text-bg-light">{{ sessionId ? `Session ${sessionId.slice(0, 8)}` : 'No Session' }}</span>
          </div>
          <pre class="report-preview">{{ currentReport || 'No report yet. Upload files and send a prompt first.' }}</pre>
        </div>
      </article>
    </div>

    <div class="modal fade" tabindex="-1" ref="modelConfigModalRef" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h6 class="modal-title mb-0">{{ modelFormMode === 'create' ? 'Add Model' : 'Configure Model' }}</h6>
            <button type="button" class="btn-close" @click="closeModelConfigModal"></button>
          </div>
          <div class="modal-body">
            <form class="d-flex flex-column gap-3" @submit.prevent="saveModelConfig">
              <div>
                <label class="form-label">Model Name</label>
                <input
                  v-model.trim="modelForm.label"
                  type="text"
                  class="form-control"
                  placeholder="Example: gpt-4o-mini"
                  required
                >
              </div>

              <div>
                <label class="form-label d-block mb-2">Mode</label>
                <div class="d-flex flex-wrap gap-3">
                  <div class="form-check">
                    <input id="cfg-api" v-model="modelForm.provider" value="api" class="form-check-input" type="radio">
                    <label class="form-check-label" for="cfg-api">API</label>
                  </div>
                  <div class="form-check">
                    <input id="cfg-local" v-model="modelForm.provider" value="local" class="form-check-input" type="radio">
                    <label class="form-check-label" for="cfg-local">Local</label>
                  </div>
                </div>
              </div>

              <template v-if="modelForm.provider === 'api'">
                <div>
                  <label class="form-label">API Endpoint</label>
                  <input
                    v-model.trim="modelForm.apiEndpoint"
                    type="text"
                    class="form-control"
                    placeholder="OpenAI-compatible endpoint"
                    required
                  >
                </div>
                <div>
                  <label class="form-label">API Key</label>
                  <input
                    v-model.trim="modelForm.apiKey"
                    type="password"
                    class="form-control"
                    placeholder="API key"
                  >
                </div>
                <div>
                  <label class="form-label">API Model Name</label>
                  <input
                    v-model.trim="modelForm.apiModelName"
                    type="text"
                    class="form-control"
                    placeholder="Example: gpt-4o-mini"
                  >
                </div>
              </template>

              <template v-else>
                <div>
                  <label class="form-label">Local Endpoint</label>
                  <input
                    v-model.trim="modelForm.localEndpoint"
                    type="text"
                    class="form-control"
                    placeholder="Example: http://127.0.0.1:11434/v1/chat/completions"
                    required
                  >
                </div>
                <div>
                  <label class="form-label">Local Model Name</label>
                  <input
                    v-model.trim="modelForm.localModelName"
                    type="text"
                    class="form-control"
                    placeholder="Example: qwen2.5:7b"
                  >
                </div>
              </template>

              <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-outline-secondary" type="button" @click="closeModelConfigModal">Cancel</button>
                <button class="btn btn-primary" type="submit">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Modal } from 'bootstrap'
import { generateAgentReport, reviseAgentReport } from '../../api/dataAgent'

const MODEL_STORAGE_KEY = 'agent-configured-models-v3'

const DEFAULT_MODEL = {
  id: 'gpt-4o-mini',
  label: 'gpt-4o-mini',
  llm_provider: 'api',
  llm_endpoint: '',
  llm_api_key: '',
  llm_model_name: 'gpt-4o-mini'
}

const fileInputRef = ref(null)
const modelConfigModalRef = ref(null)
let modelConfigModalInstance = null

const uploadedFiles = ref([])
const activeFileId = ref('')

const models = ref([])
const selectedModel = ref('')

const modelFormMode = ref('create')
const editingModelId = ref('')

const modelForm = ref({
  label: '',
  provider: 'api',
  apiEndpoint: '',
  apiKey: '',
  apiModelName: '',
  localEndpoint: '',
  localModelName: ''
})

const chatPrompt = ref('')
const sessionId = ref('')
const sessionFileId = ref('')
const currentReport = ref('')
const notice = ref('')

const isGenerating = ref(false)
const isRevising = ref(false)

const messages = ref([
  {
    id: 'm-init',
    role: 'assistant',
    text: 'Ready. Upload a file and select the model. The first prompt generates a report.'
  }
])

const isBusy = computed(() => isGenerating.value || isRevising.value)

const selectedModelConfig = computed(() => models.value.find((item) => item.id === selectedModel.value) || null)

const selectedModelLabel = computed(() => selectedModelConfig.value?.label || 'Not selected')

const activeFile = computed(() => uploadedFiles.value.find((item) => item.id === activeFileId.value) || null)

const appendMessage = (role, text) => {
  messages.value.push({
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    text: String(text || '')
  })
}

const formatFileSize = (size) => {
  const n = Number(size || 0)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

const normalizeModel = (raw = {}, fallbackId = DEFAULT_MODEL.id) => ({
  id: String(raw.id || fallbackId),
  label: String(raw.label || raw.name || raw.id || fallbackId),
  llm_provider: raw.llm_provider === 'local' ? 'local' : 'api',
  llm_endpoint: String(raw.llm_endpoint || ''),
  llm_api_key: String(raw.llm_api_key || ''),
  llm_model_name: String(raw.llm_model_name || raw.model || raw.name || raw.label || '')
})

const makeModelId = (label) => {
  const base = String(label || 'model')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'model'

  const existing = new Set(models.value.map((item) => item.id))
  let candidate = base
  let suffix = 2
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

const getStoredModels = () => {
  try {
    const text = localStorage.getItem(MODEL_STORAGE_KEY)
    if (!text) return []
    const list = JSON.parse(text)
    if (!Array.isArray(list)) return []
    return list.map((item, index) => normalizeModel(item, `model-${index + 1}`))
  } catch {
    return []
  }
}

const saveStoredModels = (modelList) => {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(modelList))
  } catch {
    // ignore localStorage errors
  }
}

const loadModels = () => {
  const stored = getStoredModels()
  models.value = stored.length > 0 ? stored : [normalizeModel(DEFAULT_MODEL)]
  if (!models.value.some((item) => item.id === selectedModel.value)) {
    selectedModel.value = models.value[0].id
  }
  saveStoredModels(models.value)
}

const setActiveModel = (modelId) => {
  selectedModel.value = modelId
}

const makeFileId = (file) => `${file.name}-${file.size}-${file.lastModified}`

const onFilesChange = (event) => {
  const files = event?.target?.files ? Array.from(event.target.files) : []
  if (files.length === 0) return

  const existingIds = new Set(uploadedFiles.value.map((item) => item.id))
  files.forEach((file) => {
    const id = makeFileId(file)
    if (existingIds.has(id)) return
    uploadedFiles.value.push({ id, file })
    existingIds.add(id)
  })

  if (!activeFileId.value && uploadedFiles.value.length > 0) {
    activeFileId.value = uploadedFiles.value[0].id
  }

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

const setActiveFile = (fileId) => {
  activeFileId.value = fileId
}

const removeFile = (fileId) => {
  const remain = uploadedFiles.value.filter((item) => item.id !== fileId)
  uploadedFiles.value = remain

  if (activeFileId.value === fileId) {
    activeFileId.value = remain[0]?.id || ''
  }
  if (sessionFileId.value === fileId) {
    sessionId.value = ''
    sessionFileId.value = ''
    currentReport.value = ''
  }
}

const getModelConfigModal = () => {
  if (!modelConfigModalRef.value) return null
  modelConfigModalInstance = Modal.getOrCreateInstance(modelConfigModalRef.value)
  return modelConfigModalInstance
}

const fillModelForm = (model) => {
  const config = normalizeModel(model)
  modelForm.value = {
    label: config.label,
    provider: config.llm_provider,
    apiEndpoint: config.llm_provider === 'api' ? config.llm_endpoint : '',
    apiKey: config.llm_provider === 'api' ? config.llm_api_key : '',
    apiModelName: config.llm_provider === 'api' ? config.llm_model_name : '',
    localEndpoint: config.llm_provider === 'local' ? config.llm_endpoint : '',
    localModelName: config.llm_provider === 'local' ? config.llm_model_name : ''
  }
}

const openCreateModelModal = () => {
  modelFormMode.value = 'create'
  editingModelId.value = ''
  modelForm.value = {
    label: '',
    provider: 'api',
    apiEndpoint: '',
    apiKey: '',
    apiModelName: '',
    localEndpoint: '',
    localModelName: ''
  }
  getModelConfigModal()?.show()
}

const openModelConfigModal = (modelId) => {
  const model = models.value.find((item) => item.id === modelId)
  if (!model) return

  modelFormMode.value = 'edit'
  editingModelId.value = model.id
  fillModelForm(model)
  getModelConfigModal()?.show()
}

const closeModelConfigModal = () => {
  getModelConfigModal()?.hide()
}

const saveModelConfig = () => {
  notice.value = ''
  const label = modelForm.value.label.trim()
  if (!label) {
    notice.value = 'Please enter model name.'
    return
  }

  const provider = modelForm.value.provider === 'local' ? 'local' : 'api'
  const endpoint = provider === 'api'
    ? modelForm.value.apiEndpoint.trim()
    : modelForm.value.localEndpoint.trim()

  if (!endpoint) {
    notice.value = provider === 'api' ? 'Please enter API endpoint.' : 'Please enter local endpoint.'
    return
  }

  if (modelFormMode.value === 'edit' && editingModelId.value) {
    models.value = models.value.map((item) => {
      if (item.id !== editingModelId.value) return item
      return {
        ...item,
        label,
        llm_provider: provider,
        llm_endpoint: endpoint,
        llm_api_key: provider === 'api' ? modelForm.value.apiKey.trim() : '',
        llm_model_name: provider === 'api'
          ? modelForm.value.apiModelName.trim() || label
          : modelForm.value.localModelName.trim() || label
      }
    })
    selectedModel.value = editingModelId.value
  } else {
    const newId = makeModelId(label)
    const newModel = {
      id: newId,
      label,
      llm_provider: provider,
      llm_endpoint: endpoint,
      llm_api_key: provider === 'api' ? modelForm.value.apiKey.trim() : '',
      llm_model_name: provider === 'api'
        ? modelForm.value.apiModelName.trim() || label
        : modelForm.value.localModelName.trim() || label
    }
    models.value = [...models.value, newModel]
    selectedModel.value = newId
  }

  saveStoredModels(models.value)
  closeModelConfigModal()
}

const getRuntimePayload = () => {
  const model = selectedModelConfig.value
  if (!model) {
    notice.value = 'Please select a model.'
    return null
  }
  if (!model.llm_endpoint) {
    notice.value = 'The selected model has no endpoint. Configure it first.'
    return null
  }

  return {
    llm_provider: model.llm_provider,
    llm_endpoint: model.llm_endpoint,
    llm_api_key: model.llm_api_key,
    llm_model_name: model.llm_model_name
  }
}

const generateReport = async (prompt) => {
  if (!activeFile.value?.file) {
    notice.value = 'Please upload a file first.'
    return
  }
  const runtime = getRuntimePayload()
  if (!runtime) return

  isGenerating.value = true
  notice.value = ''
  appendMessage('user', prompt)

  try {
    const formData = new FormData()
    formData.append('file', activeFile.value.file, activeFile.value.file.name)
    formData.append('model', selectedModel.value || '')
    formData.append('prompt', prompt)
    formData.append('llm_provider', runtime.llm_provider)
    formData.append('llm_endpoint', runtime.llm_endpoint)
    formData.append('llm_api_key', runtime.llm_api_key)
    formData.append('llm_model_name', runtime.llm_model_name)

    const response = await generateAgentReport(formData)
    const data = response?.data || {}
    sessionId.value = String(data.session_id || '').trim()
    sessionFileId.value = activeFile.value.id
    currentReport.value = String(data.report || '').trim()
    appendMessage('assistant', currentReport.value || 'Report generated, but returned empty content.')
  } catch (error) {
    const msg = `Generate failed: ${error?.message || 'unknown error'}`
    notice.value = msg
    appendMessage('assistant', msg)
  } finally {
    isGenerating.value = false
  }
}

const reviseReport = async (prompt) => {
  if (!sessionId.value) {
    await generateReport(prompt)
    return
  }
  const runtime = getRuntimePayload()
  if (!runtime) return

  isRevising.value = true
  notice.value = ''
  appendMessage('user', prompt)

  try {
    const response = await reviseAgentReport({
      session_id: sessionId.value,
      model: selectedModel.value || null,
      prompt,
      ...runtime
    })
    const data = response?.data || {}
    currentReport.value = String(data.report || '').trim()
    appendMessage('assistant', currentReport.value || 'Report revised, but returned empty content.')
  } catch (error) {
    const msg = `Revise failed: ${error?.message || 'unknown error'}`
    notice.value = msg
    appendMessage('assistant', msg)
  } finally {
    isRevising.value = false
  }
}

const submitPrompt = async () => {
  const prompt = chatPrompt.value.trim()
  if (!prompt || isBusy.value) return
  chatPrompt.value = ''

  const isFileSwitched = sessionFileId.value && sessionFileId.value !== activeFileId.value
  if (!sessionId.value || isFileSwitched) {
    if (isFileSwitched) {
      sessionId.value = ''
      sessionFileId.value = ''
      currentReport.value = ''
      appendMessage('assistant', 'File switched. Started a new report session automatically.')
    }
    await generateReport(prompt)
    return
  }

  await reviseReport(prompt)
}

const resetSession = () => {
  if (isBusy.value) return

  chatPrompt.value = ''
  sessionId.value = ''
  sessionFileId.value = ''
  currentReport.value = ''
  notice.value = ''

  messages.value = [
    {
      id: `m-reset-${Date.now()}`,
      role: 'assistant',
      text: 'Session reset. Uploaded files and model configuration are kept.'
    }
  ]
}

onMounted(() => {
  loadModels()
})

onBeforeUnmount(() => {
  modelConfigModalInstance?.dispose()
})
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.workspace-box {
  height: 220px;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  padding: 0.5rem;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #ffffff;
  padding: 0.35rem 0.4rem;
  min-width: 0;
}

.file-item.active {
  border-color: #bfdbff;
  background: #f0f7ff;
}

.file-main {
  border: none;
  background: transparent;
  text-align: left;
  padding: 0;
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.2;
}

.file-remove-btn {
  flex: 0 0 auto;
  padding: 0.15rem 0.35rem;
  font-size: 0.72rem;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.model-row-item {
  display: flex;
  align-items: stretch;
  gap: 0.45rem;
  padding: 0.35rem;
}

.model-item-btn {
  text-decoration: none;
  color: inherit;
  border-radius: 6px;
  padding: 0.45rem 0.55rem;
  flex: 1;
  min-width: 0;
}

.model-item-btn.active {
  background: #eef5ff;
}

.model-config-btn {
  flex: 0 0 auto;
  align-self: center;
  padding: 0.2rem 0.45rem;
}

.interaction-layout {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 1rem;
}

.chat-shell,
.report-shell {
  height: 560px;
  min-height: 0;
}

.chat-body,
.report-body {
  min-height: 0;
}

.chat-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: auto;
  flex: 1;
}

.message-row {
  display: flex;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 92%;
  border-radius: 12px;
  padding: 0.65rem 0.75rem;
  border: 1px solid #dbe4f0;
}

.message-row.user .message-bubble {
  background: #edf4ff;
  border-color: #c9dcff;
}

.message-row.assistant .message-bubble {
  background: #fbfdff;
}

.message-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.report-preview {
  margin: 0;
  flex: 1;
  min-height: 0;
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 992px) {
  .interaction-layout {
    grid-template-columns: 1fr;
  }

  .workspace-box {
    height: 190px;
  }

  .chat-shell,
  .report-shell {
    height: 460px;
  }
}
</style>