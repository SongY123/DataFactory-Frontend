import { getRuntimeApiBase } from '../utils/desktop'

export const config = {
  appName: 'DataFactory',
  apiBase: getRuntimeApiBase()
}

export const workflowModules = [
  {
    name: 'DataPreparation',
    to: '/data-preparation',
    compactLabel: 'D',
    label: 'Dataset Management',
    workflowLabel: 'Dataset Management',
    description: 'Register, inspect, and organize datasets for downstream synthesis tasks'
  },
  {
    name: 'ReasoningDataDistillation',
    to: '/reasoning-data-distillation',
    compactLabel: 'R',
    label: 'Reasoning Data Synthesis',
    workflowLabel: 'Reasoning Data Synthesis',
    description: 'Generate task-aligned reasoning traces as reusable process-level supervision'
  },
  {
    name: 'TrajectorySynthesis',
    to: '/trajectory-synthesis',
    compactLabel: 'T',
    label: 'Trajectory Synthesis',
    workflowLabel: 'Agentic Trajectory Synthesis',
    description: 'Construct grounded multi-step action trajectories through data interactions'
  },
  {
    name: 'AgentInteraction',
    to: '/agent-interaction',
    compactLabel: 'I',
    label: 'Agent Interaction',
    workflowLabel: 'Interactive Testing',
    description: 'Validate agent behavior through natural language interaction and iterative refinement'
  },
]
