import { createRouter, createWebHashHistory } from 'vue-router'
import { getPostLoginRoute, syncAuthSession } from '../api/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/',
    component: () => import('../views/DataAgentWorkspace.vue'),
    children: [
      {
        path: '',
        redirect: '/data-preparation'
      },
      {
        path: 'data-preparation',
        name: 'DataPreparation',
        component: () => import('../views/modules/DataPreparation.vue')
      },
      {
        path: 'data-preparation/:datasetId',
        name: 'DataPreparationDetail',
        component: () => import('../views/modules/DataPreparationDetail.vue')
      },
      {
        path: 'trajectory-synthesis',
        name: 'TrajectorySynthesis',
        component: () => import('../views/modules/TrajectorySynthesis.vue')
      },
      {
        path: 'agentic-data-synthesis',
        redirect: '/trajectory-synthesis'
      },
      {
        path: 'reasoning-data-distillation',
        name: 'ReasoningDataDistillation',
        component: () => import('../views/modules/ReasoningDataDistillation.vue')
      },
      {
        path: 'agent-interaction',
        name: 'AgentInteraction',
        component: () => import('../views/modules/AgentInteraction.vue')
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/data-preparation'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to) => {
  const authed = await syncAuthSession()

  if (to.name === 'Login' && authed) {
    return getPostLoginRoute()
  }

  if (to.name !== 'Login' && !authed) {
    return '/login'
  }

  return true
})

export default router
