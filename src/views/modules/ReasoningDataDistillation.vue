<template>
  <div class="module-page">
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div>
        <h4 class="mb-1">Reasoning Data Synthesis</h4>
        <p class="text-muted mb-0">Generate task-aligned reasoning traces as reusable process-level supervision</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" type="button" @click="refreshAll" :disabled="isLoading">
          <span v-if="isLoading" class="spinner-border spinner-border-sm me-1" role="status"></span>
          Refresh
        </button>
        <button class="btn btn-outline-primary btn-sm" type="button" @click="toggleAutoRefresh">
          {{ autoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="notice" class="floating-notice-wrap">
      <div class="alert py-2 px-3 mb-0 d-flex align-items-center justify-content-between gap-2 floating-notice" :class="noticeClass" role="alert">
        <span>{{ notice }}</span>
        <button type="button" class="btn-close" aria-label="Close" @click="setNotice('')"></button>
      </div>
    </div>

    <div class="row g-3 mb-3 synthesis-main-row">
      <div class="col-12 col-xxl-5">
        <article class="card border-0 shadow-sm">
          <div class="card-body">
            <h6 class="card-title mb-3">Task Configuration</h6>

            <form class="d-flex flex-column gap-3 task-config-form" @submit.prevent="startTask">
              <div class="d-flex align-items-center justify-content-between gap-2">
                <label class="small text-muted mb-0">Prompt</label>
                <button class="btn btn-link btn-sm py-0" type="button" @click="resetPromptToTemplate">Reset to Template</button>
              </div>
              <textarea
                v-model="form.prompt"
                @input="markPromptCustomized"
                class="form-control prompt-textarea"
                rows="11"
                required
                placeholder="Describe how the model should synthesize reasoning supervision for the selected dataset."
              ></textarea>
              <div class="prompt-placeholder-panel">
                <div class="small text-muted">Placeholders</div>
                <div v-if="promptPlaceholders.length" class="prompt-placeholder-list">
                  <span
                    v-for="placeholder in promptPlaceholders"
                    :key="`prompt-chip-${placeholder}`"
                    class="prompt-placeholder-chip"
                    :class="placeholderToneClass(placeholder)"
                  >
                    {{ '{' + placeholder + '}' }}
                  </span>
                </div>
                <div v-else class="small text-muted">No placeholders detected.</div>
              </div>

              <div class="mt-1">
                <label class="small text-muted mb-1">Model Type</label>
                <div class="d-flex gap-3">
                  <label class="form-check mb-0">
                    <input class="form-check-input" type="radio" value="api" v-model="form.modelProvider">
                    <span class="form-check-label">API</span>
                  </label>
                  <label class="form-check mb-0">
                    <input class="form-check-input" type="radio" value="local" v-model="form.modelProvider">
                    <span class="form-check-label">Local</span>
                  </label>
                </div>
              </div>

              <div class="row g-2 mt-1">
                <div class="col-12 col-md-4" v-if="form.modelProvider === 'api'">
                  <label class="small text-muted mb-1">LLM API Key</label>
                  <input
                    v-model.trim="form.llmApiKey"
                    type="password"
                    class="form-control"
                    placeholder="sk-..."
                    required
                  >
                </div>
                <div class="col-12 col-md-4">
                  <label class="small text-muted mb-1">{{ form.modelProvider === 'local' ? 'Endpoint' : 'Base URL' }}</label>
                  <input
                    v-model.trim="form.llmBaseUrl"
                    type="text"
                    class="form-control"
                    placeholder="https://api.openai.com/v1"
                    required
                  >
                </div>
                <div class="col-12 col-md-4">
                  <label class="small text-muted mb-1">Model Name</label>
                  <input
                    v-model.trim="form.llmModelName"
                    type="text"
                    class="form-control"
                    placeholder="gpt-4o-mini"
                    required
                  >
                </div>
              </div>

              <div class="mt-1">
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <label class="small text-muted mb-0">Dataset</label>
                </div>

                <div v-if="datasetOptions.length === 0" class="small text-muted border rounded p-2">
                  No datasets found. Please upload datasets first.
                </div>
                <div v-else>
                  <div class="dataset-dropdown" ref="datasetDropdownRef">
                    <button
                      class="dataset-dropdown-trigger"
                      type="button"
                      @click="toggleDatasetDropdown"
                      :aria-expanded="datasetDropdownOpen ? 'true' : 'false'"
                    >
                      <span>{{ datasetDropdownLabel }}</span>
                      <span class="dataset-dropdown-caret" :class="{ open: datasetDropdownOpen }">▾</span>
                    </button>

                    <div v-if="datasetDropdownOpen" class="dataset-dropdown-menu">
                      <label v-for="item in datasetOptions" :key="`dataset-option-${item.id}`" class="dataset-select-item">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          :checked="form.datasetIds.includes(Number(item.id))"
                          @change="toggleDatasetSelection(item.id)"
                        >
                        <span class="small">{{ item.name }}</span>
                      </label>
                    </div>
                  </div>

                  <div v-if="selectedDatasetItems.length" class="selected-dataset-list">
                    <div
                      v-for="item in selectedDatasetItems"
                      :key="`selected-dataset-${item.id}`"
                      class="selected-dataset-chip"
                    >
                      <div class="selected-dataset-copy">
                        <span class="selected-dataset-name">{{ item.name }}</span>
                        <span class="selected-dataset-config-copy">{{ datasetConfigSummary(item.id) }}</span>
                      </div>
                      <button
                        class="selected-dataset-settings"
                        type="button"
                        :aria-label="`Configure ${item.name}`"
                        @click="openDatasetConfig(item.id)"
                      >
                        <i class="bi bi-gear"></i>
                      </button>
                      <button
                        class="selected-dataset-remove"
                        type="button"
                        :aria-label="`Remove ${item.name}`"
                        @click="removeSelectedDataset(item.id)"
                      >
                        <i class="bi bi-x-lg"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-1">
                <label class="small text-muted mb-1">Save Path</label>
                <div class="save-path-row">
                  <input
                    v-model.trim="form.savePath"
                    type="text"
                    class="form-control"
                    placeholder="Leave empty to use backend default output path"
                  >
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    :title="browseSavePathTitle"
                    @click="browseSavePath"
                  >
                    Browse
                  </button>
                </div>
                <div class="small text-muted mt-1">
                  {{ savePathHelperText }}
                </div>
              </div>

              <div class="advanced-config-panel">
                <button
                  class="advanced-config-toggle"
                  type="button"
                  @click="advancedConfigOpen = !advancedConfigOpen"
                  :aria-expanded="advancedConfigOpen ? 'true' : 'false'"
                >
                  <span>Advanced Config</span>
                  <span class="dataset-dropdown-caret" :class="{ open: advancedConfigOpen }">▾</span>
                </button>

                <div v-if="advancedConfigOpen" class="advanced-config-body">
                  <div class="row g-2">
                    <div class="col-12">
                      <label class="small text-muted mb-1">Parallelism</label>
                      <input
                        v-model.number="form.parallelism"
                        @input="markParallelismCustomized"
                        type="number"
                        class="form-control"
                        min="1"
                        max="32"
                        step="1"
                      >
                      <div class="small text-muted mt-1">Controls how many dataset synthesis tasks start in parallel. Each dataset task runs with one thread.</div>
                    </div>
                    <div class="col-12">
                      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                        <label class="small text-muted mb-0">LLM API Config (JSON)</label>
                        <div class="d-flex flex-wrap gap-2">
                          <button class="btn btn-outline-primary btn-sm" type="button" @click="applyDefaultLlmParamsTemplate">
                            Apply Default Template
                          </button>
                          <button class="btn btn-outline-secondary btn-sm" type="button" @click="clearLlmParamsTemplate">
                            Clear
                          </button>
                        </div>
                      </div>
                      <textarea
                        v-model="form.llmParamsJson"
                        class="form-control advanced-config-textarea"
                        rows="7"
                        placeholder="Leave empty to use backend defaults"
                      ></textarea>
                      <div class="small text-muted mt-1">Optional raw request parameters such as temperature, top_p, max_tokens, or frequency_penalty.</div>
                    </div>
                  </div>
                </div>
              </div>

              <button class="btn btn-primary mt-1" type="submit" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Start Task
              </button>
            </form>
          </div>
        </article>
      </div>

      <div class="col-12 col-xxl-7 right-panel-col">
        <div class="row g-3">
          <div class="col-12 col-md-4" v-for="card in statsCards" :key="card.label">
            <article class="card border-0 shadow-sm h-100">
              <div class="card-body py-3">
                <div class="small text-muted">{{ card.label }}</div>
                <div class="h4 mb-0 mt-1">{{ card.value }}</div>
              </div>
            </article>
          </div>
        </div>

        <article v-if="selectedTask" class="card border-0 shadow-sm mt-3">
          <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div class="d-flex gap-2 flex-wrap">
              <button v-if="selectedTask.generatedDatasetId" class="btn btn-outline-primary btn-sm" type="button" @click="openGeneratedDataset">
                Open Generated Dataset
              </button>
            </div>
          </div>
        </article>

        <article class="card border-0 shadow-sm mt-3 task-overview-card">
          <div class="card-body d-flex flex-column gap-2 h-100">
            <div class="d-flex align-items-center justify-content-between">
              <h6 class="card-title mb-0">{{ taskPanelMode === 'tasks' ? 'Task List' : `Synthesis Results · Task ${selectedTaskId || '-'}` }}</h6>
              <div class="d-flex align-items-center gap-2">
                <span class="small text-muted" v-if="taskPanelMode === 'tasks'">Latest {{ tasks.length }} tasks</span>
                <button v-if="taskPanelMode === 'results'" class="btn btn-outline-secondary btn-sm" type="button" @click="backToTaskList">
                  Back to Tasks
                </button>
              </div>
            </div>

            <div v-if="taskPanelMode === 'results' && selectedTask" class="task-progress-panel">
              <div class="task-progress-head">
                <div>
                  <div class="small text-muted">Current Task Progress</div>
                  <div class="fw-semibold">{{ selectedTask.sourceLabel }}</div>
                </div>
                <div class="small text-muted">{{ selectedTask.progressText }}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <div class="progress flex-grow-1" role="progressbar" :aria-valuenow="selectedTask.progress" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar" :style="{ width: `${selectedTask.progress}%` }"></div>
                </div>
                <span class="small text-muted progress-percent">{{ selectedTask.progress }}%</span>
              </div>
            </div>

            <div class="table-responsive task-overview-table-wrap">
              <table v-if="taskPanelMode === 'tasks'" class="table table-sm table-hover align-middle mb-0 task-table-centered">
                <thead class="table-light">
                <tr>
                  <th>Task ID</th>
                  <th>Dataset</th>
                  <th>Progress</th>
                  <th>Created At</th>
                  <th>Updated At</th>
                </tr>
                </thead>
                <tbody>
                <tr
                  v-for="task in pagedTasks"
                  :key="task.id"
                  class="task-row"
                  :class="{ selected: selectedTaskId === task.id }"
                  @click="openTaskResults(task.id)"
                >
                  <td>{{ task.id }}</td>
                  <td>{{ task.sourceLabel }}</td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <div class="progress flex-grow-1" role="progressbar" :aria-valuenow="task.progress" aria-valuemin="0" aria-valuemax="100">
                        <div class="progress-bar" :style="{ width: `${task.progress}%` }"></div>
                      </div>
                      <span class="small text-muted">{{ task.progressText }}</span>
                    </div>
                  </td>
                  <td>{{ task.createdAtDisplay }}</td>
                  <td>{{ task.updatedAtDisplay }}</td>
                </tr>
                <tr v-if="pagedTasks.length === 0">
                  <td colspan="5" class="text-center text-muted py-3">No tasks.</td>
                </tr>
                </tbody>
              </table>

              <div v-else class="h-100">
                <div v-if="isLoadingResults" class="d-flex align-items-center justify-content-center h-100 text-muted">
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Loading results...
                </div>
                <div v-else class="result-groups-wrap">
                  <SynthesisResultsTable
                    v-if="results.length"
                    :rows="results"
                    :columns="reasoningResultsColumns"
                    :get-status-class="statusClass"
                    overlay-title="Reasoning Data Synthesis"
                    :count-label-text="`${results.length} results`"
                    empty-text="No synthesis results for this task."
                    @cell-open="openReasoningResultCell"
                  />
                  <div v-else class="text-center text-muted py-3">No synthesis results for this task.</div>
                </div>
              </div>
            </div>

            <div v-if="taskPanelMode === 'tasks'" class="d-flex align-items-center justify-content-between mt-2">
              <div class="small text-muted">Page {{ currentPage }} / {{ totalPages }}</div>
              <div class="btn-group btn-group-sm" role="group" aria-label="Task pagination">
                <button class="btn btn-outline-secondary" type="button" :disabled="currentPage <= 1" @click="goPrevPage">Prev</button>
                <button class="btn btn-outline-secondary" type="button" :disabled="currentPage >= totalPages" @click="goNextPage">Next</button>
              </div>
            </div>

            <div class="small text-muted mt-1" v-if="taskPanelMode === 'tasks'">Click one task row to inspect synthesis results.</div>
          </div>
        </article>
      </div>
    </div>

    <div class="modal fade reasoning-page-modal" tabindex="-1" ref="resultModalRef" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h6 class="modal-title mb-0">{{ resultModalTitle }}</h6>
            <button type="button" class="btn-close" @click="closeResultModal"></button>
          </div>
          <div class="modal-body">
            <pre class="result-modal-pre mb-0">{{ resultModalContent }}</pre>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" type="button" @click="closeResultModal">Close</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade reasoning-page-modal reasoning-dataset-config-modal" tabindex="-1" ref="datasetConfigModalRef" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <div>
              <h6 class="modal-title mb-1">Dataset Configuration</h6>
              <p class="text-muted small mb-0">
                {{ activeConfigDatasetItem ? activeConfigDatasetItem.name : 'Select files and map fields for this dataset.' }}
              </p>
            </div>
            <button type="button" class="btn-close" @click="closeDatasetConfigModal"></button>
          </div>
          <div class="modal-body">
            <div v-if="activeDatasetConfig" class="row g-3">
              <div class="col-12 col-lg-4">
                <section class="dataset-config-panel">
                  <div class="dataset-config-panel-head">
                    <div>
                      <h6 class="mb-1">Files</h6>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                      <button class="btn btn-outline-secondary btn-sm" type="button" :disabled="activeDatasetConfig.isLoadingFiles || !activeDatasetConfig.availableFiles.length" @click="selectAllActiveDatasetFiles">
                        Select All
                      </button>
                      <button class="btn btn-outline-secondary btn-sm" type="button" :disabled="activeDatasetConfig.isLoadingFiles || !activeDatasetConfig.selectedFilePaths.length" @click="clearActiveDatasetFiles">
                        Clear
                      </button>
                    </div>
                  </div>

                  <div v-if="activeDatasetConfig.isLoadingFiles" class="text-muted small py-3 d-flex align-items-center gap-2">
                    <span class="spinner-border spinner-border-sm" role="status"></span>
                    Loading dataset files...
                  </div>
                  <div v-else-if="!activeDatasetConfig.availableFiles.length" class="text-muted small py-3">
                    No previewable files were found for this dataset.
                  </div>
                  <div v-else class="dataset-config-file-list">
                    <div
                      v-for="file in activeDatasetConfig.availableFiles"
                      :key="`config-file-${activeConfigDatasetId}-${file.path}`"
                      class="dataset-config-file-item"
                      :class="{ active: activeDatasetConfig.activePreviewPath === file.path }"
                    >
                      <input
                        class="form-check-input mt-0"
                        type="checkbox"
                        :checked="activeDatasetConfig.selectedFilePaths.includes(file.path)"
                        @change="toggleActiveDatasetFile(file.path)"
                      >
                      <button class="dataset-config-file-button" type="button" @click="activateActiveDatasetPreview(file.path)">
                        <span class="dataset-config-file-name">{{ file.path }}</span>
                      </button>
                      <span
                        class="dataset-config-file-status"
                        :class="isFileMappingComplete(activeDatasetConfig, file.path) ? 'is-complete' : 'is-pending'"
                        :title="isFileMappingComplete(activeDatasetConfig, file.path) ? 'Field mapping configured' : 'Field mapping pending'"
                      >
                        <i class="bi" :class="isFileMappingComplete(activeDatasetConfig, file.path) ? 'bi-check-circle-fill' : 'bi-question-circle-fill'"></i>
                      </span>
                    </div>
                  </div>

                  <div class="small text-muted mt-2">
                    {{ activeDatasetConfig.selectedFilePaths.length }} file(s) selected
                  </div>
                </section>
              </div>

              <div class="col-12 col-lg-8">
                <section class="dataset-config-panel">
                  <div class="dataset-config-panel-head">
                    <div>
                      <h6 class="mb-1">Sample Data</h6>
                      <p class="text-muted small mb-0">Preview the selected file with up to 100 sample rows.</p>
                    </div>
                    <div v-if="activeConfigPreview" class="d-flex gap-2 flex-wrap">
                      <span class="config-meta-chip">{{ activeConfigPreview.format || '-' }}</span>
                      <span class="config-meta-chip">{{ activeConfigPreview.rowCount }} rows loaded</span>
                    </div>
                  </div>

                  <div v-if="activeDatasetConfig.isLoadingPreview" class="text-muted small py-3 d-flex align-items-center gap-2">
                    <span class="spinner-border spinner-border-sm" role="status"></span>
                    Loading sample data...
                  </div>
                  <div v-else-if="activeDatasetConfig.previewError" class="alert alert-warning py-2 px-3 mb-0">
                    {{ activeDatasetConfig.previewError }}
                  </div>
                  <div v-else-if="!activeConfigPreview" class="text-muted small py-3">
                    Click a file to inspect its sample rows.
                  </div>
                  <div v-else class="dataset-config-preview-wrap">
                    <div class="small text-muted mb-2">
                      {{ activeConfigPreview.path }}
                    </div>
                    <div class="table-responsive dataset-config-table-wrap">
                      <table class="table table-sm align-middle mb-0 dataset-config-table">
                        <thead class="table-light">
                        <tr>
                          <th
                            v-for="column in activeConfigPreview.columns"
                            :key="`preview-col-${column}`"
                            class="dataset-config-th"
                            :style="getPreviewColumnStyle(column)"
                          >
                            <div class="dataset-config-th-inner">
                              <span class="dataset-config-th-label">{{ column }}</span>
                              <span class="dataset-config-col-resizer" @mousedown="beginPreviewColumnResize($event, column)"></span>
                            </div>
                          </th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="(row, rowIndex) in activeConfigPreview.rows" :key="`preview-row-${rowIndex}`">
                          <td
                            v-for="column in activeConfigPreview.columns"
                            :key="`preview-row-${rowIndex}-${column}`"
                            class="dataset-config-td"
                            :style="getPreviewColumnStyle(column)"
                          >
                            <div class="dataset-config-cell" :title="previewCell(row?.[column], 1000)">
                              {{ previewCell(row?.[column]) }}
                            </div>
                          </td>
                        </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section class="dataset-config-panel mt-3">
                  <div class="dataset-config-panel-head">
                    <div>
                      <h6 class="mb-1">Field Mapping</h6>
                      <p class="text-muted small mb-0">Map dataset columns to prompt and completion. The mapping is sent to the backend for distillation.</p>
                    </div>
                  </div>

                  <div class="row g-2">
                    <div v-if="promptPlaceholders.length === 0" class="col-12">
                      <div class="text-muted small py-1">No placeholders detected in the prompt. Completion is still required.</div>
                    </div>
                    <div v-for="placeholder in promptPlaceholders" :key="`placeholder-${placeholder}`" class="col-12 col-md-6">
                      <label class="small text-muted mb-1">{{ placeholder }}</label>
                      <select :value="getActivePlaceholderMappingValue(placeholder)" class="form-select" @change="setActivePlaceholderMappingValue(placeholder, $event.target.value)">
                        <option value="">Select a column</option>
                        <option v-for="column in activeDatasetConfigColumns" :key="`${placeholder}-${column}`" :value="column">
                          {{ column }}
                        </option>
                      </select>
                    </div>
                    <div class="col-12 col-md-6">
                      <label class="small text-muted mb-1">Completion</label>
                      <select :value="activeCompletionField" class="form-select" @change="setActiveCompletionField($event.target.value)">
                        <option value="">Select a column</option>
                        <option v-for="column in activeDatasetConfigColumns" :key="`completion-column-${column}`" :value="column">
                          {{ column }}
                        </option>
                      </select>
                    </div>
                    <div class="col-12 d-flex justify-content-end">
                      <button
                        class="btn btn-outline-primary btn-sm"
                        type="button"
                        :disabled="!activeDatasetConfig || !activeDatasetConfig.selectedFilePaths.length"
                        @click="applyActiveMappingToSelectedFiles"
                      >
                        Apply All
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" type="button" @click="closeDatasetConfigModal">Done</button>
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
import { formatAppDateTime } from '../../utils/datetime'
import SynthesisResultsTable from '../../components/SynthesisResultsTable.vue'
import { chooseLocalDirectory, isElectronRuntime } from '../../utils/desktop'
import {
  createReasoningDistillationTask,
  fetchDatasetFiles,
  fetchDatasetPreview,
  fetchDatasets,
  fetchReasoningDistillationTask,
  fetchReasoningDistillationTaskResults,
  fetchReasoningDistillationTasks
} from '../../api/dataAgent'

const route = useRoute()
const router = useRouter()

const DEFAULT_STRATEGY = 'step-pruning'
const DEFAULT_TARGET_MAX_TOKENS = 1024
const DEFAULT_COMPRESSION_RATIO = 0.45
const DEFAULT_KEEP_TOOL_TRACE = true
const DATASET_PREVIEW_LIMIT = 100

const isLoading = ref(false)
const isSubmitting = ref(false)
const notice = ref('')
const noticeType = ref('info')
const canBrowseLocalDirectory = isElectronRuntime()
const autoRefresh = ref(true)
const datasetOptions = ref([])
const tasks = ref([])
const results = ref([])
const selectedTaskId = ref(null)
const selectedTask = ref(null)
const taskPanelMode = ref('tasks')
const isLoadingResults = ref(false)
const currentPage = ref(1)
const pageSize = 5
const datasetDropdownOpen = ref(false)
const datasetDropdownRef = ref(null)
const resultModalRef = ref(null)
const datasetConfigModalRef = ref(null)
const resultModalTitle = ref('Result Detail')
const resultModalContent = ref('')
const advancedConfigOpen = ref(false)
const datasetConfigMap = ref({})
const activeConfigDatasetId = ref('')
const parallelismCustomized = ref(false)
let resultModalInstance = null
let datasetConfigModalInstance = null

const API_LLM_BASE_URL = 'https://api.openai.com/v1'
const API_LLM_MODEL_NAME = 'gpt-4o-mini'
const LOCAL_LLM_BASE_URL = 'http://127.0.0.1:11434/v1'
const LOCAL_LLM_MODEL_NAME = 'qwen2.5:7b-instruct'
const DEFAULT_LLM_PARAMS_TEMPLATE = {
  temperature: 0.2,
  top_p: 0.95,
  max_tokens: 4096
}
const reasoningResultsColumns = [
  { key: 'itemKey', label: 'Item', width: '16rem', expandedWidth: '20rem' },
  { key: 'promptText', label: 'Prompt', width: '22rem', expandedWidth: '28rem' },
  { key: 'reasoningText', label: 'Reasoning', width: '28rem', expandedWidth: '40rem' },
  { key: 'answerText', label: 'Answer', width: '22rem', expandedWidth: '28rem' },
  { key: 'status', label: 'Status', width: '8rem', kind: 'status' }
]
const PROMPT_PLACEHOLDER_TONES = ['tone-blue', 'tone-green', 'tone-amber', 'tone-rose', 'tone-cyan', 'tone-violet']
const PROMPT_PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g

const buildDefaultPrompt = () => {
  return `You are generating one reasoning-synthesis training record for a data-analysis model.

Task requirements:
1) Ground the reasoning and answer in the provided source item only.
2) The reasoning field must be wrapped in exactly one pair of <think></think> tags.
3) Keep the reasoning concise, useful, and faithful to the source.
4) Keep the final answer direct and plain.
5) Do not add markdown fences or extra sections.

Source question:
{question}
`
}

const form = ref({
  datasetIds: [],
  prompt: buildDefaultPrompt(),
  modelProvider: 'api',
  llmApiKey: '',
  llmBaseUrl: API_LLM_BASE_URL,
  llmModelName: API_LLM_MODEL_NAME,
  parallelism: 1,
  savePath: '',
  llmParamsJson: JSON.stringify(DEFAULT_LLM_PARAMS_TEMPLATE, null, 2)
})

let pollTimer = null
let noticeTimer = null

const statsCards = computed(() => {
  const total = tasks.value.length
  const running = tasks.value.filter((item) => ['pending', 'running'].includes(item.status)).length
  const done = tasks.value.filter((item) => item.status === 'completed').length

  return [
    { label: 'Total Tasks', value: total },
    { label: 'Running Tasks', value: running },
    { label: 'Completed Tasks', value: done }
  ]
})

const noticeClass = computed(() => {
  if (noticeType.value === 'success') return 'alert-success'
  if (noticeType.value === 'error') return 'alert-danger'
  return 'alert-info'
})

const totalPages = computed(() => {
  const pages = Math.ceil(tasks.value.length / pageSize)
  return pages > 0 ? pages : 1
})

const pagedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return tasks.value.slice(start, start + pageSize)
})

