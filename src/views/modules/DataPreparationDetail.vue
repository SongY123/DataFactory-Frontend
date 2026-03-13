<template>
  <div class="dataset-detail-page">
    <div v-if="notice" class="alert alert-warning py-2 px-3 mb-3" role="alert">
      {{ notice }}
    </div>

    <div v-if="isLoading" class="detail-loading card border-0 shadow-sm">
      <div class="card-body d-flex align-items-center gap-2 text-muted">
        <span class="spinner-border spinner-border-sm" role="status"></span>
        <span>Loading dataset details...</span>
      </div>
    </div>

    <template v-else-if="dataset">
      <section class="detail-hero card border-0 shadow-sm overflow-hidden mb-4">
        <div class="detail-hero-grid">
          <div class="detail-hero-body">
            <button class="back-link" type="button" @click="goBack">
              <span aria-hidden="true">&larr;</span>
              <span>Back to datasets</span>
            </button>

            <div class="detail-badges">
              <span class="badge rounded-pill text-bg-dark-subtle text-dark-emphasis">Dataset</span>
              <span class="badge rounded-pill" :class="statusClass(dataset.status)">{{ dataset.status }}</span>
            </div>

            <h2 class="detail-title">{{ dataset.name }}</h2>
            <p class="detail-subtitle">
              {{ dataset.typeLabel }} dataset | {{ dataset.languageLabel }} | Updated {{ dataset.updatedAt }}
            </p>

            <p class="detail-summary">
              {{ dataset.note || 'No dataset description has been provided yet.' }}
            </p>

            <div class="detail-actions">
              <button class="btn btn-outline-secondary" type="button" @click="goBack">Browse Datasets</button>
              <button class="btn btn-primary" type="button" @click="openSampleModal">Preview Samples</button>
            </div>
          </div>

          <div class="detail-cover-panel">
            <img v-if="dataset.cover" :src="dataset.cover" :alt="`${dataset.name} cover`" class="detail-cover">
            <div v-else class="detail-cover-placeholder">
              <span class="detail-cover-icon">[]</span>
              <span>No cover image</span>
            </div>
          </div>
        </div>
      </section>

      <section class="row g-4 align-items-start">
        <div class="col-12 col-xl-8">
          <article class="card border-0 shadow-sm mb-4">
            <div class="card-body">
              <h5 class="section-title">About this dataset</h5>
              <p class="section-copy mb-0">
                {{ dataset.note || 'This dataset does not have a long-form description yet. Add one from the edit form to make this page more informative.' }}
              </p>
            </div>
          </article>

          <article class="card border-0 shadow-sm mb-4">
            <div class="card-body">
              <div class="section-header">
                <h5 class="section-title mb-0">Sample records</h5>
                <span class="badge text-bg-light">{{ sampleCountLabel }}</span>
              </div>

              <div v-if="sampleRows.length === 0" class="empty-samples">
                No sample records are available for this dataset.
              </div>
              <div v-else class="dataset-table-wrap">
                <div class="table-responsive">
                  <table class="table dataset-viewer-table align-middle mb-0">
                    <thead>
                    <tr>
                      <th class="col-id">id</th>
                      <th class="col-messages">messages</th>
                      <th class="col-numeric">input_tokens</th>
                      <th class="col-numeric">output_tokens</th>
                      <th class="col-numeric">total_tokens</th>
                      <th class="col-evaluation">evaluation</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="row in sampleTableRows" :key="row.rowKey">
                      <td class="mono-cell">{{ row.id }}</td>
                      <td>
                        <div class="messages-cell" :title="row.messagesFull">{{ row.messagesPreview }}</div>
                      </td>
                      <td class="mono-cell">{{ row.inputTokens }}</td>
                      <td class="mono-cell">{{ row.outputTokens }}</td>
                      <td class="mono-cell">{{ row.totalTokens }}</td>
                      <td>
                        <div class="evaluation-cell" :title="row.evaluationFull">{{ row.evaluationPreview }}</div>
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>
                <div v-if="samplePageCount > 1" class="sample-pagination-bar">
                  <div class="sample-pagination-status">{{ samplePageSummary }}</div>
                  <div class="sample-pagination-controls">
                    <button
                      class="page-pill page-pill-nav"
                      type="button"
                      :disabled="currentSamplePage === 1"
                      @click="goToSamplePage(currentSamplePage - 1)"
                    >
                      Prev
                    </button>
                    <template v-for="item in samplePaginationItems" :key="item.key">
                      <span v-if="item.type === 'ellipsis'" class="page-ellipsis">...</span>
                      <button
                        v-else
                        class="page-pill"
                        :class="{ 'is-active': item.page === currentSamplePage }"
                        type="button"
                        @click="goToSamplePage(item.page)"
                      >
                        {{ item.page }}
                      </button>
                    </template>
                    <button
                      class="page-pill page-pill-nav"
                      type="button"
                      :disabled="currentSamplePage === samplePageCount"
                      @click="goToSamplePage(currentSamplePage + 1)"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div class="col-12 col-xl-4">
          <article class="card border-0 shadow-sm mb-4">
            <div class="card-body">
              <h5 class="section-title">Dataset info</h5>
              <dl class="info-list mb-0">
                <div>
                  <dt>ID</dt>
                  <dd>{{ dataset.id }}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{{ dataset.typeLabel }}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{{ dataset.languageLabel }}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{{ formatSize(dataset.size) }}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{{ dataset.status }}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{{ dataset.updatedAt }}</dd>
                </div>
              </dl>
            </div>
          </article>

          <article class="card border-0 shadow-sm">
            <div class="card-body">
              <h5 class="section-title">Source</h5>
              <p v-if="dataset.source" class="section-copy source-text mb-0">{{ dataset.source }}</p>
              <p v-else class="section-copy text-muted mb-0">No source link or origin has been recorded.</p>
            </div>
          </article>
        </div>
      </section>
    </template>

    <div v-else class="card border-0 shadow-sm">
      <div class="card-body">
        <button class="back-link mb-3" type="button" @click="goBack">
          <span aria-hidden="true">&larr;</span>
          <span>Back to datasets</span>
        </button>
        <h5 class="mb-2">Dataset not found</h5>
        <p class="text-muted mb-0">The requested dataset could not be loaded.</p>
      </div>
    </div>

    <div class="modal fade" tabindex="-1" ref="sampleModalRef" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h6 class="modal-title mb-0">Sample Data - {{ dataset?.name || 'Dataset' }}</h6>
            <button type="button" class="btn-close" @click="closeSampleModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="sampleRows.length === 0" class="text-muted small">No sample data.</div>
            <div v-else class="dataset-table-wrap">
              <div class="table-responsive">
                <table class="table dataset-viewer-table align-middle mb-0">
                  <thead>
                  <tr>
                    <th style="width: 90px;">id</th>
                    <th>messages</th>
                    <th style="width: 140px;">input_tokens</th>
                    <th style="width: 150px;">output_tokens</th>
                    <th style="width: 140px;">total_tokens</th>
                    <th style="width: 140px;">evaluation</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="row in sampleTableRows" :key="`modal-${row.rowKey}`">
                    <td class="mono-cell">{{ row.id }}</td>
                    <td>
                      <div class="messages-cell" :title="row.messagesFull">{{ row.messagesPreview }}</div>
                    </td>
                    <td class="mono-cell">{{ row.inputTokens }}</td>
                    <td class="mono-cell">{{ row.outputTokens }}</td>
                    <td class="mono-cell">{{ row.totalTokens }}</td>
                    <td>
                      <div class="evaluation-cell" :title="row.evaluationFull">{{ row.evaluationPreview }}</div>
                    </td>
                  </tr>
                  </tbody>
                </table>
              </div>
              <div v-if="samplePageCount > 1" class="sample-pagination-bar sample-pagination-bar-modal">
                <div class="sample-pagination-status">{{ samplePageSummary }}</div>
                <div class="sample-pagination-controls">
                  <button
                    class="page-pill page-pill-nav"
                    type="button"
                    :disabled="currentSamplePage === 1"
                    @click="goToSamplePage(currentSamplePage - 1)"
                  >
                    Prev
                  </button>
                  <template v-for="item in samplePaginationItems" :key="`modal-${item.key}`">
                    <span v-if="item.type === 'ellipsis'" class="page-ellipsis">...</span>
                    <button
                      v-else
                      class="page-pill"
                      :class="{ 'is-active': item.page === currentSamplePage }"
                      type="button"
                      @click="goToSamplePage(item.page)"
                    >
                      {{ item.page }}
                    </button>
                  </template>
                  <button
                    class="page-pill page-pill-nav"
                    type="button"
                    :disabled="currentSamplePage === samplePageCount"
                    @click="goToSamplePage(currentSamplePage + 1)"
                  >
                    Next
                  </button>
                </div>
              </div>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import { fetchDatasetDetail } from '../../api/dataAgent'

