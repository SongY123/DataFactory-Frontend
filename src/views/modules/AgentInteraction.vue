<template>
  <div class="interaction-shell h-100">
    <aside class="workspace-panel">
      <div class="panel-header">
        <div>
          <h6 class="mb-1">Data Assets</h6>
          <small class="text-muted">{{ assetStatsText }}</small>
        </div>
        <div class="header-actions">
          <button
            class="btn btn-sm btn-link"
            type="button"
            :disabled="isBusy"
            @click="refreshAssetTree({ silent: false })"
            title="Refresh assets"
          >
            <i class="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>


      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.xlsm,.json,.jsonl"
        class="d-none"
        :disabled="isBusy"
        @change="onFilesChange"
      >

      <div class="workspace-list asset-tree-list">
        <div v-if="isAssetsLoading" class="empty-workspaces text-muted">
          Loading your saved folders and files...
        </div>

        <div v-else class="asset-tree">
          <div
            class="asset-row asset-row-root"
            :class="{ active: selectedAssetType === 'folder' && selectedAssetPath === '' }"
          >
            <button class="asset-main-btn" type="button" @click="selectRoot">
              <span class="asset-icon root"><i class="bi bi-hdd-stack"></i></span>
              <span class="asset-copy">
                <span class="asset-name">Root</span>
                <span class="asset-meta">All saved files for this account</span>
              </span>
            </button>
            <div class="asset-row-actions root-row-actions">
              <button
                class="asset-inline-action"
                type="button"
                :disabled="isBusy"
                :title="`Upload files to ${currentTargetFolderLabel}`"
                @click.stop="triggerFilePicker()"
              >
                <i class="bi bi-upload"></i>
              </button>
              <button
                class="asset-inline-action"
                type="button"
                :disabled="isBusy"
                :title="`Create folder under ${currentTargetFolderLabel}`"
                @click.stop="beginInlineFolderCreate()"
              >
                <i class="bi bi-folder-plus"></i>
              </button>
            </div>
          </div>

          <div v-if="!assetTreeItems.length && !pendingFolderDraft" class="empty-workspaces text-muted">
            No files yet. Use the icons on Root to add files or create folders.
          </div>

          <div v-for="node in flattenedAssetRows" :key="node.id" class="asset-row-wrap">
            <div v-if="node.isPending" class="asset-row pending-folder-row" :style="{ paddingLeft: `${0.75 + node.depth * 1.05}rem` }">
              <span class="asset-expand-spacer"></span>
              <div class="asset-main-btn pending-folder-main">
                <span class="asset-icon folder"><i class="bi bi-folder-fill"></i></span>
                <div class="asset-copy pending-folder-input-wrap">
                  <input
                    ref="pendingFolderInputRef"
                    v-model="pendingFolderDraft.name"
                    type="text"
                    class="pending-folder-input"
                    placeholder="New folder"
                    @keydown.enter.prevent="commitInlineFolderCreate"
                    @keydown.esc.prevent="cancelInlineFolderCreate"
                    @blur="commitInlineFolderCreate"
                  >
                  <span class="asset-meta pending-folder-hint">Press Enter to save</span>
                </div>
              </div>
            </div>

            <div v-else class="asset-row" :class="[{ active: isSelectedNode(node) }, node.type]" :style="{ paddingLeft: `${0.75 + node.depth * 1.05}rem` }">
              <button
                v-if="node.type === 'folder'"
                class="asset-expand-btn"
                type="button"
                @click.stop="toggleFolder(node.path)"
              >
                <i class="bi" :class="isFolderExpanded(node.path) ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
              </button>
              <span v-else class="asset-expand-spacer"></span>

              <button class="asset-main-btn" type="button" @click="selectAssetNode(node)">
                <span class="asset-icon" :class="node.type">
                  <i class="bi" :class="node.type === 'folder' ? 'bi-folder-fill' : ((node.extension === '.json' || node.extension === '.jsonl') ? 'bi-filetype-json' : 'bi-file-earmark-spreadsheet')"></i>
                </span>
                <span class="asset-copy">
                  <span class="asset-name" :title="node.path || node.name">{{ node.name }}</span>
                  <span class="asset-meta">{{ node.meta }}</span>
                </span>
              </button>

              <button
                class="asset-delete-btn"
                type="button"
                :disabled="isBusy"
                :title="node.type === 'folder' ? 'Delete folder' : 'Delete file'"
                @click.stop="removeAsset(node)"
              >
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <section class="chat-panel card border-0 shadow-sm">
      <div class="chat-panel-header">
        <div>
          <h5 class="mb-1">Agent Interaction</h5>
          <p class="text-muted mb-0">Multi-agent streaming conversation over the saved folders and files in your asset library.</p>
        </div>
      </div>

      <div v-if="notice" class="alert alert-info mx-3 mt-3 mb-0 py-2 px-3" role="alert">{{ notice }}</div>

      <div ref="chatBodyRef" class="chat-body">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-row"
          :class="msg.role === 'user' ? 'user' : 'assistant'"
        >
          <div v-if="msg.role === 'user'" class="message-bubble user-bubble">
            <div class="small fw-semibold mb-1">You</div>
            <p class="mb-0 message-text-plain">{{ msg.text }}</p>
          </div>

          <div v-else class="assistant-message-shell">
            <template v-if="msg.agentSteps && msg.agentSteps.length > 0">
              <div v-for="(step, index) in msg.agentSteps" :key="`${msg.id}-${index}`" class="agent-step-container">
                <div v-if="index > 0" class="step-connector">
                  <div class="line" :class="{ 'line-running': step.status === 'running' || msg.agentSteps[index - 1].status === 'running' }"></div>
                  <i class="bi bi-chevron-down arrow"></i>
                </div>

                <div class="agent-block border rounded bg-white shadow-sm overflow-hidden">
                  <div class="d-flex align-items-center gap-2 px-3 py-2 bg-light border-bottom">
                    <div class="rounded-circle bg-white border d-flex align-items-center justify-content-center agent-icon-wrap">
                      <i class="bi bi-lightning-charge-fill text-warning" v-if="step.agent === 'Orchestrator' || step.agent === 'Planner'"></i>
                      <i class="bi bi-table text-success" v-else-if="step.agent === 'TableFinder' || step.agent === 'DataAnalyst'"></i>
                      <i class="bi bi-bar-chart text-info" v-else-if="step.agent === 'Visualization'"></i>
                      <i class="bi bi-file-earmark-text text-primary" v-else-if="step.agent === 'ReportWriter'"></i>
                      <i class="bi bi-robot text-primary" v-else></i>
                    </div>
                    <span class="fw-semibold small">{{ step.agent }}</span>

                    <div class="ms-auto d-flex align-items-center gap-2">
                      <template v-if="step.status === 'running'">
                        <span class="step-running-label">Thinking</span>
                        <button
                          class="stream-control-btn stream-control-inline"
                          type="button"
                          :disabled="!isStreaming"
                          title="Stop response"
                          aria-label="Stop response"
                          @click="stopStreaming"
                        >
                          <span class="stop-square-icon" aria-hidden="true"></span>
                        </button>
                      </template>
                      <i v-else-if="step.status === 'done'" class="bi bi-check-circle-fill text-success"></i>
                      <i v-else-if="step.status === 'stopped'" class="bi bi-stop-circle-fill text-warning"></i>
                      <i v-else-if="step.status === 'error'" class="bi bi-exclamation-circle-fill text-danger"></i>
                    </div>
                  </div>

                  <div class="px-3 py-3 markdown-body small" v-html="renderMarkdown(step.content)"></div>
                </div>
              </div>
            </template>

            <div v-else class="message-bubble assistant-bubble">
              <div class="small fw-semibold mb-1">Agent</div>
              <div class="message-text markdown-body" v-html="renderMarkdown(msg.text)"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-footer">
        <div class="composer-shell">
          <form class="composer-form" @submit.prevent="submitPrompt">
            <div v-if="selectedFileAsset" class="composer-selection-row">
              <div class="composer-selection-chip" :title="selectedFileAsset.path">
                <span class="composer-selection-icon">
                  <i class="bi" :class="selectedFileAsset?.extension === '.json' || selectedFileAsset?.extension === '.jsonl' ? 'bi-filetype-json' : 'bi-file-earmark-spreadsheet'"></i>
                </span>
                <span class="composer-selection-copy">
                  <span class="composer-selection-label">Analyzing file</span>
                  <span class="composer-selection-name">{{ selectedFileAsset.name }}</span>
                </span>
              </div>
            </div>

            <textarea
              ref="composerRef"
              v-model="chatPrompt"
              class="form-control composer"
              rows="2"
              :placeholder="selectedFileAsset ? `Ask a question about ${selectedFileAsset.name}. Enter sends, Shift+Enter adds a new line.` : 'Ask a question about the uploaded files. Enter sends, Shift+Enter adds a new line.'"
              :disabled="isUploading"
              @keydown.enter.exact.prevent="submitPrompt"
              @input="adjustComposerHeight"
            ></textarea>

            <div class="composer-bottom-row">
              <div class="composer-left-actions">
                <button
                  class="composer-plus-btn"
                  type="button"
                  :disabled="isBusy"
                  title="Add model configuration"
                  aria-label="Add model configuration"
                  @click="openModelConfigModal"
                >
                  <i class="bi bi-plus-lg"></i>
                </button>

                <div ref="modelPickerRef" class="model-picker">
                  <button
                    class="model-picker-btn"
                    type="button"
                    :disabled="isBusy"
                    @click="toggleModelMenu"
                  >
                    <span class="model-picker-icon" :class="`model-tone-${activeModelOption.tone}`">
                      <i class="bi" :class="activeModelOption.icon"></i>
                    </span>
                    <span class="model-picker-label">{{ activeModelOption.label }}</span>
                    <i class="bi bi-chevron-down model-picker-caret" :class="{ open: isModelMenuOpen }"></i>
                  </button>

                  <div v-if="isModelMenuOpen" class="model-picker-menu">
                    <button
                      v-for="option in modelOptions"
                      :key="option.id"
                      class="model-menu-item"
                      :class="{ active: option.id === activeModelId }"
                      type="button"
                      @click="selectModel(option.id)"
                    >
                      <span class="model-picker-icon model-menu-icon" :class="`model-tone-${option.tone}`">
                        <i class="bi" :class="option.icon"></i>
                      </span>
                      <span class="model-menu-copy">
                        <span class="model-menu-title">{{ option.label }}</span>
                        <span class="model-menu-meta">{{ option.meta }}</span>
                      </span>
                      <i v-if="option.id === activeModelId" class="bi bi-check2 model-menu-check"></i>
                    </button>
                  </div>
                </div>
              </div>

              <button
                v-if="isStreaming"
                class="stream-control-btn composer-action-btn stream-control-composer"
                type="button"
                title="Stop response"
                aria-label="Stop response"
                @click="stopStreaming"
              >
                <span class="stop-square-icon" aria-hidden="true"></span>
              </button>
              <button
                v-else
                class="stream-control-btn composer-action-btn stream-control-composer"
                type="submit"
                :disabled="!chatPrompt.trim() || isUploading"
                title="Send message"
                aria-label="Send message"
              >
                <span v-if="isUploading" class="spinner-border spinner-border-sm" role="status"></span>
                <i v-else class="bi bi-arrow-up"></i>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  </div>

  <div class="modal fade" tabindex="-1" ref="modelConfigModalRef" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h6 class="modal-title mb-1">Model Configuration</h6>
            <p class="text-muted small mb-0">Store local or API model configs in this browser and choose which one answers the next prompt.</p>
          </div>
          <button type="button" class="btn-close" @click="closeModelConfigModal"></button>
        </div>

        <div class="modal-body">
          <div v-if="modelFormError" class="alert alert-danger py-2 px-3" role="alert">{{ modelFormError }}</div>

          <div class="row g-4">
            <div class="col-lg-7">
              <div class="mb-3">
                <label class="form-label small text-muted mb-2">Connection Type</label>
                <div class="mode-toggle-group">
                  <button
                    class="btn btn-sm"
                    :class="modelForm.mode === 'local' ? 'btn-dark' : 'btn-outline-secondary'"
                    type="button"
                    @click="setModelFormMode('local')"
                  >
                    Local
                  </button>
                  <button
                    class="btn btn-sm"
                    :class="modelForm.mode === 'api' ? 'btn-dark' : 'btn-outline-secondary'"
                    type="button"
                    @click="setModelFormMode('api')"
                  >
                    API
                  </button>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label small text-muted mb-1">Display Name</label>
                <input v-model="modelForm.name" type="text" class="form-control" maxlength="128" placeholder="Example: Local Qwen 30B">
              </div>

              <div class="mb-3">
                <label class="form-label small text-muted mb-1">Model Name</label>
                <input v-model="modelForm.model_name" type="text" class="form-control" maxlength="200" placeholder="qwen3-coder:30b-a3b-fp16 / gpt-4.1-mini">
              </div>

              <template v-if="modelForm.mode === 'local'">
                <div class="mb-3">
                  <label class="form-label small text-muted mb-1">Local Host</label>
                  <input v-model="modelForm.host" type="text" class="form-control" maxlength="500" placeholder="http://127.0.0.1:11434">
                </div>
                <small class="text-muted d-block">Local mode uses the Ollama backend path and sends `host + model_name` with the chat request.</small>
              </template>

              <template v-else>
                <div class="mb-3">
                  <label class="form-label small text-muted mb-1">API Key</label>
                  <input v-model="modelForm.api_key" type="password" class="form-control" maxlength="500" placeholder="sk-...">
                </div>
                <div class="mb-3">
                  <label class="form-label small text-muted mb-1">Base URL</label>
                  <input v-model="modelForm.base_url" type="text" class="form-control" maxlength="500" placeholder="Optional: https://api.openai.com/v1">
                </div>
                <div class="mb-3">
                  <label class="form-label small text-muted mb-1">Organization</label>
                  <input v-model="modelForm.organization" type="text" class="form-control" maxlength="200" placeholder="Optional organization id">
                </div>
                <small class="text-muted d-block">API mode uses an OpenAI-compatible chat client. Leave Base URL empty for the default OpenAI endpoint.</small>
              </template>
            </div>

            <div class="col-lg-5">
              <div class="saved-model-panel">
                <div class="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <h6 class="mb-1">Saved Models</h6>
                    <small class="text-muted">Stored in your current browser only.</small>
                  </div>
                  <button class="btn btn-sm btn-outline-secondary" type="button" @click="startCreateModel()">New</button>
                </div>

                <div v-if="savedModelConfigs.length === 0" class="empty-saved-models text-muted">
                  No custom model configs yet. Use the form to add a local or API model.
                </div>

                <div
                  v-for="item in savedModelConfigs"
                  :key="item.id"
                  class="saved-model-card"
                  :class="{ active: item.id === activeModelId }"
                >
                  <div class="saved-model-card-head">
                    <div>
                      <div class="saved-model-name">{{ item.name }}</div>
                      <div class="saved-model-meta">{{ item.mode === 'local' ? 'Local' : 'API' }} | {{ item.model_name }}</div>
                    </div>
                    <span class="badge text-bg-light">{{ item.mode === 'local' ? 'Local' : 'API' }}</span>
                  </div>

                  <div class="saved-model-endpoint text-muted">
                    {{ item.mode === 'local' ? item.host : (item.base_url || 'Default OpenAI endpoint') }}
                  </div>

                  <div class="saved-model-actions">
                    <button class="btn btn-sm btn-outline-primary" type="button" @click="useModelConfig(item.id)">Use</button>
                    <button class="btn btn-sm btn-outline-secondary" type="button" @click="editModelConfig(item.id)">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" type="button" :disabled="isBusy" @click="deleteModelConfig(item.id)">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline-secondary" type="button" @click="closeModelConfigModal">Close</button>
          <button class="btn btn-dark" type="button" @click="saveModelConfig">
            {{ editingModelId ? 'Update Model' : 'Save Model' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Modal } from 'bootstrap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createAgentAssetFolder,
  deleteAgentAssetFile,
  deleteAgentAssetFolder,
  fetchAgentAssetTree,
  streamAgentInteractionChat,
  uploadAgentInteractionFile
} from '../../api/dataAgent'