const selectedDatasetItems = computed(() => {
  const selectedIds = Array.isArray(form.value.datasetIds) ? form.value.datasetIds : []
  return selectedIds
    .map((datasetId) => datasetOptions.value.find((item) => Number(item.id) === Number(datasetId)))
    .filter(Boolean)
})

const activeDatasetConfig = computed(() => {
  const key = String(activeConfigDatasetId.value || '').trim()
  if (!key) return null
  return datasetConfigMap.value[key] || null
})

const activeConfigDatasetItem = computed(() => {
  const targetId = Number(activeConfigDatasetId.value || 0)
  if (!Number.isFinite(targetId) || targetId <= 0) return null
  return datasetOptions.value.find((item) => Number(item.id) === targetId) || null
})

const activeConfigPreview = computed(() => {
  const config = activeDatasetConfig.value
  if (!config || !config.activePreviewPath) return null
  return config.previewCache?.[config.activePreviewPath] || null
})

const promptPlaceholders = computed(() => {
  const promptText = String(form.value.prompt || '')
  const matches = promptText.match(PROMPT_PLACEHOLDER_PATTERN) || []
  const values = []
  const seen = new Set()
  matches.forEach((match) => {
    const normalized = match.slice(1, -1).trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    values.push(normalized)
  })
  return values
})

