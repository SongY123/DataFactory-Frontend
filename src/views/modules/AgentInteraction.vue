<template>
  <div class="interaction-shell h-100">
    <aside class="workspace-panel">
      <div class="environment-panel">
        <SandboxEnvironmentSelector
          v-model="selectedSandboxEnvironmentId"
          label="Environment"
          description="Choose the Python sandbox used for this chat."
          :disabled="isBusy"
        />
      </div>

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
            <span class="asset-checkbox-slot">
              <input
                class="asset-checkbox-input"
                type="checkbox"
                :checked="isRootChecked"
                :indeterminate.prop="isRootIndeterminate"
                :disabled="isBusy || !allFilePaths.length"
                @click.stop
                @change="toggleRootFilesSelection"
              >
            </span>
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
              <span class="asset-checkbox-spacer"></span>
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

              <span class="asset-checkbox-slot">
                <input
                  class="asset-checkbox-input"
                  type="checkbox"
                  :checked="isNodeChecked(node)"
                  :indeterminate.prop="isNodeIndeterminate(node)"
                  :disabled="isBusy || !hasSelectableFiles(node)"
                  @click.stop
                  @change="toggleNodeFilesSelection(node)"
                >
              </span>

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
        <div class="chat-header-copy">
          <span class="chat-header-eyebrow">Agent Interaction</span>
          <div class="chat-header-controls">
            <div ref="conversationPickerRef" class="conversation-picker">
              <button
                class="conversation-picker-btn"
                type="button"
                aria-label="Select chat page"
                :aria-expanded="isConversationMenuOpen"
                @click="toggleConversationMenu"
              >
                <span class="conversation-picker-icon" :class="{ live: activeConversation?.isStreaming }">
                  <i class="bi bi-chat-square-text"></i>
                </span>
                <span class="conversation-picker-copy">
                  <span class="conversation-picker-label">Chat page</span>
                  <span class="conversation-picker-title">{{ activeConversation?.title || 'New chat' }}</span>
                </span>
                <span class="conversation-picker-count">{{ conversationTabsSummary }}</span>
                <i class="bi bi-chevron-down conversation-picker-caret" :class="{ open: isConversationMenuOpen }"></i>
              </button>

              <div v-if="isConversationMenuOpen" class="conversation-picker-menu">
                <div
                  v-for="conversation in conversationPages"
                  :key="conversation.id"
                  class="conversation-menu-row"
                  :class="{ active: conversation.id === activeConversationId }"
                >
                  <button
                    class="conversation-menu-item"
                    type="button"
                    :aria-selected="conversation.id === activeConversationId"
                    @click="switchConversation(conversation.id, { closeMenu: true })"
                  >
                    <span class="conversation-menu-indicator" :class="{ live: conversation.isStreaming }"></span>
                    <span class="conversation-menu-copy">
                      <span class="conversation-menu-title">{{ conversation.title }}</span>
                      <span class="conversation-menu-meta">{{ getConversationMeta(conversation) }}</span>
                    </span>
                    <i v-if="conversation.id === activeConversationId" class="bi bi-check2 conversation-menu-check"></i>
                  </button>

                  <button
                    v-if="conversationPages.length > 1"
                    class="conversation-menu-close"
                    type="button"
                    :disabled="conversation.isStreaming || isUploading"
                    title="Close chat"
                    aria-label="Close chat"
                    @click.stop="closeConversationTab(conversation.id)"
                  >
                    <i class="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
            </div>

            <span class="chat-tabs-count">{{ conversationTabsSummary }}</span>
          </div>
        </div>

        <div class="chat-header-actions">
          <button
            class="chat-add-btn"
            type="button"
            :disabled="!canCreateConversation"
            title="Create a new chat page"
            aria-label="Create a new chat page"
            @click="createConversationTab"
          >
            <i class="bi bi-plus-lg"></i>
            <span>New</span>
          </button>
        </div>
      </div>

      <div ref="chatBodyRef" class="chat-body">
        <div v-if="!messages.length" class="chat-empty-state">
          <div class="chat-empty-card">
            <span class="chat-empty-badge">{{ activeConversation?.title || 'New chat' }}</span>
            <h6 class="mb-2">Start a new analysis thread</h6>
            <p class="mb-0">
              Select files on the left, then ask the agent a question. Each chat page keeps its own history, workspace, and response trace.
            </p>
          </div>
        </div>

        <template v-else>
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
                    <div class="agent-block-header">
                      <div class="rounded-circle bg-white border d-flex align-items-center justify-content-center agent-icon-wrap">
                        <i class="bi" :class="getAgentIconClass(step.agent)"></i>
                      </div>
                      <span class="fw-semibold small">{{ getAgentDisplayName(step.agent) }}</span>

                      <div class="ms-auto d-flex align-items-center gap-2">
                        <template v-if="step.status === 'running'">
                          <span class="step-running-label">Thinking</span>
                          <button
                            class="stream-control-btn stream-control-inline thinking-indicator-btn"
                            type="button"
                            :disabled="!isStreaming"
                            title="Stop response"
                            aria-label="Stop response"
                            @click="stopStreaming"
                          >
                            <span class="stop-square-icon thinking-indicator-icon" aria-hidden="true"></span>
                          </button>
                        </template>
                        <i v-else-if="step.status === 'done'" class="bi bi-check-circle-fill text-success"></i>
                        <i v-else-if="step.status === 'stopped'" class="bi bi-stop-circle-fill text-warning"></i>
                        <i v-else-if="step.status === 'error'" class="bi bi-exclamation-circle-fill text-danger"></i>
                      </div>
                    </div>

                    <div class="agent-block-content markdown-body small" v-html="renderMarkdown(step.content, msg.workspace)"></div>
                  </div>
                </div>
              </template>

              <div v-else class="message-bubble assistant-bubble">
                <div class="small fw-semibold mb-1">Agent</div>
                <div class="message-text markdown-body" v-html="renderMarkdown(msg.text, msg.workspace)"></div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="chat-footer">
        <div class="composer-shell">
          <form class="composer-form" @submit.prevent="submitPrompt">
            <div v-if="queuedFileAssets.length" class="composer-selection-row">
              <div class="composer-selection-header">
                <span class="composer-selection-summary">{{ selectionSummaryText }}</span>
                <span v-if="checkedFilePaths.length > 1" class="composer-selection-mode">Sequential analysis</span>
              </div>
              <div class="composer-selection-list">
                <div v-for="file in queuedFileAssets" :key="file.path" class="composer-selection-chip" :title="file.path">
                  <span class="composer-selection-icon">
                    <i class="bi" :class="file.extension === '.json' || file.extension === '.jsonl' ? 'bi-filetype-json' : 'bi-file-earmark-spreadsheet'"></i>
                  </span>
                  <span class="composer-selection-copy">
                    <span class="composer-selection-label">{{ queuedFileAssets.length > 1 ? 'Queued file' : 'Analyzing file' }}</span>
                    <span class="composer-selection-name">{{ file.name }}</span>
                    <span class="composer-selection-path">{{ file.path }}</span>
                  </span>
                </div>
              </div>
            </div>

            <textarea
              ref="composerRef"
              v-model="chatPrompt"
              class="form-control composer"
              rows="1"
              :placeholder="composerPlaceholder"
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
                :disabled="!chatPrompt.trim() || isBusy"
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
            <p class="text-muted small mb-0">Save one reusable local vLLM or API configuration for interactive testing.</p>
          </div>
          <button type="button" class="btn-close" @click="closeModelConfigModal"></button>
        </div>

        <div class="modal-body">
          <div v-if="modelFormError" class="alert alert-danger py-2 px-3" role="alert">{{ modelFormError }}</div>

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
            <input v-model="modelForm.name" type="text" class="form-control" maxlength="128" placeholder="Example: Local Qwen vLLM">
          </div>

          <div class="mb-3">
            <label class="form-label small text-muted mb-1">Model Name</label>
            <input v-model="modelForm.model_name" type="text" class="form-control" maxlength="200" placeholder="Qwen2.5-1.5B-Instruct">
          </div>

          <template v-if="modelForm.mode === 'local'">
            <div class="mb-3">
              <label class="form-label small text-muted mb-1">Local Model Path</label>
              <div class="d-flex align-items-center gap-2">
                <input v-model="modelForm.model_path" type="text" class="form-control" maxlength="2000" placeholder="/path/to/local/model">
                <button class="btn btn-outline-secondary" type="button" @click="browseLocalModelPath">Browse</button>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label small text-muted mb-1">Local Host</label>
              <input v-model="modelForm.host" type="text" class="form-control" maxlength="500" placeholder="http://127.0.0.1:8000/v1">
            </div>
            <small class="text-muted d-block">Local mode connects to a vLLM OpenAI-compatible endpoint and stores the selected model path for launch context.</small>
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
            <div class="mb-0">
              <label class="form-label small text-muted mb-1">Organization</label>
              <input v-model="modelForm.organization" type="text" class="form-control" maxlength="200" placeholder="Optional organization id">
            </div>
            <small class="text-muted d-block mt-2">API mode uses an OpenAI-compatible chat client. Leave Base URL empty for the default endpoint.</small>
          </template>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline-secondary" type="button" @click="closeModelConfigModal">Close</button>
          <button class="btn btn-dark" type="button" @click="saveModelConfig">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Modal } from 'bootstrap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SandboxEnvironmentSelector from '../../components/SandboxEnvironmentSelector.vue'
