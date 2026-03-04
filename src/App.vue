<template>
  <main class="app-shell">
    <AppNavbar v-if="$route.name !== 'Login'" />
    <section class="app-content">
      <router-view />
    </section>
  </main>
</template>

<script setup>
import AppNavbar from './views/AppNavbar.vue'
</script>

<style>
:root {
  --app-bg: #f3f6fb;
  --app-navbar-height: 58px;
  --border-color: #dbe4f0;
  --surface-color: #ffffff;
  --muted-text: #5b6b83;
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  height: 100%;
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background-color: var(--app-bg);
}

.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  min-height: 0;
}
</style>