const placeholderToneClass = (placeholder) => {
  const normalized = String(placeholder || '').trim()
  const index = promptPlaceholders.value.findIndex((item) => item === normalized)
  return PROMPT_PLACEHOLDER_TONES[index >= 0 ? index % PROMPT_PLACEHOLDER_TONES.length : 0]
}

const activeDatasetConfigColumns = computed(() => {
  const config = activeDatasetConfig.value
  if (!config) return []
  const values = new Set()

  Object.values(config.previewCache || {}).forEach((preview) => {
    ;(preview?.columns || []).forEach((column) => values.add(String(column)))
  })
  ;(activeConfigPreview.value?.columns || []).forEach((column) => values.add(String(column)))
  Object.values(config.fileMappings || {}).forEach((mapping) => {
    ;[
      ...(Object.values(mapping?.placeholderMappings || {})),
      mapping?.completionField
    ].forEach((column) => {
      const normalized = String(column || '').trim()
      if (normalized) values.add(normalized)
    })
  })

  return [...values]
})

const createDefaultFileMapping = () => ({
  placeholderMappings: {},
  completionField: ''
})

const readFileMappingState = (config, path) => {
  if (!config) return createDefaultFileMapping()
  const key = String(path || '').trim()
  if (!key) return createDefaultFileMapping()
  return config.fileMappings?.[key] || createDefaultFileMapping()
}

