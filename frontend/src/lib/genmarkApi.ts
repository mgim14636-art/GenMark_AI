import { AuthError, apiRequest, apiRequestWithToken, apiTextRequest, downloadAuthenticatedFile, downloadAuthenticatedFileWithToken } from '../auth'

export type OnboardingResponse = {
  completed: boolean
  usage: string[]
  audience: string | null
  completedAt: string | null
}

export type OnboardingInput = {
  usage: string[]
  audience: string
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
  paletteReplace?: boolean
  logoStyle?: string
  logoShape?: string
  additionalRequirements?: string
}

export type ProjectResponse = ProjectInput & {
  id: string
  brandType: 'CI' | 'BI'
  status: 'DRAFT' | 'BRIEF_READY' | 'GENERATING' | 'RESULT_READY' | 'ANALYZING' | 'COMPLETED'
  currentStep?: number | string | null
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
  svgUrl: string | null
  svgEdited: boolean
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

export type SurveyImprovement =
  | '로고 생성·재생성'
  | '브랜드 맞춤 로고'
  | '로고 수정'
  | '유사 상표 확인'
  | '로고 저장·활용'
  | '기타'

export type SurveySubmitInput = {
  rating: 1 | 5
  improvements?: SurveyImprovement[]
  comment?: string
}

export type BrandKit = {
  id: string
  candidateId: string
  projectId: string
  kitType: 'BUSINESS_CARD' | 'THUMBNAIL'
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  storageKey: string | null
  storageKeys?: string[]
  errorCode: string | null
  errorMessage?: string | null
  preliminary?: boolean
  warnings?: string[]
}

export type BusinessCardInfoInput = {
  name: string
  title?: string
  company?: string
  phone?: string
  email?: string
  address?: string
}

export type BrandKitCreateInput = {
  kitType: BrandKit['kitType']
  cardInfo?: BusinessCardInfoInput
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

export type AdminMetricPoint = {
  label: string
  value: number
}

export type AdminTrendPoint = AdminMetricPoint & {
  ci: number
  bi: number
}

export type AdminAnalyticsResponse = {
  period: 'daily' | 'weekly' | 'monthly' | 'custom'
  from: string
  to: string
  overview: {
    totalMembers: number
    newMembers: number
    totalGenerations: number
    ciGenerations: number
    biGenerations: number
    totalDownloads: number
    ciDownloads: number
    biDownloads: number
  }
  signup: {
    totalMembers: number
    newMembers: number
    startedGenerationMembers: number
    providerCounts: AdminMetricPoint[]
    onboardingUsage: AdminMetricPoint[]
    trend: AdminTrendPoint[]
    funnel: AdminMetricPoint[]
  }
  generation: {
    total: number
    ci: number
    bi: number
    succeeded: number
    failed: number
    likes: number
    dislikes: number
    satisfactionPercent: number
    trademarkUsagePercent: number
    purpose: AdminMetricPoint[]
    ciInputs: AdminMetricPoint[]
    biInputs: AdminMetricPoint[]
    trend: AdminTrendPoint[]
  }
  downloads: {
    total: number
    ci: number
    bi: number
    ciStyles: AdminMetricPoint[]
    biStyles: AdminMetricPoint[]
    trend: AdminTrendPoint[]
  }
  credits: {
    used: number
    granted: number
    generateUsed: number
    downloadUsed: number
    surveyGranted: number
    signupGranted: number
    totalBalance: number
  }
  survey: {
    responses: number
    likes: number
    dislikes: number
    improvements: AdminMetricPoint[]
  }
}

export type AdminAccount = {
  id: number
  loginId: string
  name: string
  createdAt: string
  lastAccessAt: string | null
}

export type AdminLogoAsset = {
  id: string
  projectId: string
  imageUrl: string
  name: string
  date: string
}

export type AdminLogoMemberRecord = {
  memberId: string
  memberName: string
  generatedLogos: AdminLogoAsset[]
  downloadedLogos: AdminLogoAsset[]
}

export type AdminSurveyResponse = {
  memberId: number
  memberEmail: string | null
  memberName: string | null
  rating: number | null
  improvements: string[]
  comment: string | null
  completedAt: string | null
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
  imageUrl?: string
  note?: string | null
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

type BackendProjectResponse = {
  id: string
  status: ProjectResponse['status']
  currentStep: number
  industry: string | null
  companyName?: string | null
  coreValues?: string | null
  brandName?: string | null
  valueCategories?: string[] | null
  brandDescription?: string | null
  targetAge?: string | null
  tone: string | null
  colorMode: string | null
  colors: string[] | null
  logoStyle: string | null
  logoShape: string | null
  additionalRequirements: string | null
  createdAt: string
  updatedAt: string
}

const normalizeHexColor = (color: string | null | undefined) => {
  if (color == null) return color
  const normalized = color.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : color
}

const colorFields = (colors: string[] | undefined, replace = false) => {
  if (replace) {
    return {
      color1: normalizeHexColor(colors?.[0] ?? null),
      color2: normalizeHexColor(colors?.[1] ?? null),
      color3: normalizeHexColor(colors?.[2] ?? null),
      color4: normalizeHexColor(colors?.[3] ?? null),
    }
  }

  return {
    ...(colors?.[0] !== undefined ? { color1: normalizeHexColor(colors[0]) } : {}),
    ...(colors?.[1] !== undefined ? { color2: normalizeHexColor(colors[1]) } : {}),
    ...(colors?.[2] !== undefined ? { color3: normalizeHexColor(colors[2]) } : {}),
    ...(colors?.[3] !== undefined ? { color4: normalizeHexColor(colors[3]) } : {}),
  }
}

const toCiProjectRequest = (input: ProjectInput) => ({
  industry: input.industry,
  companyName: input.companyName,
  coreValues: input.brandValuesText ?? input.companyMotto ?? input.brandValues?.join(', '),
  tone: input.tone,
  colorMode: input.colorMode,
  paletteReplace: input.paletteReplace,
  ...colorFields(input.colors, input.paletteReplace === true),
  logoStyle: input.logoStyle,
  logoShape: input.logoShape,
  additionalRequirements: input.additionalRequirements,
})

const toBiProjectRequest = (input: ProjectInput) => ({
  industry: input.industry,
  brandName: input.brandName,
  valueCategory1: input.brandValues?.[0],
  valueCategory2: input.brandValues?.[1],
  valueCategory3: input.brandValues?.[2],
  brandDescription: input.brandValuesText ?? input.companyMotto,
  targetAge: input.targetAge,
  tone: input.tone,
  colorMode: input.colorMode,
  paletteReplace: input.paletteReplace,
  ...colorFields(input.colors, input.paletteReplace === true),
  logoStyle: input.logoStyle,
  logoShape: input.logoShape,
  additionalRequirements: input.additionalRequirements,
})

const normalizeCiProject = (project: BackendProjectResponse): ProjectResponse => ({
  id: project.id,
  brandType: 'CI',
  status: project.status,
  currentStep: project.currentStep,
  industry: project.industry ?? undefined,
  companyName: project.companyName ?? undefined,
  companyMotto: project.coreValues ?? undefined,
  brandValuesText: project.coreValues ?? undefined,
  tone: project.tone ?? undefined,
  colorMode: project.colorMode ?? undefined,
  colors: project.colors ?? undefined,
  logoStyle: project.logoStyle ?? undefined,
  logoShape: project.logoShape ?? undefined,
  additionalRequirements: project.additionalRequirements ?? undefined,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
})

const normalizeBiProject = (project: BackendProjectResponse): ProjectResponse => ({
  id: project.id,
  brandType: 'BI',
  status: project.status,
  currentStep: project.currentStep,
  industry: project.industry ?? undefined,
  brandName: project.brandName ?? undefined,
  brandValues: project.valueCategories ?? undefined,
  brandValuesText: project.brandDescription ?? undefined,
  companyMotto: project.brandDescription ?? undefined,
  targetAge: project.targetAge ?? undefined,
  tone: project.tone ?? undefined,
  colorMode: project.colorMode ?? undefined,
  colors: project.colors ?? undefined,
  logoStyle: project.logoStyle ?? undefined,
  logoShape: project.logoShape ?? undefined,
  additionalRequirements: project.additionalRequirements ?? undefined,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
})

const projectPath = (brandType: 'CI' | 'BI') => brandType === 'BI' ? 'bi-projects' : 'ci-projects'

const getProjectByType = async (projectId: string, brandType: 'CI' | 'BI') => {
  const response = await apiRequest<BackendProjectResponse>(`/${projectPath(brandType)}/${projectId}`)
  return brandType === 'BI' ? normalizeBiProject(response) : normalizeCiProject(response)
}

export const projectsApi = {
  create: async (input: ProjectInput) => {
    const brandType = input.brandType === 'BI' ? 'BI' : 'CI'
    const response = await apiRequest<BackendProjectResponse>(`/${projectPath(brandType)}`, {
      method: 'POST',
      body: JSON.stringify(brandType === 'BI' ? toBiProjectRequest(input) : toCiProjectRequest(input)),
    })
    return brandType === 'BI' ? normalizeBiProject(response) : normalizeCiProject(response)
  },
  get: async (projectId: string) => {
    try {
      return await getProjectByType(projectId, 'CI')
    } catch (error) {
      if (!(error instanceof AuthError) || error.status !== 404) throw error
      return getProjectByType(projectId, 'BI')
    }
  },
  patch: async (projectId: string, input: ProjectInput) => {
    const brandType = input.brandType === 'BI' ? 'BI' : 'CI'
    const response = await apiRequest<BackendProjectResponse>(`/${projectPath(brandType)}/${projectId}`, {
    method: 'PATCH',
      body: JSON.stringify(brandType === 'BI' ? toBiProjectRequest(input) : toCiProjectRequest(input)),
    })
    return brandType === 'BI' ? normalizeBiProject(response) : normalizeCiProject(response)
  },
  updateStep: async (projectId: string, step: 'brand-brief' | 'tone' | 'logo-style' | 'final-review', input: ProjectInput) => {
    const brandType = input.brandType === 'BI' ? 'BI' : 'CI'
    const response = await apiRequest<BackendProjectResponse>(`/${projectPath(brandType)}/${projectId}/${step}`, {
      method: 'PUT',
      body: JSON.stringify(brandType === 'BI' ? toBiProjectRequest(input) : toCiProjectRequest(input)),
    })
    return brandType === 'BI' ? normalizeBiProject(response) : normalizeCiProject(response)
  },
  discard: (projectId: string, brandType: 'CI' | 'BI') => apiRequest<void>(`/${projectPath(brandType)}/${projectId}`, {
    method: 'DELETE',
  }),
  createGeneration: (projectId: string, idempotencyKey: string) => apiRequest<LogoGeneration>(`/projects/${projectId}/logo-generations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  }),
  getGeneration: (projectId: string, generationId: string) => apiRequest<LogoGeneration>(`/projects/${projectId}/logo-generations/${generationId}`),
  getLatestCandidates: (projectId: string) => apiRequest<LogoCandidate[]>(`/projects/${projectId}/logo-candidates`),
  getCandidates: (projectId: string, generationId: string) => apiRequest<LogoCandidate[]>(`/projects/${projectId}/logo-generations/${generationId}/logo-candidates`),
  getCandidateSvg: (svgUrl: string) => apiTextRequest(svgUrl),
  saveCandidateSvg: (svgUrl: string, svg: string) => apiTextRequest(svgUrl, {
    method: 'PUT',
    body: JSON.stringify({ svg }),
  }),
  selectCandidate: (projectId: string, candidateId: string) => apiRequest<LogoCandidate>(`/projects/${projectId}/logo-candidates/${candidateId}/select`, {
    method: 'POST',
  }),
  pinCandidate: (projectId: string, candidateId: string) => apiRequest<PinnedLogo>(`/projects/${projectId}/logo-candidates/${candidateId}/pin`, {
    method: 'POST',
  }),
  unpinCandidate: (projectId: string, candidateId: string) => apiRequest<void>(`/projects/${projectId}/logo-candidates/${candidateId}/pin`, {
    method: 'DELETE',
  }),
  downloadCandidate: (projectId: string, candidateId: string) => apiRequest<DownloadRecord>(`/projects/${projectId}/logo-candidates/${candidateId}/download`, {
    method: 'POST',
  }),
  requestBrandKit: (projectId: string, candidateId: string, input?: BrandKitCreateInput) => apiRequest<BrandKit>(`/projects/${projectId}/logo-candidates/${candidateId}/brand-kits`, {
    method: 'POST',
    body: input ? JSON.stringify(input) : undefined,
  }),
  getLatestBrandKit: async (projectId: string, candidateId: string) => {
    const kits = await apiRequest<BrandKit[]>(`/projects/${projectId}/logo-candidates/${candidateId}/brand-kits`)
    return kits[0] ?? null
  },
  getBrandKit: (projectId: string, candidateId: string, brandKitId: string) => apiRequest<BrandKit>(
    `/projects/${projectId}/logo-candidates/${candidateId}/brand-kits/${brandKitId}`,
  ),
  downloadBrandKit: (projectId: string, candidateId: string, brandKitId: string) => downloadAuthenticatedFile(
    `/projects/${projectId}/logo-candidates/${candidateId}/brand-kits/${brandKitId}/download`,
  ),
  createAnalysis: (projectId: string) => apiRequest<TrademarkAnalysis>(`/projects/${projectId}/trademark-analyses`, {
    method: 'POST',
  }),
  getAnalysis: (projectId: string, analysisId: string) => apiRequest<TrademarkAnalysis>(`/projects/${projectId}/trademark-analyses/${analysisId}`),
  getMatches: (projectId: string, analysisId: string) => apiRequest<TrademarkMatch[]>(`/projects/${projectId}/trademark-analyses/${analysisId}/matches`),
}

export const meApi = {
  getCredits: () => apiRequest<{ balance: number }>('/me/credits'),
  getSurvey: () => apiRequest<SurveyStatus>('/me/survey'),
  submitSurvey: (input: SurveySubmitInput) => apiRequest<SurveyStatus>('/me/survey', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getPins: () => apiRequest<PinnedLogo[]>('/me/pins'),
  getBrandKits: () => apiRequest<BrandKit[]>('/me/brand-kits'),
  getDownloads: (type?: 'CI' | 'BI') => apiRequest<DownloadRecord[]>(`/me/downloads${type ? `?type=${type}` : ''}`),
}

export const adminApi = {
  login: (loginId: string, password: string) => apiRequest<AdminLoginResult>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, password }),
  }),
  dashboard: (token: string) => apiRequestWithToken<AdminDashboardStats>(token, '/admin/dashboard'),
  analytics: (token: string, period: 'daily' | 'weekly' | 'monthly' | 'custom', from?: string, to?: string) => {
    const params = new URLSearchParams({ period })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return apiRequestWithToken<AdminAnalyticsResponse>(token, `/admin/analytics?${params.toString()}`)
  },
  members: (token: string) => apiRequestWithToken<AdminMember[]>(token, '/admin/members'),
  admins: (token: string) => apiRequestWithToken<AdminAccount[]>(token, '/admin/admins'),
  generationRecords: (token: string, type: 'CI' | 'BI') => apiRequestWithToken<AdminLogoMemberRecord[]>(token, `/admin/generation-records?type=${type}`),
  surveyResponses: (token: string) => apiRequestWithToken<AdminSurveyResponse[]>(token, '/admin/survey-responses'),
  candidateImage: (token: string, candidateId: string) => downloadAuthenticatedFileWithToken(token, `/admin/candidates/${candidateId}/image`),
  memberDownloads: (token: string, memberId: number, type?: 'CI' | 'BI') => apiRequestWithToken<DownloadRecord[]>(token, `/admin/members/${memberId}/downloads${type ? `?type=${type}` : ''}`),
  downloadImage: (token: string, downloadId: number) => downloadAuthenticatedFileWithToken(token, `/admin/downloads/${downloadId}/image`),
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