import {
  createAgentAssetFolder,
  deleteAgentAssetFile,
  deleteAgentAssetFolder,
  fetchAgenticSynthesisTasks,
  fetchAgentAssetTree,
  fetchDatasets,
  fetchUserPreference,
  fetchReasoningDistillationTasks,
  saveUserPreference,
  streamAgentInteractionChat,
  uploadAgentInteractionFile
} from '../../api/dataAgent'
import { config } from '../../config/global'
import { chooseLocalDirectory, isElectronRuntime } from '../../utils/desktop'

const SERVER_DEFAULT_MODEL_ID = 'server-default'
const SAVED_MODEL_ID = 'saved-model'
const INTERACTIVE_PREFERENCE_KEY = 'interactive_testing'
const LOCAL_VLLM_ENDPOINT = 'http://127.0.0.1:8000/v1'
const LOCAL_VLLM_MODEL_NAME = 'Qwen2.5-1.5B-Instruct'
const DEFAULT_REMOTE_MODEL_NAME = 'gpt-4o-mini'
const MAX_CONVERSATION_PAGES = 6
const CONVERSATION_TITLE_LIMIT = 30
const route = useRoute()
const router = useRouter()

const fileInputRef = ref(null)
const composerRef = ref(null)
const chatBodyRef = ref(null)
const modelConfigModalRef = ref(null)
const modelPickerRef = ref(null)
const conversationPickerRef = ref(null)
const pendingFolderInputRef = ref(null)
const canBrowseLocalDirectory = isElectronRuntime()
const selectedSandboxEnvironmentId = ref('')
const isHydratingInteractivePreference = ref(false)
const platformDatasets = ref([])
const platformTrajectoryTasks = ref([])
const platformDistillationTasks = ref([])
const attachedContextItems = ref([])
const selectedPlatformRefs = ref({
  dataset: '',
  trajectoryTask: '',
  distillationTask: ''
})

const assetTreeItems = ref([])
const assetSummary = ref({ folder_count: 0, file_count: 0, total_size: 0 })
const selectedAssetPath = ref('')
const selectedAssetType = ref('folder')
const checkedFilePaths = ref([])
const expandedFolderPaths = ref([''])
const isAssetsLoading = ref(false)
const pendingFolderDraft = ref(null)
const pendingUploadFolderPath = ref('')
const isUploading = ref(false)
const savedModelConfig = ref(null)
const activeModelId = ref(SERVER_DEFAULT_MODEL_ID)
const modelFormError = ref('')
const modelForm = ref(createEmptyModelForm())
const isModelMenuOpen = ref(false)
const isConversationMenuOpen = ref(false)
const conversationPages = ref([createConversationPage(1)])
const activeConversationId = ref(conversationPages.value[0].id)
const nextConversationNumber = ref(2)

let modelConfigModalInstance = null

const activeConversation = computed(() =>
  conversationPages.value.find((item) => item.id === activeConversationId.value) || conversationPages.value[0] || null
)
const messages = computed(() => activeConversation.value?.messages || [])
const chatPrompt = computed({
  get: () => activeConversation.value?.chatPrompt || '',
  set: (value) => {
    if (activeConversation.value) activeConversation.value.chatPrompt = String(value ?? '')
  }
})
const workspaceId = computed({
  get: () => activeConversation.value?.workspaceId || makeWorkspaceId(),
  set: (value) => {
    if (activeConversation.value) activeConversation.value.workspaceId = cleanString(value) || makeWorkspaceId()
  }
})
const sessionId = computed({
  get: () => activeConversation.value?.sessionId || '',
  set: (value) => {
    if (activeConversation.value) activeConversation.value.sessionId = cleanString(value)
  }
})
const notice = computed({
  get: () => activeConversation.value?.notice || '',
  set: (value) => {
    if (activeConversation.value) activeConversation.value.notice = String(value || '')
  }
})
const isStreaming = computed(() => !!activeConversation.value?.isStreaming)
const isAnyConversationStreaming = computed(() => conversationPages.value.some((item) => item.isStreaming))
const conversationTabsSummary = computed(() => `${conversationPages.value.length} chat${conversationPages.value.length === 1 ? '' : 's'}`)
const canCreateConversation = computed(() => conversationPages.value.length < MAX_CONVERSATION_PAGES && !isUploading.value)