const SERVER_DEFAULT_MODEL_ID = 'server-default'
const MODEL_CONFIGS_STORAGE_KEY = 'datafactory.agentInteraction.modelConfigs.v1'
const ACTIVE_MODEL_STORAGE_KEY = 'datafactory.agentInteraction.activeModelId.v1'

const fileInputRef = ref(null)
const composerRef = ref(null)
const chatBodyRef = ref(null)
const modelConfigModalRef = ref(null)
const modelPickerRef = ref(null)
const pendingFolderInputRef = ref(null)

const assetTreeItems = ref([])
const assetSummary = ref({ folder_count: 0, file_count: 0, total_size: 0 })
const selectedAssetPath = ref('')
const selectedAssetType = ref('folder')
const expandedFolderPaths = ref([''])
const isAssetsLoading = ref(false)
const pendingFolderDraft = ref(null)
const pendingUploadFolderPath = ref('')
const workspaceId = ref(makeWorkspaceId())
const sessionId = ref('')
const chatPrompt = ref('')
const notice = ref('')
const isUploading = ref(false)
const isStreaming = ref(false)
const currentStreamController = ref(null)
const savedModelConfigs = ref(loadStoredModelConfigs())
const activeModelId = ref(loadStoredActiveModelId(savedModelConfigs.value))
const editingModelId = ref('')
const modelFormError = ref('')
const modelForm = ref(createEmptyModelForm())
const isModelMenuOpen = ref(false)

