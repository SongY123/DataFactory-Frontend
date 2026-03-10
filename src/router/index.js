import { createRouter, createWebHashHistory } from 'vue-router'
import { getPostLoginRoute, isLoggedIn } from '../api/auth'

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
        path: 'data-processing',
        name: 'DataProcessing',
        component: () => import('../views/modules/DataProcessing.vue')
      },
      {
        path: 'model-training',
        name: 'ModelTraining',
        component: () => import('../views/modules/ModelTraining.vue')
      },
      {
        path: 'model-evaluation',
        name: 'ModelEvaluation',
        component: () => import('../views/modules/ModelEvaluation.vue')
      },
      {
        path: 'agent-interaction',
        name: 'AgentInteraction',
        component: () => import('../views/modules/AgentInteraction.vue')
      },
      {
        path: 'agentic-data-synthesis',
        name: 'AgenticDataSynthesis',
        component: () => import('../views/modules/AgenticDataSynthesis.vue')
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

router.beforeEach((to) => {
  const authed = isLoggedIn()

  if (to.name === 'Login' && authed) {
    return getPostLoginRoute()
  }

  if (to.name !== 'Login' && !authed) {
    return '/login'
  }

  return true
})

export default router
