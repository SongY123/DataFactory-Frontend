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
              <div v-else class="sample-list">
                <article v-for="(sample, index) in visibleSamples" :key="index" class="sample-card">
                  <div class="sample-index">#{{ index + 1 }}</div>
                  <pre class="sample-pre">{{ stringifySample(sample) }}</pre>
                </article>
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
            <div v-else class="table-responsive">
              <table class="table table-sm table-bordered align-middle mb-0">
                <thead class="table-light">
                <tr>
                  <th style="width: 50px;">#</th>
                  <th>Content</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(sample, index) in sampleRows" :key="index">
                  <td>{{ index + 1 }}</td>
                  <td><pre class="sample-pre mb-0">{{ stringifySample(sample) }}</pre></td>
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
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'bootstrap'
import { fetchDatasetDetail } from '../../api/dataAgent'

const route = useRoute()
const router = useRouter()

const isLoading = ref(false)
const notice = ref('')
const dataset = ref(null)
const sampleRows = ref([])
const sampleModalRef = ref(null)
let sampleModalInstance = null

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

const visibleSamples = computed(() => sampleRows.value.slice(0, 4))
const sampleCountLabel = computed(() => `${sampleRows.value.length} samples`)

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
  } catch (error) {
    dataset.value = null
    sampleRows.value = []
    notice.value = `Failed to load dataset detail. (${error?.message || 'unknown error'})`
  } finally {
    isLoading.value = false
  }
}

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

.sample-list {
  display: grid;
  gap: 1rem;
}

.sample-card {
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  overflow: hidden;
  background: #ffffff;
}

.sample-index {
  padding: 0.65rem 0.9rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
}

.sample-pre {
  margin: 0;
  padding: 1rem;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.83rem;
  line-height: 1.55;
}

@media (max-width: 991px) {
  .detail-hero-grid {
    grid-template-columns: 1fr;
  }
}
</style>