let modelConfigModalInstance = null

const messages = ref([
  {
    id: 'm-init',
    role: 'assistant',
    text: 'Ready. Your saved folders and files are available on the left. Pick a model if needed, then start a conversation.',
    agentSteps: []
  }
])

const isBusy = computed(() => isUploading.value || isStreaming.value)
const assetStatsText = computed(() => `${assetSummary.value.folder_count || 0} folders, ${assetSummary.value.file_count || 0} files saved for your account`)
const selectedFileAsset = computed(() => findAssetNodeByPath(assetTreeItems.value, selectedAssetPath.value, 'file'))
const currentTargetFolderPath = computed(() => {
  if (selectedAssetType.value === 'folder') return selectedAssetPath.value
  return parentAssetPath(selectedAssetPath.value)
})
const currentTargetFolderLabel = computed(() => currentTargetFolderPath.value || 'Root')
const flattenedAssetRows = computed(() => flattenVisibleAssetRows(assetTreeItems.value, pendingFolderDraft.value))
const activeModelConfig = computed(() => savedModelConfigs.value.find((item) => item.id === activeModelId.value) || null)
const modelOptions = computed(() => [
  {
    id: SERVER_DEFAULT_MODEL_ID,
    label: 'Server Default',
    meta: 'Use backend default model',
    icon: 'bi-stars',
    tone: 'default'
  },
  ...savedModelConfigs.value.map((item) => ({
    id: item.id,
    label: item.name,
    meta: item.model_name,
    icon: item.mode === 'local' ? 'bi-cpu-fill' : 'bi-cloud-fill',
    tone: item.mode === 'local' ? 'local' : 'api'
  }))
])
const activeModelOption = computed(() => modelOptions.value.find((item) => item.id === activeModelId.value) || modelOptions.value[0])

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

function makeWorkspaceId() {
  return `agent-ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createModelId() {
  return `model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cleanString(value) {
  return String(value || '').trim()
}

function normalizeLocalHost(value) {
  const text = cleanString(value)
  if (!text) return ''
  const normalized = text.replace(/\/+$/, '')
  if (/\/v1$/i.test(normalized)) {
    return normalized.replace(/\/v1$/i, '')
  }
  return normalized
}

function normalizeStoredModelConfig(raw) {
  if (!raw || typeof raw !== 'object') return null
  const mode = cleanString(raw.mode) === 'api' ? 'api' : 'local'
  const modelName = cleanString(raw.model_name || raw.modelName)
  if (!modelName) return null

  const normalized = {
    id: cleanString(raw.id) || createModelId(),
    name: cleanString(raw.name) || `${mode === 'local' ? 'Local' : 'API'} ${modelName}`,
    mode,
    provider: mode === 'local' ? 'ollama' : 'openai',
    model_name: modelName,
    host: mode === 'local' ? normalizeLocalHost(raw.host) || 'http://127.0.0.1:11434' : '',
    api_key: mode === 'api' ? cleanString(raw.api_key || raw.apiKey) : '',
    base_url: mode === 'api' ? cleanString(raw.base_url || raw.baseUrl) : '',
    organization: mode === 'api' ? cleanString(raw.organization) : '',
    client_type: mode === 'api' ? 'openai' : ''
  }

  if (mode === 'api' && !normalized.api_key) return null
  return normalized
}

function loadStoredModelConfigs() {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(MODEL_CONFIGS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => normalizeStoredModelConfig(item)).filter(Boolean)
  } catch {
    return []
  }
}

function persistModelConfigs() {
  if (!canUseStorage()) return
  window.localStorage.setItem(MODEL_CONFIGS_STORAGE_KEY, JSON.stringify(savedModelConfigs.value))
}

function loadStoredActiveModelId(configs) {
  if (!canUseStorage()) return SERVER_DEFAULT_MODEL_ID
  const stored = cleanString(window.localStorage.getItem(ACTIVE_MODEL_STORAGE_KEY))
  if (!stored) return SERVER_DEFAULT_MODEL_ID
  return configs.some((item) => item.id === stored) ? stored : SERVER_DEFAULT_MODEL_ID
}

function persistActiveModelId() {
  if (!canUseStorage()) return
  window.localStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, activeModelId.value)
}

function createEmptyModelForm(mode = 'local') {
  return {
    name: '',
    mode,
    model_name: '',
    host: 'http://127.0.0.1:11434',
    api_key: '',
    base_url: '',
    organization: ''
  }
}

function getModelConfigModal() {
  if (!modelConfigModalRef.value) return null
  modelConfigModalInstance = Modal.getOrCreateInstance(modelConfigModalRef.value)
  return modelConfigModalInstance
}

function startCreateModel(mode = 'local') {
  editingModelId.value = ''
  modelFormError.value = ''
  modelForm.value = createEmptyModelForm(mode)
}

function openModelConfigModal() {
  isModelMenuOpen.value = false
  startCreateModel()
  getModelConfigModal()?.show()
}

function closeModelConfigModal() {
  getModelConfigModal()?.hide()
}

function toggleModelMenu() {
  if (isBusy.value) return
  isModelMenuOpen.value = !isModelMenuOpen.value
}

