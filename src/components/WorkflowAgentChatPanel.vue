<template>
  <aside class="workflow-agent-chat" :class="{ collapsed: isCollapsed }">
    <button
      v-if="isCollapsed"
      class="collapsed-chat-card"
      type="button"
      :title="`Expand ${pageTitle} Factory Agent`"
      @click="setCollapsed(false)"
    >
      <span class="collapsed-chat-icon">
        <i class="bi bi-chat-square-text"></i>
      </span>
      <span class="collapsed-chat-copy">
        <span class="collapsed-chat-label">Factory Agent</span>
        <span class="collapsed-chat-meta">{{ compactSessionSummary }}</span>
      </span>
      <span class="collapsed-chat-badge">{{ sessions.length }}</span>
    </button>

    <section v-else class="chat-panel card border-0 shadow-sm">
      <div class="chat-panel-header">
        <div class="chat-header-copy">
          <span class="chat-header-eyebrow">Factory Agent</span>
          <div class="chat-header-controls">
            <div ref="sessionPickerRef" class="conversation-picker">
              <button
                class="conversation-picker-btn"
                type="button"
                :aria-expanded="isSessionMenuOpen ? 'true' : 'false'"
                @click="toggleSessionMenu"
              >
                <span class="conversation-picker-icon" :class="{ live: isSending }">
                  <i class="bi bi-chat-square-text"></i>
                </span>
                <span class="conversation-picker-title">{{ activeSession?.title || 'New chat' }}</span>
                <i class="bi bi-chevron-down conversation-picker-caret" :class="{ open: isSessionMenuOpen }"></i>
              </button>

              <div v-if="isSessionMenuOpen" class="conversation-picker-menu">
                <button
                  v-for="session in sessions"
                  :key="session.id"
                  class="conversation-menu-item"
                  :class="{ active: session.id === activeSessionId }"
                  type="button"
                  @click="switchSession(session.id)"
                >
                  <span class="conversation-menu-indicator" :class="{ live: session.id === activeSessionId }"></span>
                  <span class="conversation-menu-copy">
                    <span class="conversation-menu-title">{{ session.title }}</span>
                    <span class="conversation-menu-meta">{{ getSessionMeta(session) }}</span>
                  </span>
                  <i v-if="session.id === activeSessionId" class="bi bi-check2 conversation-menu-check"></i>
                </button>
              </div>
            </div>
            <div class="chat-header-actions">
              <button
                class="chat-add-btn"
                type="button"
                title="New chat"
                aria-label="New chat"
                :disabled="isSending"
                @click="createChatSession"
              >
                <i class="bi bi-plus-lg"></i>
              </button>
              <button
                class="chat-collapse-btn"
                type="button"
                title="Collapse Factory Agent"
                aria-label="Collapse Factory Agent"
                :disabled="isSending"
                @click="setCollapsed(true)"
              >
                <i class="bi bi-chevron-double-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="notice" class="chat-notice">
        <div class="alert alert-warning py-2 px-3 mb-0 small" role="alert">
          {{ notice }}
        </div>
      </div>

      <div ref="chatBodyRef" class="chat-body">
        <div v-if="!messages.length" class="chat-empty-state">
          <div class="chat-empty-card">
            <span class="chat-empty-badge">{{ pageTitle }}</span>
            <h6 class="mb-2">Start a new chat</h6>
            <p class="mb-0">{{ emptyStateCopy }}</p>
          </div>
        </div>

        <template v-else>
          <div
            v-for="message in messages"
            :key="message.id"
            class="message-row"
            :class="message.role === 'user' ? 'user' : 'assistant'"
          >
            <article class="message-bubble">
              <div class="message-role">{{ message.role === 'user' ? 'You' : 'Agent' }}</div>
              <div v-if="message.role === 'assistant'" class="message-text message-text-markdown">
                <MarkdownRenderer :content="message.text" />
              </div>
              <div v-else class="message-text">{{ message.text }}</div>
              <div v-if="hasDatasetView(message)" class="message-dataset-actions">
                <div class="message-dataset-card">
                  <div class="message-dataset-copy">
                    <div class="message-dataset-name">{{ datasetSummaryTitle(message) }}</div>
                    <div class="message-dataset-meta">
                      <span>{{ datasetSummaryCount(message) }}</span>
                      <span v-if="message.datasetSearch?.filters?.formatTags?.length">
                        {{ message.datasetSearch.filters.formatTags.join(', ') }}
                      </span>
                    </div>
                    <div class="message-dataset-preview">{{ datasetSummaryPreview(message) }}</div>
                  </div>
                  <button
                    class="btn btn-outline-primary btn-sm message-dataset-view-btn"
                    type="button"
                    @click="viewDatasetMatches(message)"
                  >
                    View
                  </button>
                </div>
              </div>
              <div v-if="message.promptRecommendation?.prompt" class="message-prompt-actions">
                <div class="message-prompt-card">
                  <div class="message-prompt-copy">
                    <div class="message-prompt-title">
                      {{ message.promptRecommendation.target === 'evaluation' ? 'Evaluation Prompt' : 'Synthesis Prompt' }}
                    </div>
                    <div v-if="message.promptRecommendation.changes?.length" class="message-prompt-meta">
                      {{ message.promptRecommendation.changes.join(' · ') }}
                    </div>
                    <div v-if="message.promptRecommendation.actionSequence?.length" class="message-prompt-sequence">
                      {{ message.promptRecommendation.actionSequence.join(' → ') }}
                    </div>
                  </div>
                  <button
                    class="btn btn-primary btn-sm message-prompt-apply-btn"
                    type="button"
                    @click="applyPromptRecommendation(message.promptRecommendation)"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </article>
          </div>
        </template>
      </div>

      <form class="chat-footer" @submit.prevent="sendMessage">
        <textarea
          ref="composerRef"
          v-model="draft"
          class="chat-composer"
          rows="1"
          :disabled="isSending || isLoading"
          :placeholder="composerPlaceholder"
          @input="adjustComposerHeight"
          @keydown.enter.exact.prevent="sendMessage"
        ></textarea>
        <button
          class="chat-send-btn"
          type="submit"
          :disabled="!canSend"
          :title="isSending ? 'Waiting for response' : 'Send message'"
        >
          <span v-if="isSending" class="spinner-border spinner-border-sm" role="status"></span>
          <i v-else class="bi bi-send-fill"></i>
        </button>
      </form>
    </section>
  </aside>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { fetchUserPreference, saveUserPreference, streamWorkflowAssistantChat } from '../api/dataAgent'

