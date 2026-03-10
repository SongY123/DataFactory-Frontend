export const config = {
  appName: 'DataFactory',
  apiBase: '/api'
}

export const workflowModules = [
  {
    name: 'DataPreparation',
    to: '/data-preparation',
    label: 'Data Preparation',
    workflowLabel: 'Data Preparation',
    description: 'Collect, align, and register training datasets.'
  },
  {
    name: 'ReasoningDataDistillation',
    to: '/reasoning-data-distillation',
    label: 'Reasoning Distillation',
    workflowLabel: 'Reasoning Data Distillation',
    description: 'Distill high-quality reasoning traces into compact training corpora.'
  },
  {
    name: 'TrajectorySynthesis',
    to: '/trajectory-synthesis',
    label: 'Trajectory Synthesis',
    workflowLabel: 'Agentic Trajectory Synthesis',
    description: 'Generate synthesized trajectories and track task progress.'
  },
  {
    name: 'AgentInteraction',
    to: '/agent-interaction',
    label: 'Agent Interaction',
    workflowLabel: 'Agent Interaction',
    description: 'Validate agent responses with real conversation loops.'
  },
]