function closeModelMenu() {
  isModelMenuOpen.value = false
}

function handleDocumentPointerDown(event) {
  const root = modelPickerRef.value
  if (!root) return
  if (root.contains(event.target)) return
  isModelMenuOpen.value = false
}

function setModelFormMode(mode) {
  modelForm.value = {
    ...modelForm.value,
    mode,
    host: mode === 'local' ? (normalizeLocalHost(modelForm.value.host) || 'http://127.0.0.1:11434') : modelForm.value.host,
    api_key: mode === 'api' ? modelForm.value.api_key : '',
    base_url: mode === 'api' ? modelForm.value.base_url : '',
    organization: mode === 'api' ? modelForm.value.organization : ''
  }
}

function validateModelForm() {
  const name = cleanString(modelForm.value.name)
  const modelName = cleanString(modelForm.value.model_name)
  const mode = modelForm.value.mode === 'api' ? 'api' : 'local'

  if (!name) return 'Display name is required.'
  if (!modelName) return 'Model name is required.'
  if (mode === 'local' && !normalizeLocalHost(modelForm.value.host)) return 'Local host is required for local models.'
  if (mode === 'api' && !cleanString(modelForm.value.api_key)) return 'API key is required for API models.'
  return ''
}

function applyConversationReset(reason, { resetWorkspace = false } = {}) {
  const hadConversation = sessionId.value || messages.value.length > 1
  sessionId.value = ''
  if (resetWorkspace) workspaceId.value = makeWorkspaceId()
  if (hadConversation && reason) appendAssistantNote(reason)
}

function selectModel(modelId, options = {}) {
  const normalizedId = modelOptions.value.some((item) => item.id === modelId) ? modelId : SERVER_DEFAULT_MODEL_ID
  const changed = activeModelId.value !== normalizedId
  activeModelId.value = normalizedId
  persistActiveModelId()
  isModelMenuOpen.value = false

  if (changed && !options.silent) {
    notice.value = ''
    applyConversationReset('Model changed. The next prompt will use the selected model.', {
      resetWorkspace: false,
      resetSync: false
    })
  }
}

function buildSelectedModelPayload() {
  if (!activeModelConfig.value) return undefined
  const item = activeModelConfig.value
  const payload = {
    name: item.name,
    mode: item.mode,
    provider: item.provider,
    model_name: item.model_name
  }

  if (item.mode === 'local') {
    payload.host = normalizeLocalHost(item.host)
  } else {
    payload.api_key = item.api_key
    if (item.base_url) payload.base_url = item.base_url
    if (item.organization) payload.organization = item.organization
    payload.client_type = item.client_type || 'openai'
  }

  return payload
}

function saveModelConfig() {
  const error = validateModelForm()
  if (error) {
    modelFormError.value = error
    return
  }

  const normalized = normalizeStoredModelConfig({
    ...modelForm.value,
    id: editingModelId.value || createModelId()
  })
  if (!normalized) {
    modelFormError.value = 'Model configuration is invalid.'
    return
  }

  const nextList = savedModelConfigs.value.filter((item) => item.id !== normalized.id)
  nextList.unshift(normalized)
  savedModelConfigs.value = nextList
  persistModelConfigs()

  const previouslyActiveId = activeModelId.value
  activeModelId.value = normalized.id
  persistActiveModelId()
  if (previouslyActiveId !== normalized.id) {
    applyConversationReset('Model changed. The next prompt will use the selected model.', {
      resetWorkspace: false,
      resetSync: false
    })
  }

  notice.value = `Using model: ${normalized.name}`
  isModelMenuOpen.value = false
  closeModelConfigModal()
}

function editModelConfig(modelId) {
  const item = savedModelConfigs.value.find((entry) => entry.id === modelId)
  if (!item) return
  editingModelId.value = item.id
  modelFormError.value = ''
  modelForm.value = {
    name: item.name,
    mode: item.mode,
    model_name: item.model_name,
    host: item.host,
    api_key: item.api_key,
    base_url: item.base_url,
    organization: item.organization
  }
  getModelConfigModal()?.show()
}

function useModelConfig(modelId) {
  selectModel(modelId)
  notice.value = 'Selected model will be used for the next prompt.'
  closeModelConfigModal()
}

function deleteModelConfig(modelId) {
  if (typeof window !== 'undefined') {
    const confirmed = window.confirm('Delete this saved model configuration?')
    if (!confirmed) return
  }

  const exists = savedModelConfigs.value.some((item) => item.id === modelId)
  if (!exists) return

  savedModelConfigs.value = savedModelConfigs.value.filter((item) => item.id !== modelId)
  persistModelConfigs()

  if (activeModelId.value === modelId) {
    selectModel(SERVER_DEFAULT_MODEL_ID)
    notice.value = 'Active model was removed. Switched back to Server Default.'
  }

  if (editingModelId.value === modelId) startCreateModel()
}

function triggerFilePicker(folderPath = currentTargetFolderPath.value) {
  pendingUploadFolderPath.value = cleanString(folderPath)
  fileInputRef.value?.click()
}