const emit = defineEmits(['collapse-change', 'apply-prompt', 'view-datasets'])

const props = defineProps({
  pageKey: {
    type: String,
    required: true
  },
  pageTitle: {
    type: String,
    required: true
  },
  pageDescription: {
    type: String,
    default: ''
  },
  pageContext: {
    type: Object,
    default: () => ({})
  }
})

const CHAT_PREFERENCE_KEY = 'workflow_agent_chat'
const MAX_MESSAGES = 40
const SESSION_TITLE_LIMIT = 40

const chatBodyRef = ref(null)
const composerRef = ref(null)
const sessionPickerRef = ref(null)
const isLoading = ref(true)
const isSending = ref(false)
const isSessionMenuOpen = ref(false)
const notice = ref('')
const preferenceState = ref({ pages: {} })
const pageState = ref(createDefaultPageState())
const isHydrating = ref(false)

let persistTimer = null

const sessions = computed(() => Array.isArray(pageState.value.sessions) ? pageState.value.sessions : [])
const activeSessionId = computed(() => String(pageState.value.activeSessionId || ''))
const activeSession = computed(() => sessions.value.find((item) => item.id === activeSessionId.value) || sessions.value[0] || null)
const messages = computed(() => Array.isArray(activeSession.value?.messages) ? activeSession.value.messages : [])
const isCollapsed = computed(() => !!pageState.value.collapsed)
const sessionSummary = computed(() => `${sessions.value.length} chat${sessions.value.length === 1 ? '' : 's'}`)
const compactSessionSummary = computed(() => `${sessions.value.length} session${sessions.value.length === 1 ? '' : 's'}`)
const composerPlaceholder = computed(() => `Ask about ${props.pageTitle}`)
const emptyStateCopy = computed(
  () =>
    props.pageDescription ||
    `Ask questions about ${props.pageTitle}. Each page keeps its own chat sessions and history.`
)
const canSend = computed(() => !isLoading.value && !isSending.value && cleanString(draft.value))
const draft = computed({
  get: () => String(activeSession.value?.draft || ''),
  set: (value) => {
    if (!activeSession.value) return
    activeSession.value.draft = String(value ?? '')
  }
})

function nowIso() {
  return new Date().toISOString()
}