const getFileMappingState = (config, path) => {
  if (!config) return createDefaultFileMapping()
  const key = String(path || '').trim()
  if (!key) return createDefaultFileMapping()
  if (!config.fileMappings[key]) {
    config.fileMappings = {
      ...config.fileMappings,
      [key]: createDefaultFileMapping()
    }
  }
  return config.fileMappings[key]
}

const activeFileMapping = computed(() => {
  const config = activeDatasetConfig.value
  const path = String(config?.activePreviewPath || '').trim()
  if (!config || !path) return createDefaultFileMapping()
  return getFileMappingState(config, path)
})

const activeCompletionField = computed(() => String(activeFileMapping.value?.completionField || '').trim())

const datasetDropdownLabel = computed(() => {
  if (selectedDatasetItems.value.length === 1) return selectedDatasetItems.value[0].name
  if (selectedDatasetItems.value.length > 1) return `${selectedDatasetItems.value.length} datasets selected`
  return 'Select datasets'
})

const browseSavePathTitle = computed(() => {
  if (canBrowseLocalDirectory) return 'Choose a local directory'
  return 'Directory browsing is available in the Electron desktop app only'
})

const savePathHelperText = computed(() => {
  if (form.value.savePath) return form.value.savePath
  if (canBrowseLocalDirectory) return 'Choose a local directory on this computer.'
  return 'Browser mode cannot open a local directory chooser. Enter an absolute path manually or use the Electron desktop app.'
})

const setNotice = (message, type = 'info') => {
  notice.value = String(message || '')
  noticeType.value = type

  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }

  if (!notice.value) return

  const timeoutMs = type === 'error' ? 6000 : type === 'success' ? 3500 : 2500
  noticeTimer = setTimeout(() => {
    notice.value = ''
    noticeTimer = null
  }, timeoutMs)
}

const formatDateTime = (value) => formatAppDateTime(value)

const mapDatasets = (raw) => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return list.map((item, index) => ({
    id: Number(item?.id || index + 1),
    name: String(item?.name || item?.dataset_name || `dataset-${index + 1}`)
  }))
}

const mapTask = (item, index = 0) => {
  const processedItems = Number(item?.processed_items || 0)
  const totalItems = Number(item?.total_items || 0)
  const progress = totalItems > 0
    ? Math.max(0, Math.min(100, Math.round((processedItems / totalItems) * 100)))
    : 0

  return {
    id: String(item?.id || index + 1),
    sourceLabel: String(item?.source_label || `Dataset #${item?.source_dataset_id || '-'}`),
    processedItems,
    totalItems,
    progress,
    progressText: totalItems > 0 ? `${processedItems}/${totalItems}` : `${processedItems}`,
    status: String(item?.status || 'pending').toLowerCase(),
    distilledSamples: Number(item?.distilled_samples || 0),
    avgTokens: Number(item?.avg_tokens || 0),
    generatedDatasetId: Number(item?.generated_dataset_id || item?.generated_dataset?.id || 0),
    createdAtDisplay: formatDateTime(item?.created_at || item?.insert_time || item?.createdAt || '-'),
    updatedAtDisplay: formatDateTime(item?.updated_at || item?.update_time || item?.updatedAt || '-')
  }
}

