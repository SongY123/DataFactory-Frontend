export const config = {
  appName: 'DataFactory',
  apiBase: '/api'
}

export const workflowModules = [
  {
    name: 'DataPreparation',
    to: '/data-preparation',
    label: 'Data Preparation',
    description: 'Collect, align, and register training datasets.'
  },
  {
    name: 'DataProcessing',
    to: '/data-processing',
    label: 'Data Processing',
    description: 'Clean, normalize, and transform training data.'
  },
  {
    name: 'ModelTraining',
    to: '/model-training',
    label: 'Model Training',
    description: 'Configure hyperparameters and launch training jobs.'
  },
  {
    name: 'ModelEvaluation',
    to: '/model-evaluation',
    label: 'Model Evaluation',
    description: 'Track benchmark metrics and failure slices.'
  },
  {
    name: 'AgentInteraction',
    to: '/agent-interaction',
    label: 'Agent Interaction',
    description: 'Validate agent responses with real conversation loops.'
  }
]
