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
              :class="{ active: route.name === item.name }"
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

          <li class="nav-item dropdown" v-if="authed">
            <a
              class="nav-link dropdown-toggle user-menu-toggle"
              href="#"
              role="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i class="bi bi-person-circle me-1"></i>
              {{ username || 'User' }}
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
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
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clearLocalAuth, getStoredUsername, isLoggedIn, logout } from '../api/auth'
import { config, workflowModules } from '../config/global.js'

const router = useRouter()
const route = useRoute()

const appName = config.appName
const authed = ref(false)
const username = ref('')
const loggingOut = ref(false)

const refreshAuthState = () => {
  authed.value = isLoggedIn()
  username.value = getStoredUsername()
}

const goToLogin = () => {
  router.push('/login')
}

const handleLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true

  try {
    await logout()
  } catch (_) {
    clearLocalAuth()
  } finally {
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

onMounted(() => {
  refreshAuthState()
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
})
</script>

<style scoped>
.app-navbar {
  background: linear-gradient(90deg, #143267 0%, #1d4a8f 55%, #2266b3 100%);
  min-height: var(--app-navbar-height, 58px);
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
}
</style>
