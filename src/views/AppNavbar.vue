<template>
  <nav class="navbar navbar-expand-lg navbar-dark app-navbar shadow-sm">
    <div class="container-fluid px-3">
      <div class="navbar-brand d-flex align-items-center gap-2">
        <img src="../assets/img/logo.svg" height="24">
      </div>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#mainNavbar"
        aria-controls="mainNavbar"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div id="mainNavbar" class="collapse navbar-collapse">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0 nav-scroll-wrap">
          <li v-for="item in workflowModules" :key="item.name" class="nav-item">
            <router-link
              :to="item.to"
              class="nav-link"
              :class="{ active: isWorkflowItemActive(item) }"
            >
              {{ item.label }}
            </router-link>
          </li>
        </ul>

        <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-lg-2">
          <li class="nav-item">
            <a
              class="nav-link"
              href="https://github.com/SongY123/DataFactory"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
              title="GitHub Repository"
            >
              <i class="bi bi-github fs-5"></i>
            </a>
          </li>

          <li v-if="authed" ref="userMenuRef" class="nav-item user-menu-wrap">
            <button
              class="nav-link user-menu-toggle"
              type="button"
              :aria-expanded="isUserMenuOpen ? 'true' : 'false'"
              @click.stop="toggleUserMenu"
            >
              <i class="bi bi-person-circle me-1"></i>
              {{ username || 'User' }}
              <i class="bi user-menu-caret ms-2" :class="isUserMenuOpen ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
            </button>
            <ul v-if="isUserMenuOpen" class="dropdown-menu dropdown-menu-end user-menu-dropdown show" @click.stop>
              <li>
                <button
                  class="dropdown-item d-flex align-items-center"
                  type="button"
                  :disabled="loggingOut"
                  @click="handleLogout"
                >
                  <span v-if="loggingOut" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  <i v-else class="bi bi-box-arrow-right me-2"></i>
                  Sign out
                </button>
              </li>
            </ul>
          </li>

          <li class="nav-item" v-else>
            <button class="btn btn-sm btn-outline-light" type="button" @click="goToLogin">
              Sign in
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clearLocalAuth, getStoredUsername, isLoggedIn, logout } from '../api/auth'
import { config, workflowModules } from '../config/global.js'

const router = useRouter()
const route = useRoute()

const appName = config.appName
const authed = ref(false)
const username = ref('')
const loggingOut = ref(false)
const isUserMenuOpen = ref(false)
const userMenuRef = ref(null)

const refreshAuthState = () => {
  authed.value = isLoggedIn()
  username.value = getStoredUsername()
  if (!authed.value) {
    isUserMenuOpen.value = false
  }
}

const isWorkflowItemActive = (item) => {
  if (!item?.to) return false
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

const goToLogin = () => {
  router.push('/login')
}

const closeUserMenu = () => {
  isUserMenuOpen.value = false
}

const toggleUserMenu = () => {
  if (!authed.value) return
  isUserMenuOpen.value = !isUserMenuOpen.value
}

const handleLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true

  try {
    await logout()
  } catch (_) {
    clearLocalAuth()
  } finally {
    closeUserMenu()
    refreshAuthState()
    loggingOut.value = false
    await router.replace('/login')
  }
}

const handleStorageChange = (event) => {
  if (event.key === 'authLoggedIn' || event.key === 'authUsername') {
    refreshAuthState()
  }
}

const handleClickOutsideUserMenu = (event) => {
  if (!userMenuRef.value) return
  if (!userMenuRef.value.contains(event.target)) {
    closeUserMenu()
  }
}

const handleWindowKeydown = (event) => {
  if (event.key === 'Escape') {
    closeUserMenu()
  }
}

onMounted(() => {
  refreshAuthState()
  window.addEventListener('storage', handleStorageChange)
  document.addEventListener('click', handleClickOutsideUserMenu)
  window.addEventListener('keydown', handleWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
  document.removeEventListener('click', handleClickOutsideUserMenu)
  window.removeEventListener('keydown', handleWindowKeydown)
})

watch(() => route.fullPath, () => {
  closeUserMenu()
})
</script>

<style scoped>
.app-navbar {
  background: linear-gradient(90deg, #143267 0%, #1d4a8f 55%, #2266b3 100%);
  min-height: var(--app-navbar-height, 58px);
  position: relative;
  z-index: 1100;
  overflow: visible;
}

.app-navbar .container-fluid,
.app-navbar .navbar-collapse,
.app-navbar .navbar-nav,
.app-navbar .user-menu-wrap {
  overflow: visible;
}

.app-navbar .user-menu-wrap {
  position: relative;
}

.nav-scroll-wrap {
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: thin;
}

.nav-link {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.86) !important;
}

.nav-link.active {
  color: #ffffff !important;
  border-bottom: 2px solid #ffffff;
}

.user-menu-toggle {
  display: inline-flex;
  align-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-decoration: none;
}

.user-menu-caret {
  font-size: 0.78rem;
  line-height: 1;
}

.user-menu-toggle:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.75);
  outline-offset: 2px;
}

.user-menu-dropdown {
  position: absolute;
  right: 0;
  left: auto;
  top: calc(100% + 0.45rem);
  z-index: 1200;
  min-width: 11rem;
  border: 1px solid rgba(20, 50, 103, 0.12);
  box-shadow: 0 14px 30px rgba(20, 50, 103, 0.18);
}
</style>
