import { apiRequest } from '../auth'

export type OnboardingDetailsDecision = 'SUBMITTED' | 'SKIPPED'

export type OnboardingResponse = {
  completed: boolean
  usage: string[]
  audience: string | null
  detailsDecision: OnboardingDetailsDecision | null
  completedAt: string | null
  schemaVersion: number
}

export type OnboardingInput = {
  usage: string[]
  audience: string
  detailsDecision: OnboardingDetailsDecision
  initialProject?: ProjectInput
}

export type ProjectInput = {
  brandType?: string
  industry?: string
  brandName?: string
  companyName?: string
  companyMotto?: string
  brandValues?: string[]
  brandValuesText?: string
  targetAge?: string
  tone?: string
  colorMode?: string
  colors?: string[]
  logoStyle?: string
  includeBrandName?: boolean
  additionalRequirements?: string
}

export type ProjectResponse = ProjectInput & {
  id: string
  status: 'DRAFT' | 'BRIEF_READY' | 'GENERATING' | 'RESULT_READY' | 'ANALYZING' | 'COMPLETED'
  createdAt: string
  updatedAt: string
}

export type LogoGeneration = {
  id: string
  projectId: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  candidateCount: number
  modelName: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export type LogoCandidate = {
  id: string
  order: number
  storageKey: string
  mimeType: string
  width: number | null
  height: number | null
  selected: boolean
  saved: boolean
  createdAt: string
}

export type TrademarkAnalysis = {
  id: string
  projectId: string
  candidateId: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  maxSimilarity: number | null
  riskLevel: 'SAFE' | 'MODERATE' | 'CAUTION' | null
  riskLabel: string | null
  riskDescription: string | null
  disclaimer: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export type TrademarkMatch = {
  rank: number
  applicationNumber: string
  name: string
  category: string
  similarity: number
  imagePath: string | null
}

export const getLogoCandidateImageUrl = (storageKey: string) => {
  const normalizedKey = storageKey.replace(/^\/+/, '')
  const publicPath = normalizedKey.startsWith('uploads/')
    ? normalizedKey
    : `uploads/${normalizedKey}`

  return `/${publicPath}`
}

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export const onboardingApi = {
  get: () => apiRequest<OnboardingResponse>('/me/onboarding'),
  complete: (input: OnboardingInput) => apiRequest<OnboardingResponse>('/me/onboarding', {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
}

export const projectsApi = {
  create: (input: ProjectInput) => apiRequest<ProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  get: (projectId: string) => apiRequest<ProjectResponse>(`/projects/${projectId}`),
  patch: (projectId: string, input: ProjectInput) => apiRequest<ProjectResponse>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
  updateStep: (projectId: string, step: 'brand-brief' | 'tone' | 'logo-style' | 'final-review', input: ProjectInput) => apiRequest<ProjectResponse>(`/projects/${projectId}/${step}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }),
  createGeneration: (projectId: string, idempotencyKey: string) => apiRequest<LogoGeneration>(`/projects/${projectId}/logo-generations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  }),
  getGeneration: (projectId: string, generationId: string) => apiRequest<LogoGeneration>(`/projects/${projectId}/logo-generations/${generationId}`),
  getCandidates: (projectId: string, generationId: string) => apiRequest<LogoCandidate[]>(`/projects/${projectId}/logo-generations/${generationId}/logo-candidates`),
  selectCandidate: (projectId: string, candidateId: string) => apiRequest<LogoCandidate>(`/projects/${projectId}/logo-candidates/${candidateId}/select`, {
    method: 'POST',
  }),
  createAnalysis: (projectId: string) => apiRequest<TrademarkAnalysis>(`/projects/${projectId}/trademark-analyses`, {
    method: 'POST',
  }),
  getAnalysis: (projectId: string, analysisId: string) => apiRequest<TrademarkAnalysis>(`/projects/${projectId}/trademark-analyses/${analysisId}`),
  getMatches: (projectId: string, analysisId: string) => apiRequest<TrademarkMatch[]>(`/projects/${projectId}/trademark-analyses/${analysisId}/matches`),
}

export async function waitForLogoGeneration(projectId: string, generationId: string): Promise<LogoGeneration> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const generation = await projectsApi.getGeneration(projectId, generationId)
    if (generation.status === 'SUCCEEDED' || generation.status === 'FAILED') return generation
    await delay(1_500)
  }
  throw new Error('로고 생성 상태 확인 시간이 초과됐어요. 결과 화면에서 다시 확인해주세요.')
}

export async function waitForTrademarkAnalysis(projectId: string, analysisId: string): Promise<TrademarkAnalysis> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const analysis = await projectsApi.getAnalysis(projectId, analysisId)
    if (analysis.status === 'SUCCEEDED' || analysis.status === 'FAILED') return analysis
    await delay(1_500)
  }
  throw new Error('상표 분석 상태 확인 시간이 초과됐어요. 결과 화면에서 다시 확인해주세요.')
}
