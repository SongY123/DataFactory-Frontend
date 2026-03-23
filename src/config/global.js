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
    description: 'Collect, align, and register training datasets.'
  },
  {
    name: 'ReasoningDataDistillation',
    to: '/reasoning-data-distillation',
    compactLabel: 'R',
    label: 'Reasoning Data Synthesis',
    workflowLabel: 'Reasoning Data Synthesis',
    description: 'Synthesize high-quality reasoning traces into reusable training corpora.'
  },
  {
    name: 'TrajectorySynthesis',
    to: '/trajectory-synthesis',
    compactLabel: 'T',
    label: 'Trajectory Synthesis',
    workflowLabel: 'Agentic Trajectory Synthesis',
    description: 'Generate synthesized trajectories and track task progress.'
  },
  {
    name: 'AgentInteraction',
    to: '/agent-interaction',
    compactLabel: 'I',
    label: 'Agent Interaction',
    workflowLabel: 'Agent Interaction',
    description: 'Validate agent responses with real conversation loops.'
  },
]
