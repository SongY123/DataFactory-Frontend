<template>
  <div class="workspace-shell">
    <aside class="workflow-sidebar border-end" :class="{ collapsed: isSidebarCollapsed }">
      <div class="sidebar-head">
        <div class="sidebar-head-top">
          <div>
            <p class="text-uppercase text-muted fw-semibold small mb-2">Workflow</p>
            <h5 v-if="!isSidebarCollapsed" class="mb-2">Data Agent Training</h5>
          </div>
          <button
            type="button"
            class="sidebar-toggle-btn"
            :aria-label="isSidebarCollapsed ? 'Expand workflow' : 'Collapse workflow'"
            :title="isSidebarCollapsed ? 'Expand workflow' : 'Collapse workflow'"
            @click="toggleSidebar"
          >
            <i class="bi" :class="isSidebarCollapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'"></i>
          </button>
        </div>
        <p v-if="!isSidebarCollapsed" class="text-muted small mb-0">
          Drive each cycle from dataset onboarding to online interaction validation.
        </p>
      </div>

      <div class="workflow-steps mt-3">
        <button
          v-for="(item, index) in workflowModules"
          :key="item.name"
          type="button"
          class="workflow-step"
          :class="{ active: route.name === item.name }"
          :title="isSidebarCollapsed ? (item.workflowLabel || item.label) : ''"
          @click="router.push(item.to)"
        >
          <span class="step-index">{{ index + 1 }}</span>
          <span v-if="!isSidebarCollapsed" class="step-body">
            <span class="step-title">{{ item.workflowLabel || item.label }}</span>
            <span class="step-desc">{{ item.description }}</span>
          </span>
        </button>
      </div>

      <div v-if="!isSidebarCollapsed" class="sidebar-foot mt-auto">
        <div class="small text-muted">Current stage</div>
        <div class="fw-semibold">{{ currentModuleLabel }}</div>
      </div>
    </aside>

    <section class="workspace-main">
      <router-view v-slot="{ Component, route: currentRoute }">
        <keep-alive>
          <component
              :is="Component"
              v-if="currentRoute.name === 'AgentInteraction'"
              :key="String(currentRoute.name || 'AgentInteraction')"
          />
        </keep-alive>
        <component
            :is="Component"
            v-if="currentRoute.name !== 'AgentInteraction'"
            :key="currentRoute.fullPath"
        />
      </router-view >
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { workflowModules } from '../config/global.js'

const WORKFLOW_SIDEBAR_COLLAPSE_KEY = 'workflowSidebarCollapsed'
const route = useRoute()
const router = useRouter()
const isSidebarCollapsed = ref(localStorage.getItem(WORKFLOW_SIDEBAR_COLLAPSE_KEY) === 'true')

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  localStorage.setItem(WORKFLOW_SIDEBAR_COLLAPSE_KEY, String(isSidebarCollapsed.value))
}

const currentModuleLabel = computed(() => {
  const match = workflowModules.find((item) => item.name === route.name)
  return match?.workflowLabel || match?.label || workflowModules[0].workflowLabel || workflowModules[0].label
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
  transition: width 0.2s ease, min-width 0.2s ease, padding 0.2s ease;
}

.workflow-sidebar.collapsed {
  width: 96px;
  min-width: 96px;
  padding: 0.9rem 0.6rem;
}

.sidebar-head {
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sidebar-toggle-btn {
  width: 30px;
  height: 30px;
  border: 1px solid #cbd7ea;
  background: #f8fbff;
  color: #335b93;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
}

.sidebar-toggle-btn:hover {
  border-color: #90b0df;
  background: #edf4ff;
}

.sidebar-toggle-btn:focus-visible {
  outline: 2px solid #2f6fca;
  outline-offset: 1px;
}

.sidebar-toggle-btn .bi {
  font-size: 0.85rem;
  line-height: 1;
}

.workflow-sidebar.collapsed .sidebar-head-top {
  justify-content: center;
}

.workflow-sidebar.collapsed .sidebar-head-top > div {
  display: none;
}

.workflow-steps {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.workflow-step {
  width: 100%;
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

.workflow-sidebar.collapsed .workflow-step {
  padding: 0.6rem;
  justify-content: center;
  align-items: center;
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

  .workflow-sidebar,
  .workflow-sidebar.collapsed {
    width: 100%;
    min-width: 0;
    padding: 1rem;
  }
}
</style>