const mapResults = (raw) => {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return list.map((item, index) => ({
    id: String(item?.id || index + 1),
    itemKey: String(item?.item_key || `item-${index + 1}`),
    promptText: String(item?.prompt_text || ''),
    reasoningText: String(item?.reasoning_text || ''),
    answerText: String(item?.answer_text || ''),
    status: String(item?.status || 'unknown').toLowerCase()
  }))
}

const statusClass = (status) => {
  if (['completed', 'success', 'done', 'finished'].includes(status)) return 'bg-success-subtle text-success-emphasis'
  if (['running', 'in_progress', 'queued', 'pending'].includes(status)) return 'bg-primary-subtle text-primary-emphasis'
  if (['failed', 'error', 'cancelled', 'aborted'].includes(status)) return 'bg-danger-subtle text-danger-emphasis'
  return 'bg-light text-dark'
}

const previewText = (text, limit = 120) => {
  const content = String(text || '').trim()
  if (!content) return '-'
  return content.length > limit ? `${content.slice(0, limit)}...` : content
}

const markPromptCustomized = () => {}

const markParallelismCustomized = () => {
  parallelismCustomized.value = true
}

const resetPromptToTemplate = () => {
  form.value.prompt = buildDefaultPrompt()
}

const applyDefaultLlmParamsTemplate = () => {
  form.value.llmParamsJson = JSON.stringify(DEFAULT_LLM_PARAMS_TEMPLATE, null, 2)
  advancedConfigOpen.value = true
}

const clearLlmParamsTemplate = () => {
  form.value.llmParamsJson = ''
}

const normalizeLlmParamsJson = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  const parsed = JSON.parse(text)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('LLM API Config must be a JSON object.')
  }
  return JSON.stringify(parsed)
}

const browseSavePath = async () => {
  if (!canBrowseLocalDirectory) {
    setNotice('Browse is available only in the Electron desktop app. In browser mode, enter an absolute path manually.', 'info')
    return
  }
  const selected = await chooseLocalDirectory()
  if (selected) {
    form.value.savePath = selected
  }
}

const createDefaultDatasetConfig = () => ({
  selectedFilePaths: [],
  availableFiles: [],
  activePreviewPath: '',
  previewCache: {},
  isLoadingFiles: false,
  isLoadingPreview: false,
  previewError: '',
  fileMappings: {},
  previewColumnWidths: {}
})

const ensureDatasetConfig = (datasetId) => {
  const key = String(Number(datasetId) || '')
  if (!key) return null
  if (!datasetConfigMap.value[key]) {
    datasetConfigMap.value = {
      ...datasetConfigMap.value,
      [key]: createDefaultDatasetConfig()
    }
  }
  return datasetConfigMap.value[key]
}

