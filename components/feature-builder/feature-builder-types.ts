export type FeatureBuilderStep = 
  | 'overview'
  | 'requirements'
  | 'design'
  | 'implementation'
  | 'testing'
  | 'review'
  | 'launch'

export interface FeatureBuilderData {
  // Overview step
  name: string
  description: string
  projectId: string
  
  // Requirements step
  requirements: string[]
  acceptanceCriteria: string[]
  
  // Design step
  designNotes: string
  technicalApproach: string
  
  // Implementation step
  implementationPlan: string
  estimatedHours: number
  
  // Testing step
  testStrategy: string
  testCases: string[]
  
  // Review step
  reviewNotes: string
  
  // Launch step
  launchChecklist: string[]
}

export interface StepConfig {
  id: FeatureBuilderStep
  label: string
  description: string
  index: number
}

export const STEPS: StepConfig[] = [
  { id: 'overview', label: 'Overview', description: 'Feature name and basic info', index: 0 },
  { id: 'requirements', label: 'Requirements', description: 'Define what needs to be built', index: 1 },
  { id: 'design', label: 'Design', description: 'Technical design and approach', index: 2 },
  { id: 'implementation', label: 'Implementation', description: 'Plan the development work', index: 3 },
  { id: 'testing', label: 'Testing', description: 'Define test strategy', index: 4 },
  { id: 'review', label: 'Review', description: 'Final review before creation', index: 5 },
  { id: 'launch', label: 'Launch', description: 'Create the feature ticket', index: 6 },
]

export const TOTAL_STEPS = STEPS.length

export function getStepConfig(stepId: FeatureBuilderStep): StepConfig {
  return STEPS.find(s => s.id === stepId) ?? STEPS[0]
}

export function getStepByIndex(index: number): StepConfig | undefined {
  return STEPS[index]
}

export function isFirstStep(stepId: FeatureBuilderStep): boolean {
  return stepId === 'overview'
}

export function isLastStep(stepId: FeatureBuilderStep): boolean {
  return stepId === 'launch'
}

export function getNextStep(stepId: FeatureBuilderStep): FeatureBuilderStep | null {
  const current = getStepConfig(stepId)
  const next = getStepByIndex(current.index + 1)
  return next?.id ?? null
}

export function getPreviousStep(stepId: FeatureBuilderStep): FeatureBuilderStep | null {
  const current = getStepConfig(stepId)
  const prev = getStepByIndex(current.index - 1)
  return prev?.id ?? null
}