const isBusy = computed(() => isUploading.value || isAnyConversationStreaming.value)
const assetStatsText = computed(() => `${assetSummary.value.folder_count || 0} folders, ${assetSummary.value.file_count || 0} files saved`)
const selectedFileAsset = computed(() => findAssetNodeByPath(assetTreeItems.value, selectedAssetPath.value, 'file'))
const checkedFilePathSet = computed(() => new Set(checkedFilePaths.value))
const allFilePaths = computed(() =>
  flattenAllAssetNodes(assetTreeItems.value, [])
    .filter((node) => node.type === 'file')
    .map((node) => node.path)
)
const checkedFileAssets = computed(() =>
  checkedFilePaths.value
    .map((path) => findAssetNodeByPath(assetTreeItems.value, path, 'file'))
    .filter(Boolean)
)
const queuedFileAssets = computed(() => {
  if (checkedFileAssets.value.length > 0) return checkedFileAssets.value
  return selectedFileAsset.value ? [selectedFileAsset.value] : []
})
const selectionSummaryText = computed(() => {
  if (checkedFileAssets.value.length > 1) return `${checkedFileAssets.value.length} files selected`
  if (checkedFileAssets.value.length === 1) return '1 file selected'
  if (selectedFileAsset.value) return 'Focused file'
  return ''
})
const composerPlaceholder = computed(() => {
  if (queuedFileAssets.value.length === 1) {
    return `Ask a question about ${queuedFileAssets.value[0].name}. Enter sends, Shift+Enter adds a new line.`
  }
  if (queuedFileAssets.value.length > 1) {
    return `Ask a question about ${queuedFileAssets.value.length} selected files. The agent will analyze them one by one. Enter sends, Shift+Enter adds a new line.`
  }
  return 'Ask a question about the uploaded files. Enter sends, Shift+Enter adds a new line.'
})
const isRootChecked = computed(() => allFilePaths.value.length > 0 && allFilePaths.value.every((path) => checkedFilePathSet.value.has(path)))
const isRootIndeterminate = computed(() => {
  const checkedCount = allFilePaths.value.filter((path) => checkedFilePathSet.value.has(path)).length
  return checkedCount > 0 && checkedCount < allFilePaths.value.length
})
const currentTargetFolderPath = computed(() => {
  if (selectedAssetType.value === 'folder') return selectedAssetPath.value
  return parentAssetPath(selectedAssetPath.value)
})
const currentTargetFolderLabel = computed(() => currentTargetFolderPath.value || 'Root')
const flattenedAssetRows = computed(() => flattenVisibleAssetRows(assetTreeItems.value, pendingFolderDraft.value))
const activeModelConfig = computed(() => {
  if (activeModelId.value !== SAVED_MODEL_ID) return null
  return savedModelConfig.value || null
})
const modelOptions = computed(() => {
  const options = [
    {
      id: SERVER_DEFAULT_MODEL_ID,
      label: 'Server Default',
      meta: 'Use backend default model',
      icon: 'bi-stars',
      tone: 'default'
    }
  ]

  if (savedModelConfig.value) {
    options.push({
      id: SAVED_MODEL_ID,
      label: savedModelConfig.value.name,
      meta: `${savedModelConfig.value.mode === 'local' ? 'Local' : 'API'} · ${savedModelConfig.value.model_name}`,
      icon: savedModelConfig.value.mode === 'local' ? 'bi-cpu-fill' : 'bi-cloud-fill',
      tone: savedModelConfig.value.mode === 'local' ? 'local' : 'api'
    })
  }

  return options
})
const activeModelOption = computed(() => modelOptions.value.find((item) => item.id === activeModelId.value) || modelOptions.value[0])

function makeWorkspaceId() {
  return `agent-ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function makeConversationId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cleanString(value) {
  return String(value || '').trim()
}

function createConversationPage(sequence = 1) {
  return {
    id: makeConversationId(),
    title: `Chat ${sequence}`,
    isUntitled: true,
    workspaceId: makeWorkspaceId(),
    sessionId: '',
    chatPrompt: '',
    notice: '',
    isStreaming: false,
    currentStreamController: null,
    messages: []
  }
}

function getConversationById(conversationId = activeConversationId.value) {
  return conversationPages.value.find((item) => item.id === conversationId) || null
}

function abbreviateConversationTitle(value, limit = CONVERSATION_TITLE_LIMIT) {
  const normalized = cleanString(value).replace(/\s+/g, ' ')
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(6, limit - 1)).trim()}…`
}

function deriveConversationTitle(prompt, queuedFiles = []) {
  const promptTitle = abbreviateConversationTitle(prompt)
  if (queuedFiles.length === 1) {
    return abbreviateConversationTitle(queuedFiles[0]?.name || promptTitle || 'Chat')
  }
  if (queuedFiles.length > 1) {
    return abbreviateConversationTitle(`${queuedFiles.length} files`)
  }
  return promptTitle || ''
}

function updateConversationTitleFromPrompt(conversationId, prompt, queuedFiles = []) {
  const conversation = getConversationById(conversationId)
  if (!conversation || !conversation.isUntitled) return
  const derivedTitle = deriveConversationTitle(prompt, queuedFiles)
  if (!derivedTitle) return
  conversation.title = derivedTitle
  conversation.isUntitled = false
}

function createConversationTab() {
  if (!canCreateConversation.value) return
  const nextConversation = createConversationPage(nextConversationNumber.value)
  nextConversationNumber.value += 1
  conversationPages.value.push(nextConversation)
  activeConversationId.value = nextConversation.id
  isConversationMenuOpen.value = false
  nextTick(() => {
    adjustComposerHeight()
    composerRef.value?.focus()
  })
}

function switchConversation(conversationId, options = {}) {
  if (!getConversationById(conversationId)) return
  if (activeConversationId.value !== conversationId) activeConversationId.value = conversationId
  if (options.closeMenu) isConversationMenuOpen.value = false
}

function closeConversationTab(conversationId) {
  if (conversationPages.value.length === 1) return
  const index = conversationPages.value.findIndex((item) => item.id === conversationId)
  if (index < 0) return

  const conversation = conversationPages.value[index]
  if (conversation.isStreaming || isUploading.value) return

  const hasContent = conversation.messages.length > 0 || cleanString(conversation.chatPrompt)
  if (hasContent && typeof window !== 'undefined') {
    const confirmed = window.confirm(`Close "${conversation.title}"? This chat page will be removed.`)
    if (!confirmed) return
  }

  conversationPages.value.splice(index, 1)
  if (activeConversationId.value === conversationId) {
    const fallbackConversation = conversationPages.value[Math.max(0, index - 1)] || conversationPages.value[0]
    if (fallbackConversation) activeConversationId.value = fallbackConversation.id
  }
  nextTick(() => adjustComposerHeight())
}

function getConversationMeta(conversation) {
  if (!conversation) return ''
  if (conversation.isStreaming) return 'Responding now'
  const messageCount = Array.isArray(conversation.messages) ? conversation.messages.length : 0
  if (!messageCount) return 'Empty chat'
  return `${messageCount} message${messageCount === 1 ? '' : 's'}`
}

function getAgentDisplayName(agent) {
  const normalized = cleanString(agent)
  const labels = {
    Analyze: 'Analyze',
    Understand: 'Understand',
    Code: 'Code',
    Execute: 'Execute',
    Answer: 'Answer',
    TrainingAuditLead: '训练数据质量评估总控',
    Orchestrator: '评估总控',
    Planner: '审计规划器',
    TableFinder: '数据定位器',
    DataAnalyst: '数据分析师',
    DatasetProfiler: '数据质量分析师',
    QualityAuditor: '质量审计员',
    TrainingReadinessReviewer: '训练就绪度评审',
    Visualization: '图表分析师',
    ReportWriter: '报告生成器',
    AuditReportWriter: '报告生成器'
  }
  return labels[normalized] || normalized || '智能体'
}

function getAgentIconClass(agent) {
  const normalized = cleanString(agent)
  if (normalized === 'Analyze') {
    return 'bi-search text-info'
  }
  if (normalized === 'Understand') {
    return 'bi-lightbulb text-warning'
  }
  if (normalized === 'Code') {
    return 'bi-code-slash text-primary'
  }
  if (normalized === 'Execute') {
    return 'bi-play-circle text-success'
  }
  if (normalized === 'Answer') {
    return 'bi-chat-dots text-primary'
  }
  if ([ 'TrainingAuditLead', 'Orchestrator', 'Planner' ].includes(normalized)) {
    return 'bi-stars text-warning'
  }
  if ([ 'DatasetProfiler', 'QualityAuditor', 'DataAnalyst', 'TableFinder' ].includes(normalized)) {
    return 'bi-clipboard-data text-success'
  }
  if (normalized === 'TrainingReadinessReviewer') {
    return 'bi-shield-check text-danger'
  }
  if (normalized === 'Visualization') {
    return 'bi-bar-chart-line text-info'
  }
  if ([ 'AuditReportWriter', 'ReportWriter' ].includes(normalized)) {
    return 'bi-file-earmark-richtext text-primary'
  }
  return 'bi-robot text-primary'
}

function normalizeEndpoint(value) {
  const text = cleanString(value)
  if (!text) return ''
  return text.replace(/\/+$/, '')
}

