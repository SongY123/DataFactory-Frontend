<template>
  <div class="login-container">
    <div class="animated-background">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="gradient-orb orb-3"></div>
      <div class="gradient-orb orb-4"></div>
    </div>

    <div class="login-form-wrapper">
      <div class="login-card">
        <div class="text-center mb-4">
          <img src="../assets/img/logo.svg" class="login-logo mb-3">
        </div>

        <form @submit.prevent="handleLogin">
          <div class="mb-3">
            <label for="username" class="form-label text-white">Username</label>
            <input
              id="username"
              v-model="loginForm.username"
              type="text"
              class="form-control form-control-lg glass-input"
              placeholder="Enter your username"
              required
            >
          </div>

          <div class="mb-3">
            <label for="password" class="form-label text-white">Password</label>
            <input
              id="password"
              v-model="loginForm.password"
              type="password"
              class="form-control form-control-lg glass-input"
              placeholder="Enter your password"
              required
            >
          </div>

          <div class="mb-3 form-check">
            <input
              id="rememberPassword"
              v-model="loginForm.rememberPassword"
              class="form-check-input glass-checkbox"
              type="checkbox"
              @change="handleRememberPasswordChange"
            >
            <label class="form-check-label text-white" for="rememberPassword">Remember me</label>
          </div>

          <div class="d-grid gap-2">
            <button
              type="submit"
              class="btn btn-glass btn-lg"
              :disabled="isLoading"
            >
              <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status"></span>
              {{ isLoading ? 'Signing in...' : 'Sign in' }}
            </button>
            <button type="button" class="btn btn-glass-secondary btn-lg" @click="handleCancel">Clear</button>
          </div>
        </form>

        <div class="text-center mt-4">
          <p class="text-white-50 small mb-0">&copy; 2026 {{ appName }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { config } from '../config/global.js'
import { getPostLoginRoute, isLoggedIn, login as loginApi } from '../api/auth'

export default {
  name: 'Login',
  data() {
    const remembered = localStorage.getItem('authRememberLogin') === 'true'
    const rememberedUsername = localStorage.getItem('authRememberedUsername') || ''
    const rememberedPassword = localStorage.getItem('authRememberedPassword') || ''

    return {
      appName: config.appName,
      loginForm: {
        username: remembered ? rememberedUsername : '',
        password: remembered ? rememberedPassword : '',
        rememberPassword: remembered
      },
      isLoading: false
    }
  },
  methods: {
    async handleLogin() {
      this.isLoading = true

      try {
        await loginApi(this.loginForm.username.trim(), this.loginForm.password)

        if (this.loginForm.rememberPassword) {
          localStorage.setItem('authRememberLogin', 'true')
          localStorage.setItem('authRememberedUsername', this.loginForm.username.trim())
          localStorage.setItem('authRememberedPassword', this.loginForm.password)
        } else {
          localStorage.removeItem('authRememberLogin')
          localStorage.removeItem('authRememberedUsername')
          localStorage.removeItem('authRememberedPassword')
        }

        this.$router.replace(getPostLoginRoute())
      } catch (error) {
        alert(error?.message || 'Login failed. Please try again.')
      } finally {
        this.isLoading = false
      }
    },

    handleCancel() {
      this.loginForm.password = ''
      if (!this.loginForm.rememberPassword) {
        this.loginForm.username = ''
      }
    },

    handleRememberPasswordChange() {
      if (this.loginForm.rememberPassword) return
      localStorage.removeItem('authRememberLogin')
      localStorage.removeItem('authRememberedUsername')
      localStorage.removeItem('authRememberedPassword')
    }
  },

  mounted() {
    if (isLoggedIn()) {
      this.$router.replace(getPostLoginRoute())
    }
  }
}
</script>

<style scoped>
.login-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(45deg, #0f2d5c, #1d4f91, #2a79c2, #1a5ba5);
  background-size: 400% 400%;
  animation: gradientShift 9s ease infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes gradientShift {
  0% {
    background-position: 0 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.animated-background {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  opacity: 0.58;
  filter: blur(36px);
  animation: float 7s ease-in-out infinite;
}

.orb-1 {
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, #5cc3ff, #2e9ae0);
  top: 8%;
  left: 10%;
}

.orb-2 {
  width: 210px;
  height: 210px;
  background: radial-gradient(circle, #5ea4f1, #2f76c8);
  top: 58%;
  right: 16%;
  animation-delay: 2s;
}

.orb-3 {
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, #4d8ee0, #2f66b2);
  bottom: 14%;
  left: 22%;
  animation-delay: 4s;
}

.orb-4 {
  width: 190px;
  height: 190px;
  background: radial-gradient(circle, #77b7ff, #4a8fd8);
  top: 16%;
  right: 10%;
  animation-delay: 1s;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) translateX(0) scale(1);
  }
  33% {
    transform: translateY(-18px) translateX(12px) scale(1.08);
  }
  66% {
    transform: translateY(10px) translateX(-10px) scale(0.92);
  }
}

.login-form-wrapper {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 480px;
  padding: 1rem;
}

.login-card {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(22px);
  box-shadow: 0 24px 56px rgba(12, 33, 66, 0.34);
}

.login-logo {
  width: 200px;
  height: auto;
}

.glass-input {
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: #fff;
}

.glass-input::placeholder {
  color: rgba(255, 255, 255, 0.66);
}

.glass-input:focus {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.45);
  color: #fff;
  box-shadow: 0 0 0 0.2rem rgba(255, 255, 255, 0.15);
}

.glass-checkbox {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.48);
}

.btn-glass {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.16));
  border: 1px solid rgba(255, 255, 255, 0.36);
  color: #fff;
  font-weight: 600;
}

.btn-glass:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.24));
  color: #fff;
}

.btn-glass-secondary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
}

.btn-glass-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
</style>