function formatFileSize(size) {
  const n = Number(size || 0)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function formatFolderMeta(node) {
  const folderCount = Number(node?.folder_count || 0)
  const fileCount = Number(node?.file_count || 0)
  if (!folderCount && !fileCount) return 'Empty folder'

  const parts = []
  if (folderCount) parts.push(`${folderCount} folder${folderCount === 1 ? '' : 's'}`)
  if (fileCount) parts.push(`${fileCount} file${fileCount === 1 ? '' : 's'}`)
  return parts.join(' | ')
}

function parentAssetPath(path) {
  const normalized = cleanString(path).replace(/\\/g, '/')
  if (!normalized) return ''
  const parts = normalized.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

function flattenAllAssetNodes(nodes, rows = []) {
  nodes.forEach((node) => {
    rows.push(node)
    if (node.type === 'folder' && Array.isArray(node.children) && node.children.length) {
      flattenAllAssetNodes(node.children, rows)
    }
  })
  return rows
}

function findAssetNodeByPath(nodes, targetPath, targetType = '') {
  const normalizedPath = cleanString(targetPath)
  if (!normalizedPath) return null

  for (const node of nodes || []) {
    if (node.path === normalizedPath && (!targetType || node.type === targetType)) {
      return node
    }
    if (node.type === 'folder' && Array.isArray(node.children) && node.children.length) {
      const found = findAssetNodeByPath(node.children, normalizedPath, targetType)
      if (found) return found
    }
  }

  return null
}

function isFolderExpanded(path) {
  return expandedFolderPaths.value.includes(path)
}

function ensureExpandedFolder(path) {
  const normalized = cleanString(path)
  if (!normalized) {
    if (!expandedFolderPaths.value.includes('')) expandedFolderPaths.value = ['', ...expandedFolderPaths.value]
    return
  }

  const parts = normalized.split('/').filter(Boolean)
  const next = new Set(expandedFolderPaths.value)
  next.add('')
  let cursor = ''
  parts.forEach((part) => {
    cursor = cursor ? `${cursor}/${part}` : part
    next.add(cursor)
  })
  expandedFolderPaths.value = Array.from(next)
}

function collapseFolderTree(path) {
  const normalized = cleanString(path)
  expandedFolderPaths.value = expandedFolderPaths.value.filter((item) => item === '' || (item !== normalized && !item.startsWith(`${normalized}/`)))
}

function makePendingFolderRow(draft, depth) {
  return {
    id: draft.id,
    type: 'folder',
    path: '',
    name: draft.name,
    depth,
    isPending: true,
    meta: 'Press Enter to save'
  }
}

function flattenVisibleAssetRows(nodes, pendingDraft = null, depth = 0, rows = [], parentPath = '') {
  if (pendingDraft && pendingDraft.parentPath === parentPath) {
    rows.push(makePendingFolderRow(pendingDraft, depth))
  }

  nodes.forEach((node) => {
    rows.push({
      ...node,
      depth,
      meta: node.type === 'folder' ? formatFolderMeta(node) : formatFileSize(node.size)
    })

    if (node.type === 'folder' && isFolderExpanded(node.path)) {
      flattenVisibleAssetRows(
        Array.isArray(node.children) ? node.children : [],
        pendingDraft,
        depth + 1,
        rows,
        node.path
      )
    }
  })
  return rows
}

function normalizeAssetSelection() {
  const allNodes = flattenAllAssetNodes(assetTreeItems.value, [])
  const validFolders = new Set([''])
  allNodes.filter((node) => node.type === 'folder').forEach((node) => validFolders.add(node.path))
  expandedFolderPaths.value = expandedFolderPaths.value.filter((path) => validFolders.has(path))
  if (!expandedFolderPaths.value.includes('')) {
    expandedFolderPaths.value = ['', ...expandedFolderPaths.value]
  }

  const hasSelection = selectedAssetPath.value === ''
    ? selectedAssetType.value === 'folder'
    : allNodes.some((node) => node.path === selectedAssetPath.value && node.type === selectedAssetType.value)

  if (!hasSelection) {
    selectedAssetPath.value = ''
    selectedAssetType.value = 'folder'
  }

  ensureExpandedFolder(selectedAssetType.value === 'folder' ? selectedAssetPath.value : parentAssetPath(selectedAssetPath.value))
}

function isSelectedNode(node) {
  return selectedAssetType.value === node.type && selectedAssetPath.value === node.path
}

function selectRoot() {
  selectedAssetPath.value = ''
  selectedAssetType.value = 'folder'
}

function toggleFolder(path) {
  const normalized = cleanString(path)
  if (!normalized) return
  if (isFolderExpanded(normalized)) {
    collapseFolderTree(normalized)
    if (selectedAssetType.value === 'folder' && selectedAssetPath.value === normalized) {
      selectedAssetPath.value = normalized
    }
    return
  }
  ensureExpandedFolder(normalized)
}

function selectAssetNode(node) {
  selectedAssetPath.value = node.path
  selectedAssetType.value = node.type
  if (node.type === 'folder') ensureExpandedFolder(node.path)
}

function beginInlineFolderCreate(parentPath = currentTargetFolderPath.value) {
  if (isBusy.value) return
  const normalizedParent = cleanString(parentPath)
  ensureExpandedFolder(normalizedParent)
  selectedAssetPath.value = normalizedParent
  selectedAssetType.value = 'folder'
  pendingFolderDraft.value = {
    id: `pending-folder-${Date.now()}`,
    parentPath: normalizedParent,
    name: ''
  }
  nextTick(() => pendingFolderInputRef.value?.focus())
}

function cancelInlineFolderCreate() {
  pendingFolderDraft.value = null
}

async function commitInlineFolderCreate() {
  const draft = pendingFolderDraft.value
  if (!draft) return

  const normalizedName = cleanString(draft.name)
  if (!normalizedName) {
    cancelInlineFolderCreate()
    return
  }

  isUploading.value = true
  try {
    const res = await createAgentAssetFolder({
      name: normalizedName,
      parent_path: draft.parentPath
    })
    const nextFolderPath = res?.folder?.path || [draft.parentPath, normalizedName].filter(Boolean).join('/')
    pendingFolderDraft.value = null
    ensureExpandedFolder(draft.parentPath)
    ensureExpandedFolder(nextFolderPath)
    await refreshAssetTree()
    selectedAssetPath.value = nextFolderPath
    selectedAssetType.value = 'folder'
    notice.value = `Folder created: ${normalizedName}`
    syncReset('Context assets changed. A new agent session will start on the next prompt.')
  } catch (error) {
    notice.value = error?.message || 'Failed to create folder.'
    nextTick(() => pendingFolderInputRef.value?.focus())
  } finally {
    isUploading.value = false
  }
}

async function refreshAssetTree({ silent = true } = {}) {
  isAssetsLoading.value = true
  try {
    const data = await fetchAgentAssetTree()
    assetTreeItems.value = Array.isArray(data?.items) ? data.items : []
    assetSummary.value = {
      folder_count: Number(data?.summary?.folder_count || 0),
      file_count: Number(data?.summary?.file_count || 0),
      total_size: Number(data?.summary?.total_size || 0)
    }
    normalizeAssetSelection()
    if (!silent) {
      notice.value = 'Saved files refreshed.'
    }
  } catch (error) {
    notice.value = error?.message || 'Failed to load saved files.'
  } finally {
    isAssetsLoading.value = false
  }
}

async function removeAsset(node) {
  if (!node?.path || isBusy.value) return

  const confirmed = typeof window === 'undefined'
    ? true
    : window.confirm(node.type === 'folder'
      ? `Delete folder "${node.name}" and all nested files?`
      : `Delete file "${node.name}"?`)
  if (!confirmed) return

  isUploading.value = true
  try {
    if (node.type === 'folder') {
      await deleteAgentAssetFolder(node.path, true)
      collapseFolderTree(node.path)
      if (selectedAssetPath.value === node.path || selectedAssetPath.value.startsWith(`${node.path}/`)) {
        selectRoot()
      }
    } else {
      await deleteAgentAssetFile(node.path)
      if (selectedAssetPath.value === node.path) {
        selectedAssetPath.value = parentAssetPath(node.path)
        selectedAssetType.value = 'folder'
      }
    }

    await refreshAssetTree()
    notice.value = `${node.type === 'folder' ? 'Folder' : 'File'} deleted: ${node.name}`
    syncReset('Context assets changed. A new agent session will start on the next prompt.')
  } catch (error) {
    notice.value = error?.message || `Failed to delete ${node.type}.`
  } finally {
    isUploading.value = false
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatInlineMarkdown(value) {
  let text = String(value || '')
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  text = text.replace(/\*\*([^*][\s\S]*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    const safeUrl = String(url).replace(/"/g, '%22')
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })
  return text
}

function splitTableRow(line) {
  const core = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '')
  return core.split('|').map((cell) => cell.trim())
}

function isTableSeparatorRow(line) {
  const cells = splitTableRow(line)
  if (!cells.length) return false
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function renderMarkdown(raw) {
  const source = String(raw || '').replace(/\r\n?/g, '\n')
  if (!source.trim()) return ''

  const codeBlocks = []
  const tokenized = source.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push({ lang: String(lang || '').toLowerCase(), code: String(code || '') })
    return `@@CODE_BLOCK_${idx}@@`
  })

  const lines = tokenized.split('\n')
  const blocks = []
  let paragraphLines = []
  let listMode = ''
  let listItems = []

  const flushParagraph = () => {
    if (!paragraphLines.length) return
    const html = paragraphLines.map((line) => formatInlineMarkdown(escapeHtml(line))).join('<br>')
    blocks.push(`<p>${html}</p>`)
    paragraphLines = []
  }

  const flushList = () => {
    if (!listItems.length || !listMode) {
      listMode = ''
      listItems = []
      return
    }
    const tag = listMode === 'ol' ? 'ol' : 'ul'
    blocks.push(`<${tag}>${listItems.join('')}</${tag}>`)
    listMode = ''
    listItems = []
  }

  const parseTableAt = (startIndex) => {
    const headerLine = String(lines[startIndex] || '').trim()
    const separatorLine = String(lines[startIndex + 1] || '').trim()

    if (!headerLine.includes('|') || !separatorLine.includes('|')) return null
    if (/^@@CODE_BLOCK_\d+@@$/.test(headerLine)) return null
    if (!isTableSeparatorRow(separatorLine)) return null

    const headerCells = splitTableRow(headerLine)
    if (!headerCells.some((cell) => cell.length > 0)) return null

    const bodyRows = []
    let cursor = startIndex + 2
    while (cursor < lines.length) {
      const current = String(lines[cursor] || '').trim()
      if (!current || !current.includes('|')) break
      if (/^@@CODE_BLOCK_\d+@@$/.test(current)) break
      bodyRows.push(splitTableRow(current))
      cursor += 1
    }

    const normalizeCells = (cells) => {
      const width = Math.max(headerCells.length, cells.length)
      const normalized = []
      for (let i = 0; i < width; i += 1) {
        normalized.push(cells[i] || '')
      }
      return normalized
    }

    const headHtml = normalizeCells(headerCells)
      .map((cell) => `<th>${formatInlineMarkdown(escapeHtml(cell))}</th>`)
      .join('')

    const bodyHtml = bodyRows
      .map((row) => {
        const rowHtml = normalizeCells(row)
          .map((cell) => `<td>${formatInlineMarkdown(escapeHtml(cell))}</td>`)
          .join('')
        return `<tr>${rowHtml}</tr>`
      })
      .join('')

    const tableHtml = bodyRows.length
      ? `<table class="md-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
      : `<table class="md-table"><thead><tr>${headHtml}</tr></thead></table>`

    return { html: tableHtml, nextIndex: cursor }
  }

  let lineIndex = 0
  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      lineIndex += 1
      continue
    }

    const codeMatch = trimmed.match(/^@@CODE_BLOCK_(\d+)@@$/)
    if (codeMatch) {
      flushParagraph()
      flushList()
      blocks.push(trimmed)
      lineIndex += 1
      continue
    }

    const table = parseTableAt(lineIndex)
    if (table) {
      flushParagraph()
      flushList()
      blocks.push(table.html)
      lineIndex = table.nextIndex
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const level = headingMatch[1].length
      const content = formatInlineMarkdown(escapeHtml(headingMatch[2]))
      blocks.push(`<h${level}>${content}</h${level}>`)
      lineIndex += 1
      continue
    }

    const hrMatch = trimmed.match(/^(-{3,}|\*{3,})$/)
    if (hrMatch) {
      flushParagraph()
      flushList()
      blocks.push('<hr>')
      lineIndex += 1
      continue
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph()
      flushList()
      const content = formatInlineMarkdown(escapeHtml(quoteMatch[1]))
      blocks.push(`<blockquote>${content}</blockquote>`)
      lineIndex += 1
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      if (listMode && listMode !== 'ol') flushList()
      listMode = 'ol'
      listItems.push(`<li>${formatInlineMarkdown(escapeHtml(orderedMatch[1]))}</li>`)
      lineIndex += 1
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (listMode && listMode !== 'ul') flushList()
      listMode = 'ul'
      listItems.push(`<li>${formatInlineMarkdown(escapeHtml(unorderedMatch[1]))}</li>`)
      lineIndex += 1
      continue
    }

    flushList()
    paragraphLines.push(line)
    lineIndex += 1
  }

  flushParagraph()
  flushList()

  let html = blocks.join('')
  html = html.replace(/@@CODE_BLOCK_(\d+)@@/g, (_m, idx) => {
    const block = codeBlocks[Number(idx)]
    if (!block) return ''
    const languageClass = block.lang ? ` class="language-${block.lang}"` : ''
    return `<pre class="md-code-block"><code${languageClass}>${escapeHtml(block.code)}</code></pre>`
  })

  return html
}

function appendAssistantNote(text) {
  messages.value.push({
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    text: String(text || ''),
    agentSteps: []
  })
}

function appendUserMessage(text) {
  messages.value.push({
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'user',
    text: String(text || ''),
    agentSteps: []
  })
}

function appendAssistantPlaceholder() {
  const id = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  messages.value.push({ id, role: 'assistant', text: '', agentSteps: [] })
  return id
}

function extractUpdateContent(content, preferredKeys = []) {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') {
    for (const key of preferredKeys) {
      const value = content[key]
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }
    if (typeof content.result === 'string' && content.result.trim()) return content.result
    if (typeof content.task === 'string' && content.task.trim()) return content.task
    try {
      return JSON.stringify(content, null, 2)
    } catch {
      return String(content)
    }
  }
  return String(content || '')
}

function updateAssistantMessage(messageId, updater) {
  messages.value = messages.value.map((msg) => {
    if (msg.id !== messageId) return msg
    return updater({ ...msg, agentSteps: Array.isArray(msg.agentSteps) ? [...msg.agentSteps] : [] })
  })
}

function applyStreamUpdate(messageId, update) {
  updateAssistantMessage(messageId, (msg) => {
    const steps = [...(msg.agentSteps || [])]
    const agent = String(update?.agent || 'Agent')
    const type = String(update?.type || '')
    let latestText = String(msg.text || '')

    if (type === 'agent_start') {
      const startContent = extractUpdateContent(update?.content, ['task', 'result'])
      steps.forEach((step) => {
        if (step.status === 'running') step.status = 'done'
      })
      steps.push({
        agent,
        content: startContent,
        status: 'running',
        stepType: type,
        isFinal: false
      })
    } else if (type === 'stream_chunk') {
      const chunkContent = extractUpdateContent(update?.content, ['result', 'task'])
      if (steps.length === 0) {
        steps.push({ agent, content: chunkContent, status: 'running', stepType: type, isFinal: false })
      } else {
        const lastIndex = steps.length - 1
        steps[lastIndex] = {
          ...steps[lastIndex],
          agent: steps[lastIndex].agent || agent,
          content: chunkContent || steps[lastIndex].content,
          status: 'running'
        }
      }
      if (chunkContent) latestText = chunkContent
    } else if (type === 'agent_finish') {
      const finalContent = extractUpdateContent(update?.content, ['result', 'task'])
      if (steps.length === 0) {
        steps.push({ agent, content: finalContent, status: 'done', stepType: type, isFinal: !!update?.is_final })
      } else {
        const lastIndex = steps.length - 1
        steps[lastIndex] = {
          ...steps[lastIndex],
          agent: steps[lastIndex].agent || agent,
          content: finalContent || steps[lastIndex].content,
          status: 'done',
          isFinal: !!update?.is_final
        }
      }
      if (finalContent) latestText = finalContent
    } else if (type === 'agent_error') {
      const errorContent = extractUpdateContent(update?.content, ['error_message', 'result', 'task'])
      if (steps.length === 0) {
        steps.push({ agent, content: errorContent, status: 'error', stepType: type, isFinal: true })
      } else {
        const lastIndex = steps.length - 1
        steps[lastIndex] = {
          ...steps[lastIndex],
          agent: steps[lastIndex].agent || agent,
          content: errorContent || steps[lastIndex].content,
          status: 'error',
          isFinal: true
        }
      }
      if (errorContent) latestText = errorContent
    }

    return { ...msg, text: latestText, agentSteps: steps }
  })
}

function finalizeAssistantMessage(messageId) {
  updateAssistantMessage(messageId, (msg) => {
    const steps = (msg.agentSteps || []).map((step) => step.status === 'running' ? { ...step, status: 'done' } : step)
    const lastStepWithContent = [...steps].reverse().find((step) => step.stepType !== 'agent_start' && String(step?.content || '').trim())
    return { ...msg, text: lastStepWithContent?.content || msg.text, agentSteps: steps }
  })
}

function markAssistantError(messageId, error) {
  const message = `Error: ${error?.message || 'unknown error'}`
  updateAssistantMessage(messageId, (msg) => {
    const steps = [...(msg.agentSteps || [])]
    if (!steps.length) {
      steps.push({ agent: 'System', content: message, status: 'error', stepType: 'agent_error', isFinal: true })
    } else {
      const lastIndex = steps.length - 1
      steps[lastIndex] = {
        ...steps[lastIndex],
        content: `${steps[lastIndex].content || ''}${steps[lastIndex].content ? '\n\n' : ''}${message}`,
        status: 'error',
        isFinal: true
      }
    }
    return { ...msg, agentSteps: steps }
  })
}

function isAbortError(error) {
  return error?.name === 'AbortError'
}

function markAssistantStopped(messageId) {
  updateAssistantMessage(messageId, (msg) => {
    const steps = [...(msg.agentSteps || [])]
    if (!steps.length) {
      steps.push({
        agent: 'System',
        content: 'Response stopped by user.',
        status: 'stopped',
        stepType: 'agent_stop',
        isFinal: true
      })
    } else {
      const lastIndex = steps.length - 1
      const lastStep = steps[lastIndex]
      steps[lastIndex] = {
        ...lastStep,
        content: `${lastStep.content || ''}${lastStep.content ? '\n\n' : ''}Response stopped by user.`,
        status: 'stopped',
        isFinal: true
      }
    }
    return { ...msg, agentSteps: steps }
  })
}

function stopStreaming() {
  if (!isStreaming.value || !currentStreamController.value) return
  notice.value = 'Stopping response...'
  currentStreamController.value.abort()
}
function adjustComposerHeight() {
  const el = composerRef.value
  if (!el) return
  el.style.height = 'auto'
  const maxHeight = 120
  const nextHeight = Math.min(el.scrollHeight, maxHeight)
  el.style.height = `${nextHeight}px`
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function syncReset(reason) {
  applyConversationReset(reason, {
    resetWorkspace: true
  })
}

async function onFilesChange(event) {
  const files = event?.target?.files ? Array.from(event.target.files) : []
  const targetFolderPath = pendingUploadFolderPath.value || currentTargetFolderPath.value
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  pendingUploadFolderPath.value = ''
  if (!files.length) return

  isUploading.value = true
  try {
    for (const file of files) {
      await uploadAgentInteractionFile(file, targetFolderPath)
    }
    ensureExpandedFolder(targetFolderPath)
    await refreshAssetTree()
    notice.value = files.length === 1
      ? `Uploaded ${files[0].name} to ${targetFolderPath || 'Root'}.`
      : `Uploaded ${files.length} files to ${targetFolderPath || 'Root'}.`
    syncReset('Context assets changed. A new agent session will start on the next prompt.')
  } catch (error) {
    notice.value = error?.message || 'File upload failed.'
  } finally {
    isUploading.value = false
  }
}

async function submitPrompt() {
  const prompt = chatPrompt.value.trim()
  if (!prompt || isBusy.value) return
  if (!Number(assetSummary.value.file_count || 0)) {
    notice.value = 'Please upload at least one context file first.'
    return
  }

  chatPrompt.value = ''
  adjustComposerHeight()
  notice.value = ''

  appendUserMessage(prompt)
  const assistantMessageId = appendAssistantPlaceholder()
  const streamController = new AbortController()
  currentStreamController.value = streamController

  try {
    isStreaming.value = true

    await streamAgentInteractionChat(
      {
        query: prompt,
        workspace: workspaceId.value,
        request_id: sessionId.value || undefined,
        selected_file_path: selectedFileAsset.value?.path || undefined,
        model_config: buildSelectedModelPayload()
      },
      {
        signal: streamController.signal,
        onOpened: (data) => {
          const openedSessionId = String(data?.session_id || '').trim()
          if (openedSessionId) {
            sessionId.value = openedSessionId
          }
        },
        onDelta: (update) => {
          applyStreamUpdate(assistantMessageId, update)
        },
        onDone: () => {
          finalizeAssistantMessage(assistantMessageId)
        },
        onError: (error) => {
          notice.value = error?.message || 'Stream failed.'
          markAssistantError(assistantMessageId, error)
        }
      }
    )
  } catch (error) {
    if (isAbortError(error)) {
      notice.value = 'Response stopped.'
      sessionId.value = ''
      markAssistantStopped(assistantMessageId)
    } else {
      const msg = error?.message || 'unknown error'
      notice.value = msg
      markAssistantError(assistantMessageId, error)
    }
  } finally {
    currentStreamController.value = null
    isStreaming.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  refreshAssetTree()
  nextTick(() => adjustComposerHeight())
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  currentStreamController.value?.abort()
  modelConfigModalInstance?.dispose()
})

watch(
  messages,
  async () => {
    await nextTick()
    if (chatBodyRef.value) {
      chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
    }
  },
  { deep: true }
)
</script>

<style scoped>
.interaction-shell {
  height: 100%;
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.workspace-panel {
  height: 100%;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.85rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.panel-header h6 {
  font-weight: 600;
  color: #374151;
  font-size: 0.95rem;
}

.header-actions .btn-link {
  color: #6b7280;
  text-decoration: none;
  padding: 0.25rem;
}

.header-actions .btn-link:hover {
  color: #2563eb;
}

.workspace-list {
  flex: 1;
  overflow: auto;
  padding: 0.65rem;
}

.asset-tree {
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
}

.asset-row-wrap {
  min-width: 0;
}

.asset-row {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.asset-row:hover {
  background: #f8fafc;
}

.asset-row.active {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.asset-row-root {
  width: 100%;
  padding: 0.2rem 0.35rem;
  background: transparent;
}

.asset-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding-right: 0.3rem;
}

.root-row-actions {
  padding-right: 0.45rem;
}

.asset-inline-action,
.asset-inline-action,
.asset-expand-btn,
.asset-delete-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.asset-inline-action:hover:not(:disabled),
.asset-expand-btn:hover,
.asset-delete-btn:hover:not(:disabled) {
  background: #e5e7eb;
  color: #0f172a;
}

.asset-expand-spacer {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.asset-main-btn {
  min-width: 0;
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border: none;
  background: transparent;
  padding: 0.45rem 0.4rem;
  text-align: left;
}

.pending-folder-row {
  border-color: #dbeafe;
  background: #f8fbff;
}

.pending-folder-main {
  width: 100%;
}

.pending-folder-input-wrap {
  gap: 0.18rem;
}

.pending-folder-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.78rem;
  font-weight: 600;
  color: #0f172a;
  padding: 0;
}

.pending-folder-input::placeholder {
  color: #94a3b8;
  font-weight: 500;
}

.pending-folder-hint {
  color: #2563eb;
}

.asset-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.asset-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-meta {
  font-size: 0.7rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-icon {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.95rem;
}

.asset-icon.root {
  background: #e0f2fe;
  color: #0369a1;
}

.asset-icon.folder {
  background: #fff7ed;
  color: #c2410c;
}

.asset-icon.file {
  background: #eff6ff;
  color: #1d4ed8;
}

.empty-workspaces {
  padding: 1rem;
  text-align: center;
  font-size: 0.78rem;
  line-height: 1.5;
}


.chat-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem 0.95rem;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.chat-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  overflow: auto;
  flex: 1;
  min-height: 0;
  background: #f7faff;
  padding: 1rem 1.1rem;
}

.chat-footer {
  padding: 0.8rem 0.9rem 0.9rem;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.composer-shell {
  border: 1px solid #dbe4f0;
  background: #ffffff;
  border-radius: 18px;
  padding: 0.62rem 0.68rem;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.composer-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-top: 0.45rem;
}

.composer-left-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
}

.composer-plus-btn {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.composer-plus-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.composer-plus-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.model-picker {
  position: relative;
  min-width: 0;
  max-width: 280px;
  flex: 1;
}

.model-picker-btn {
  width: 100%;
  min-height: 34px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  border-radius: 999px;
  padding: 0.2rem 0.48rem 0.2rem 0.28rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: all 0.18s ease;
}

.model-picker-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #9ca3af;
}

.model-picker-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.model-picker-icon {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #ffffff;
  font-size: 0.8rem;
}

.model-tone-default {
  background: linear-gradient(135deg, #111827, #334155);
}

.model-tone-local {
  background: linear-gradient(135deg, #0f766e, #14b8a6);
}

.model-tone-api {
  background: linear-gradient(135deg, #2563eb, #60a5fa);
}

.model-picker-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
  font-weight: 600;
}

.model-picker-caret {
  margin-left: auto;
  color: #64748b;
  transition: transform 0.18s ease;
}

.model-picker-caret.open {
  transform: rotate(180deg);
}

.model-picker-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 0.55rem);
  width: min(320px, calc(100vw - 3rem));
  padding: 0.38rem;
  border-radius: 16px;
  border: 1px solid #dbe4f0;
  background: #ffffff;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.16);
  z-index: 30;
}

.model-menu-item {
  width: 100%;
  border: none;
  background: transparent;
  border-radius: 12px;
  padding: 0.48rem;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  text-align: left;
  transition: background-color 0.18s ease;
}

.model-menu-item:hover {
  background: #f8fafc;
}

.model-menu-item.active {
  background: #eef4ff;
}

.model-menu-icon {
  width: 28px;
  height: 28px;
}

.model-menu-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
}

.model-menu-title {
  font-size: 0.76rem;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-menu-meta {
  font-size: 0.74rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-menu-check {
  color: #2563eb;
  font-size: 0.92rem;
}

.composer-form {
  display: block;
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
  max-width: 88%;
  border-radius: 14px;
  padding: 0.7rem 0.8rem;
  border: 1px solid #dbe4f0;
}

.user-bubble {
  background: #edf4ff;
  border-color: #c9dcff;
}

.assistant-bubble {
  background: #ffffff;
}

.assistant-message-shell {
  width: min(100%, 920px);
}

.message-text,
.message-text-plain {
  margin: 0;
  word-break: break-word;
}

.composer-selection-row {
  margin-bottom: 0.45rem;
}

.composer-selection-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.48rem;
  min-height: 34px;
  max-width: 100%;
  padding: 0.34rem 0.55rem;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #dbe4f0;
}

.composer-selection-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.composer-selection-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
}

.composer-selection-label {
  font-size: 0.62rem;
  line-height: 1.05;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  font-weight: 700;
}

.composer-selection-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer {
  resize: none;
  min-height: 58px;
  max-height: 120px;
  border: none;
  box-shadow: none;
  padding: 0.05rem 0.1rem 0;
  line-height: 1.42;
  font-size: 0.92rem;
}

.composer:focus {
  box-shadow: none;
}

.composer-action-btn {
  font-size: 1rem;
}

.upload-action-btn {
  gap: 0.5rem;
  font-weight: 600;
  min-height: 40px;
}

.mode-toggle-group {
  display: inline-flex;
  gap: 0.45rem;
}

.saved-model-panel {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 1rem;
  background: #f8fafc;
}

.empty-saved-models {
  padding: 1rem 0.25rem;
  font-size: 0.84rem;
  line-height: 1.5;
}

.saved-model-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}

.saved-model-card.active {
  border-color: #111827;
  box-shadow: 0 10px 18px rgba(15, 23, 42, 0.06);
}

.saved-model-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.saved-model-name {
  font-weight: 700;
  color: #111827;
}

.saved-model-meta,
.saved-model-endpoint {
  font-size: 0.78rem;
  line-height: 1.45;
}

.saved-model-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.stream-control-btn {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.stream-control-btn:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
}

.stream-control-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.stream-control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.stream-control-inline {
  width: 30px;
  height: 30px;
  padding: 0;
}

.stream-control-composer {
  width: 38px;
  height: 38px;
  padding: 0;
  border-color: #111827;
  background: #111827;
  color: #ffffff;
  flex-shrink: 0;
}

.stream-control-composer:hover:not(:disabled) {
  background: #1f2937;
  border-color: #1f2937;
}

.step-running-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #6b7280;
}

.stop-square-icon {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 0.12rem;
  background: currentColor;
  display: inline-block;
  flex-shrink: 0;
}

.markdown-body {
  line-height: 1.55;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 0.45rem 0;
  font-weight: 700;
}

.markdown-body :deep(p) {
  margin: 0.35rem 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.35rem 0;
  padding-left: 1.2rem;
}

.markdown-body :deep(li) {
  margin: 0.2rem 0;
}

.markdown-body :deep(table.md-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.45rem 0;
  font-size: 0.92rem;
}

.markdown-body :deep(table.md-table th),
.markdown-body :deep(table.md-table td) {
  border: 1px solid #d6dfec;
  padding: 0.35rem 0.45rem;
  text-align: left;
  vertical-align: top;
}

.markdown-body :deep(table.md-table th) {
  background: #eef3fa;
  font-weight: 700;
}

.markdown-body :deep(blockquote) {
  margin: 0.45rem 0;
  padding: 0.1rem 0.6rem;
  border-left: 3px solid #cdd8ea;
  color: #50607a;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #d6deea;
  margin: 0.6rem 0;
}

.markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.86em;
  background: #eef2f7;
  border-radius: 4px;
  padding: 0.08rem 0.3rem;
}

.markdown-body :deep(pre.md-code-block) {
  margin: 0.45rem 0;
  padding: 0.6rem;
  border-radius: 8px;
  background: #eef3fa;
  border: 1px solid #d6dfec;
  overflow-x: auto;
}

.markdown-body :deep(pre.md-code-block code) {
  background: transparent;
  padding: 0;
}

.markdown-body :deep(a) {
  color: #1d4ed8;
  text-decoration: underline;
}

.agent-step-container {
  width: 100%;
}

.agent-block {
  position: relative;
  z-index: 1;
}

.step-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 4px 0;
  position: relative;
  z-index: 0;
}

.step-connector .line {
  width: 2px;
  height: 1.4rem;
  background-color: #1f2937;
}

.step-connector .line-running {
  background: linear-gradient(to bottom, #999, #0d6efd);
  background-size: 100% 200%;
  animation: flowLine 1.5s linear infinite;
}

.step-connector .arrow {
  font-size: 0.75rem;
  color: #1f2937;
  margin-top: -4px;
}

.step-connector:has(.line-running) .arrow {
  color: #0d6efd;
  animation: bounceArrow 1.5s ease-in-out infinite;
}

.agent-icon-wrap {
  width: 24px;
  height: 24px;
}


@keyframes flowLine {
  0% { background-position: 0% 100%; }
  100% { background-position: 0% 0%; }
}

@keyframes bounceArrow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}

@media (max-width: 992px) {
  .interaction-shell {
    grid-template-columns: 1fr;
  }

  .workspace-panel {
    min-height: 280px;
  }

  .chat-panel-header,
  .saved-model-card-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .composer-bottom-row {
    align-items: stretch;
    flex-direction: column;
  }

  .composer-left-actions {
    width: 100%;
  }

  .model-picker {
    max-width: none;
    width: 100%;
  }

  .model-picker-menu {
    width: 100%;
  }

  .composer-action-btn {
    align-self: flex-end;
  }

  .message-bubble,
  .assistant-message-shell {
    max-width: 100%;
    width: 100%;
  }
}
</style>