function normalizeStoredModelConfig(raw) {
  if (!raw || typeof raw !== 'object') return null
  const mode = cleanString(raw.mode) === 'api' ? 'api' : 'local'
  const modelName = cleanString(raw.model_name || raw.modelName)
  if (!modelName) return null

  const normalized = {
    id: SAVED_MODEL_ID,
    name: cleanString(raw.name) || `${mode === 'local' ? 'Local' : 'API'} ${modelName}`,
    mode,
    provider: 'openai',
    model_name: modelName,
    host: mode === 'local' ? normalizeEndpoint(raw.host || raw.base_url || raw.baseUrl) || LOCAL_VLLM_ENDPOINT : '',
    model_path: mode === 'local' ? cleanString(raw.model_path || raw.modelPath) : '',
    api_key: mode === 'api' ? cleanString(raw.api_key || raw.apiKey) : '',
    base_url: mode === 'api' ? normalizeEndpoint(raw.base_url || raw.baseUrl) : '',
    organization: mode === 'api' ? cleanString(raw.organization) : '',
    client_type: 'openai'
  }

  if (mode === 'api' && !normalized.api_key) return null
  return normalized
}

function createEmptyModelForm(mode = 'local') {
  return {
    name: '',
    mode,
    model_name: mode === 'local' ? LOCAL_VLLM_MODEL_NAME : DEFAULT_REMOTE_MODEL_NAME,
    model_path: '',
    host: LOCAL_VLLM_ENDPOINT,
    api_key: '',
    base_url: '',
    organization: ''
  }
}

function buildInteractivePreferencePayload() {
  return {
    active_model_id: activeModelId.value,
    selected_sandbox_environment_id: cleanString(selectedSandboxEnvironmentId.value),
    saved_model_config: savedModelConfig.value ? { ...savedModelConfig.value } : null
  }
}

async function persistInteractivePreference({ silent = false } = {}) {
  try {
    await saveUserPreference(INTERACTIVE_PREFERENCE_KEY, buildInteractivePreferencePayload())
  } catch (error) {
    if (!silent) {
      throw error
    }
  }
}

function hydrateInteractivePreference(value) {
  if (!value || typeof value !== 'object') return

  isHydratingInteractivePreference.value = true
  try {
    const normalized = normalizeStoredModelConfig(value.saved_model_config)
    savedModelConfig.value = normalized
    const nextActiveId = cleanString(value.active_model_id)
    activeModelId.value = nextActiveId === SAVED_MODEL_ID && normalized ? SAVED_MODEL_ID : SERVER_DEFAULT_MODEL_ID
    selectedSandboxEnvironmentId.value = cleanString(value.selected_sandbox_environment_id)
    if (normalized) {
      modelForm.value = {
        name: normalized.name,
        mode: normalized.mode,
        model_name: normalized.model_name,
        model_path: normalized.model_path || '',
        host: normalized.host || LOCAL_VLLM_ENDPOINT,
        api_key: normalized.api_key || '',
        base_url: normalized.base_url || '',
        organization: normalized.organization || ''
      }
    }
  } finally {
    isHydratingInteractivePreference.value = false
  }
}

async function loadInteractivePreference() {
  try {
    const response = await fetchUserPreference(INTERACTIVE_PREFERENCE_KEY)
    hydrateInteractivePreference(response?.data?.value ?? null)
  } catch {
    // preference loading is best-effort
  }
}

function getModelConfigModal() {
  if (!modelConfigModalRef.value) return null
  modelConfigModalInstance = Modal.getOrCreateInstance(modelConfigModalRef.value)
  return modelConfigModalInstance
}

function populateModelFormFromConfig(config = null) {
  modelFormError.value = ''
  if (!config) {
    modelForm.value = createEmptyModelForm('local')
    return
  }
  modelForm.value = {
    name: config.name,
    mode: config.mode,
    model_name: config.model_name,
    model_path: config.model_path || '',
    host: config.host || LOCAL_VLLM_ENDPOINT,
    api_key: config.api_key || '',
    base_url: config.base_url || '',
    organization: config.organization || ''
  }
}

function openModelConfigModal() {
  isModelMenuOpen.value = false
  populateModelFormFromConfig(savedModelConfig.value)
  getModelConfigModal()?.show()
}

function closeModelConfigModal() {
  getModelConfigModal()?.hide()
}

function toggleModelMenu() {
  if (isBusy.value) return
  isConversationMenuOpen.value = false
  isModelMenuOpen.value = !isModelMenuOpen.value
}

function closeModelMenu() {
  isModelMenuOpen.value = false
}

function toggleConversationMenu() {
  isModelMenuOpen.value = false
  isConversationMenuOpen.value = !isConversationMenuOpen.value
}

function handleDocumentPointerDown(event) {
  const modelRoot = modelPickerRef.value
  if (modelRoot && !modelRoot.contains(event.target)) {
    isModelMenuOpen.value = false
  }

  const conversationRoot = conversationPickerRef.value
  if (conversationRoot && !conversationRoot.contains(event.target)) {
    isConversationMenuOpen.value = false
  }
}

function setModelFormMode(mode) {
  modelForm.value = {
    ...modelForm.value,
    mode,
    model_name: cleanString(modelForm.value.model_name) || (mode === 'local' ? LOCAL_VLLM_MODEL_NAME : DEFAULT_REMOTE_MODEL_NAME),
    host: mode === 'local' ? (normalizeEndpoint(modelForm.value.host) || LOCAL_VLLM_ENDPOINT) : LOCAL_VLLM_ENDPOINT,
    model_path: mode === 'local' ? cleanString(modelForm.value.model_path) : '',
    api_key: mode === 'api' ? modelForm.value.api_key : '',
    base_url: mode === 'api' ? normalizeEndpoint(modelForm.value.base_url) : '',
    organization: mode === 'api' ? modelForm.value.organization : ''
  }
}

function validateModelForm() {
  const name = cleanString(modelForm.value.name)
  const modelName = cleanString(modelForm.value.model_name)
  const mode = modelForm.value.mode === 'api' ? 'api' : 'local'

  if (!name) return 'Display name is required.'
  if (!modelName) return 'Model name is required.'
  if (mode === 'local' && !cleanString(modelForm.value.model_path)) return 'Local model path is required for local models.'
  if (mode === 'local' && !normalizeEndpoint(modelForm.value.host)) return 'Local host is required for local models.'
  if (mode === 'api' && !cleanString(modelForm.value.api_key)) return 'API key is required for API models.'
  return ''
}

function applyConversationReset(reason, { resetWorkspace = false, conversationId = activeConversationId.value } = {}) {
  const conversation = getConversationById(conversationId)
  if (!conversation) return
  const hadConversation = cleanString(conversation.sessionId) || conversation.messages.length > 0
  conversation.sessionId = ''
  if (resetWorkspace) conversation.workspaceId = makeWorkspaceId()
  if (hadConversation && reason) appendAssistantNote(reason, conversationId)
}

function applyConversationResetToAll(reason, { resetWorkspace = false } = {}) {
  conversationPages.value.forEach((conversation) => {
    conversation.sessionId = ''
    if (resetWorkspace) conversation.workspaceId = makeWorkspaceId()
  })
  if (reason) {
    applyConversationReset(reason, {
      resetWorkspace: false,
      conversationId: activeConversationId.value
    })
  }
}