function makeSessionId() {
  return `wf-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cleanString(value) {
  return String(value || '').trim()
}

function abbreviateTitle(value) {
  const normalized = cleanString(value).replace(/\s+/g, ' ')
  if (!normalized) return ''
  if (normalized.length <= SESSION_TITLE_LIMIT) return normalized
  return `${normalized.slice(0, SESSION_TITLE_LIMIT - 1).trim()}…`
}

function createSessionRecord(sequence = 1) {
  const timestamp = nowIso()
  return {
    id: makeSessionId(),
    title: `Chat ${sequence}`,
    isUntitled: true,
    draft: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: []
  }
}

function createDefaultPageState() {
  const initialSession = createSessionRecord(1)
  return {
    collapsed: false,
    activeSessionId: initialSession.id,
    nextSessionNumber: 2,
    sessions: [initialSession]
  }
}

function normalizeMessage(raw = {}, index = 0) {
  const role = String(raw.role || '').toLowerCase() === 'assistant' ? 'assistant' : 'user'
  const text = String(raw.text || raw.content || '').trim()
  if (!text) return null
  const datasetMatches = Array.isArray(raw.datasetMatches || raw.dataset_matches)
    ? (raw.datasetMatches || raw.dataset_matches)
      .map((item) => normalizeDatasetMatch(item))
      .filter(Boolean)
    : []
  return {
    id: cleanString(raw.id) || `wf-msg-${Date.now()}-${index}`,
    role,
    text,
    createdAt: cleanString(raw.createdAt || raw.created_at) || nowIso(),
    datasetMatches,
    datasetViewItems: normalizeDatasetViewItems(raw.datasetViewItems || raw.dataset_view_items),
    datasetSearch: normalizeDatasetSearch(raw.datasetSearch || raw.dataset_search),
    promptRecommendation: normalizePromptRecommendation(raw.promptRecommendation || raw.prompt_recommendation)
  }
}

function normalizeDatasetMatch(raw = {}) {
  const datasetId = Number(raw.id || raw.dataset_id || 0)
  const name = cleanString(raw.name)
  if (!datasetId || !name) return null
  return {
    id: datasetId,
    name,
    type: cleanString(raw.type),
    sourceKind: cleanString(raw.sourceKind || raw.source_kind),
    status: cleanString(raw.status),
    note: cleanString(raw.note),
    formatTags: Array.isArray(raw.formatTags || raw.format_tags) ? [...(raw.formatTags || raw.format_tags)] : [],
    languageTags: Array.isArray(raw.languageTags || raw.language_tags) ? [...(raw.languageTags || raw.language_tags)] : [],
    size: Number(raw.size || 0)
  }
}

function normalizeDatasetSearch(raw = {}) {
  if (!raw || typeof raw !== 'object') return null
  const filters = raw.filters && typeof raw.filters === 'object' ? raw.filters : {}
  return {
    query: cleanString(raw.query),
    totalMatches: Number(raw.totalMatches || raw.total_matches || 0),
    shownMatches: Number(raw.shownMatches || raw.shown_matches || 0),
    matchedDatasetIds: Array.isArray(raw.matchedDatasetIds || raw.matched_dataset_ids)
      ? [...(raw.matchedDatasetIds || raw.matched_dataset_ids)].map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)
      : [],
    filters: {
      nameKeyword: cleanString(filters.nameKeyword || filters.name_keyword),
      formatTags: Array.isArray(filters.formatTags || filters.format_tags) ? [...(filters.formatTags || filters.format_tags)].map((item) => cleanString(item)).filter(Boolean) : [],
      languageTags: Array.isArray(filters.languageTags || filters.language_tags) ? [...(filters.languageTags || filters.language_tags)].map((item) => cleanString(item)).filter(Boolean) : [],
      sizeLevels: Array.isArray(filters.sizeLevels || filters.size_levels) ? [...(filters.sizeLevels || filters.size_levels)].map((item) => cleanString(item)).filter(Boolean) : [],
      statuses: Array.isArray(filters.statuses) ? [...filters.statuses].map((item) => cleanString(item)).filter(Boolean) : []
    }
  }
}

function normalizeDatasetViewItems(raw = []) {
  if (!Array.isArray(raw)) return []
  return raw.filter((item) => item && typeof item === 'object')
}

function normalizePromptRecommendation(raw = {}) {
  if (!raw || typeof raw !== 'object') return null
  const prompt = cleanString(raw.prompt)
  if (!prompt) return null
  const target = cleanString(raw.target).toLowerCase() === 'evaluation' ? 'evaluation' : 'synthesis'
  const changes = Array.isArray(raw.changes)
    ? raw.changes.map((item) => cleanString(item)).filter(Boolean)
    : []
  const actionSequence = Array.isArray(raw.actionSequence || raw.action_sequence)
    ? (raw.actionSequence || raw.action_sequence).map((item) => cleanString(item)).filter(Boolean)
    : []
  return {
    target,
    prompt,
    changes,
    actionSequence
  }
}

function normalizeSession(raw = {}, index = 0) {
  const messagesList = Array.isArray(raw.messages)
    ? raw.messages.map((item, msgIndex) => normalizeMessage(item, msgIndex)).filter(Boolean)
    : []
  const fallbackTitle = `Chat ${index + 1}`
  return {
    id: cleanString(raw.id) || makeSessionId(),
    title: cleanString(raw.title) || fallbackTitle,
    isUntitled: raw.isUntitled !== false,
    draft: '',
    createdAt: cleanString(raw.createdAt || raw.created_at) || nowIso(),
    updatedAt: cleanString(raw.updatedAt || raw.updated_at) || cleanString(raw.createdAt || raw.created_at) || nowIso(),
    messages: messagesList.slice(-MAX_MESSAGES)
  }
}

function normalizePageState(raw) {
  const fallback = createDefaultPageState()
  if (!raw || typeof raw !== 'object') return fallback

  const sessionsList = Array.isArray(raw.sessions)
    ? raw.sessions.map((item, index) => normalizeSession(item, index)).filter(Boolean)
    : []

  if (!sessionsList.length) return fallback

  const requestedActiveId = cleanString(raw.activeSessionId || raw.active_session_id)
  const active = sessionsList.find((item) => item.id === requestedActiveId) || sessionsList[0]
  const nextSessionNumber = Math.max(Number(raw.nextSessionNumber || raw.next_session_number || 0) || 0, sessionsList.length + 1)

  return {
    collapsed: !!raw.collapsed,
    activeSessionId: active.id,
    nextSessionNumber,
    sessions: sessionsList
  }
}

function serializePageState() {
  return {
    collapsed: !!pageState.value.collapsed,
    activeSessionId: cleanString(pageState.value.activeSessionId),
    nextSessionNumber: Math.max(2, Number(pageState.value.nextSessionNumber || 2)),
    sessions: sessions.value.map((session) => ({
      id: cleanString(session.id),
      title: cleanString(session.title) || 'Chat',
      isUntitled: session.isUntitled !== false,
      createdAt: cleanString(session.createdAt) || nowIso(),
      updatedAt: cleanString(session.updatedAt) || nowIso(),
      messages: (Array.isArray(session.messages) ? session.messages : [])
        .map((message) => normalizeMessage(message))
        .filter(Boolean)
        .slice(-MAX_MESSAGES)
    }))
  }
}

function schedulePersist() {
  if (isHydrating.value) return
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    void persistState()
  }, 180)
}

async function persistState() {
  if (isHydrating.value) return
  const payload = {
    pages: {
      ...(preferenceState.value?.pages || {}),
      [props.pageKey]: serializePageState()
    }
  }
  preferenceState.value = payload
  try {
    await saveUserPreference(CHAT_PREFERENCE_KEY, payload)
  } catch {
    // preference persistence is best-effort
  }
}

async function loadState() {
  isLoading.value = true
  isHydrating.value = true
  try {
    const response = await fetchUserPreference(CHAT_PREFERENCE_KEY)
    const value = response?.data?.value
    const pages = value && typeof value === 'object' && value.pages && typeof value.pages === 'object'
      ? value.pages
      : {}
    preferenceState.value = { pages }
    pageState.value = normalizePageState(pages[props.pageKey])
  } catch {
    preferenceState.value = { pages: {} }
    pageState.value = createDefaultPageState()
  } finally {
    isHydrating.value = false
    isLoading.value = false
    emit('collapse-change', !!pageState.value.collapsed)
    await nextTick()
    adjustComposerHeight()
    scrollChatToBottom()
  }
}

function setCollapsed(nextValue) {
  pageState.value.collapsed = !!nextValue
  emit('collapse-change', !!pageState.value.collapsed)
  schedulePersist()
}

function toggleSessionMenu() {
  isSessionMenuOpen.value = !isSessionMenuOpen.value
}

function switchSession(sessionId) {
  const normalizedId = cleanString(sessionId)
  if (!normalizedId) return
  if (!sessions.value.some((item) => item.id === normalizedId)) return
  pageState.value.activeSessionId = normalizedId
  isSessionMenuOpen.value = false
  schedulePersist()
  nextTick(() => {
    adjustComposerHeight()
    scrollChatToBottom()
  })
}

function createNewSession() {
  const nextSequence = Math.max(1, Number(pageState.value.nextSessionNumber || sessions.value.length + 1))
  const session = createSessionRecord(nextSequence)
  pageState.value.sessions = [...sessions.value, session]
  pageState.value.activeSessionId = session.id
  pageState.value.nextSessionNumber = nextSequence + 1
  notice.value = ''
  isSessionMenuOpen.value = false
  schedulePersist()
  nextTick(() => {
    adjustComposerHeight()
    scrollChatToBottom()
  })
}

function createChatSession() {
  createNewSession()
}

function getSessionById(sessionId = activeSessionId.value) {
  return sessions.value.find((item) => item.id === cleanString(sessionId)) || null
}

function getSessionMeta(session) {
  const messageCount = Array.isArray(session?.messages) ? session.messages.length : 0
  if (!messageCount) return 'No messages yet'
  return `${messageCount} message${messageCount === 1 ? '' : 's'}`
}

function handleDocumentPointerDown(event) {
  if (!isSessionMenuOpen.value) return
  const target = event?.target
  if (sessionPickerRef.value?.contains(target)) return
  isSessionMenuOpen.value = false
}

function updateSessionTitleFromPrompt(session, prompt) {
  if (!session || session.isUntitled === false) return
  const title = abbreviateTitle(prompt)
  if (!title) return
  session.title = title
  session.isUntitled = false
}

function appendMessage(sessionId, role, text) {
  appendStructuredMessage(sessionId, {
    role,
    text,
  })
}

function appendStructuredMessage(sessionId, payload = {}) {
  const session = getSessionById(sessionId)
  if (!session) return
  const normalized = normalizeMessage({
    id: `wf-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: payload.role,
    text: String(payload.text || ''),
    createdAt: nowIso(),
    dataset_matches: payload.datasetMatches || [],
    dataset_search: payload.datasetSearch || null,
    prompt_recommendation: payload.promptRecommendation || null
  })
  if (!normalized) return
  session.messages = [
    ...(Array.isArray(session.messages) ? session.messages : []),
    normalized
  ].slice(-MAX_MESSAGES)
  session.updatedAt = nowIso()
}