const previewCell = (value, limit = 120) => {
  if (value == null) return ''
  const text = typeof value === 'string'
    ? value
    : (() => {
        try {
          return JSON.stringify(value)
        } catch {
          return String(value)
        }
      })()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

const isFileMappingComplete = (config, path) => {
  const mapping = readFileMappingState(config, path)
  const completionReady = Boolean(String(mapping.completionField || '').trim())
  const placeholdersReady = promptPlaceholders.value.every((placeholder) => Boolean(String(mapping.placeholderMappings?.[placeholder] || '').trim()))
  return completionReady && placeholdersReady
}

const datasetConfigSummary = (datasetId) => {
  const config = datasetConfigMap.value[String(datasetId)] || null
  if (!config) return 'Not configured'
  const selectedCount = config.selectedFilePaths.length
  const configuredCount = config.selectedFilePaths.filter((path) => isFileMappingComplete(config, path)).length
  if (selectedCount) {
    return `${configuredCount}/${selectedCount} file(s) mapped`
  }
  return 'Not configured'
}

const toggleDatasetSelection = (datasetId) => {
  const nextId = Number(datasetId)
  if (!Number.isFinite(nextId) || nextId <= 0) return
  const current = Array.isArray(form.value.datasetIds) ? form.value.datasetIds : []
  if (current.includes(nextId)) {
    removeSelectedDataset(nextId)
    return
  }
  form.value.datasetIds = [...current, nextId]
  ensureDatasetConfig(nextId)
}

const removeSelectedDataset = (datasetId) => {
  const targetId = Number(datasetId)
  form.value.datasetIds = (Array.isArray(form.value.datasetIds) ? form.value.datasetIds : []).filter((item) => Number(item) !== targetId)

  const key = String(targetId)
  if (datasetConfigMap.value[key]) {
    const nextMap = { ...datasetConfigMap.value }
    delete nextMap[key]
    datasetConfigMap.value = nextMap
  }

  if (String(activeConfigDatasetId.value) === key) {
    closeDatasetConfigModal()
  }
}

const toggleDatasetDropdown = () => {
  datasetDropdownOpen.value = !datasetDropdownOpen.value
}

const handleClickOutsideDatasetDropdown = (event) => {
  if (!datasetDropdownRef.value) return
  if (!datasetDropdownRef.value.contains(event.target)) {
    datasetDropdownOpen.value = false
  }
}

const loadDatasetConfigFiles = async (datasetId) => {
  const config = ensureDatasetConfig(datasetId)
  if (!config || config.isLoadingFiles) return

  config.isLoadingFiles = true
  config.previewError = ''
  try {
    const response = await fetchDatasetFiles(datasetId)
    const data = response?.data || response || {}
    config.availableFiles = Array.isArray(data.data_files)
      ? data.data_files
        .map((item) => ({
          path: String(item?.path || ''),
          format: String(item?.format || '')
        }))
        .filter((item) => item.path)
      : []

    config.selectedFilePaths = config.selectedFilePaths.filter((path) => config.availableFiles.some((item) => item.path === path))

    if (!config.activePreviewPath && config.availableFiles.length) {
      config.activePreviewPath = config.availableFiles[0].path
    }
  } catch (error) {
    config.availableFiles = []
    config.previewError = error?.message || 'Failed to load dataset files.'
  } finally {
    config.isLoadingFiles = false
  }
}

const ensureDatasetPreviewLoaded = async (datasetId, path) => {
  const config = ensureDatasetConfig(datasetId)
  const targetPath = String(path || '').trim()
  if (!config || !targetPath) return null
  if (config.previewCache?.[targetPath]) return config.previewCache[targetPath]

  config.isLoadingPreview = true
  config.previewError = ''
  try {
    const response = await fetchDatasetPreview(datasetId, { path: targetPath, limit: DATASET_PREVIEW_LIMIT })
    const payload = response?.data || response || {}
    const preview = {
      path: String(payload.path || targetPath),
      format: String(payload.format || ''),
      columns: Array.isArray(payload.columns) ? payload.columns.map((item) => String(item)) : [],
      rows: Array.isArray(payload.rows) ? payload.rows : [],
      rowCount: Number(payload.row_count || 0)
    }
    config.previewCache = {
      ...config.previewCache,
      [targetPath]: preview
    }
    return preview
  } catch (error) {
    config.previewError = error?.message || 'Failed to load dataset preview.'
    return null
  } finally {
    config.isLoadingPreview = false
  }
}

const getDatasetConfigModal = () => {
  if (!datasetConfigModalRef.value) return null
  datasetConfigModalInstance = Modal.getOrCreateInstance(datasetConfigModalRef.value)
  return datasetConfigModalInstance
}

const openDatasetConfig = async (datasetId) => {
  const targetId = Number(datasetId)
  if (!Number.isFinite(targetId) || targetId <= 0) return
  ensureDatasetConfig(targetId)
  activeConfigDatasetId.value = String(targetId)
  await loadDatasetConfigFiles(targetId)

  const config = ensureDatasetConfig(targetId)
  if (config?.activePreviewPath) {
    await ensureDatasetPreviewLoaded(targetId, config.activePreviewPath)
  }

  getDatasetConfigModal()?.show()
}

const closeDatasetConfigModal = () => {
  getDatasetConfigModal()?.hide()
}

const activateActiveDatasetPreview = async (path) => {
  const datasetId = Number(activeConfigDatasetId.value || 0)
  if (!Number.isFinite(datasetId) || datasetId <= 0) return
  const config = ensureDatasetConfig(datasetId)
  if (!config) return
  config.activePreviewPath = String(path || '').trim()
  await ensureDatasetPreviewLoaded(datasetId, config.activePreviewPath)
}

const toggleActiveDatasetFile = async (path) => {
  const datasetId = Number(activeConfigDatasetId.value || 0)
  if (!Number.isFinite(datasetId) || datasetId <= 0) return
  const config = ensureDatasetConfig(datasetId)
  const targetPath = String(path || '').trim()
  if (!config || !targetPath) return

  if (config.selectedFilePaths.includes(targetPath)) {
    config.selectedFilePaths = config.selectedFilePaths.filter((item) => item !== targetPath)
  } else {
    config.selectedFilePaths = [...config.selectedFilePaths, targetPath]
    await ensureDatasetPreviewLoaded(datasetId, targetPath)
  }

  if (!config.activePreviewPath) {
    config.activePreviewPath = targetPath
  }
}

const selectAllActiveDatasetFiles = async () => {
  const datasetId = Number(activeConfigDatasetId.value || 0)
  if (!Number.isFinite(datasetId) || datasetId <= 0) return
  const config = ensureDatasetConfig(datasetId)
  if (!config) return
  config.selectedFilePaths = config.availableFiles.map((item) => item.path)
  if (!config.activePreviewPath && config.selectedFilePaths.length) {
    config.activePreviewPath = config.selectedFilePaths[0]
  }
  if (config.activePreviewPath) {
    await ensureDatasetPreviewLoaded(datasetId, config.activePreviewPath)
  }
}

const clearActiveDatasetFiles = () => {
  const config = activeDatasetConfig.value
  if (!config) return
  config.selectedFilePaths = []
}

const getActivePlaceholderMappingValue = (placeholder) => {
  const key = String(placeholder || '').trim()
  if (!key) return ''
  return String(activeFileMapping.value?.placeholderMappings?.[key] || '').trim()
}

const setActivePlaceholderMappingValue = (placeholder, value) => {
  const config = activeDatasetConfig.value
  const path = String(config?.activePreviewPath || '').trim()
  const key = String(placeholder || '').trim()
  if (!config || !path || !key) return

  const mapping = getFileMappingState(config, path)
  const nextPlaceholderMappings = {
    ...(mapping.placeholderMappings || {})
  }
  const normalizedValue = String(value || '').trim()
  if (normalizedValue) {
    nextPlaceholderMappings[key] = normalizedValue
  } else {
    delete nextPlaceholderMappings[key]
  }

  config.fileMappings = {
    ...config.fileMappings,
    [path]: {
      ...mapping,
      placeholderMappings: nextPlaceholderMappings
    }
  }
}

const setActiveCompletionField = (value) => {
  const config = activeDatasetConfig.value
  const path = String(config?.activePreviewPath || '').trim()
  if (!config || !path) return

  const mapping = getFileMappingState(config, path)
  config.fileMappings = {
    ...config.fileMappings,
    [path]: {
      ...mapping,
      completionField: String(value || '').trim()
    }
  }
}

const applyActiveMappingToSelectedFiles = () => {
  const config = activeDatasetConfig.value
  if (!config) return
  const placeholderMappings = { ...(activeFileMapping.value?.placeholderMappings || {}) }
  const completionField = String(activeFileMapping.value?.completionField || '').trim()
  if (!config.selectedFilePaths.length) return

  const nextMappings = { ...config.fileMappings }
  config.selectedFilePaths.forEach((path) => {
    nextMappings[path] = {
      placeholderMappings: { ...placeholderMappings },
      completionField
    }
  })
  config.fileMappings = nextMappings
}

const setPreviewColumnWidth = (column, widthPx) => {
  const config = activeDatasetConfig.value
  if (!config) return
  const normalizedColumn = String(column || '').trim()
  const safeWidth = Math.max(140, Math.min(640, Number(widthPx) || 220))
  config.previewColumnWidths = {
    ...config.previewColumnWidths,
    [normalizedColumn]: safeWidth
  }
}

const getPreviewColumnStyle = (column) => {
  const config = activeDatasetConfig.value
  const width = Number(config?.previewColumnWidths?.[String(column || '').trim()] || 220)
  return {
    width: `${width}px`,
    minWidth: `${width}px`
  }
}

const beginPreviewColumnResize = (event, column) => {
  event.preventDefault()
  const startX = Number(event.clientX || 0)
  const initialWidth = Number(activeDatasetConfig.value?.previewColumnWidths?.[String(column || '').trim()] || 220)

  const handleMove = (moveEvent) => {
    const delta = Number(moveEvent.clientX || 0) - startX
    setPreviewColumnWidth(column, initialWidth + delta)
  }

  const handleUp = () => {
    window.removeEventListener('mousemove', handleMove)
    window.removeEventListener('mouseup', handleUp)
  }

  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleUp)
}

const refreshDatasetOptions = async () => {
  const response = await fetchDatasets()
  datasetOptions.value = mapDatasets(response)
  const validIds = new Set(datasetOptions.value.map((item) => String(item.id)))
  form.value.datasetIds = (Array.isArray(form.value.datasetIds) ? form.value.datasetIds : [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && validIds.has(String(item)))
  datasetConfigMap.value = Object.fromEntries(
    Object.entries(datasetConfigMap.value).filter(([key]) => validIds.has(String(key)))
  )
  applyRouteSelection()
}

const inspectTask = async (taskId, { silent = false } = {}) => {
  if (!taskId) return

  selectedTaskId.value = String(taskId)
  if (!silent) isLoading.value = true

  try {
    const response = await fetchReasoningDistillationTask(selectedTaskId.value)
    selectedTask.value = mapTask(response?.data || response)
  } catch (error) {
    const fallback = tasks.value.find((item) => item.id === selectedTaskId.value)
    if (fallback) {
      selectedTask.value = fallback
    }
    if (!silent) {
      setNotice(`Failed to load task detail. (${error?.message || 'unknown error'})`, 'error')
    }
  } finally {
    if (!silent) isLoading.value = false
  }
}

const refreshTaskResults = async (taskId, { silent = false, reset = false } = {}) => {
  if (!taskId) return

  if (!silent) isLoadingResults.value = true
  if (reset) results.value = []

  try {
    const resultResponse = await fetchReasoningDistillationTaskResults(taskId, 200)
    results.value = mapResults(resultResponse)
  } catch (error) {
    if (!silent) {
      setNotice(`Failed to load task results. (${error?.message || 'unknown error'})`, 'error')
    }
  } finally {
    if (!silent) isLoadingResults.value = false
  }
}

const refreshTasks = async ({ silent = false } = {}) => {
  if (!silent) isLoading.value = true
  if (!silent) setNotice('')

  try {
    const response = await fetchReasoningDistillationTasks(100)
    tasks.value = (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []).map(mapTask)

    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value
    }

    if (!selectedTaskId.value && tasks.value.length > 0) {
      selectedTaskId.value = tasks.value[0].id
      await inspectTask(selectedTaskId.value, { silent: true })
      return
    }

    if (selectedTaskId.value) {
      const exists = tasks.value.find((item) => item.id === selectedTaskId.value)
      if (!exists && tasks.value.length > 0) {
        selectedTaskId.value = tasks.value[0].id
      }
      if (selectedTaskId.value) {
        await inspectTask(selectedTaskId.value, { silent: true })
      }
    }

    if (taskPanelMode.value === 'results' && selectedTaskId.value) {
      await refreshTaskResults(selectedTaskId.value, { silent: true })
    }
  } catch (error) {
    setNotice(`Refresh failed. (${error?.message || 'unknown error'})`, 'error')
  } finally {
    if (!silent) isLoading.value = false
  }
}

