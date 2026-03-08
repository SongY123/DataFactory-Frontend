<template>
  <div class="module-page h-100">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Agent Interaction</h4>
        <p class="text-muted mb-0">上传文件后可按 API 或 Local 模式调用模型生成报告，并通过提示词多轮修订。</p>
      </div>
      <button class="btn btn-outline-secondary btn-sm" type="button" @click="resetSession" :disabled="isBusy">
        Clear Session
      </button>
    </div>

    <div v-if="notice" class="alert alert-info py-2 px-3" role="alert">{{ notice }}</div>

    <article class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-12 col-lg-4">
            <label class="form-label small fw-semibold">File</label>
            <input class="form-control" type="file" @change="onFileChange" :disabled="isBusy">
            <div class="small text-muted mt-1">{{ selectedFileLabel }}</div>
          </div>

          <div class="col-12 col-lg-3">
            <label class="form-label small fw-semibold">Model</label>
            <select v-model="selectedModel" class="form-select" :disabled="isBusy || models.length === 0">
              <option v-for="item in models" :key="item.id" :value="item.id">{{ item.label }}</option>
            </select>
          </div>

          <div class="col-12 col-lg-5">
            <label class="form-label small fw-semibold">Analysis Prompt</label>
            <div class="d-flex gap-2">
              <input
                v-model.trim="analysisPrompt"
                type="text"
                class="form-control"
                placeholder="例：请重点分析数据质量风险和可训练性"
                :disabled="isBusy"
              >
              <button class="btn btn-primary" type="button" @click="generateReport" :disabled="!selectedFile || isBusy">
                <span v-if="isGenerating" class="spinner-border spinner-border-sm" role="status"></span>
                <span v-else>Generate</span>
              </button>
            </div>
          </div>

          <div class="col-12">
            <label class="form-label small fw-semibold d-block">Model Runtime</label>
            <div class="d-flex gap-3 align-items-center flex-wrap mb-2">
              <div class="form-check">
                <input id="mode-api" v-model="llmProvider" value="api" class="form-check-input" type="radio" :disabled="isBusy">
                <label class="form-check-label" for="mode-api">API</label>
              </div>
              <div class="form-check">
                <input id="mode-local" v-model="llmProvider" value="local" class="form-check-input" type="radio" :disabled="isBusy">
                <label class="form-check-label" for="mode-local">Local</label>
              </div>
            </div>

            <div class="row g-2">
              <template v-if="llmProvider === 'api'">
                <div class="col-12 col-lg-5">
                  <input v-model.trim="apiEndpoint" type="text" class="form-control" placeholder="API Endpoint (OpenAI-compatible)">
                </div>
                <div class="col-12 col-lg-4">
                  <input v-model.trim="apiKey" type="password" class="form-control" placeholder="API Key">
                </div>
                <div class="col-12 col-lg-3">
                  <input v-model.trim="apiModelName" type="text" class="form-control" placeholder="API Model Name (optional)">
                </div>
              </template>

              <template v-else>
                <div class="col-12 col-lg-8">
                  <input v-model.trim="localEndpoint" type="text" class="form-control" placeholder="Local Model Address (e.g. http://127.0.0.1:11434/v1/chat/completions)">
                </div>
                <div class="col-12 col-lg-4">
                  <input v-model.trim="localModelName" type="text" class="form-control" placeholder="Local Model Name (optional)">
                </div>
              </template>
            </div>
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
          <form class="d-flex gap-2" @submit.prevent="reviseReport">
            <input
              v-model.trim="revisePrompt"
              type="text"
              class="form-control"
              placeholder="输入修订提示词，例如：改成面向管理层的摘要"
              :disabled="isBusy || !sessionId"
            >
            <button class="btn btn-primary" type="submit" :disabled="!revisePrompt || !sessionId || isBusy">
              <span v-if="isRevising" class="spinner-border spinner-border-sm" role="status"></span>
              <span v-else>Revise</span>
            </button>
          </form>
        </div>
      </article>

      <article class="card border-0 shadow-sm report-shell">
        <div class="card-body d-flex flex-column">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <h6 class="card-title mb-0">Current Report</h6>
            <span class="badge text-bg-light">{{ sessionId ? `Session ${sessionId.slice(0, 8)}` : 'No Session' }}</span>
          </div>
          <pre class="report-preview">{{ currentReport || 'No report yet. Upload a file and generate report first.' }}</pre>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchAgentModels, generateAgentReport, reviseAgentReport } from '../../api/dataAgent'

const selectedFile = ref(null)
const selectedModel = ref('')
const models = ref([])

const llmProvider = ref('api')
const apiEndpoint = ref('')
const apiKey = ref('')
const apiModelName = ref('')
const localEndpoint = ref('')
const localModelName = ref('')

const analysisPrompt = ref('')
const revisePrompt = ref('')
const sessionId = ref('')
const currentReport = ref('')
const notice = ref('')

const isGenerating = ref(false)
const isRevising = ref(false)

