import { apiRequest, apiRequestWithToken } from '../auth'

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
  currentStep?: string | null
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
  pinnedAt: string | null
  createdAt: string
}

export type CiLatestProfile = {
  hasPrevious: boolean
  companyName: string | null
  coreValues: string | null
}

export type PinnedLogo = {
  projectId?: string
  projectType?: 'CI' | 'BI'
  candidateId: string
  storageKey: string
  pinnedAt: string | null
  expiresAt: string
  createdAt?: string
}

export type DownloadRecord = {
  downloadId: number
  candidateId: string
  projectType: 'CI' | 'BI'
  imageUrl: string
  firstTime: boolean
  downloadedAt: string
}

export type SurveyStatus = {
  completed: boolean
  creditBalance: number
}

export type BrandKit = {
  id: string
  kitType: 'BUSINESS_CARD' | 'BOTTLE'
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  storageKey: string | null
  errorCode: string | null
  errorMessage?: string | null
}

export type AdminLoginResult = {
  accessToken: string
  expiresIn: number
  loginId: string
  name: string
}

export type AdminDashboardStats = {
  totalMembers: number
  newMembers7Days: number
  totalGenerations: number
  totalDownloads: number
}

export type AdminMember = {
  id: number
  email: string
  name: string
  provider: string
  ciGenerations: number
  biGenerations: number
  downloadCount: number
  creditBalance: number
  paidUser: boolean
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

export const ciProjectsApi = {
  latestProfile: () => apiRequest<CiLatestProfile>('/ci-projects/latest-profile'),
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
  pinCandidate: (projectId: string, candidateId: string) => apiRequest<PinnedLogo>(`/projects/${projectId}/logo-candidates/${candidateId}/pin`, {
    method: 'POST',
  }),
  unpinCandidate: (projectId: string, candidateId: string) => apiRequest<PinnedLogo>(`/projects/${projectId}/logo-candidates/${candidateId}/pin`, {
    method: 'DELETE',
  }),
  downloadCandidate: (projectId: string, candidateId: string) => apiRequest<DownloadRecord>(`/projects/${projectId}/logo-candidates/${candidateId}/download`, {
    method: 'POST',
  }),
  requestBrandKit: (projectId: string, candidateId: string) => apiRequest<BrandKit>(`/projects/${projectId}/logo-candidates/${candidateId}/brand-kits`, {
    method: 'POST',
  }),
  getBrandKit: (projectId: string, candidateId: string) => apiRequest<BrandKit>(`/projects/${projectId}/logo-candidates/${candidateId}/brand-kits`),
  createAnalysis: (projectId: string) => apiRequest<TrademarkAnalysis>(`/projects/${projectId}/trademark-analyses`, {
    method: 'POST',
  }),
  getAnalysis: (projectId: string, analysisId: string) => apiRequest<TrademarkAnalysis>(`/projects/${projectId}/trademark-analyses/${analysisId}`),
  getMatches: (projectId: string, analysisId: string) => apiRequest<TrademarkMatch[]>(`/projects/${projectId}/trademark-analyses/${analysisId}/matches`),
}

export const meApi = {
  getCredits: () => apiRequest<{ balance: number }>('/me/credits'),
  getSurvey: () => apiRequest<SurveyStatus>('/me/survey'),
  submitSurvey: (input: { rating: number; improvements: string[]; comment: string }) => apiRequest<SurveyStatus>('/me/survey', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getPins: () => apiRequest<PinnedLogo[]>('/me/pins'),
  getDownloads: (type?: 'CI' | 'BI') => apiRequest<DownloadRecord[]>(`/me/downloads${type ? `?type=${type}` : ''}`),
}

export const adminApi = {
  login: (loginId: string, password: string) => apiRequest<AdminLoginResult>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, password }),
  }),
  dashboard: (token: string) => apiRequestWithToken<AdminDashboardStats>(token, '/admin/dashboard'),
  members: (token: string) => apiRequestWithToken<AdminMember[]>(token, '/admin/members'),
  memberDownloads: (token: string, memberId: number, type?: 'CI' | 'BI') => apiRequestWithToken<DownloadRecord[]>(token, `/admin/members/${memberId}/downloads${type ? `?type=${type}` : ''}`),
  downloadImage: (token: string, downloadId: number) => apiRequestWithToken<{ imageUrl: string }>(token, `/admin/downloads/${downloadId}/image`),
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