function appendAssistantPlaceholder(sessionId) {
  const session = getSessionById(sessionId)
  if (!session) return ''
  const placeholder = {
    id: `wf-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    text: '',
    createdAt: nowIso(),
    datasetMatches: [],
    datasetSearch: null,
    promptRecommendation: null
  }
  session.messages = [...(Array.isArray(session.messages) ? session.messages : []), placeholder].slice(-MAX_MESSAGES)
  session.updatedAt = nowIso()
  return placeholder.id
}

function patchMessage(sessionId, messageId, updater) {
  const session = getSessionById(sessionId)
  if (!session) return
  const items = Array.isArray(session.messages) ? [...session.messages] : []
  const index = items.findIndex((item) => String(item?.id || '') === String(messageId || ''))
  if (index < 0) return
  const current = items[index]
  const nextValue = typeof updater === 'function' ? updater(current) : current
  if (!nextValue) return
  items[index] = nextValue
  session.messages = items.slice(-MAX_MESSAGES)
  session.updatedAt = nowIso()
}

function appendAssistantDelta(sessionId, messageId, chunk) {
  const delta = String(chunk || '')
  if (!delta) return
  patchMessage(sessionId, messageId, (message) => ({
    ...message,
    text: `${String(message?.text || '')}${delta}`
  }))
}

function finalizeAssistantMessage(sessionId, messageId, payload = {}) {
  patchMessage(sessionId, messageId, (message) => {
    const mergedText = cleanString(message?.text) || cleanString(payload?.answer)
    return {
      ...message,
      text: mergedText,
      datasetMatches: Array.isArray(payload?.dataset_matches || payload?.datasetMatches)
        ? (payload.dataset_matches || payload.datasetMatches).map((item) => normalizeDatasetMatch(item)).filter(Boolean)
        : Array.isArray(message?.datasetMatches)
          ? message.datasetMatches
          : [],
      datasetViewItems: normalizeDatasetViewItems(payload?.dataset_view_items || payload?.datasetViewItems).length
        ? normalizeDatasetViewItems(payload?.dataset_view_items || payload?.datasetViewItems)
        : Array.isArray(message?.datasetViewItems)
          ? message.datasetViewItems
          : [],
      datasetSearch: normalizeDatasetSearch(payload?.dataset_search || payload?.datasetSearch) || message?.datasetSearch || null,
      promptRecommendation: normalizePromptRecommendation(payload?.prompt_recommendation || payload?.promptRecommendation) || message?.promptRecommendation || null
    }
  })
}

function applyPromptRecommendation(recommendation) {
  const normalized = normalizePromptRecommendation(recommendation)
  if (!normalized) return
  emit('apply-prompt', normalized)
}

function datasetSummaryCount(message) {
  const resolvedItems = Array.isArray(message?.datasetViewItems) ? message.datasetViewItems.length : 0
  if (resolvedItems > 0) {
    return `${resolvedItems} dataset${resolvedItems === 1 ? '' : 's'} selected`
  }
  const total = Number(message?.datasetSearch?.totalMatches || 0)
  if (total > 0) {
    return `${total} dataset${total === 1 ? '' : 's'} matched`
  }
  const count = Array.isArray(message?.datasetMatches) ? message.datasetMatches.length : 0
  return `${count} dataset${count === 1 ? '' : 's'} matched`
}

function hasDatasetView(message) {
  const resolvedItems = Array.isArray(message?.datasetViewItems) ? message.datasetViewItems.length : 0
  if (resolvedItems > 0) return true
  const previewCount = Array.isArray(message?.datasetMatches) ? message.datasetMatches.length : 0
  if (previewCount > 0) return true
  const matchedIdCount = Array.isArray(message?.datasetSearch?.matchedDatasetIds) ? message.datasetSearch.matchedDatasetIds.length : 0
  if (matchedIdCount > 0) return true
  return Number(message?.datasetSearch?.totalMatches || 0) > 0
}

function datasetSummaryTitle(message) {
  const nameKeyword = cleanString(message?.datasetSearch?.filters?.nameKeyword)
  if (nameKeyword) {
    return `Dataset matches for "${nameKeyword}"`
  }
  const query = cleanString(message?.datasetSearch?.query)
  if (query) {
    return 'Dataset search results'
  }
  return 'Matched datasets'
}

function datasetSummaryPreview(message) {
  const names = Array.isArray(message?.datasetViewItems) && message.datasetViewItems.length
    ? message.datasetViewItems.map((item) => cleanString(item?.name)).filter(Boolean)
    : Array.isArray(message?.datasetMatches)
      ? message.datasetMatches.map((item) => cleanString(item?.name)).filter(Boolean)
      : []
  if (!names.length) return 'Open the list view to inspect all matching datasets.'
  const preview = names.slice(0, 3).join(' · ')
  const remaining = names.length - 3
  return remaining > 0 ? `${preview} · +${remaining} more` : preview
}

function viewDatasetMatches(message) {
  emit('view-datasets', {
    datasetItems: Array.isArray(message?.datasetViewItems) ? message.datasetViewItems : [],
    datasetMatches: Array.isArray(message?.datasetMatches) ? message.datasetMatches : [],
    datasetSearch: message?.datasetSearch || null
  })
}

async function sendMessage() {
  const session = activeSession.value
  const prompt = cleanString(draft.value)
  if (!session || !prompt || isSending.value || isLoading.value) return

  notice.value = ''
  draft.value = ''
  appendMessage(session.id, 'user', prompt)
  updateSessionTitleFromPrompt(session, prompt)
  const assistantMessageId = appendAssistantPlaceholder(session.id)
  isSending.value = true
  schedulePersist()
  await nextTick()
  adjustComposerHeight()
  scrollChatToBottom()

  try {
    const history = (Array.isArray(session.messages) ? session.messages : [])
      .map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.text || '').trim()
      }))
      .filter((item) => item.content)

    await streamWorkflowAssistantChat(
      {
        page_key: props.pageKey,
        session_id: session.id,
        messages: history,
        page_context: props.pageContext || {}
      },
      {
        onDelta: (data) => {
          appendAssistantDelta(session.id, assistantMessageId, data?.content)
          schedulePersist()
        },
        onDone: (data) => {
          finalizeAssistantMessage(session.id, assistantMessageId, data || {})
          schedulePersist()
        },
        onError: (error) => {
          notice.value = error?.message || 'Failed to send message.'
        }
      }
    )
  } catch (error) {
    notice.value = error?.message || 'Failed to send message.'
  } finally {
    isSending.value = false
    await nextTick()
    scrollChatToBottom()
  }
}

function adjustComposerHeight() {
  const element = composerRef.value
  if (!element) return
  element.style.height = 'auto'
  const maxHeight = 108
  const nextHeight = Math.min(element.scrollHeight, maxHeight)
  element.style.height = `${nextHeight}px`
  element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function scrollChatToBottom() {
  if (!chatBodyRef.value) return
  chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
}

watch(
  messages,
  async () => {
    await nextTick()
    scrollChatToBottom()
  },
  { deep: true }
)

onMounted(async () => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  await loadState()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  if (persistTimer) {
    window.clearTimeout(persistTimer)
    persistTimer = null
  }
  void persistState()
})
</script>

<style scoped>
.workflow-agent-chat {
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
  align-self: stretch;
  min-height: 0;
  height: 100%;
}

.workflow-agent-chat.collapsed {
  width: 100%;
  min-width: 0;
  flex-basis: auto;
}

.collapsed-chat-card {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 1px solid #dbe4f1;
  border-radius: 18px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.85rem;
  padding: 1rem 0.75rem;
  color: #1a2e4a;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.collapsed-chat-card:hover {
  border-color: #8fb1e6;
  box-shadow: 0 18px 42px rgba(35, 47, 69, 0.12);
  transform: translateY(-1px);
}

.collapsed-chat-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #eef4ff;
  color: #295ea8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
}

.collapsed-chat-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  align-items: center;
  text-align: center;
}

.collapsed-chat-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #1a2e4a;
}

.collapsed-chat-meta {
  font-size: 0.7rem;
  color: #6b7a90;
}

.collapsed-chat-badge {
  min-width: 32px;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  background: #f4f7fb;
  color: #48607f;
  font-size: 0.72rem;
  font-weight: 700;
}

.chat-panel {
  height: 100%;
  min-height: 0;
  background: #fff;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding-bottom: 20px;
}

.chat-panel-header {
  padding: 0.85rem 0.95rem 0.8rem;
  border-bottom: 1px solid #e5e7eb;
  background: #fcfcfd;
}

.chat-header-copy {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  flex: 1;
}

.chat-header-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #5f6f86;
}

.chat-header-controls {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.chat-add-btn,
.chat-collapse-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid #d5dfec;
  background: #fff;
  color: #37557b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
}

.chat-add-btn:hover:not(:disabled),
.chat-collapse-btn:hover:not(:disabled) {
  border-color: #90b0df;
  background: #eef4ff;
  color: #234a86;
}

.chat-add-btn:disabled,
.chat-collapse-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.conversation-picker {
  position: relative;
  min-width: 0;
  flex: 1;
}

.conversation-picker-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 32px;
  padding: 0.18rem 0.55rem;
  border-radius: 10px;
  border: 1px solid #dce4ef;
  background: #fff;
  transition: all 0.18s ease;
  text-align: left;
}

.conversation-picker-btn:hover:not(:disabled) {
  border-color: #90b0df;
  background: #f8fbff;
}

.conversation-picker-icon {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: #eef4ff;
  color: #295ea8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.72rem;
}

.conversation-picker-icon.live {
  background: #eefcf3;
  color: #0b8f54;
}

.conversation-picker-title {
  min-width: 0;
  flex: 1;
  font-size: 0.8rem;
  font-weight: 700;
  color: #1a2e4a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
}

.conversation-picker-caret {
  color: #7a899e;
  transition: transform 0.18s ease;
}

.conversation-picker-caret.open {
  transform: rotate(180deg);
}

.conversation-picker-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  left: 0;
  right: 0;
  z-index: 20;
  border: 1px solid #dce4ef;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 22px 48px rgba(28, 42, 63, 0.16);
  overflow: hidden;
}

.conversation-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.62rem 0.75rem;
  background: transparent;
  border: 0;
  text-align: left;
  transition: background 0.18s ease;
}

.conversation-menu-item + .conversation-menu-item {
  border-top: 1px solid #eef2f6;
}

.conversation-menu-item:hover,
.conversation-menu-item.active {
  background: #f7faff;
}

.conversation-menu-indicator {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #d0dae7;
  flex-shrink: 0;
}

.conversation-menu-indicator.live {
  background: #2563eb;
}

.conversation-menu-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
}

.conversation-menu-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: #1a2e4a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-menu-meta {
  font-size: 0.68rem;
  color: #73829a;
}

.conversation-menu-check {
  color: #2563eb;
  flex-shrink: 0;
}

.chat-notice {
  padding: 0.8rem 1rem 0;
}

.chat-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.95rem 0.95rem 0.7rem;
  background: linear-gradient(180deg, #fcfdff 0%, #f7f9fc 100%);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.chat-empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-empty-card {
  width: 100%;
  padding: 1rem 1.05rem;
  border-radius: 18px;
  border: 1px dashed #d6deea;
  background: rgba(255, 255, 255, 0.88);
  color: #55657b;
}

.chat-empty-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #eef4ff;
  color: #295ea8;
  padding: 0.24rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  margin-bottom: 0.7rem;
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
  max-width: min(92%, 30rem);
  padding: 0.8rem 0.95rem;
  border-radius: 16px;
  border: 1px solid #d9e1eb;
  background: #fff;
  box-shadow: 0 8px 24px rgba(28, 42, 63, 0.06);
}

.message-row.user .message-bubble {
  background: #eef4ff;
  border-color: #caddfb;
}

.message-role {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #6a7b92;
  margin-bottom: 0.35rem;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: #1d2f48;
  line-height: 1.55;
  font-size: 0.9rem;
}

.message-text-markdown {
  white-space: normal;
}

.message-text-markdown :deep(.markdown-renderer) {
  color: #1d2f48;
  line-height: 1.6;
}

.message-text-markdown :deep(.markdown-content > :first-child) {
  margin-top: 0;
}

.message-text-markdown :deep(.markdown-content > :last-child) {
  margin-bottom: 0;
}

.message-text-markdown :deep(h1),
.message-text-markdown :deep(h2),
.message-text-markdown :deep(h3),
.message-text-markdown :deep(h4),
.message-text-markdown :deep(h5),
.message-text-markdown :deep(h6) {
  font-size: 0.94rem;
}

.message-text-markdown :deep(pre) {
  margin-bottom: 0.7rem;
  border-radius: 14px;
}

.message-text-markdown :deep(table) {
  margin-bottom: 0.75rem;
}

.message-dataset-actions {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: 0.8rem;
}

.message-dataset-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.72rem;
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #fbfdff;
}

.message-dataset-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.message-dataset-name {
  font-size: 0.84rem;
  font-weight: 700;
  color: #1b304d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-dataset-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.55rem;
  font-size: 0.72rem;
  color: #64748b;
}

.message-dataset-preview {
  font-size: 0.75rem;
  color: #42536b;
  line-height: 1.45;
}

.message-dataset-view-btn {
  flex-shrink: 0;
  min-width: 64px;
}

.message-prompt-actions {
  margin-top: 0.7rem;
}

.message-prompt-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.68rem 0.75rem;
  border: 1px solid #d9e4f3;
  border-radius: 12px;
  background: #f5f9ff;
}

.message-prompt-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.message-prompt-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: #173a66;
}

.message-prompt-meta {
  font-size: 0.74rem;
  color: #5f7592;
  line-height: 1.4;
}

.message-prompt-sequence {
  font-size: 0.74rem;
  color: #244b7a;
  line-height: 1.4;
}

.message-prompt-apply-btn {
  flex-shrink: 0;
  min-width: 68px;
}

.chat-footer {
  margin-top: auto;
  padding: 0.8rem 0.95rem 0;
  border-top: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}

.chat-composer {
  flex: 1;
  min-height: 42px;
  max-height: 108px;
  resize: none;
  border: 1px solid #d7dfeb;
  border-radius: 15px;
  padding: 0.72rem 0.9rem;
  line-height: 1.45;
  color: #1d2f48;
}

.chat-composer:focus {
  outline: 0;
  border-color: #7aa3e3;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.chat-send-btn {
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 14px;
  background: #172033;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.chat-send-btn:hover:not(:disabled) {
  background: #0f1727;
  box-shadow: 0 14px 30px rgba(23, 32, 51, 0.24);
  transform: translateY(-1px);
}

.chat-send-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 1280px) {
  .workflow-agent-chat,
  .workflow-agent-chat.collapsed {
    width: 100%;
    min-width: 0;
    flex-basis: auto;
    min-height: 0;
    height: auto;
  }

  .collapsed-chat-card,
  .chat-panel {
    min-height: 320px;
    height: auto;
  }
}
</style>