const route = useRoute()
const router = useRouter()

const isLoading = ref(false)
const notice = ref('')
const dataset = ref(null)
const sampleRows = ref([])
const currentSamplePage = ref(1)
const sampleModalRef = ref(null)
let sampleModalInstance = null
const SAMPLE_RECORDS_PAGE_SIZE = 5

const typeLabels = {
  instruction: 'Instruction',
  conversation: 'Conversation',
  evaluation: 'Evaluation',
  'tool-trace': 'Tool Trace'
}

const languageLabels = {
  zh: 'Chinese',
  en: 'English',
  multi: 'Multilingual'
}

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

const stringifyCompact = (value) => {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const toDisplayText = (value, fallback = '-') => {
  const textValue = stringifyCompact(value).trim()
  return textValue || fallback
}

const normalizeMessagesPreview = (messages) => {
  if (Array.isArray(messages)) {
    const joined = messages
      .map((item) => {
        if (item && typeof item === 'object') {
          const role = stringifyCompact(item.role || item.speaker || item.name).trim()
          const content = stringifyCompact(item.content || item.text || item.message).trim()
          if (role && content) return `${role}: ${content}`
          return content || role || stringifyCompact(item)
        }
        return stringifyCompact(item)
      })
      .filter(Boolean)
      .join(' | ')
    return toDisplayText(joined)
  }

  return toDisplayText(messages)
}

const normalizeSampleRow = (sample, index) => {
  const messagesFull = normalizeMessagesPreview(sample?.messages)
  const evaluationFull = toDisplayText(sample?.evaluation)

  return {
    rowKey: sample?.id ?? index,
    id: sample?.id ?? index + 1,
    messagesFull,
    messagesPreview: messagesFull,
    inputTokens: sample?.input_tokens ?? '-',
    outputTokens: sample?.output_tokens ?? '-',
    totalTokens: sample?.total_tokens ?? '-',
    evaluationFull,
    evaluationPreview: evaluationFull,
  }
}

const normalizeDatasetDetail = (detail) => ({
  id: Number(detail?.id || detail?.dataset_id || 0),
  name: String(detail?.name || detail?.dataset_name || 'Unknown dataset'),
  type: String(detail?.type || detail?.dataset_type || 'instruction'),
  typeLabel: typeLabels[String(detail?.type || detail?.dataset_type || 'instruction')] || String(detail?.type || detail?.dataset_type || 'instruction'),
  language: String(detail?.language || detail?.lang || 'multi'),
  languageLabel: languageLabels[String(detail?.language || detail?.lang || 'multi')] || String(detail?.language || detail?.lang || 'multi'),
  size: Number(detail?.size || detail?.sample_count || 0),
  status: String(detail?.status || 'draft'),
  source: String(detail?.source || ''),
  note: String(detail?.note || ''),
  cover: String(detail?.cover_url || detail?.cover || detail?.cover_path || detail?.thumbnail || ''),
  updatedAt: String(detail?.update_time || detail?.updated_at || '-'),
})

const normalizedSampleRows = computed(() =>
  sampleRows.value.map((sample, index) => normalizeSampleRow(sample, index))
)

const samplePageCount = computed(() => Math.max(1, Math.ceil(normalizedSampleRows.value.length / SAMPLE_RECORDS_PAGE_SIZE)))

const sampleCountLabel = computed(() => {
  const total = normalizedSampleRows.value.length
  if (total === 0) return '0 samples'
  return `${total} samples`
})

const samplePageSummary = computed(() => {
  const total = normalizedSampleRows.value.length
  if (total === 0) return 'No samples'
  const start = (currentSamplePage.value - 1) * SAMPLE_RECORDS_PAGE_SIZE + 1
  const end = Math.min(currentSamplePage.value * SAMPLE_RECORDS_PAGE_SIZE, total)
  return `Showing ${start}-${end} of ${total} samples`
})

const sampleTableRows = computed(() => {
  const start = (currentSamplePage.value - 1) * SAMPLE_RECORDS_PAGE_SIZE
  const end = start + SAMPLE_RECORDS_PAGE_SIZE
  return normalizedSampleRows.value.slice(start, end)
})

const buildSamplePaginationItems = (currentPage, totalPages) => {
  const items = []
  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page += 1) {
      items.push({ type: 'page', page, key: `page-${page}` })
    }
    return items
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  if (currentPage <= 3) {
    pages.add(2)
    pages.add(3)
  }
  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1)
    pages.add(totalPages - 2)
  }

  const orderedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)

  orderedPages.forEach((page, index) => {
    const previous = orderedPages[index - 1]
    if (previous && page - previous > 1) {
      items.push({ type: 'ellipsis', key: `ellipsis-${previous}-${page}` })
    }
    items.push({ type: 'page', page, key: `page-${page}` })
  })

  return items
}

