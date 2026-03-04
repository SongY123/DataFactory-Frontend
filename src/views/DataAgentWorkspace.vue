<template>
  <div class="workspace-shell">
    <aside class="workflow-sidebar border-end">
      <div class="sidebar-head">
        <p class="text-uppercase text-muted fw-semibold small mb-2">Workflow</p>
        <h5 class="mb-2">Data Agent Training</h5>
        <p class="text-muted small mb-0">Drive each cycle from dataset onboarding to online interaction validation.</p>
      </div>

      <div class="workflow-steps mt-3">
        <button
          v-for="(item, index) in workflowModules"
          :key="item.name"
          type="button"
          class="workflow-step"
          :class="{ active: route.name === item.name }"
          @click="router.push(item.to)"
        >
          <span class="step-index">{{ index + 1 }}</span>
          <span class="step-body">
            <span class="step-title">{{ item.label }}</span>
            <span class="step-desc">{{ item.description }}</span>
          </span>
        </button>
      </div>

      <div class="sidebar-foot mt-auto">
        <div class="small text-muted">Current stage</div>
        <div class="fw-semibold">{{ currentModuleLabel }}</div>
      </div>
    </aside>

    <section class="workspace-main">
      <router-view />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { workflowModules } from '../config/global.js'

const route = useRoute()
const router = useRouter()

const currentModuleLabel = computed(() => {
  const match = workflowModules.find((item) => item.name === route.name)
  return match?.label || workflowModules[0].label
})
</script>

<style scoped>
.workspace-shell {
  height: 100%;
  display: flex;
  min-height: 0;
}

.workflow-sidebar {
  width: 330px;
  background: #fff;
  display: flex;
  flex-direction: column;
  padding: 1.15rem;
  gap: 0.25rem;
  min-width: 280px;
}

.sidebar-head {
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--border-color);
}

.workflow-steps {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.workflow-step {
  border: 1px solid var(--border-color);
  background: #fff;
  border-radius: 14px;
  padding: 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  text-align: left;
  transition: all 0.18s ease;
}

.workflow-step:hover {
  border-color: #2563eb;
  transform: translateY(-1px);
}

.workflow-step.active {
  border-color: #2563eb;
  background: #eef4ff;
}

.step-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #dde7fb;
  color: #1b4f95;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.step-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: #1a2e4a;
}

.step-desc {
  font-size: 0.78rem;
  color: #60708a;
  line-height: 1.35;
}

.sidebar-foot {
  margin-top: auto;
  border-top: 1px dashed #cfd9e9;
  padding-top: 0.7rem;
}

.workspace-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 1rem;
}

@media (max-width: 992px) {
  .workspace-shell {
    flex-direction: column;
  }

  .workflow-sidebar {
    width: 100%;
    min-width: 0;
  }
}
</style>