const refreshAll = async () => {
  isLoading.value = true
  setNotice('')
  try {
    await refreshDatasetOptions()
    await refreshTasks({ silent: true })
    if (selectedTaskId.value) {
      await inspectTask(selectedTaskId.value, { silent: true })
      if (taskPanelMode.value === 'results') {
        await refreshTaskResults(selectedTaskId.value, { silent: true })
      }
    }
  } catch (error) {
    setNotice(`Refresh failed. (${error?.message || 'unknown error'})`, 'error')
  } finally {
    isLoading.value = false
  }
}

const openTaskResults = async (taskId) => {
  await inspectTask(taskId, { silent: true })
  taskPanelMode.value = 'results'
  await refreshTaskResults(taskId, { silent: false, reset: true })
}

const backToTaskList = () => {
  taskPanelMode.value = 'tasks'
}

const goPrevPage = () => {
  if (currentPage.value <= 1) return
  currentPage.value -= 1
}

const goNextPage = () => {
  if (currentPage.value >= totalPages.value) return
  currentPage.value += 1
}

const runTaskBatchWithConcurrency = async (datasetIds, limit, worker) => {
  const queue = Array.isArray(datasetIds) ? [...datasetIds] : []
  const normalizedLimit = Math.max(1, Math.min(32, Number(limit) || 1))
  const settled = new Array(queue.length)
  let cursor = 0

  const runNext = async () => {
    while (cursor < queue.length) {
      const currentIndex = cursor
      cursor += 1
      const datasetId = queue[currentIndex]
      try {
        const value = await worker(datasetId, currentIndex)
        settled[currentIndex] = { status: 'fulfilled', value }
      } catch (error) {
        settled[currentIndex] = { status: 'rejected', reason: error }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(normalizedLimit, queue.length) }, () => runNext()))
  return settled
}

const startTask = async () => {
  if (!Array.isArray(form.value.datasetIds) || !form.value.datasetIds.length) {
    setNotice('Please select at least one dataset.', 'error')
    return
  }
  if (!form.value.prompt || !form.value.llmBaseUrl || !form.value.llmModelName) {
    setNotice('Please complete prompt and model fields before submitting.', 'error')
    return
  }
  if (form.value.modelProvider === 'api' && !form.value.llmApiKey) {
    setNotice('API model type requires LLM API Key.', 'error')
    return
  }

  isSubmitting.value = true
  setNotice('Starting tasks...', 'info')
  try {
    const selectedDatasetIds = form.value.datasetIds
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0)
    const invalidDataset = selectedDatasetItems.value.find((item) => {
      const config = datasetConfigMap.value[String(item.id)] || null
      return !config
        || !config.selectedFilePaths.length
        || config.selectedFilePaths.some((path) => !isFileMappingComplete(config, path))
    })
    if (invalidDataset) {
      setNotice(`Please finish file selection and field mapping for ${invalidDataset.name}.`, 'error')
      return
    }

    const llmParamsJson = normalizeLlmParamsJson(form.value.llmParamsJson)
    const submissionParallelism = Math.max(1, Math.min(32, Number(form.value.parallelism) || selectedDatasetIds.length || 1))
    const sharedPayload = {
      source_type: 'dataset',
      prompt: form.value.prompt,
      strategy: DEFAULT_STRATEGY,
      target_max_tokens: DEFAULT_TARGET_MAX_TOKENS,
      compression_ratio: DEFAULT_COMPRESSION_RATIO,
      keep_tool_trace: DEFAULT_KEEP_TOOL_TRACE,
      note: '',
      llm_api_key: form.value.modelProvider === 'local' ? 'local' : form.value.llmApiKey,
      llm_base_url: form.value.llmBaseUrl,
      llm_model_name: form.value.llmModelName,
      save_path: String(form.value.savePath || '').trim() || undefined,
      llm_params_json: llmParamsJson
    }

    const results = await runTaskBatchWithConcurrency(selectedDatasetIds, submissionParallelism, (datasetId) => {
        const config = datasetConfigMap.value[String(datasetId)]
        return createReasoningDistillationTask({
          ...sharedPayload,
          source_dataset_id: datasetId,
          parallelism: 1,
          selected_file_paths: [...config.selectedFilePaths],
          file_mappings: config.selectedFilePaths.map((path) => ({
            path,
            placeholder_mappings: {
              ...(getFileMappingState(config, path).placeholderMappings || {})
            },
            completion_field: getFileMappingState(config, path).completionField
          }))
        })
      }
    )

    const successes = results
      .filter((item) => item.status === 'fulfilled')
      .map((item) => mapTask(item.value?.data || item.value))
    const failures = results.filter((item) => item.status === 'rejected')

    if (!successes.length) {
      throw new Error(failures[0]?.reason?.message || 'backend error')
    }

    selectedTaskId.value = successes[0].id
    selectedTask.value = successes[0]
    taskPanelMode.value = 'tasks'
    if (failures.length) {
      setNotice(`Started ${successes.length} task(s), ${failures.length} failed.`, 'error')
    } else {
      setNotice(`Started ${successes.length} reasoning synthesis task(s).`, 'success')
    }
    await refreshTasks({ silent: true })
    await inspectTask(selectedTaskId.value, { silent: true })
  } catch (error) {
    setNotice(`Failed to start task. (${error?.message || 'backend error'})`, 'error')
  } finally {
    isSubmitting.value = false
  }
}

const openGeneratedDataset = () => {
  if (!selectedTask.value?.generatedDatasetId) return
  router.push(`/data-preparation/${selectedTask.value.generatedDatasetId}`)
}

const applyRouteSelection = () => {
  const datasetId = String(route.query.datasetId || '').trim()
  if (datasetId && datasetOptions.value.some((item) => String(item.id) === datasetId)) {
    form.value.datasetIds = [Number(datasetId)]
    ensureDatasetConfig(Number(datasetId))
  }
}

const startPolling = () => {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    try {
      await refreshTasks({ silent: true })
      if (taskPanelMode.value === 'results' && selectedTaskId.value) {
        await refreshTaskResults(selectedTaskId.value, { silent: true })
      }
    } catch {
      // ignore silent polling failures
    }
  }, 5000)
}

const stopPolling = () => {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startPolling()
  } else {
    stopPolling()
  }
}

const getResultModal = () => {
  if (!resultModalRef.value) return null
  resultModalInstance = Modal.getOrCreateInstance(resultModalRef.value)
  return resultModalInstance
}

const openResultField = (row, fieldLabel, fieldValue) => {
  resultModalTitle.value = `Result ${row?.id || ''} · ${String(fieldLabel || 'Detail')}`
  resultModalContent.value = String(fieldValue || '-')
  getResultModal()?.show()
}

const openReasoningResultCell = ({ row, column, value }) => {
  openResultField(row, column?.label || 'Detail', value)
}

const closeResultModal = () => {
  getResultModal()?.hide()
}

watch(
  () => form.value.modelProvider,
  (provider) => {
    if (provider === 'local') {
      if (!form.value.llmBaseUrl || form.value.llmBaseUrl === API_LLM_BASE_URL) {
        form.value.llmBaseUrl = LOCAL_LLM_BASE_URL
      }
      if (!form.value.llmModelName || form.value.llmModelName === API_LLM_MODEL_NAME) {
        form.value.llmModelName = LOCAL_LLM_MODEL_NAME
      }
    } else {
      if (!form.value.llmBaseUrl || form.value.llmBaseUrl === LOCAL_LLM_BASE_URL) {
        form.value.llmBaseUrl = API_LLM_BASE_URL
      }
      if (!form.value.llmModelName || form.value.llmModelName === LOCAL_LLM_MODEL_NAME) {
        form.value.llmModelName = API_LLM_MODEL_NAME
      }
    }
  }
)

