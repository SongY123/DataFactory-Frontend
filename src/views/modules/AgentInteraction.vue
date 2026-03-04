<template>
  <div class="module-page h-100">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Agent Interaction</h4>
        <p class="text-muted mb-0">Run conversational probes and inspect agent reasoning traces before release.</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" type="button" @click="clearConversation" :disabled="isSending">
        Clear Session
      </button>
    </div>

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

    <div class="interaction-layout">
      <article class="card border-0 shadow-sm d-flex flex-column chat-shell">
        <div class="card-body chat-body">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="message-row"
            :class="msg.role"
          >
            <div class="message-bubble">
              <div class="small fw-semibold mb-1">{{ msg.role === 'user' ? 'You' : 'Agent' }}</div>
              <div>{{ msg.text }}</div>
            </div>
          </div>
        </div>

        <div class="card-footer bg-white border-0 pt-0">
          <form class="d-flex gap-2" @submit.prevent="sendMessage">
            <input
              v-model.trim="draft"
              type="text"
              class="form-control"
              placeholder="Type a prompt to test agent behavior..."
              :disabled="isSending"
            >
            <button class="btn btn-primary" type="submit" :disabled="!draft || isSending">
              <span v-if="isSending" class="spinner-border spinner-border-sm" role="status"></span>
              <span v-else>Send</span>
            </button>
          </form>
        </div>
      </article>

      <article class="card border-0 shadow-sm trace-shell">
        <div class="card-body">
          <h6 class="card-title mb-2">Trace Timeline</h6>
          <div class="d-flex flex-column gap-2">
            <div v-for="trace in traces" :key="trace.id" class="trace-item">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-semibold small">{{ trace.step }}</span>
                <span class="small text-muted">{{ trace.time }}</span>
              </div>
              <div class="small text-muted">{{ trace.detail }}</div>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { postAgentMessage } from '../../api/dataAgent'

const draft = ref('')
const isSending = ref(false)
const notice = ref('')

const messages = ref([
  {
    id: 'm-init',
    role: 'assistant',
    text: 'Ready for validation. Try prompts for data preparation, training orchestration, or evaluation interpretation.'
  }
])

const traces = ref([
  { id: 't-0', step: 'Session initialized', time: 'now', detail: 'Agent sandbox loaded with default safety and tool policies.' }
])

const addTrace = (step, detail) => {
  traces.value.unshift({
    id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    step,
    detail,
    time: new Date().toLocaleTimeString()
  })
}

const extractResponseText = (response) => {
  if (typeof response === 'string') return response

  const candidates = [
    response?.answer,
    response?.response,
    response?.message,
    response?.data?.answer,
    response?.data?.response
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return 'No textual answer returned from backend.'
}

const sendMessage = async () => {
  if (!draft.value) return

  const userText = draft.value
  draft.value = ''
  notice.value = ''
  isSending.value = true

  messages.value.push({
    id: `user-${Date.now()}`,
    role: 'user',
    text: userText
  })

  addTrace('Prompt accepted', 'User prompt entered validation queue.')

  try {
    const response = await postAgentMessage({ message: userText, history: messages.value })
    const text = extractResponseText(response)

    messages.value.push({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text
    })

    addTrace('Backend response', 'Agent response received from /api/agent/chat endpoint.')
  } catch (error) {
    const fallback = `Mock response: I can help plan dataset preparation and training steps for "${userText}". Connect backend to enable real inference.`

    messages.value.push({
      id: `assistant-local-${Date.now()}`,
      role: 'assistant',
      text: fallback
    })

    addTrace('Fallback response', 'Backend unavailable, returned local simulation response.')
    notice.value = `Backend unavailable, using mock response. (${error?.message || 'unknown error'})`
  } finally {
    isSending.value = false
  }
}

const clearConversation = () => {
  if (isSending.value) return

  messages.value = [
    {
      id: `m-reset-${Date.now()}`,
      role: 'assistant',
      text: 'Session cleared. Send a new prompt for validation.'
    }
  ]

  traces.value = [
    { id: `trace-reset-${Date.now()}`, step: 'Session reset', time: new Date().toLocaleTimeString(), detail: 'Conversation and trace state were cleared.' }
  ]
}
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.interaction-layout {
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 1rem;
  min-height: 540px;
}

.chat-shell {
  min-height: 0;
}

.chat-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: auto;
  max-height: 520px;
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
  max-width: 85%;
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

.trace-item {
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  padding: 0.6rem;
  background: #fff;
}

@media (max-width: 992px) {
  .interaction-layout {
    grid-template-columns: 1fr;
  }

  .chat-body {
    max-height: 420px;
  }
}
</style>