const samplePaginationItems = computed(() =>
  buildSamplePaginationItems(currentSamplePage.value, samplePageCount.value)
)

const goToSamplePage = (page) => {
  const nextPage = Math.min(Math.max(page, 1), samplePageCount.value)
  currentSamplePage.value = nextPage
}

const getSampleModal = () => {
  if (!sampleModalRef.value) return null
  sampleModalInstance = Modal.getOrCreateInstance(sampleModalRef.value)
  return sampleModalInstance
}

const openSampleModal = () => {
  getSampleModal()?.show()
}

const closeSampleModal = () => {
  getSampleModal()?.hide()
}

const goBack = () => {
  router.push('/data-preparation')
}

const loadDatasetDetail = async () => {
  const datasetId = Number(route.params.datasetId || 0)
  if (!datasetId) {
    dataset.value = null
    notice.value = 'Invalid dataset id.'
    return
  }

  isLoading.value = true
  notice.value = ''

  try {
    const response = await fetchDatasetDetail(datasetId)
    const detail = response?.data || response || {}
    dataset.value = normalizeDatasetDetail(detail)
    sampleRows.value = Array.isArray(detail?.sample_data) ? detail.sample_data : []
    currentSamplePage.value = 1
  } catch (error) {
    dataset.value = null
    sampleRows.value = []
    currentSamplePage.value = 1
    notice.value = `Failed to load dataset detail. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

watch(samplePageCount, (pageCount) => {
  if (currentSamplePage.value > pageCount) {
    currentSamplePage.value = pageCount
  }
})

onMounted(() => {
  loadDatasetDetail()
})

onBeforeUnmount(() => {
  sampleModalInstance?.dispose()
})
</script>

<style scoped>
.dataset-detail-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-loading {
  min-height: 120px;
}

.detail-hero {
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.14), transparent 32%),
    linear-gradient(135deg, #f8fbff 0%, #ffffff 60%, #f4f7fb 100%);
}

.detail-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.9fr);
  gap: 1.5rem;
  padding: 1.5rem;
}

.detail-hero-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.back-link {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: #475569;
  font-weight: 600;
}

.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.detail-title {
  margin: 0;
  font-size: clamp(1.9rem, 2.2vw, 2.8rem);
  line-height: 1.05;
  color: #0f172a;
}

.detail-subtitle {
  margin: 0;
  color: #526071;
  font-size: 1rem;
}

.detail-summary,
.section-copy {
  color: #334155;
  line-height: 1.7;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.detail-cover-panel {
  min-height: 260px;
  border-radius: 1.25rem;
  background: linear-gradient(180deg, #ffffff 0%, #eef4ff 100%);
  border: 1px solid rgba(148, 163, 184, 0.24);
  overflow: hidden;
}

.detail-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.detail-cover-placeholder {
  height: 100%;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #64748b;
  background: linear-gradient(180deg, #f8fafc 0%, #e8eef8 100%);
}

.detail-cover-icon {
  font-size: 2rem;
  line-height: 1;
}

.section-title {
  margin-bottom: 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.info-list {
  display: grid;
  gap: 1rem;
}

.info-list div {
  display: grid;
  gap: 0.2rem;
}

.info-list dt {
  margin: 0;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}

.info-list dd {
  margin: 0;
  color: #0f172a;
  font-weight: 600;
  word-break: break-word;
}

.source-text {
  word-break: break-word;
}

.empty-samples {
  padding: 1rem;
  border-radius: 1rem;
  background: #f8fafc;
  color: #64748b;
}

.dataset-table-wrap {
  border: 1px solid #dbe3ee;
  border-radius: 1rem;
  overflow: hidden;
  background: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.dataset-viewer-table {
  margin: 0;
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  --bs-table-bg: transparent;
}

.dataset-viewer-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  color: #475569;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-bottom: 1px solid #dbe3ee;
  border-right: 1px solid #e2e8f0;
}

.dataset-viewer-table thead th:last-child {
  border-right: none;
}

.dataset-viewer-table td,
.dataset-viewer-table th {
  padding: 0.72rem 0.85rem;
  vertical-align: top;
  border-color: #e2e8f0;
}

.dataset-viewer-table tbody td {
  font-size: 0.78rem;
  color: #1f2937;
  border-bottom: 1px solid #edf2f7;
  border-right: 1px solid #edf2f7;
  background: #ffffff;
}

.dataset-viewer-table tbody td:last-child {
  border-right: none;
}

.dataset-viewer-table tbody tr:last-child td {
  border-bottom: none;
}

.dataset-viewer-table tbody tr:hover td {
  background: #f8fbff;
}

.sample-pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem 1rem;
  border-top: 1px solid #e8eef6;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.sample-pagination-bar-modal {
  position: sticky;
  bottom: 0;
}

.sample-pagination-status {
  color: #526071;
  font-size: 0.82rem;
  font-weight: 600;
}

.sample-pagination-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.page-pill {
  min-width: 2.35rem;
  height: 2.35rem;
  padding: 0 0.8rem;
  border: 1px solid #d7e1ee;
  border-radius: 999px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  color: #334155;
  font-size: 0.82rem;
  font-weight: 700;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}

.page-pill:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(37, 99, 235, 0.3);
  color: #1d4ed8;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);
}

.page-pill.is-active {
  border-color: transparent;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
}

.page-pill:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  box-shadow: none;
}

.page-pill-nav {
  min-width: 4.3rem;
}

.page-ellipsis {
  color: #94a3b8;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 0 0.15rem;
}

.col-id {
  width: 72px;
}

.col-messages {
  width: 42%;
}

.col-numeric {
  width: 112px;
}

.col-evaluation {
  width: 22%;
}

.mono-cell {
  font-family: Consolas, 'SFMono-Regular', 'Liberation Mono', Menlo, monospace;
  font-size: 0.74rem;
  color: #0f172a;
  white-space: nowrap;
}

.messages-cell,
.evaluation-cell {
  display: -webkit-box;
  width: 100%;
  overflow: hidden;
  color: #334155;
  font-size: 0.78rem;
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  min-height: calc(1.35em * 2);
}

.messages-cell {
  max-width: 100%;
}

.evaluation-cell {
  max-width: 100%;
}

@media (max-width: 991px) {
  .detail-hero-grid {
    grid-template-columns: 1fr;
  }

  .sample-pagination-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .sample-pagination-controls {
    justify-content: flex-start;
  }
}
</style>