function selectModel(modelId, options = {}) {
  const normalizedId = modelOptions.value.some((item) => item.id === modelId) ? modelId : SERVER_DEFAULT_MODEL_ID
  const changed = activeModelId.value !== normalizedId
  activeModelId.value = normalizedId
  isModelMenuOpen.value = false
  void persistInteractivePreference({ silent: true })

  if (changed && !options.silent) {
    notice.value = ''
    applyConversationResetToAll('Model changed. The next prompt will use the selected model.', {
      resetWorkspace: false
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
    model_name: item.model_name,
    model_path: item.model_path || undefined
  }

  if (item.mode === 'local') {
    payload.api_key = 'local'
    payload.base_url = normalizeEndpoint(item.host) || LOCAL_VLLM_ENDPOINT
    payload.client_type = 'openai'
  } else {
    payload.api_key = item.api_key
    if (item.base_url) payload.base_url = item.base_url
    if (item.organization) payload.organization = item.organization
    payload.client_type = item.client_type || 'openai'
  }

  return payload
}

async function browseLocalModelPath() {
  modelFormError.value = ''
  if (!canBrowseLocalDirectory) {
    modelFormError.value = 'Browse is available only in the Electron desktop app. In browser mode, enter a local model path manually.'
    return
  }
  const selected = await chooseLocalDirectory()
  if (selected) {
    modelForm.value.model_path = selected
  }
}

async function saveModelConfig() {
  const error = validateModelForm()
  if (error) {
    modelFormError.value = error
    return
  }

  const normalized = normalizeStoredModelConfig(modelForm.value)
  if (!normalized) {
    modelFormError.value = 'Model configuration is invalid.'
    return
  }

  modelFormError.value = ''
  const previouslyActiveId = activeModelId.value
  const previousSavedModelConfig = savedModelConfig.value ? { ...savedModelConfig.value } : null
  savedModelConfig.value = normalized
  activeModelId.value = SAVED_MODEL_ID
  try {
    await persistInteractivePreference()
    if (previouslyActiveId !== SAVED_MODEL_ID) {
      applyConversationResetToAll('Model changed. The next prompt will use the selected model.', {
        resetWorkspace: false
      })
    }
    notice.value = `Using model: ${normalized.name}`
    isModelMenuOpen.value = false
    closeModelConfigModal()
  } catch (persistError) {
    if (previouslyActiveId !== activeModelId.value) {
      activeModelId.value = previouslyActiveId
    }
    savedModelConfig.value = previousSavedModelConfig
    modelFormError.value = persistError?.message || 'Failed to save model configuration.'
  }
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

function collectNodeFilePaths(node, rows = []) {
  if (!node) return rows
  if (node.type === 'file') {
    rows.push(node.path)
    return rows
  }
  if (node.type === 'folder' && Array.isArray(node.children)) {
    node.children.forEach((child) => collectNodeFilePaths(child, rows))
  }
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

function normalizeCheckedFiles(allNodes = null) {
  const sourceNodes = Array.isArray(allNodes) ? allNodes : flattenAllAssetNodes(assetTreeItems.value, [])
  const validFilePaths = new Set(sourceNodes.filter((node) => node.type === 'file').map((node) => node.path))
  const nextChecked = []
  const seen = new Set()
  checkedFilePaths.value.forEach((path) => {
    const normalized = cleanString(path)
    if (!normalized || seen.has(normalized) || !validFilePaths.has(normalized)) return
    seen.add(normalized)
    nextChecked.push(normalized)
  })
  checkedFilePaths.value = nextChecked
}

function hasSelectableFiles(node) {
  return collectNodeFilePaths(node, []).length > 0
}

function isNodeChecked(node) {
  const filePaths = collectNodeFilePaths(node, [])
  return filePaths.length > 0 && filePaths.every((path) => checkedFilePathSet.value.has(path))
}

function isNodeIndeterminate(node) {
  if (!node || node.type !== 'folder') return false
  const filePaths = collectNodeFilePaths(node, [])
  if (!filePaths.length) return false
  const checkedCount = filePaths.filter((path) => checkedFilePathSet.value.has(path)).length
  return checkedCount > 0 && checkedCount < filePaths.length
}

function updateCheckedFiles(nextPaths) {
  const uniquePaths = []
  const seen = new Set()
  nextPaths.forEach((path) => {
    const normalized = cleanString(path)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    uniquePaths.push(normalized)
  })
  checkedFilePaths.value = uniquePaths
}

function toggleNodeFilesSelection(node) {
  const filePaths = collectNodeFilePaths(node, [])
  if (!filePaths.length) return
  const next = new Set(checkedFilePaths.value)
  const allChecked = filePaths.every((path) => next.has(path))
  if (allChecked) {
    filePaths.forEach((path) => next.delete(path))
  } else {
    filePaths.forEach((path) => next.add(path))
  }
  updateCheckedFiles(Array.from(next))
}

function toggleRootFilesSelection() {
  if (!allFilePaths.value.length) return
  const next = new Set(checkedFilePaths.value)
  if (isRootChecked.value) {
    allFilePaths.value.forEach((path) => next.delete(path))
  } else {
    allFilePaths.value.forEach((path) => next.add(path))
  }
  updateCheckedFiles(Array.from(next))
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
  normalizeCheckedFiles(allNodes)
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

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function normalizeArtifactReference(value) {
  const raw = cleanString(value).replace(/\\/g, '/')
  if (!raw) return ''
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw

  let normalized = raw.replace(/^\.\//, '').replace(/^\//, '')
  if (normalized.startsWith('../output/')) {
    normalized = normalized.slice(3)
  } else if (normalized.startsWith('../charts/')) {
    normalized = `output/charts/${normalized.slice('../charts/'.length)}`
  } else if (normalized.startsWith('charts/')) {
    normalized = `output/charts/${normalized.slice('charts/'.length)}`
  }

  return normalized
}

function buildAgentArtifactUrl(value, workspace = '') {
  const normalized = normalizeArtifactReference(value)
  if (!normalized) return ''
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized

  if (normalized.startsWith('output/')) {
    return `${config.apiBase}/generated/${normalized.slice('output/'.length)}`
  }

  const params = new URLSearchParams({ path: normalized })
  const workspaceName = cleanString(workspace)
  if (workspaceName) {
    params.set('workspace', workspaceName)
  }
  return `${config.apiBase}/chat/artifact?${params.toString()}`
}

function inferArtifactLabel(value, fallback = 'Generated chart') {
  const normalized = normalizeArtifactReference(value)
  if (!normalized) return fallback
  const fileName = normalized.split('/').pop() || ''
  const stem = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return stem || fallback
}

function renderMarkdownInlineImage(altText, value, workspace = '') {
  const src = buildAgentArtifactUrl(value, workspace)
  if (!src) return ''
  const safeAlt = escapeAttribute(altText || inferArtifactLabel(value, 'Generated chart'))
  const safeSrc = escapeAttribute(src)
  return `<span class="md-inline-image-wrap"><img class="md-inline-image" src="${safeSrc}" alt="${safeAlt}" loading="lazy"></span>`
}

function renderMarkdownImageFigure(altText, value, workspace = '') {
  const src = buildAgentArtifactUrl(value, workspace)
  if (!src) return ''
  const safeAlt = escapeAttribute(altText || inferArtifactLabel(value, 'Generated chart'))
  const safeSrc = escapeAttribute(src)
  return `<figure class="md-image"><img src="${safeSrc}" alt="${safeAlt}" loading="lazy"><figcaption>${safeAlt}</figcaption></figure>`
}

function formatInlineMarkdown(value, workspace = '') {
  let text = String(value || '')
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  text = text.replace(/\*\*([^*][\s\S]*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, artifactPath) => renderMarkdownInlineImage(alt, artifactPath, workspace))
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

function normalizeStreamingMarkdownSource(raw) {
  const source = String(raw || '').replace(/\r\n?/g, '\n')
  if (!source) return ''

  const fenceLines = source.match(/^\s*```[a-zA-Z0-9_-]*\s*$/gm) || []
  if (fenceLines.length % 2 === 0) return source

  return `${source}\n\`\`\``
}

function renderMarkdown(raw, workspace = '') {
  const source = normalizeStreamingMarkdownSource(raw)
  if (!source.trim()) return ''

  const codeBlocks = []
  const renderedArtifactPaths = new Set()
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
    const html = paragraphLines.map((line) => formatInlineMarkdown(escapeHtml(line), workspace)).join('<br>')
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
      .map((cell) => `<th>${formatInlineMarkdown(escapeHtml(cell), workspace)}</th>`)
      .join('')

    const bodyHtml = bodyRows
      .map((row) => {
        const rowHtml = normalizeCells(row)
          .map((cell) => `<td>${formatInlineMarkdown(escapeHtml(cell), workspace)}</td>`)
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

    const standaloneImageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (standaloneImageMatch) {
      flushParagraph()
      flushList()
      const normalizedPath = normalizeArtifactReference(standaloneImageMatch[2])
      if (normalizedPath && !renderedArtifactPaths.has(normalizedPath)) {
        renderedArtifactPaths.add(normalizedPath)
        blocks.push(renderMarkdownImageFigure(standaloneImageMatch[1], standaloneImageMatch[2], workspace))
      }
      lineIndex += 1
      continue
    }

    const artifactPathMatch = trimmed.match(/^(?:\u8def\u5f84|path)\s*[:\uff1a]\s*([^\s]+\.(?:png|jpe?g|gif|svg|webp))$/i)
    if (artifactPathMatch) {
      flushParagraph()
      flushList()
      blocks.push(`<p>${formatInlineMarkdown(escapeHtml(line), workspace)}</p>`)
      const normalizedPath = normalizeArtifactReference(artifactPathMatch[1])
      if (normalizedPath && !renderedArtifactPaths.has(normalizedPath)) {
        renderedArtifactPaths.add(normalizedPath)
        blocks.push(renderMarkdownImageFigure(inferArtifactLabel(artifactPathMatch[1]), artifactPathMatch[1], workspace))
      }
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
      const content = formatInlineMarkdown(escapeHtml(headingMatch[2]), workspace)
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
      const content = formatInlineMarkdown(escapeHtml(quoteMatch[1]), workspace)
      blocks.push(`<blockquote>${content}</blockquote>`)
      lineIndex += 1
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      if (listMode && listMode !== 'ol') flushList()
      listMode = 'ol'
      listItems.push(`<li>${formatInlineMarkdown(escapeHtml(orderedMatch[1]), workspace)}</li>`)
      lineIndex += 1
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (listMode && listMode !== 'ul') flushList()
      listMode = 'ul'
      listItems.push(`<li>${formatInlineMarkdown(escapeHtml(unorderedMatch[1]), workspace)}</li>`)
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

function appendAssistantNote(text, conversationId = activeConversationId.value) {
  const conversation = getConversationById(conversationId)
  if (!conversation) return
  conversation.messages.push({
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    text: String(text || ''),
    agentSteps: [],
    workspace: ''
  })
}

function appendUserMessage(text, conversationId = activeConversationId.value) {
  const conversation = getConversationById(conversationId)
  if (!conversation) return
  conversation.messages.push({
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'user',
    text: String(text || ''),
    agentSteps: []
  })
}

function appendAssistantPlaceholder(workspace = '', conversationId = activeConversationId.value) {
  const conversation = getConversationById(conversationId)
  if (!conversation) return ''
  const id = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  conversation.messages.push({ id, role: 'assistant', text: '', agentSteps: [], workspace: cleanString(workspace) })
  return id
}

function setAssistantMessageWorkspace(conversationId, messageId, workspace) {
  const normalizedWorkspace = cleanString(workspace)
  if (!normalizedWorkspace) return
  updateAssistantMessage(conversationId, messageId, (msg) => ({
    ...msg,
    workspace: normalizedWorkspace
  }))
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

function updateAssistantMessage(conversationId, messageId, updater) {
  const conversation = getConversationById(conversationId)
  if (!conversation) return
  conversation.messages = conversation.messages.map((msg) => {
    if (msg.id !== messageId) return msg
    return updater({ ...msg, agentSteps: Array.isArray(msg.agentSteps) ? [...msg.agentSteps] : [] })
  })
}

function applyStreamUpdate(conversationId, messageId, update) {
  updateAssistantMessage(conversationId, messageId, (msg) => {
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

function finalizeAssistantMessage(conversationId, messageId) {
  updateAssistantMessage(conversationId, messageId, (msg) => {
    const steps = (msg.agentSteps || []).map((step) => step.status === 'running' ? { ...step, status: 'done' } : step)
    const lastStepWithContent = [...steps].reverse().find((step) => step.stepType !== 'agent_start' && String(step?.content || '').trim())
    return { ...msg, text: lastStepWithContent?.content || msg.text, agentSteps: steps }
  })
}

function markAssistantError(conversationId, messageId, error) {
  const message = `Error: ${error?.message || 'unknown error'}`
  updateAssistantMessage(conversationId, messageId, (msg) => {
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

function markAssistantStopped(conversationId, messageId) {
  updateAssistantMessage(conversationId, messageId, (msg) => {
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
  const conversation = getConversationById()
  if (!conversation || !conversation.isStreaming || !conversation.currentStreamController) return
  notice.value = 'Stopping response...'
  conversation.currentStreamController.abort()
}
function adjustComposerHeight() {
  const el = composerRef.value
  if (!el) return
  el.style.height = 'auto'
  const maxHeight = 92
  const nextHeight = Math.min(el.scrollHeight, maxHeight)
  el.style.height = `${nextHeight}px`
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function syncReset(reason) {
  applyConversationResetToAll(reason, {
    resetWorkspace: true
  })
}

function mapPlatformDatasets(raw) {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return list.map((item, index) => ({
    id: Number(item?.id || index + 1),
    name: String(item?.name || item?.dataset_name || `dataset-${index + 1}`)
  }))
}

function mapPlatformTasks(raw, labelPrefix) {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return list.map((item, index) => ({
    id: Number(item?.id || index + 1),
    label: `#${item?.id || index + 1} · ${String(item?.dataset_name || item?.dataset?.name || item?.datasetName || labelPrefix)}`
  }))
}

async function refreshPlatformContextOptions() {
  try {
    const [datasetsResponse, trajectoryResponse, distillationResponse] = await Promise.all([
      fetchDatasets(),
      fetchAgenticSynthesisTasks(100),
      fetchReasoningDistillationTasks(100)
    ])
    platformDatasets.value = mapPlatformDatasets(datasetsResponse)
    platformTrajectoryTasks.value = mapPlatformTasks(trajectoryResponse, 'trajectory')
    platformDistillationTasks.value = mapPlatformTasks(distillationResponse, 'distillation')
    hydrateContextFromQuery()
  } catch {
    // ignore option refresh failures and keep chat usable
  }
}

function contextLabelFor(type, refId, fallback = '') {
  if (type === 'dataset') {
    return platformDatasets.value.find((item) => Number(item.id) === Number(refId))?.name || fallback || `Dataset #${refId}`
  }
  if (type === 'trajectory_task') {
    return platformTrajectoryTasks.value.find((item) => Number(item.id) === Number(refId))?.label || fallback || `Trajectory Task #${refId}`
  }
  if (type === 'distillation_task') {
    return platformDistillationTasks.value.find((item) => Number(item.id) === Number(refId))?.label || fallback || `Distillation Task #${refId}`
  }
  return fallback || `${type} #${refId}`
}

function attachContextItem(type, refId, fallbackLabel = '') {
  const normalizedId = Number(refId || 0)
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return
  const exists = attachedContextItems.value.some((item) => item.type === type && Number(item.refId) === normalizedId)
  if (exists) return
  attachedContextItems.value = [
    ...attachedContextItems.value,
    {
      type,
      refId: normalizedId,
      label: contextLabelFor(type, normalizedId, fallbackLabel)
    }
  ]
  syncReset('Attached platform context changed. A new agent session will start on the next prompt.')
}

function attachPlatformContext(type) {
  if (type === 'dataset') {
    attachContextItem('dataset', selectedPlatformRefs.value.dataset)
    selectedPlatformRefs.value.dataset = ''
    return
  }
  if (type === 'trajectory_task') {
    attachContextItem('trajectory_task', selectedPlatformRefs.value.trajectoryTask)
    selectedPlatformRefs.value.trajectoryTask = ''
    return
  }
  if (type === 'distillation_task') {
    attachContextItem('distillation_task', selectedPlatformRefs.value.distillationTask)
    selectedPlatformRefs.value.distillationTask = ''
  }
}

function removeAttachedContext(type, refId) {
  attachedContextItems.value = attachedContextItems.value.filter((item) => !(item.type === type && Number(item.refId) === Number(refId)))
  syncReset('Attached platform context changed. A new agent session will start on the next prompt.')
}

function hydrateContextFromQuery() {
  const contextType = cleanString(route.query.contextType)
  const contextId = Number(route.query.contextId || 0)
  const contextLabel = cleanString(route.query.contextLabel)
  if (contextType && Number.isFinite(contextId) && contextId > 0) {
    attachContextItem(contextType, contextId, contextLabel)
  }
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
  const conversationId = activeConversationId.value
  const conversation = getConversationById(conversationId)
  if (!conversation) return

  const prompt = cleanString(conversation.chatPrompt)
  const queuedFiles = queuedFileAssets.value
  if (!prompt || isBusy.value) return
  if (!Number(assetSummary.value.file_count || 0)) {
    notice.value = 'Please upload at least one context file first.'
    return
  }

  conversation.chatPrompt = ''
  adjustComposerHeight()
  notice.value = ''

  updateConversationTitleFromPrompt(conversationId, prompt, queuedFiles)
  appendUserMessage(prompt, conversationId)
  const assistantMessageId = appendAssistantPlaceholder(conversation.workspaceId, conversationId)
  const streamController = new AbortController()
  conversation.currentStreamController = streamController

  try {
    conversation.isStreaming = true

    await streamAgentInteractionChat(
      {
        query: prompt,
        workspace: conversation.workspaceId,
        request_id: conversation.sessionId || undefined,
        selected_file_path: queuedFiles.length === 1 ? queuedFiles[0].path : undefined,
        selected_file_paths: queuedFiles.length ? queuedFiles.map((file) => file.path) : undefined,
        model_config: buildSelectedModelPayload(),
        sandbox_environment_id: cleanString(selectedSandboxEnvironmentId.value) || undefined
      },
      {
        signal: streamController.signal,
        onOpened: (data) => {
          const targetConversation = getConversationById(conversationId)
          if (!targetConversation) return
          const openedSessionId = String(data?.session_id || '').trim()
          if (openedSessionId) {
            targetConversation.sessionId = openedSessionId
          }
          const openedWorkspace = cleanString(data?.workspace)
          if (openedWorkspace) {
            targetConversation.workspaceId = openedWorkspace
            setAssistantMessageWorkspace(conversationId, assistantMessageId, openedWorkspace)
          }
        },
        onDelta: (update) => {
          applyStreamUpdate(conversationId, assistantMessageId, update)
        },
        onDone: () => {
          finalizeAssistantMessage(conversationId, assistantMessageId)
        },
        onError: (error) => {
          const targetConversation = getConversationById(conversationId)
          if (targetConversation) {
            targetConversation.notice = error?.message || 'Stream failed.'
          }
          markAssistantError(conversationId, assistantMessageId, error)
        }
      }
    )
  } catch (error) {
    if (isAbortError(error)) {
      const targetConversation = getConversationById(conversationId)
      if (targetConversation) {
        targetConversation.notice = 'Response stopped.'
        targetConversation.sessionId = ''
      }
      markAssistantStopped(conversationId, assistantMessageId)
    } else {
      const msg = error?.message || 'unknown error'
      const targetConversation = getConversationById(conversationId)
      if (targetConversation) {
        targetConversation.notice = msg
      }
      markAssistantError(conversationId, assistantMessageId, error)
    }
  } finally {
    const targetConversation = getConversationById(conversationId)
    if (targetConversation) {
      targetConversation.currentStreamController = null
      targetConversation.isStreaming = false
    }
  }
}

onMounted(async () => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  await loadInteractivePreference()
  await Promise.all([
    refreshAssetTree(),
    refreshPlatformContextOptions()
  ])
  nextTick(() => adjustComposerHeight())
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  conversationPages.value.forEach((conversation) => conversation.currentStreamController?.abort())
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

watch(
  activeConversationId,
  async () => {
    await nextTick()
    adjustComposerHeight()
    if (chatBodyRef.value) {
      chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
    }
  }
)

watch(
  selectedSandboxEnvironmentId,
  (nextValue, previousValue) => {
    const nextId = cleanString(nextValue)
    const prevId = cleanString(previousValue)
    if (isHydratingInteractivePreference.value) {
      return
    }
    if (nextId === prevId) return
    void persistInteractivePreference({ silent: true })
    if (!nextId && !prevId) return
    syncReset('Environment changed. A new agent session will start on the next prompt.')
  }
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

.environment-panel {
  padding: 0.9rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #fcfcfd;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1rem 0.85rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.platform-context-panel {
  border-bottom: 1px solid #e5e7eb;
  background: #fcfcfd;
}

:global(.modal) {
  z-index: 1400;
}

:global(.modal-backdrop) {
  z-index: 1390;
}

.platform-context-header {
  padding: 0.75rem 1rem 0.25rem;
}

.platform-context-body {
  padding: 0.25rem 1rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.platform-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.45rem;
}

.attached-context-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.15rem;
}

.attached-context-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid #dbe2ea;
  background: #fff;
  border-radius: 999px;
  padding: 0.35rem 0.55rem 0.35rem 0.7rem;
  font-size: 0.78rem;
  color: #334155;
}

.attached-context-remove {
  border: 0;
  background: transparent;
  color: #64748b;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

.asset-checkbox-slot,
.asset-checkbox-spacer {
  width: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.asset-checkbox-input {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
  border-radius: 4px;
  border: 1.5px solid #60a5fa;
  box-shadow: none;
}

.asset-checkbox-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 0.16rem rgba(37, 99, 235, 0.18);
}

.asset-checkbox-input:checked {
  background-color: #2563eb;
  border-color: #2563eb;
}

.asset-checkbox-input:indeterminate {
  background-color: #93c5fd;
  border-color: #2563eb;
}

.asset-checkbox-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
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
  background: #dbeafe;
  color: #2563eb;
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
  gap: 0.65rem;
  padding: 0.72rem 0.88rem 0.68rem;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.chat-header-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.chat-header-eyebrow {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #2563eb;
  white-space: nowrap;
}

.chat-header-controls {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.48rem;
}

.conversation-picker {
  position: relative;
  min-width: 0;
  width: min(100%, 360px);
}

.conversation-picker-btn {
  width: 100%;
  min-height: 34px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #0f172a;
  border-radius: 999px;
  padding: 0.18rem 0.28rem 0.18rem 0.24rem;
  display: flex;
  align-items: center;
  gap: 0.44rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: all 0.18s ease;
}

.conversation-picker-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #9ca3af;
}

.conversation-picker-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.conversation-picker-icon {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563eb, #60a5fa);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.78rem;
}

.conversation-picker-icon.live {
  background: linear-gradient(135deg, #0f766e, #22c55e);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.12);
}

.conversation-picker-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.02rem;
}

.conversation-picker-label {
  font-size: 0.58rem;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 700;
}

.conversation-picker-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
  font-weight: 600;
  color: #0f172a;
}

.conversation-picker-count {
  flex-shrink: 0;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 0.12rem 0.42rem;
  font-size: 0.64rem;
  font-weight: 700;
}

.conversation-picker-caret {
  color: #64748b;
  transition: transform 0.18s ease;
}

.conversation-picker-caret.open {
  transform: rotate(180deg);
}

.conversation-picker-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  width: min(360px, calc(100vw - 3rem));
  padding: 0.34rem;
  border-radius: 16px;
  border: 1px solid #dbe4f0;
  background: #ffffff;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.16);
  z-index: 35;
}

.conversation-menu-row {
  display: flex;
  align-items: center;
  gap: 0.28rem;
  border-radius: 12px;
  padding: 0.1rem;
}

.conversation-menu-row.active {
  background: #f8fbff;
}

.conversation-menu-item {
  min-width: 0;
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 10px;
  padding: 0.42rem 0.48rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  text-align: left;
  transition: background-color 0.18s ease;
}

.conversation-menu-item:hover {
  background: #f8fafc;
}

.conversation-menu-indicator {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #cbd5e1;
  flex-shrink: 0;
}

.conversation-menu-indicator.live {
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.14);
}

.conversation-menu-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.04rem;
}

.conversation-menu-title {
  font-size: 0.79rem;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-menu-meta {
  font-size: 0.7rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-menu-check {
  color: #2563eb;
  font-size: 0.92rem;
}

.conversation-menu-close {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.conversation-menu-close:hover:not(:disabled) {
  background: #e5e7eb;
  color: #0f172a;
}

.conversation-menu-close:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chat-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  flex-shrink: 0;
}

.chat-tabs-count {
  font-size: 0.7rem;
  color: #64748b;
  white-space: nowrap;
}

.chat-add-btn {
  min-height: 34px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #0f172a;
  border-radius: 999px;
  padding: 0.18rem 0.62rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: all 0.18s ease;
}

.chat-add-btn:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.chat-add-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chat-body {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  overflow: auto;
  flex: 1;
  min-height: 0;
  background: #f7faff;
  padding: 0.82rem 0.92rem;
}

.chat-empty-state {
  flex: 1;
  display: grid;
  place-items: center;
}

.chat-empty-card {
  max-width: 400px;
  border: 1px solid #dbeafe;
  background: linear-gradient(160deg, #ffffff 0%, #f3f8ff 100%);
  border-radius: 20px;
  padding: 1.08rem 1.12rem;
  box-shadow: 0 18px 30px rgba(15, 23, 42, 0.07);
  text-align: left;
}

.chat-empty-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  padding: 0.22rem 0.52rem;
  font-size: 0.68rem;
  font-weight: 700;
  margin-bottom: 0.7rem;
}

.chat-empty-card h6 {
  font-size: 0.94rem;
  color: #0f172a;
}

.chat-empty-card p {
  font-size: 0.8rem;
  line-height: 1.55;
  color: #475569;
}

.chat-footer {
  padding: 0.6rem 0.72rem 0.72rem;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.composer-shell {
  border: 1px solid #dbe4f0;
  background: #ffffff;
  border-radius: 16px;
  padding: 0.46rem 0.52rem;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.composer-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
  margin-top: 0.32rem;
}

.composer-left-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  flex: 1;
}

.composer-plus-btn {
  width: 28px;
  height: 28px;
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
  max-width: 236px;
  flex: 1;
}

.model-picker-btn {
  width: 100%;
  min-height: 32px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  border-radius: 999px;
  padding: 0.18rem 0.42rem 0.18rem 0.24rem;
  display: flex;
  align-items: center;
  gap: 0.38rem;
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
  width: 22px;
  height: 22px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #ffffff;
  font-size: 0.74rem;
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
  font-size: 0.8rem;
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
  bottom: calc(100% + 0.45rem);
  width: min(300px, calc(100vw - 3rem));
  padding: 0.32rem;
  border-radius: 14px;
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
  padding: 0.42rem;
  display: flex;
  align-items: center;
  gap: 0.58rem;
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
  width: 26px;
  height: 26px;
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
  max-width: 82%;
  border-radius: 12px;
  padding: 0.56rem 0.68rem;
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
  width: min(100%, 860px);
}

.message-text,
.message-text-plain {
  margin: 0;
  word-break: break-word;
  font-size: 0.88rem;
  line-height: 1.5;
}

.composer-selection-row {
  margin-bottom: 0.28rem;
}

.composer-selection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.42rem;
  margin-bottom: 0.28rem;
}

.composer-selection-summary {
  font-size: 0.58rem;
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 700;
}

.composer-selection-mode {
  flex-shrink: 0;
  padding: 0.12rem 0.36rem;
  border-radius: 999px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.6rem;
  font-weight: 600;
}

.composer-selection-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
  max-height: 68px;
  overflow: auto;
  padding-right: 0.15rem;
}

.composer-selection-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  min-height: 26px;
  max-width: min(100%, 240px);
  flex: 0 1 240px;
  padding: 0.22rem 0.36rem;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #dbe4f0;
}

.composer-selection-icon {
  width: 22px;
  height: 22px;
  border-radius: 8px;
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
  font-size: 0.52rem;
  line-height: 1.05;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  font-weight: 700;
}

.composer-selection-name {
  font-size: 0.72rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-selection-path {
  font-size: 0.62rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer {
  resize: none;
  min-height: 42px;
  max-height: 92px;
  border: none;
  box-shadow: none;
  padding: 0.02rem 0.08rem 0;
  line-height: 1.38;
  font-size: 0.88rem;
}

.composer:focus {
  box-shadow: none;
}

.composer-action-btn {
  font-size: 0.92rem;
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
  width: 26px;
  height: 26px;
  padding: 0;
}

.thinking-indicator-btn {
  box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.16);
}

.stream-control-composer {
  width: 34px;
  height: 34px;
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
  font-size: 0.72rem;
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

.thinking-indicator-icon {
  animation: thinkingPulse 1.15s ease-in-out infinite;
  transform-origin: center;
}

@keyframes thinkingPulse {
  0% {
    transform: scale(0.82);
    opacity: 0.72;
  }

  50% {
    transform: scale(1.28);
    opacity: 1;
  }

  100% {
    transform: scale(0.82);
    opacity: 0.72;
  }
}

@media (prefers-reduced-motion: reduce) {
  .thinking-indicator-icon {
    animation: none;
  }
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

.markdown-body :deep(figure.md-image) {
  margin: 0.75rem 0;
}

.markdown-body :deep(figure.md-image img) {
  display: block;
  max-width: 100%;
  border-radius: 12px;
  border: 1px solid #d6dfec;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.markdown-body :deep(figure.md-image figcaption) {
  margin-top: 0.4rem;
  font-size: 0.82rem;
  color: #64748b;
}

.markdown-body :deep(.md-inline-image-wrap) {
  display: inline-flex;
  margin: 0.25rem 0;
}

.markdown-body :deep(.md-inline-image) {
  max-width: min(100%, 520px);
  border-radius: 10px;
  border: 1px solid #d6dfec;
}

.agent-step-container {
  width: 100%;
}

.agent-block {
  position: relative;
  z-index: 1;
  border-radius: 14px !important;
}

.agent-block-header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.52rem 0.68rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.agent-block-content {
  padding: 0.72rem 0.8rem;
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
  width: 22px;
  height: 22px;
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

  .chat-header-copy,
  .chat-header-controls,
  .chat-header-actions {
    width: 100%;
  }

  .chat-header-copy {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.4rem;
  }

  .chat-header-controls {
    justify-content: space-between;
  }

  .conversation-picker {
    width: 100%;
  }

  .conversation-picker-menu {
    width: 100%;
  }

  .composer-bottom-row {
    align-items: stretch;
    flex-direction: column;
  }

  .composer-left-actions {
    width: 100%;
  }

  .composer-selection-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .composer-selection-chip {
    max-width: 100%;
    flex-basis: 100%;
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