watch(
  () => route.query.datasetId,
  () => {
    applyRouteSelection()
  }
)

watch(
  () => (Array.isArray(form.value.datasetIds) ? form.value.datasetIds.length : 0),
  (count) => {
    if (parallelismCustomized.value) return
    form.value.parallelism = Math.max(1, Number(count) || 1)
  },
  { immediate: true }
)

onMounted(async () => {
  document.addEventListener('click', handleClickOutsideDatasetDropdown)
  await refreshAll()
  applyRouteSelection()
  if (autoRefresh.value) startPolling()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutsideDatasetDropdown)
  if (noticeTimer) {
    clearTimeout(noticeTimer)
    noticeTimer = null
  }
  resultModalInstance?.dispose()
  datasetConfigModalInstance?.dispose()
  stopPolling()
})
</script>

<style scoped>
.module-page {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.floating-notice-wrap {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  width: min(760px, calc(100vw - 24px));
}

.floating-notice {
  box-shadow: 0 8px 24px rgba(16, 36, 66, 0.18);
  border-radius: 10px;
}

.synthesis-main-row {
  align-items: stretch;
}

.synthesis-main-row > [class*='col-'] {
  display: flex;
  flex-direction: column;
}

.prompt-textarea {
  min-height: 260px;
  resize: vertical;
  font-size: 0.9rem;
  line-height: 1.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.prompt-placeholder-panel {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.1rem 0;
}

.prompt-placeholder-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.prompt-placeholder-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.78rem;
  font-weight: 600;
}

.prompt-placeholder-chip.tone-blue {
  color: #0b63d1;
  background: rgba(11, 99, 209, 0.14);
  border-color: rgba(11, 99, 209, 0.2);
}

.prompt-placeholder-chip.tone-green {
  color: #18794e;
  background: rgba(24, 121, 78, 0.14);
  border-color: rgba(24, 121, 78, 0.2);
}

.prompt-placeholder-chip.tone-amber {
  color: #9a5a00;
  background: rgba(203, 132, 0, 0.16);
  border-color: rgba(203, 132, 0, 0.22);
}

.prompt-placeholder-chip.tone-rose {
  color: #b42363;
  background: rgba(180, 35, 99, 0.14);
  border-color: rgba(180, 35, 99, 0.2);
}

.prompt-placeholder-chip.tone-cyan {
  color: #0f6d7a;
  background: rgba(15, 109, 122, 0.14);
  border-color: rgba(15, 109, 122, 0.2);
}

.prompt-placeholder-chip.tone-violet {
  color: #6d3cc5;
  background: rgba(109, 60, 197, 0.14);
  border-color: rgba(109, 60, 197, 0.2);
}

.synthesis-main-row {
  align-items: flex-start;
}

.dataset-dropdown {
  position: relative;
}

.dataset-dropdown-trigger {
  width: 100%;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fff;
  min-height: 38px;
  padding: 0.45rem 0.7rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #23364f;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dataset-dropdown-trigger:hover {
  border-color: #9fb8e5;
}

.dataset-dropdown-trigger:focus-visible {
  outline: none;
  border-color: #6a9ae6;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}

.dataset-dropdown-caret {
  color: #5f7392;
  transition: transform 0.15s ease;
}

.dataset-dropdown-caret.open {
  transform: rotate(180deg);
}

.dataset-dropdown-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 30;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fff;
  max-height: 220px;
  overflow: auto;
  padding: 0.45rem 0.5rem;
  box-shadow: 0 10px 24px rgba(32, 55, 90, 0.12);
}

.dataset-select-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.3rem;
  border-radius: 8px;
}

.dataset-select-item:hover {
  background: #f4f8ff;
}

.selected-dataset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.75rem;
}

.selected-dataset-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 40px;
  max-width: 100%;
  padding: 0.38rem 0.45rem 0.38rem 0.7rem;
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  background: #f7faff;
  color: #2a4166;
}

.selected-dataset-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.selected-dataset-name {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
}

.selected-dataset-config-copy {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  color: #6b7d96;
}

.selected-dataset-settings,
.selected-dataset-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: rgba(42, 65, 102, 0.08);
  color: #466287;
}

.selected-dataset-settings:hover,
.selected-dataset-remove:hover {
  background: rgba(42, 65, 102, 0.16);
  color: #223854;
}

.dataset-config-panel {
  border: 1px solid #dbe4f0;
  border-radius: 14px;
  background: #fbfdff;
  padding: 0.9rem;
}

.dataset-config-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
}

.dataset-config-file-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-height: 420px;
  overflow: auto;
}

.dataset-config-file-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #e2ebf7;
  border-radius: 12px;
  background: #fff;
}

.dataset-config-file-item.active {
  border-color: #95b6ea;
  background: #f4f8ff;
}

.dataset-config-file-button {
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  color: #23364f;
}

.dataset-config-file-name {
  display: block;
  font-size: 0.82rem;
  word-break: break-word;
}

.dataset-config-file-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 0.95rem;
}

.dataset-config-file-status.is-complete {
  color: #1f8c61;
}

.dataset-config-file-status.is-pending {
  color: #c38a11;
}

.dataset-config-preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dataset-config-table-wrap {
  max-height: 420px;
  overflow: auto;
  border: 1px solid #e2ebf7;
  border-radius: 12px;
}

.dataset-config-table {
  table-layout: fixed;
  width: max-content;
  min-width: 100%;
}

.dataset-config-th,
.dataset-config-td {
  position: relative;
}

.dataset-config-th-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  min-width: 0;
}

.dataset-config-th-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dataset-config-col-resizer {
  flex: 0 0 8px;
  align-self: stretch;
  cursor: col-resize;
  border-right: 2px solid #d2deef;
  opacity: 0.8;
}

.dataset-config-col-resizer:hover {
  border-right-color: #7fa2d9;
}

.dataset-config-cell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8rem;
}

.config-meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(42, 65, 102, 0.08);
  color: #49617f;
  font-size: 0.76rem;
  font-weight: 600;
}

.save-path-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.6rem;
}

.advanced-config-panel {
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #fbfdff;
}

.advanced-config-toggle {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0.7rem 0.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.92rem;
  font-weight: 600;
  color: #294268;
}

.advanced-config-toggle:hover {
  background: #f4f8ff;
}

.advanced-config-body {
  padding: 0 0.8rem 0.8rem;
  border-top: 1px solid #e2ebf7;
}

.advanced-config-textarea {
  font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.82rem;
}

.task-config-form {
  row-gap: 0.7rem !important;
}

.result-preview {
  display: block;
  width: 100%;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-preview-clickable {
  cursor: pointer;
}

.result-preview-clickable:hover {
  text-decoration: underline;
}

.result-groups-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.task-row {
  cursor: pointer;
}

.task-row.selected {
  background: #eef4ff;
}

.task-overview-card {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}

.task-overview-card :deep(.card-body) {
  flex: 1;
  min-height: 0;
}

.task-overview-table-wrap {
  flex: 0 0 auto;
  height: 500px;
  min-height: 500px;
  max-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
}

.results-table-fixed {
  width: 100%;
  table-layout: fixed;
}

.results-table-fixed th,
.results-table-fixed td {
  overflow: hidden;
}

.right-panel-col {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
}

.task-table-centered th,
.task-table-centered td {
  text-align: center;
  vertical-align: middle;
}

.task-progress-panel {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #f8fbff;
}

.task-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.progress-percent {
  min-width: 3rem;
  text-align: right;
}

.result-modal-pre {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 65vh;
  overflow: auto;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fbfdff;
  padding: 0.8rem;
}

:global(.reasoning-page-modal) {
  z-index: 1400;
}

:global(.modal-backdrop) {
  z-index: 1390;
}

@media (max-width: 992px) {
  .task-progress-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