const messages = ref([
  {
    id: 'm-init',
    role: 'assistant',
    text: '准备就绪：请上传文件并选择模型与调用模式。'
  }
])

const isBusy = computed(() => isGenerating.value || isRevising.value)
const selectedFileLabel = computed(() => selectedFile.value?.name || 'No file selected')

const appendMessage = (role, text) => {
  messages.value.push({
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    text: String(text || '')
  })
}

const validateRuntime = () => {
  if (llmProvider.value === 'api' && !apiEndpoint.value.trim()) {
    notice.value = 'API 模式需要填写 API Endpoint。'
    return false
  }
  if (llmProvider.value === 'local' && !localEndpoint.value.trim()) {
    notice.value = 'Local 模式需要填写本地模型地址。'
    return false
  }
  return true
}

const getRuntimePayload = () => {
  if (llmProvider.value === 'api') {
    return {
      llm_provider: 'api',
      llm_endpoint: apiEndpoint.value.trim(),
      llm_api_key: apiKey.value.trim(),
      llm_model_name: apiModelName.value.trim()
    }
  }

  return {
    llm_provider: 'local',
    llm_endpoint: localEndpoint.value.trim(),
    llm_api_key: '',
    llm_model_name: localModelName.value.trim()
  }
}

const loadModels = async () => {
  notice.value = ''
  try {
    const response = await fetchAgentModels()
    const rawModels = response?.data?.models
    if (Array.isArray(rawModels) && rawModels.length > 0) {
      models.value = rawModels
    } else {
      models.value = [
        { id: 'gpt-4o-mini', label: 'gpt-4o-mini' },
        { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' }
      ]
    }
  } catch (error) {
    models.value = [
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini' },
      { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini' }
    ]
    notice.value = `模型列表加载失败，使用默认模型。(${error?.message || 'unknown error'})`
  }

  if (!selectedModel.value && models.value.length > 0) {
    selectedModel.value = models.value[0].id
  }
}

const onFileChange = (event) => {
  const files = event?.target?.files
  selectedFile.value = files && files.length > 0 ? files[0] : null
}

const generateReport = async () => {
  if (!selectedFile.value) {
    notice.value = '请先选择文件。'
    return
  }
  if (!validateRuntime()) return

  isGenerating.value = true
  notice.value = ''

  appendMessage('user', analysisPrompt.value || '请生成该文件的分析报告。')

  try {
    const runtime = getRuntimePayload()
    const formData = new FormData()
    formData.append('file', selectedFile.value, selectedFile.value.name)
    formData.append('model', selectedModel.value || '')
    formData.append('prompt', analysisPrompt.value || '')
    formData.append('llm_provider', runtime.llm_provider)
    formData.append('llm_endpoint', runtime.llm_endpoint)
    formData.append('llm_api_key', runtime.llm_api_key)
    formData.append('llm_model_name', runtime.llm_model_name)

    const response = await generateAgentReport(formData)
    const data = response?.data || {}

    sessionId.value = String(data.session_id || '').trim()
    currentReport.value = String(data.report || '').trim()

    appendMessage('assistant', currentReport.value || '报告生成完成，但返回内容为空。')
  } catch (error) {
    const msg = `报告生成失败：${error?.message || 'unknown error'}`
    notice.value = msg
    appendMessage('assistant', msg)
  } finally {
    isGenerating.value = false
  }
}

const reviseReport = async () => {
  if (!sessionId.value || !revisePrompt.value) return
  if (!validateRuntime()) return

  const userPrompt = revisePrompt.value
  revisePrompt.value = ''

  isRevising.value = true
  notice.value = ''
  appendMessage('user', userPrompt)

  try {
    const runtime = getRuntimePayload()
    const response = await reviseAgentReport({
      session_id: sessionId.value,
      model: selectedModel.value || null,
      prompt: userPrompt,
      ...runtime
    })
    const data = response?.data || {}
    currentReport.value = String(data.report || '').trim()
    appendMessage('assistant', currentReport.value || '报告已修订，但返回内容为空。')
  } catch (error) {
    const msg = `报告修订失败：${error?.message || 'unknown error'}`
    notice.value = msg
    appendMessage('assistant', msg)
  } finally {
    isRevising.value = false
  }
}

const resetSession = () => {
  if (isBusy.value) return

  selectedFile.value = null
  analysisPrompt.value = ''
  revisePrompt.value = ''
  sessionId.value = ''
  currentReport.value = ''
  notice.value = ''

  messages.value = [
    {
      id: `m-reset-${Date.now()}`,
      role: 'assistant',
      text: '会话已重置。请重新上传文件并生成报告。'
    }
  ]
}

onMounted(() => {
  loadModels()
})
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.interaction-layout {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 1rem;
  min-height: 540px;
}

.chat-shell,
.report-shell {
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
  padding: 0.75rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  overflow: auto;
  min-height: 460px;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 992px) {
  .interaction-layout {
    grid-template-columns: 1fr;
  }

  .chat-body {
    max-height: 400px;
  }

  .report-preview {
    min-height: 320px;
  }
}
</style>
