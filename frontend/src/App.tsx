import { FormEvent, lazy, PointerEvent, Suspense, useEffect, useRef, useState } from 'react'
import { AlarmClock, ArrowLeft, ArrowRight, BarChart3, Check, CircleCheck, CircleHelp, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, CloudCheck, Compass, Download, Droplets, FileCheck2, FolderCheck, Gift, GraduationCap, Heart, House, Image as ImageIcon, Info, Laptop, LoaderCircle, MessageSquare, Palette, PawPrint, Pencil, PenLine, Plus, RefreshCw, Search, Shapes, ShieldCheck, Shirt, Sparkle as LucideSparkle, Sparkles, ThumbsDown, ThumbsUp, Type as TypeIcon, UserRound, Utensils, Video, X, Clock3, type LucideIcon } from 'lucide-react'
import CopperplateHatch from './components/ui/CopperplateHatch'
import AnimatedGallery from './components/ui/AnimatedGallery'
import GenMarkLogo from './components/ui/GenMarkLogo'
import { AuthError, type AuthProvider, type AuthUser, loginWithProvider, logout, restoreSession } from './auth'
import { getLogoCandidateImageUrl, onboardingApi, projectsApi, type LogoCandidate, type TrademarkMatch, waitForLogoGeneration, waitForTrademarkAnalysis, type ProjectInput } from './lib/genmarkApi'

const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

type ViewMode = 'home' | 'hero' | 'onboarding' | 'industry' | 'brand-details' | 'company-details' | 'choice' | 'tone' | 'style' | 'final' | 'loading' | 'trademark-loading' | 'trademark-selection' | 'trademark-result' | 'result' | 'edit' | 'login' | 'mypage' | 'survey'
type LoginDestination = 'home' | 'industry' | 'choice'
type LoginReturnMode = 'hero' | 'home'
type OnboardingOption = 'online' | 'social' | 'offline'
type AudienceOption = 'company' | 'owner' | 'hobby' | 'sidejob'
type IndustryOption = 'beauty' | 'fashion' | 'food' | 'health' | 'tech' | 'education' | 'pet' | 'other'
type CoreValue = 'vegan' | 'crueltyFree' | 'lowIrritation' | 'derma' | 'cleanBeauty' | 'natural' | 'premium' | 'sustainable' | 'scientific' | 'reasonable' | 'emotional'
type ToneOption = 'friendly' | 'professional' | 'warm' | 'trendy' | 'minimal'
type RgbColor = { r: number; g: number; b: number }
type LogoStyle = 'symbol' | 'wordmark' | 'combination' | 'lettermark'

const categories = ['전체', '워드마크', '콤비네이션', '레터마크', '미니멀']

const toneOptions: Array<{ id: ToneOption; label: string; description: string; colors: [string, string] }> = [
  { id: 'friendly', label: '친근하고 다정한', description: '편안하고 부드러운 인상', colors: ['#f39bbd', '#b9d3f7'] },
  { id: 'professional', label: '전문적이고 신뢰감 있는', description: '정돈되고 믿음직한 인상', colors: ['#17185b', '#a45c72'] },
  { id: 'warm', label: '감성적이고 따뜻한', description: '섬세하고 따뜻한 인상', colors: ['#d29474', '#f2eadc'] },
  { id: 'trendy', label: '유니크하고 트렌디한', description: '개성 있고 감각적인 인상', colors: ['#171713', '#f2f2f4'] },
  { id: 'minimal', label: '미니멀하고 직관적인', description: '군더더기 없이 명확한 인상', colors: ['#396fc8', '#dde4ff'] },
]

const industryOptions: Array<{ id: IndustryOption; title: string; description: string; apiValue: string; icon: LucideIcon }> = [
  { id: 'beauty', title: '뷰티', description: '스킨케어 · 메이크업 · 향수', apiValue: 'COSMETICS', icon: Sparkles },
  { id: 'fashion', title: '패션', description: '의류 · 액세서리 · 슈즈', apiValue: 'FASHION', icon: Shirt },
  { id: 'food', title: '푸드 · 카페', description: '카페 · 베이커리 · 식품', apiValue: 'FOOD', icon: Utensils },
  { id: 'health', title: '헬스 · 웰니스', description: '피트니스 · 건강 · 요가', apiValue: 'HEALTH_WELLNESS', icon: Heart },
  { id: 'tech', title: '테크', description: 'IT · 앱 · 소프트웨어', apiValue: 'TECH', icon: Laptop },
  { id: 'education', title: '교육', description: '학원 · 강의 · 교육', apiValue: 'EDUCATION', icon: GraduationCap },
  { id: 'pet', title: '펫', description: '반려동물 용품 · 서비스', apiValue: 'PET', icon: PawPrint },
  { id: 'other', title: '기타', description: '그 외 업종', apiValue: 'OTHER', icon: Shapes },
]

const logoStyleOptions: Array<{ id: LogoStyle; label: string; description: string; fit: string; recommended?: boolean }> = [
  { id: 'symbol', label: '심볼마크', description: '그림이나 도형만으로 브랜드를 표현하는 로고', fit: '앱 아이콘, SNS 프로필과 제품 용기에 작게 사용할 때 좋아요.' },
  { id: 'wordmark', label: '워드마크', description: '브랜드 이름의 글씨체를 중심으로 만든 로고', fit: '새로운 브랜드 이름을 고객에게 명확하게 알리고 싶을 때 좋아요.' },
  { id: 'combination', label: '콤비네이션', description: '그림과 브랜드 이름을 함께 사용하는 로고', fit: '온라인과 오프라인에서 다양하게 사용하고 싶을 때 좋아요.', recommended: true },
  { id: 'lettermark', label: '레터마크', description: '브랜드 이름의 첫 글자나 이니셜을 활용한 로고', fit: '브랜드 이름이 길거나 간결한 이미지를 원할 때 좋아요.' },
]

const galleryItems = [
  { id: 'luna', name: 'LUNA', category: '미니멀', meta: '뷰티 · 워드마크', likes: '2.8k', position: '20% 72%', tone: 'luna' },
  { id: 'beau', name: 'BEAU', category: '워드마크', meta: '스킨케어 · 워드마크', likes: '1.9k', position: '72% 46%', tone: 'beau' },
  { id: 'sora', name: 'SORA', category: '콤비네이션', meta: '클린뷰티 · 워드마크', likes: '1.6k', position: '88% 72%', tone: 'sora' },
  { id: 'mori', name: 'MORI', category: '레터마크', meta: '바디케어 · 레터마크', likes: '1.2k', position: '52% 28%', tone: 'mori' },
]

const surveyImprovementOptions = ['로고 디자인', '글씨체', '색상 조합', '생성 속도', '수정 기능', '상표 이미지 분석', '결과 설명', '제품 썸네일', '기타']

const getModeFromUrl = (): ViewMode => {
  const requestedView = new URLSearchParams(window.location.search).get('view')
  if (requestedView === 'home') return 'home'
  if (requestedView === 'login') return 'login'
  if (requestedView === 'hero') return 'hero'
  if (requestedView === 'onboarding') return 'onboarding'
  if (requestedView === 'industry' || requestedView === 'industry-selection' || requestedView === 'domain') return 'industry'
  if (requestedView === 'brand-details' || requestedView === 'brand-info' || requestedView === 'values') return 'brand-details'
  if (requestedView === 'company-details' || requestedView === 'ci-details' || requestedView === 'corporate-details') return 'company-details'
  if (requestedView === 'choice' || requestedView === 'ci-bi' || requestedView === 'brand-type') return 'choice'
  if (requestedView === 'tone' || requestedView === 'tone-color' || requestedView === 'tone-and-color') return 'tone'
  if (requestedView === 'style' || requestedView === 'logo-style' || requestedView === 'logo-shape') return 'style'
  if (requestedView === 'final' || requestedView === 'details' || requestedView === 'request') return 'final'
  if (requestedView === 'loading' || requestedView === 'logo-loading' || requestedView === 'generating') return 'loading'
  if (requestedView === 'trademark-loading' || requestedView === 'trademark' || requestedView === 'trademark-analysis') return 'trademark-loading'
  if (requestedView === 'trademark-selection' || requestedView === 'trademark-choice' || requestedView === 'trademark-select') return 'trademark-selection'
  if (requestedView === 'trademark-result' || requestedView === 'trademark-analysis-result' || requestedView === 'similarity-result') return 'trademark-result'
  if (requestedView === 'result' || requestedView === 'logo-result' || requestedView === 'generated-logo') return 'result'
  if (requestedView === 'edit' || requestedView === 'logo-edit' || requestedView === 'logo-editor') return 'edit'
  if (requestedView === 'mypage' || requestedView === 'my-page' || requestedView === 'profile') return 'mypage'
  if (requestedView === 'survey' || requestedView === 'feedback' || requestedView === 'satisfaction') return 'survey'
  return 'hero'
}

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const rgbToHex = ({ r, g, b }: RgbColor) => `#${[r, g, b].map((channel) => clampColorChannel(channel).toString(16).padStart(2, '0')).join('')}`
const hexToRgb = (hex: string): RgbColor => {
  const normalized = hex.replace('#', '')
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) || 0,
    g: Number.parseInt(normalized.slice(2, 4), 16) || 0,
    b: Number.parseInt(normalized.slice(4, 6), 16) || 0,
  }
}

function Sparkle() {
  return <Sparkles aria-hidden="true" className="sparkle" size={18} strokeWidth={1.8} />
}

function ScreenBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="screen-back-button" type="button" aria-label={label} onClick={onClick}>
      <ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} />
    </button>
  )
}

type BrandFlowStep = 1 | 2 | 3 | 4

function BrandFlowProgress({ step }: { step: BrandFlowStep }) {
  return (
    <div className={`brand-flow-progress is-step-${step}`} aria-label={`브랜드 생성 4단계 중 ${step}단계`}>
      <span className="brand-flow-step-badge">{step} / 4</span>
      <div className="brand-flow-progress-track" aria-hidden="true">
        <span className="brand-flow-progress-line" />
        {[1, 2, 3, 4].map((node) => (
          <span key={node} className={`brand-flow-progress-node ${node < step ? 'complete' : node === step ? 'active' : ''}`}>
            {node < step ? <Check size={14} strokeWidth={2.5} /> : null}
          </span>
        ))}
      </div>
    </div>
  )
}

function BrandLogo({ className = '' }: { className?: string }) {
  return <GenMarkLogo className={className ? `brand-emblem ${className}` : 'brand-emblem'} />
}

function CustomerApp() {
  const [mode, setModeState] = useState<ViewMode>(getModeFromUrl)
  const [loggedIn, setLoggedIn] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authRestoring, setAuthRestoring] = useState(true)
  const [authError, setAuthError] = useState('')
  const [loginDestination, setLoginDestination] = useState<LoginDestination>('home')
  const [loginReturnMode, setLoginReturnMode] = useState<LoginReturnMode>('home')
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [onboardingSaving, setOnboardingSaving] = useState(false)
  const [onboardingError, setOnboardingError] = useState('')
  const [activeCategory, setActiveCategory] = useState('전체')
  const [likedIds, setLikedIds] = useState<string[]>([])
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1)
  const [onboardingTransition, setOnboardingTransition] = useState<'idle' | 'exit' | 'enter'>('idle')
  const onboardingTransitionTimer = useRef<number | null>(null)
  const [onboardingSelection, setOnboardingSelection] = useState<OnboardingOption[]>(['online'])
  const [audienceSelection, setAudienceSelection] = useState<AudienceOption[]>(['company'])
  const [industrySelection, setIndustrySelection] = useState<IndustryOption | null>(null)
  const [brandKind, setBrandKind] = useState<'ci' | 'bi' | null>(() => getModeFromUrl() === 'company-details' ? 'ci' : null)
  const [choiceBackMode, setChoiceBackMode] = useState<'home' | 'onboarding' | 'industry'>('home')
  const [industryBackMode, setIndustryBackMode] = useState<'home' | 'onboarding'>('home')
  const [additionalRequest, setAdditionalRequest] = useState('')
  const [brandName, setBrandName] = useState('')
  const [companyName, setCompanyName] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('genmark-company-profile') ?? '{}').name ?? ''
    } catch {
      return ''
    }
  })
  const [companyMotto, setCompanyMotto] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('genmark-company-profile') ?? '{}').motto ?? ''
    } catch {
      return ''
    }
  })
  const [coreValues, setCoreValues] = useState<CoreValue[]>([])
  const [coreValueInputMode, setCoreValueInputMode] = useState<'category' | 'direct'>('category')
  const [brandValueDescription, setBrandValueDescription] = useState('')
  const [toneSelection, setToneSelection] = useState<ToneOption>('friendly')
  const [manualColor, setManualColor] = useState<RgbColor>({ r: 151, g: 101, b: 233 })
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [logoStyle, setLogoStyle] = useState<LogoStyle>('combination')
  const [resultCandidate, setResultCandidate] = useState(0)
  const [resultLiked, setResultLiked] = useState(false)
  const [trademarkAnalysisSkipped, setTrademarkAnalysisSkipped] = useState(false)
  const [editTarget, setEditTarget] = useState<'symbol' | 'text'>('text')
  const [editorBrandName, setEditorBrandName] = useState('LUVÉRA')
  const [editorSymbol, setEditorSymbol] = useState(0)
  const [editorScale, setEditorScale] = useState(100)
  const [editorRotation, setEditorRotation] = useState(0)
  const [editorOpacity, setEditorOpacity] = useState(100)
  const [editorLetterSpacing, setEditorLetterSpacing] = useState(0)
  const [editorColor, setEditorColor] = useState('#7B5CDF')
  const [editorSaved, setEditorSaved] = useState(false)
  const [trademarkEntry, setTrademarkEntry] = useState<'generation' | 'result'>('generation')
  const [trademarkAnalysisCompleted, setTrademarkAnalysisCompleted] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(() => window.localStorage.getItem('genmark-project-id'))
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState('')
  const [generationLoading, setGenerationLoading] = useState(false)
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [logoCandidates, setLogoCandidates] = useState<LogoCandidate[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [trademarkMatches, setTrademarkMatches] = useState<TrademarkMatch[]>([])
  const [trademarkDisclaimer, setTrademarkDisclaimer] = useState('')
  const [trademarkSimilarity, setTrademarkSimilarity] = useState<number | null>(null)
  const [trademarkRiskLabel, setTrademarkRiskLabel] = useState('')
  const [trademarkRiskDescription, setTrademarkRiskDescription] = useState('')
  const [surveyRating, setSurveyRating] = useState(0)
  const [surveyImprovements, setSurveyImprovements] = useState<string[]>([])
  const [surveyComment, setSurveyComment] = useState('')
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [remainingCredits, setRemainingCredits] = useState(2)
  const [creditModal, setCreditModal] = useState<'credit' | 'survey' | null>(null)
  const [choiceInfoModal, setChoiceInfoModal] = useState<'ci' | 'bi' | null>(null)
  const [pendingDownload, setPendingDownload] = useState<{ name: string; subtitle: string; storageKey?: string } | null>(null)

  const setMode = (nextMode: ViewMode, options: { replace?: boolean } = {}) => {
    setModeState(nextMode)

    const url = new URL(window.location.href)
    const currentView = url.searchParams.get('view')
    if (currentView === nextMode) return

    url.searchParams.set('view', nextMode)
    const nextUrl = `${url.pathname}${url.search}${url.hash}`
    if (options.replace) {
      window.history.replaceState({ view: nextMode }, '', nextUrl)
    } else {
      window.history.pushState({ view: nextMode }, '', nextUrl)
    }
  }

  const canAnalyzeTrademark = logoStyle === 'combination' || logoStyle === 'symbol'

  useEffect(() => {
    const handlePopState = () => setModeState(getModeFromUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const session = await restoreSession()
        if (cancelled) return
        if (!session) {
          setAuthUser(null)
          setLoggedIn(false)
          return
        }

        setAuthUser(session.user)
        setLoggedIn(true)
        setOnboardingCompleted(session.user.onboardingCompleted)
        if (session.user.onboardingCompleted) window.localStorage.setItem('genmark-onboarding-completed', 'true')

        try {
          const onboarding = await onboardingApi.get()
          if (cancelled) return
          setOnboardingSelection(onboarding.usage.filter((value): value is OnboardingOption => value === 'online' || value === 'social' || value === 'offline'))
          if (onboarding.audience === 'company' || onboarding.audience === 'owner' || onboarding.audience === 'hobby' || onboarding.audience === 'sidejob') {
            setAudienceSelection([onboarding.audience])
          }
        } catch (error) {
          // A missing or temporarily unavailable onboarding record must not log out
          // an otherwise valid session restored from the refresh token.
          if (error instanceof AuthError && error.status === 401) {
            setAuthUser(null)
            setLoggedIn(false)
          }
        }

        if (cancelled) return
        if (session.resumeProjectId) {
          setProjectId(session.resumeProjectId)
          window.localStorage.setItem('genmark-project-id', session.resumeProjectId)
        } else {
          setProjectId(null)
          window.localStorage.removeItem('genmark-project-id')
        }
      } catch {
        if (!cancelled) {
          setAuthUser(null)
          setLoggedIn(false)
        }
      } finally {
        if (!cancelled) setAuthRestoring(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('view') !== 'setup') return

    url.searchParams.set('view', 'home')
    window.history.replaceState({ view: 'home' }, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('genmark-company-profile', JSON.stringify({ name: companyName, motto: companyMotto }))
  }, [companyName, companyMotto])

  useEffect(() => () => {
    if (onboardingTransitionTimer.current !== null) window.clearTimeout(onboardingTransitionTimer.current)
  }, [])

  useEffect(() => {
    if (!choiceInfoModal) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChoiceInfoModal(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [choiceInfoModal])

  const galleryRef = useRef<HTMLDivElement>(null)
  const galleryDragStartX = useRef(0)
  const galleryDragStartScrollLeft = useRef(0)
  const isDraggingGallery = useRef(false)

  const filteredItems = activeCategory === '전체'
    ? galleryItems
    : galleryItems.filter((item) => item.category === activeCategory)

  const toggleLike = (id: string) => {
    setLikedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const scrollGallery = (amount: number) => {
    galleryRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const handleGalleryPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const track = galleryRef.current
    if (!track || event.button !== 0) return

    isDraggingGallery.current = true
    galleryDragStartX.current = event.clientX
    galleryDragStartScrollLeft.current = track.scrollLeft
    track.setPointerCapture(event.pointerId)
    track.classList.add('is-dragging')
  }

  const handleGalleryPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const track = galleryRef.current
    if (!track || !isDraggingGallery.current) return

    event.preventDefault()
    track.scrollLeft = galleryDragStartScrollLeft.current - (event.clientX - galleryDragStartX.current)
  }

  const handleGalleryPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const track = galleryRef.current
    if (!track) return

    isDraggingGallery.current = false
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId)
    track.classList.remove('is-dragging')
  }

  const toggleSurveyImprovement = (item: string) => {
    setSurveyImprovements((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])
  }

  const completeLogin = async (provider: AuthProvider) => {
    if (authLoading) return
    setAuthLoading(true)
    setAuthError('')
    try {
      const session = await loginWithProvider(provider)
      setAuthUser(session.user)
      setLoggedIn(true)
      if (session.resumeProjectId) {
        setProjectId(session.resumeProjectId)
        window.localStorage.setItem('genmark-project-id', session.resumeProjectId)
      } else {
        setProjectId(null)
        window.localStorage.removeItem('genmark-project-id')
      }
      setOnboardingCompleted(session.user.onboardingCompleted)
      setOnboardingStep(1)
      setIndustryBackMode(session.user.onboardingCompleted ? 'home' : 'onboarding')
      setMode(session.user.onboardingCompleted ? loginDestination : 'onboarding')
      setLoginDestination('home')
    } catch (error) {
      const message = error instanceof AuthError
        ? `${error.message}${error.code ? ` (${error.code}${error.requestId ? `, requestId: ${error.requestId}` : ''})` : ''}`
        : error instanceof Error
          ? error.message
          : '로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      setAuthError(message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setAuthUser(null)
    setLoggedIn(false)
    setMode('login')
  }

  const startOnboarding = () => {
    if (!loggedIn) {
      setLoginDestination('industry')
      setLoginReturnMode('home')
      setMode('login')
      return
    }

    setOnboardingStep(1)
    if (onboardingCompleted) {
      setIndustryBackMode('home')
      setMode('industry')
    } else {
      setMode('onboarding')
    }
  }

  const completeOnboarding = async () => {
    if (onboardingSaving) return
    if (onboardingSelection.length === 0) {
      setOnboardingError('사용처를 하나 이상 선택해주세요.')
      return
    }
    const audience = audienceSelection[0]
    if (!audience) {
      setOnboardingError('방문 목적을 선택해주세요.')
      return
    }

    setOnboardingSaving(true)
    setOnboardingError('')
    try {
      await onboardingApi.complete({
        usage: onboardingSelection,
        audience,
        // The project type and detailed project fields are collected after this
        // onboarding gate, so this first completion intentionally skips them.
        detailsDecision: 'SKIPPED',
      })
      setOnboardingCompleted(true)
      window.localStorage.setItem('genmark-onboarding-completed', 'true')
      setIndustryBackMode('onboarding')
      setMode('industry')
    } catch (error) {
      const message = error instanceof AuthError ? error.message : '온보딩 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요.'
      setOnboardingError(message)
    } finally {
      setOnboardingSaving(false)
    }
  }

  const transitionToOnboardingStep = (nextStep: 1 | 2) => {
    if (onboardingTransition !== 'idle' || nextStep === onboardingStep) return

    setOnboardingTransition('exit')
    onboardingTransitionTimer.current = window.setTimeout(() => {
      setOnboardingStep(nextStep)
      setOnboardingTransition('enter')
      onboardingTransitionTimer.current = window.setTimeout(() => {
        setOnboardingTransition('idle')
        onboardingTransitionTimer.current = null
      }, 920)
    }, 340)
  }

  const advanceOnboarding = () => {
    if (onboardingStep === 1) {
      transitionToOnboardingStep(2)
      return
    }

    void completeOnboarding()
  }

  const advanceIndustrySelection = () => {
    if (!industrySelection) return
    setChoiceBackMode('industry')
    setMode('choice')
  }

  const openTrademarkSelection = (entry: 'generation' | 'result') => {
    setTrademarkAnalysisCompleted(false)
    if (!canAnalyzeTrademark) {
      setTrademarkAnalysisSkipped(true)
      setMode(entry === 'result' ? 'result' : 'loading')
      return
    }

    setTrademarkAnalysisSkipped(false)
    setTrademarkEntry(entry)
    setMode('trademark-selection')
  }

  const toggleOnboardingSelection = (option: OnboardingOption) => {
    setOnboardingSelection((current) => current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option])
  }

  const toggleAudienceSelection = (option: AudienceOption) => {
    setAudienceSelection([option])
  }

  const toggleCoreValue = (value: CoreValue) => {
    setCoreValues((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : current.length < 3 ? [...current, value] : current)
  }

  const updateManualColor = (channel: keyof RgbColor, value: string) => {
    const nextValue = value === '' ? 0 : Number(value)
    setManualColor((current) => ({
      ...current,
      [channel]: clampColorChannel(Number.isFinite(nextValue) ? nextValue : 0),
    }))
  }

  const updateManualColorFromHex = (hex: string) => {
    setManualColor(hexToRgb(hex))
  }

  const buildProjectInput = (): ProjectInput => ({
    brandType: brandKind === 'ci' ? 'CI' : 'BI',
    industry: industryOptions.find((option) => option.id === industrySelection)?.apiValue ?? 'COSMETICS',
    brandName: brandName.trim() || undefined,
    companyName: companyName.trim() || undefined,
    companyMotto: companyMotto.trim() || undefined,
    brandValues: coreValueInputMode === 'category' ? coreValues : undefined,
    brandValuesText: coreValueInputMode === 'direct' ? brandValueDescription.trim() || undefined : undefined,
    tone: toneSelection,
    colorMode: 'MANUAL',
    colors: [rgbToHex(manualColor)],
    logoStyle,
    includeBrandName: true,
    additionalRequirements: additionalRequest.trim() || undefined,
  })

  const ensureProject = async (step: 'brand-brief' | 'tone' | 'logo-style' | 'final-review' = 'final-review') => {
    const input = buildProjectInput()
    if (projectId) {
      try {
        await projectsApi.updateStep(projectId, step, input)
        return projectId
      } catch (error) {
        if (!(error instanceof AuthError) || error.status !== 404) throw error
        setProjectId(null)
        window.localStorage.removeItem('genmark-project-id')
      }
    }

    const project = await projectsApi.create(input)
    setProjectId(project.id)
    window.localStorage.setItem('genmark-project-id', project.id)
    return project.id
  }

  const saveProjectStep = async (step: 'brand-brief' | 'tone' | 'logo-style', nextMode: ViewMode) => {
    if (projectSaving) return
    setProjectSaving(true)
    setProjectError('')
    try {
      await ensureProject(step)
      setMode(nextMode)
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : '프로젝트 정보를 저장하지 못했어요.')
    } finally {
      setProjectSaving(false)
    }
  }

  const saveEditorChanges = async () => {
    if (!projectId) {
      setEditorSaved(true)
      return
    }
    try {
      await projectsApi.patch(projectId, { brandName: editorBrandName, colors: [editorColor] })
      setEditorSaved(true)
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : '편집 내용을 저장하지 못했어요.')
    }
  }

  const startLogoGeneration = async () => {
    if (generationLoading) return
    setGenerationLoading(true)
    setGenerationError('')
    setMode('loading')
    try {
      const nextProjectId = await ensureProject('final-review')
      const generation = await projectsApi.createGeneration(nextProjectId, crypto.randomUUID())
      setGenerationId(generation.id)
      const completedGeneration = await waitForLogoGeneration(nextProjectId, generation.id)
      if (completedGeneration.status === 'FAILED') {
        throw new Error(completedGeneration.errorMessage ?? '로고 생성에 실패했어요.')
      }

      const candidates = await projectsApi.getCandidates(nextProjectId, generation.id)
      if (candidates.length !== 4) throw new Error('로고 후보를 4개 불러오지 못했어요.')
      setLogoCandidates(candidates)
      const selected = candidates.findIndex((candidate) => candidate.selected)
      setResultCandidate(selected >= 0 ? selected : 0)
      setSelectedCandidateId(selected >= 0 ? candidates[selected].id : null)
      setMode('result')
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '로고 생성 중 문제가 발생했어요.')
    } finally {
      setGenerationLoading(false)
    }
  }

  const selectLogoCandidate = async (candidate: LogoCandidate, index: number) => {
    if (!projectId) return
    setResultCandidate(index)
    try {
      const selected = await projectsApi.selectCandidate(projectId, candidate.id)
      setSelectedCandidateId(selected.id)
      setLogoCandidates((current) => current.map((item) => ({ ...item, selected: item.id === selected.id })))
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '로고 후보를 선택하지 못했어요.')
    }
  }

  const startTrademarkAnalysis = async () => {
    if (!projectId || trademarkAnalysisCompleted) return
    const candidate = logoCandidates[resultCandidate]
    if (!candidate) {
      setAnalysisError('먼저 로고 후보를 생성해주세요.')
      return
    }

    setAnalysisError('')
    setMode('trademark-loading')
    try {
      await projectsApi.selectCandidate(projectId, candidate.id)
      setSelectedCandidateId(candidate.id)
      const analysis = await projectsApi.createAnalysis(projectId)
      setAnalysisId(analysis.id)
      const completedAnalysis = await waitForTrademarkAnalysis(projectId, analysis.id)
      if (completedAnalysis.status === 'FAILED') {
        throw new Error(completedAnalysis.errorMessage ?? '상표 분석에 실패했어요.')
      }
      const matches = await projectsApi.getMatches(projectId, analysis.id)
      setTrademarkMatches(matches)
      setTrademarkSimilarity(completedAnalysis.maxSimilarity)
      setTrademarkRiskLabel(completedAnalysis.riskLabel ?? '')
      setTrademarkRiskDescription(completedAnalysis.riskDescription ?? '')
      setTrademarkDisclaimer(completedAnalysis.disclaimer ?? '')
      setTrademarkAnalysisCompleted(true)
      setMode('trademark-result')
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : '상표 분석 중 문제가 발생했어요.')
      setMode('result')
    }
  }

  const downloadLogo = (candidate: { name: string; subtitle?: string; storageKey?: string }) => {
    if (!candidate.storageKey) return

    const downloadUrl = getLogoCandidateImageUrl(candidate.storageKey)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `${candidate.name.toLowerCase()}-logo.png`
    link.click()
  }

  const requestLogoDownload = (candidate: { name: string; subtitle: string; storageKey?: string }) => {
    setPendingDownload(candidate)
    setCreditModal('credit')
  }

  const downloadWithCredit = () => {
    if (!pendingDownload || remainingCredits < 1) return
    setRemainingCredits((current) => current - 1)
    downloadLogo(pendingDownload)
    setPendingDownload(null)
    setCreditModal(null)
  }

  const submitCreditSurvey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRemainingCredits((current) => current + 1)
    setSurveySubmitted(true)
    setCreditModal(null)
  }

  const onboardingOptions: Array<{
    id: OnboardingOption
    eyebrow: string
    title: string
    description: string
  }> = [
    { id: 'online', eyebrow: '온라인 판매', title: '온라인 쇼핑몰', description: '상품 썸네일과 스토어 프로필에 사용할 예정이에요.' },
    { id: 'social', eyebrow: 'SNS', title: '인스타그램 · SNS', description: '프로필, 게시물과 홍보 이미지에 사용할 예정이에요.' },
    { id: 'offline', eyebrow: '오프라인', title: '매장 · 명함 · 인쇄물', description: '간판이나 명함 등 오프라인에서도 사용할 예정이에요.' },
  ]

  const audienceOptions: Array<{
    id: AudienceOption
    eyebrow: string
    title: string
    description: string
  }> = [
    { id: 'company', eyebrow: '회사 / 팀', title: '회사 / 팀', description: '법인 · 팀 프로젝트' },
    { id: 'owner', eyebrow: '자영업', title: '자영업', description: '개인 사업 · 가게' },
    { id: 'hobby', eyebrow: '취미 / 창작', title: '취미 / 창작', description: '개인 활동 · 포트폴리오' },
    { id: 'sidejob', eyebrow: '부업 & 투잡', title: '부업 & 투잡', description: 'N잡 · 사이드 프로젝트' },
  ]

  const renderOnboardingScreen = () => (
    <main className={`onboarding-screen onboarding-step-${onboardingStep}${onboardingTransition === 'idle' ? '' : ` onboarding-transition-${onboardingTransition}`}`}>
      <div className="onboarding-transition-wash" aria-hidden="true" />
      {onboardingStep === 2 && <ScreenBackButton label="온보딩 1단계로 돌아가기" onClick={() => transitionToOnboardingStep(1)} />}
      <div className="onboarding-overlay" />
      <section className="onboarding-content" aria-labelledby="onboarding-title">
        <div className="onboarding-intro">
          <div className="onboarding-brand"><span>GenMark</span></div>
          <div className="onboarding-step"><span>{onboardingStep} / 2</span></div>
          {onboardingStep === 1 ? (
            <h1 id="onboarding-title">로고를 어디에<br /><strong>사용할 예정인가요?</strong></h1>
          ) : (
            <h1 id="onboarding-title">어떤 계기로<br /><strong>방문하게 되셨나요?</strong></h1>
          )}
        </div>
        <div className="onboarding-interaction">
          <p className="onboarding-selection-hint">{onboardingStep === 1 ? '복수 선택 가능' : '하나만 선택 가능'}</p>
          <div className="onboarding-options">
            {onboardingStep === 1 ? onboardingOptions.map((option) => {
              const selected = onboardingSelection.includes(option.id)
              return (
                <button key={option.id} type="button" className={selected ? 'onboarding-option selected' : 'onboarding-option'} onClick={() => toggleOnboardingSelection(option.id)} aria-pressed={selected}>
                  <span className="onboarding-option-copy">
                    <small>{option.eyebrow}</small>
                    <strong>{option.title}</strong>
                    <span>{option.description}</span>
                  </span>
                  <span className="onboarding-radio" aria-hidden="true">{selected && <Check size={24} strokeWidth={2.5} />}</span>
                </button>
              )
            }) : audienceOptions.map((option) => {
              const selected = audienceSelection.includes(option.id)
              return (
                <button key={option.id} type="button" className={selected ? 'onboarding-option selected' : 'onboarding-option'} onClick={() => toggleAudienceSelection(option.id)} aria-pressed={selected}>
                  <span className="onboarding-option-copy">
                    <small>{option.eyebrow}</small>
                    <strong>{option.title}</strong>
                    <span>{option.description}</span>
                  </span>
                  <span className="onboarding-radio" aria-hidden="true">{selected && <Check size={24} strokeWidth={2.5} />}</span>
                </button>
              )
            })}
          </div>
          {onboardingError && <p className="onboarding-error" role="alert">{onboardingError}</p>}
          <button className="onboarding-next" type="button" onClick={advanceOnboarding}>
            {onboardingSaving ? '저장 중...' : onboardingStep === 1 ? '다음' : '시작하기'}
          </button>
        </div>
      </section>
    </main>
  )

  const renderIndustrySelectionScreen = () => (
    <main className="industry-selection-screen" aria-labelledby="industry-selection-title">
      <ScreenBackButton
        label="이전 화면으로 돌아가기"
        onClick={() => industryBackMode === 'onboarding' ? (setOnboardingStep(2), setMode('onboarding')) : setMode('home')}
      />
      <section className="industry-selection-content">
        <header className="industry-selection-heading">
          <h1 id="industry-selection-title">어떤 업종의<br /><strong>브랜드인가요?</strong></h1>
          <p>업종에 맞춰 로고의 분위기와 방향을 잡아드려요.</p>
        </header>

        <div className="industry-options" role="group" aria-label="업종 선택">
          {industryOptions.map((option) => {
            const selected = industrySelection === option.id
            const Icon = option.icon
            return (
              <button
                key={option.id}
                type="button"
                className={selected ? 'industry-option selected' : 'industry-option'}
                aria-pressed={selected}
                onClick={() => setIndustrySelection((current) => current === option.id ? null : option.id)}
              >
                <span className="industry-option-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.8} /></span>
                <span className="industry-option-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="industry-option-check" aria-hidden="true">{selected && <Check size={16} strokeWidth={2.4} />}</span>
              </button>
            )
          })}
        </div>

        <button className="industry-next" type="button" onClick={advanceIndustrySelection} disabled={!industrySelection}>
          다음 <ChevronRight aria-hidden="true" size={22} strokeWidth={1.8} />
        </button>
      </section>
    </main>
  )

  const renderBrandDetailsScreen = () => {
    const coreValueOptions: Array<{ id: CoreValue; label: string }> = [
      { id: 'vegan', label: '비건' },
      { id: 'crueltyFree', label: '크루얼티프리' },
      { id: 'lowIrritation', label: '저자극' },
      { id: 'derma', label: '더마' },
      { id: 'cleanBeauty', label: '클린뷰티' },
      { id: 'natural', label: '자연주의' },
      { id: 'premium', label: '프리미엄' },
      { id: 'sustainable', label: '지속가능성' },
      { id: 'scientific', label: '과학적 검증' },
      { id: 'reasonable', label: '합리적인 가격' },
      { id: 'emotional', label: '감성적인 경험' },
    ]

    return (
      <main className="brand-details-screen">
        <ScreenBackButton label="CI·BI 선택 화면으로 돌아가기" onClick={() => setMode('choice')} />
        <section className="brand-details-content" aria-labelledby="brand-details-title">
          <BrandFlowProgress step={1} />

          <header className="brand-details-heading">
            <h1 id="brand-details-title">어떤 화장품 브랜드를 만들고 있나요?</h1>
            <p>제품 특징과 고객이 느꼈으면 하는 이미지를 알려주세요.</p>
          </header>

          <section className="brand-details-section brand-name-section" aria-labelledby="brand-name-title">
            <h2 id="brand-name-title">상호명</h2>
            <div className="brand-details-input-wrap">
              <input
                aria-label="상호명"
                maxLength={80}
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                placeholder="예: 루아 코스메틱"
              />
              <span>{brandName.length} / 80</span>
            </div>
          </section>

          <section className="brand-details-section core-values-section" aria-labelledby="core-values-title">
            <div className="core-values-heading">
              <h2 id="core-values-title">브랜드가 추구하는 가치 <small>(최대 3개 선택)</small></h2>
              <div className="core-values-mode-toggle" role="tablist" aria-label="가치 입력 방식">
                <button className={coreValueInputMode === 'category' ? 'active' : ''} type="button" role="tab" aria-selected={coreValueInputMode === 'category'} onClick={() => setCoreValueInputMode('category')}>카테고리</button>
                <button className={coreValueInputMode === 'direct' ? 'active' : ''} type="button" role="tab" aria-selected={coreValueInputMode === 'direct'} onClick={() => setCoreValueInputMode('direct')}>직접입력</button>
              </div>
            </div>
            {coreValueInputMode === 'category' ? (
              <>
                <div className="core-values-grid">
                  {coreValueOptions.map((option) => {
                    const selected = coreValues.includes(option.id)
                    return (
                      <button key={option.id} type="button" className={selected ? 'core-value-button selected' : 'core-value-button'} aria-pressed={selected} onClick={() => toggleCoreValue(option.id)}>
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="core-values-note"><span aria-hidden="true">ⓘ</span>3개까지 선택할 수 있어요. 선택하지 않아도 다음 단계로 진행할 수 있어요.</p>
              </>
            ) : (
              <div className="core-values-custom-input">
                <textarea
                  aria-label="브랜드가 추구하는 가치 직접 입력"
                  value={brandValueDescription}
                  onChange={(event) => setBrandValueDescription(event.target.value)}
                  placeholder="고객에게 어떤 브랜드로 기억되고 싶은지 작성해주세요. (예: 친근한, 전문적인, 혁신적인)"
                />
              </div>
            )}
          </section>

          <button className="brand-details-next" type="button" onClick={() => void saveProjectStep('brand-brief', 'tone')} disabled={projectSaving}>
            {projectSaving ? '저장 중...' : '다음'} <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} />
          </button>
          {projectError && <p className="project-error" role="alert">{projectError}</p>}
        </section>
      </main>
    )
  }

  const renderCompanyDetailsScreen = () => {
    const handleCompanyDetailsNext = () => {
      void saveProjectStep('brand-brief', 'tone')
    }

    return (
      <main className="brand-details-screen company-details-screen">
      <ScreenBackButton
        label="이전 화면으로 돌아가기"
        onClick={() => setMode('choice')}
      />
      <section className="brand-details-content" aria-labelledby="company-details-title">
        <BrandFlowProgress step={1} />

        <header className="brand-details-heading">
          <h1 id="company-details-title">어떤 기업을 만들고 있나요?</h1>
          <p>기업의 방향과 고객에게 전하고 싶은 이미지를 알려주세요.</p>
        </header>

        <section className="brand-details-section brand-name-section" aria-labelledby="company-name-title">
          <h2 id="company-name-title">기업명</h2>
          <div className="brand-details-input-wrap">
            <input
              aria-label="기업명"
              maxLength={80}
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="예: 그로우랩"
            />
            <span>{companyName.length} / 80</span>
          </div>
        </section>

        <section className="brand-details-section core-values-section company-motto-section" aria-labelledby="company-motto-title">
          <div className="core-values-heading company-motto-heading">
            <h2 id="company-motto-title">기업의 모토</h2>
          </div>
          <div className="core-values-custom-input">
            <textarea
              aria-label="기업의 모토 직접 입력"
              maxLength={300}
              value={companyMotto}
              onChange={(event) => setCompanyMotto(event.target.value)}
              placeholder="기업의 미션, 비전, 또는 모토를 입력해주세요."
            />
            <span className="company-motto-count">{companyMotto.length} / 300</span>
          </div>
        </section>

        <button className="brand-details-next" type="button" onClick={handleCompanyDetailsNext} disabled={projectSaving}>
          {projectSaving ? '저장 중...' : '다음'} <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} />
        </button>
        {projectError && <p className="project-error" role="alert">{projectError}</p>}
      </section>
      </main>
    )
  }

  const renderToneSelectionScreen = () => (
    <main className="tone-selection-screen">
      <ScreenBackButton label="이전 화면으로 돌아가기" onClick={() => setMode(brandKind === 'ci' ? 'company-details' : 'brand-details')} />
      <section className="tone-selection-content" aria-labelledby="tone-selection-title">
        <BrandFlowProgress step={2} />

        <header className="tone-selection-heading">
          <h1 id="tone-selection-title">톤앤매너와<br />색상을 골라주세요</h1>
          <p>톤 선택 시 어울리는 색상이 자동으로 적용돼요</p>
        </header>

        <section className="tone-options" aria-label="톤앤매너 선택">
          {toneOptions.map((tone) => {
            const selected = toneSelection === tone.id
            return (
              <button
                key={tone.id}
                type="button"
                className={selected ? 'tone-option selected' : 'tone-option'}
                aria-pressed={selected}
                onClick={() => setToneSelection(tone.id)}
              >
                <span className="tone-swatches" aria-hidden="true">
                  <i style={{ background: tone.colors[0] }} />
                  <i style={{ background: tone.colors[1] }} />
                </span>
                <span className="tone-option-copy">
                  <strong>{tone.label}</strong>
                  <small>{tone.description}</small>
                </span>
                <span className="tone-radio" aria-hidden="true">{selected && <Check size={21} strokeWidth={2.5} />}</span>
              </button>
            )
          })}
        </section>

        <section className="tone-color-card tone-direct-card" aria-label="직접 색상 지정">
          <span className="tone-color-sparkles" aria-hidden="true"><Sparkles size={32} strokeWidth={1.6} /></span>
          <div>
            <h2>직접 색상 지정</h2>
            <p>원하는 색상을 직접 지정할 수 있어요</p>
          </div>
          <button
            className="tone-auto-chip tone-picker-trigger"
            type="button"
            aria-expanded={colorPickerOpen}
            aria-controls="tone-color-picker"
            onClick={() => setColorPickerOpen((current) => !current)}
          >
            <span className="tone-picker-swatch" style={{ background: rgbToHex(manualColor) }} aria-hidden="true" />
            직접
          </button>

          {colorPickerOpen && (
            <div className="tone-color-picker" id="tone-color-picker" role="dialog" aria-label="RGB 색상 선택">
              <div className="tone-color-picker-heading">
                <strong>원하는 색상 선택</strong>
                <button type="button" aria-label="색상 팔레트 닫기" onClick={() => setColorPickerOpen(false)}>×</button>
              </div>
              <label className="tone-color-palette">
                <span className="tone-color-palette-preview" style={{ background: rgbToHex(manualColor) }} />
                <input
                  aria-label="색상 팔레트"
                  type="color"
                  value={rgbToHex(manualColor)}
                  onChange={(event) => updateManualColorFromHex(event.target.value)}
                />
              </label>
              <div className="tone-rgb-fields" aria-label="RGB 값 입력">
                {(['r', 'g', 'b'] as const).map((channel) => (
                  <label key={channel}>
                    <span>{channel.toUpperCase()}</span>
                    <input
                      aria-label={`${channel.toUpperCase()} 값`}
                      type="number"
                      min="0"
                      max="255"
                      value={manualColor[channel]}
                      onChange={(event) => updateManualColor(channel, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="tone-color-picker-footer">
                <span>RGB({manualColor.r}, {manualColor.g}, {manualColor.b})</span>
                <button type="button" onClick={() => setColorPickerOpen(false)}>선택 완료</button>
              </div>
            </div>
          )}
        </section>

        <button className="tone-next" type="button" onClick={() => void saveProjectStep('tone', 'style')} disabled={projectSaving}>
          {projectSaving ? '저장 중...' : '다음'} <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} />
        </button>
        {projectError && <p className="project-error" role="alert">{projectError}</p>}
      </section>
    </main>
  )

  const renderStyleSelectionScreen = () => (
    <main className="logo-style-screen">
      <ScreenBackButton label="톤앤매너 선택 화면으로 돌아가기" onClick={() => setMode('tone')} />
      <section className="logo-style-content" aria-labelledby="logo-style-title">
        <BrandFlowProgress step={3} />

        <header className="logo-style-heading">
          <h1 id="logo-style-title">어떤 형태의 로고가<br />필요한가요?</h1>
          <p>잘 모르겠다면 활용도가 높은 <strong>‘심볼+이름’</strong>을 추천해요.</p>
        </header>

        <section className="logo-style-options" aria-label="로고 형태 선택">
          {logoStyleOptions.map((option) => {
            const selected = logoStyle === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={selected ? 'logo-style-option selected' : 'logo-style-option'}
                aria-pressed={selected}
                onClick={() => setLogoStyle(option.id)}
              >
                <span className={`logo-style-preview ${option.id}`} aria-hidden="true">
                  {option.id === 'symbol' && <span className="style-symbol-mark">✦</span>}
                  {option.id === 'wordmark' && <span className="style-wordmark-text">LUNÉE</span>}
                  {option.id === 'combination' && <><span className="style-combination-mark">◈</span><span className="style-combination-text">LUNÉE</span></>}
                  {option.id === 'lettermark' && <span className="style-lettermark-text">LN</span>}
                </span>
                <span className="logo-style-copy">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                  <span className="logo-style-fit"><em>적합한 경우</em>{option.fit}</span>
                  {option.recommended && <small className="logo-style-recommend"><Sparkle /> 처음 만드는 브랜드에 추천</small>}
                </span>
                <span className="logo-style-radio" aria-hidden="true">{selected && <Check size={22} strokeWidth={2.5} />}</span>
              </button>
            )
          })}
        </section>

        <button className="logo-style-next" type="button" onClick={() => void saveProjectStep('logo-style', 'final')} disabled={projectSaving}>
          {projectSaving ? '저장 중...' : '다음'} <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} />
        </button>
        {projectError && <p className="project-error" role="alert">{projectError}</p>}
      </section>
    </main>
  )

  const renderFeaturedHero = () => (
    <section className="featured-hero" aria-labelledby="featured-title">
      <img className="featured-art" src="/aurora-bubbles.png" alt="핑크와 보라색의 투명한 구체가 겹쳐진 스킨케어 이미지" />
      <div className="featured-scrim" />
      <div className="featured-lockup">
        <h1 id="featured-title">LUMIÈRE</h1>
        <p className="featured-subtitle">RADIANT SKINCARE</p>
        <span className="featured-rule" />
        <p className="featured-korean">빛나는 피부의 시작</p>
        <span className="featured-tag">럭셔리 스킨케어</span>
      </div>
      <div className="featured-dots" aria-label="대표 큐레이션 진행 상태">
        <span className="active" /><span /><span /><span />
      </div>
      <div className="hero-create-bar">
        <div>
          <strong>5분 만에 완성하는</strong>
          <span>프리미엄 브랜드 로고</span>
        </div>
        <button className="gradient-button hero-create-button" type="button" onClick={startOnboarding}>
          <Sparkle /> 로고 생성 시작
        </button>
      </div>
    </section>
  )

  const renderHeroScreen = () => (
    <main className="hero-screen">
      <header className="hero-screen-header">
        <div className="hero-screen-brand"><BrandLogo className="hero-screen-mark" /><span>GenMark AI</span></div>
        <button type="button" className="hero-screen-login" onClick={() => { setLoginDestination('home'); setLoginReturnMode('hero'); setMode('login') }}>로그인</button>
      </header>
      <section className="hero-screen-panel" aria-labelledby="hero-screen-title">
        <CopperplateHatch className="hero-screen-art" density={1.1} intensity={1.1} speed={0.42} interactive />
        <div className="hero-screen-overlay" />
        <div className="hero-screen-copy">
          <p className="hero-screen-eyebrow hero-copy-reveal hero-copy-reveal-eyebrow"><Sparkle /> Brand starter</p>
          <h1 id="hero-screen-title">
            <span className="hero-title-line hero-title-line-1">로고를 만들고</span>
            <span className="hero-title-line hero-title-line-2"><strong>비슷한 상표가 있는지도</strong></span>
            <span className="hero-title-line hero-title-line-3">확인하세요</span>
          </h1>
          <p className="hero-screen-description hero-copy-reveal hero-copy-reveal-description">브랜드 정보를 입력하면 AI 로고 후보를 만들고,<br />기존 상표 표본 이미지와 비교해 안전성도 확인해드려요.</p>
          <button className="hero-screen-cta hero-copy-reveal hero-copy-reveal-cta" type="button" onClick={() => setMode('home')}><Sparkle /> <span>서비스 시작하기</span></button>
          <p className="hero-screen-note hero-copy-reveal hero-copy-reveal-note">◇ 디자인 경험이 없어도 괜찮아요&nbsp;&nbsp;·&nbsp;&nbsp;약 5분이면 시작할 수 있어요</p>
        </div>
      </section>
    </main>
  )

  const renderAnimatedGalleryHeroScreen = () => (
    <main className="gallery-hero-screen">
      <AnimatedGallery>
        <header className="gallery-hero-header">
          <div className="gallery-hero-brand">
            <BrandLogo className="gallery-hero-mark" />
            <span>GenMark AI</span>
          </div>
          <button
            type="button"
            className="gallery-hero-login"
            disabled={authRestoring}
            onClick={() => {
              if (loggedIn) {
                void handleLogout()
                return
              }
              setLoginDestination('home')
              setLoginReturnMode('hero')
              setMode('login')
            }}
          >
            {authRestoring ? '확인 중…' : loggedIn ? '로그아웃' : '로그인'}
          </button>
        </header>

        <div className="gallery-hero-copy">
          <p className="gallery-hero-eyebrow hero-copy-reveal hero-copy-reveal-eyebrow"><Sparkles aria-hidden="true" size={16} strokeWidth={1.8} /> Brand starter</p>
          <h1 id="hero-screen-title">
            <span className="hero-title-line hero-title-line-1">로고를 만들고</span>
            <span className="hero-title-line hero-title-line-2"><strong>비슷한 상표가 있는지도</strong></span>
            <span className="hero-title-line hero-title-line-3">확인하세요</span>
          </h1>
          <p className="gallery-hero-description hero-copy-reveal hero-copy-reveal-description">브랜드 정보를 입력하면 AI 로고 후보를 만들고,<br />기존 상표 표본 이미지와 비교해 안전성도 확인해드려요.</p>
          <div className="gallery-hero-actions hero-copy-reveal hero-copy-reveal-cta">
            <button className="gallery-hero-cta" type="button" onClick={() => setMode('home')}><span>서비스 시작하기</span><Video aria-hidden="true" size={15} strokeWidth={2} /></button>
          </div>
          <p className="gallery-hero-note hero-copy-reveal hero-copy-reveal-note">◇ 디자인 경험이 없어도 괜찮아요&nbsp;&nbsp;·&nbsp;&nbsp;약 5분이면 시작할 수 있어요</p>
        </div>
      </AnimatedGallery>
    </main>
  )

  const renderChoiceScreen = () => {
    const chooseBrandKind = (kind: 'ci' | 'bi') => {
      setBrandKind(kind)
      setMode(kind === 'ci' ? 'company-details' : 'brand-details')
    }

    const choiceDetails = {
      ci: {
        label: '회사 · 기업 로고',
        title: 'CI란?',
        summary: '회사나 매장 전체를 대표하는 로고예요.',
        recommendations: ['회사명을 로고로 만들고 싶어요', '여러 제품을 하나의 회사 브랜드로 운영할 예정이에요', '명함이나 회사 소개 자료에도 사용할 예정이에요'],
        result: '기업 로고 · 대표 컬러 · 추천 글씨체 · 명함 시안',
      },
      bi: {
        label: '제품 · 브랜드 로고',
        title: 'BI란?',
        summary: '특정 화장품 브랜드나 제품 라인을 대표하는 로고예요.',
        recommendations: ['새로운 화장품 브랜드를 출시하려고 해요', '기존 회사에서 새로운 제품 라인을 만들고 있어요', '스마트스토어 제품 썸네일에 사용할 로고가 필요해요'],
        result: '제품 브랜드 로고 · 대표 컬러 · 추천 글씨체 · 제품 썸네일',
      },
    } as const

    const activeChoiceDetails = choiceInfoModal ? choiceDetails[choiceInfoModal] : null

    return (
      <main className="brand-choice-screen">
        <ScreenBackButton label="이전 화면으로 돌아가기" onClick={() => choiceBackMode === 'onboarding' ? (setOnboardingStep(2), setMode('onboarding')) : choiceBackMode === 'industry' ? setMode('industry') : setMode('home')} />
        <section className="brand-choice-content" aria-label="CI와 BI 로고 선택">
          <div className="brand-choice-list">
            <article className="brand-choice-card ci-card">
              <div className="brand-choice-art-wrap"><img src="/ci-white.svg" alt="회사와 기업을 대표하는 CI 로고 예시" /></div>
              <div className="brand-choice-copy">
                <div className="brand-choice-heading">
                  <span className="brand-choice-label">회사 · 기업 로고</span>
                  <button className="brand-choice-info" type="button" aria-label="CI 설명 보기" onClick={() => setChoiceInfoModal('ci')}><Info aria-hidden="true" size={19} strokeWidth={2} /></button>
                </div>
                <h2>CI 만들기</h2>
                <p>회사나 매장 전체를<br />대표하는 로고예요.</p>
                <button className="brand-choice-cta ci-cta" type="button" onClick={() => chooseBrandKind('ci')}>회사 로고 만들기 <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} /></button>
              </div>
            </article>
            <article className="brand-choice-card bi-card">
              <div className="brand-choice-art-wrap"><img src="/bi-white.svg" alt="제품과 화장품 브랜드를 대표하는 BI 로고 예시" /></div>
              <div className="brand-choice-copy">
                <div className="brand-choice-heading">
                  <span className="brand-choice-label">제품 · 브랜드 로고</span>
                  <button className="brand-choice-info" type="button" aria-label="BI 설명 보기" onClick={() => setChoiceInfoModal('bi')}><Info aria-hidden="true" size={19} strokeWidth={2} /></button>
                </div>
                <h2>BI 만들기</h2>
                <p>특정 화장품 브랜드나 제품 라인을<br />대표하는 로고예요.</p>
                <button className="brand-choice-cta bi-cta" type="button" onClick={() => chooseBrandKind('bi')}>제품 · 브랜드 로고 만들기 <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} /></button>
              </div>
            </article>
          </div>
        </section>
        {activeChoiceDetails && choiceInfoModal && (
          <div className={`brand-choice-info-backdrop ${choiceInfoModal === 'bi' ? 'is-bi' : 'is-ci'}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setChoiceInfoModal(null) }}>
            <section className="brand-choice-info-modal" role="dialog" aria-modal="true" aria-labelledby="brand-choice-info-title">
              <div className="brand-choice-info-header">
                <span className="brand-choice-label">{activeChoiceDetails.label}</span>
                <button className="brand-choice-info-close" type="button" aria-label="설명 닫기" onClick={() => setChoiceInfoModal(null)}><X aria-hidden="true" size={21} strokeWidth={2} /></button>
              </div>
              <h2 id="brand-choice-info-title">{activeChoiceDetails.title}</h2>
              <p className="brand-choice-info-summary">{activeChoiceDetails.summary}</p>
              <div className="brand-choice-info-section">
                <h3><Sparkles aria-hidden="true" size={17} strokeWidth={2} /> 이런 경우 추천</h3>
                <ul>{activeChoiceDetails.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul>
              </div>
              <div className="brand-choice-info-section result-section">
                <h3><Gift aria-hidden="true" size={18} strokeWidth={2} />결과물</h3>
                <p>{activeChoiceDetails.result}</p>
              </div>
            </section>
          </div>
        )}
      </main>
    )
  }

  const renderFinalRequestScreen = () => {
    const suggestions = ['반드시 넣고 싶은 모양', '피하고 싶은 모양', '참고하고 싶은 분위기', '글씨체의 느낌', '로고를 사용할 위치']
    const summaryRows = [
      { key: 'name', label: '브랜드명', value: 'SERA (세라)', icon: 'name' },
      { key: 'product', label: '제품 종류', value: '스킨케어', icon: 'product' },
      { key: 'description', label: '브랜드 설명', value: '민감한 피부를 위한 저자극 비건 스킨케어 브랜드', icon: 'description' },
      { key: 'audience', label: '주요 고객', value: '20-30대 민감성 피부 여성', icon: 'audience' },
      { key: 'value', label: '핵심 가치', value: '비건, 저자극, 클린뷰티', icon: 'value' },
      { key: 'mood', label: '원하는 분위기', value: '자연스럽고 깨끗한', icon: 'mood' },
    ]

    const addSuggestion = (suggestion: string) => {
      setAdditionalRequest((current) => current ? `${current} ${suggestion}` : suggestion)
    }

    return (
      <main className="final-request-screen">
        <ScreenBackButton label="로고 스타일 선택 화면으로 돌아가기" onClick={() => setMode('style')} />
        <section className="final-request-content" aria-labelledby="final-request-title">
          <BrandFlowProgress step={4} />

          <header className="final-request-heading">
            <h1 id="final-request-title">마지막으로 꼭 반영할 내용을 알려주세요</h1>
            <p>원하는 요소뿐 아니라 피하고 싶은 형태도 작성할 수 있어요.</p>
          </header>

          <section className="final-request-section" aria-labelledby="additional-request-title">
            <h2 id="additional-request-title">추가 요청사항</h2>
            <div className="final-textarea-wrap">
              <textarea
                aria-label="추가 요청사항"
                maxLength={300}
                value={additionalRequest}
                onChange={(event) => setAdditionalRequest(event.target.value)}
                placeholder={'예: 꽃이나 잎 모양은 피하고,\n얇고 고급스러운 영문 글씨체를 사용해주세요.'}
              />
              <span className="final-character-count">{additionalRequest.length} / 300</span>
            </div>
          </section>

          <section className="final-tip-card" aria-label="추가 요청사항 작성 도움말">
          <span className="final-tip-icon" aria-hidden="true"><Info size={24} strokeWidth={1.8} /></span>
            <div>
              <p>다음과 같은 내용을 작성할 수 있어요.</p>
              <div className="final-suggestion-list">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => addSuggestion(suggestion)}>
                    <Plus aria-hidden="true" size={15} strokeWidth={2} />{suggestion}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="final-summary-section" aria-labelledby="summary-title">
            <h2 id="summary-title">이 내용으로 로고를 만들게요</h2>
            <div className="final-summary-card">
              {summaryRows.map((row) => (
                <div className="final-summary-row" key={row.key}>
                  <span className={`final-detail-icon icon-${row.icon}`} aria-hidden="true" />
                  <span className="final-summary-label">{row.label}</span>
                  <span className="final-summary-value">{row.value}</span>
                  <button className="final-edit-button" type="button" onClick={() => setMode(brandKind === 'ci' ? 'company-details' : 'brand-details')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
                </div>
              ))}
              <div className="final-summary-row">
                <span className="final-detail-icon icon-color" aria-hidden="true" />
                <span className="final-summary-label">선호 색상</span>
                <span className="final-color-swatches" aria-label="선호 색상 4개">
                  <i className="swatch-green" /><i className="swatch-yellow" /><i className="swatch-cream" /><i className="swatch-gray" />
                </span>
                  <button className="final-edit-button" type="button" onClick={() => setMode(brandKind === 'ci' ? 'company-details' : 'brand-details')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
              </div>
              <div className="final-summary-row">
                <span className="final-detail-icon icon-logo" aria-hidden="true" />
                <span className="final-summary-label">로고 형태</span>
                <span className="final-summary-value">콤비네이션 (그림 + 브랜드명) <em>추천</em></span>
                <button className="final-edit-button" type="button" onClick={() => setMode(brandKind === 'ci' ? 'company-details' : 'brand-details')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
              </div>
              <div className="final-summary-row final-summary-last">
                <span className="final-detail-icon icon-question" aria-hidden="true"><CircleHelp size={22} strokeWidth={1.8} /></span>
                <span className="final-summary-label">추가 요청사항</span>
                <span className="final-summary-value">{additionalRequest || '별도 요청 없음'}</span>
                <span className="final-summary-dash" aria-hidden="true">—</span>
              </div>
            </div>
          </section>

          <button className="final-generate-button" type="button" onClick={() => void startLogoGeneration()} disabled={generationLoading}>
            <span className="final-sparkle-cluster" aria-hidden="true"><i>✧</i><i>✧</i><i>✧</i></span>
            로고 생성하기
            <ChevronRight className="final-generate-arrow" aria-hidden="true" size={28} strokeWidth={1.8} />
          </button>
          {generationError && <p className="generation-error" role="alert">{generationError}</p>}
          <p className="final-footnote"><Info aria-hidden="true" size={18} strokeWidth={1.8} /> 생성된 후보는 나중에 색상과 글씨체를 수정할 수 있어요.</p>
        </section>
      </main>
    )
  }

  const renderLoadingScreen = () => {
    const loadingSteps = [
      { number: '1', icon: 'clipboard', text: '브랜드와 제품의 특징을 정리하고 있어요' },
      { number: '2', icon: 'mood', text: '고객에게 어울리는 분위기를 찾고 있어요' },
      { number: '3', icon: 'palette', text: '색상과 글씨체를 조합하고 있어요' },
      { number: '4', icon: 'pen', text: '로고 후보를 생성하고 있어요' },
      { number: '5', icon: 'folder', text: '결과를 비교하기 쉽게 정리하고 있어요' },
    ]

    return (
      <main className="logo-loading-screen" aria-labelledby="logo-loading-title">
        <section className="logo-loading-content">
          <header className="logo-loading-heading">
            <h1 id="logo-loading-title">브랜드 정보를 바탕으로<br />로고를 만들고 있어요</h1>
            <p>서로 다른 방향의 로고 후보 4개를 준비하고 있어요.</p>
          </header>

          <div className="logo-loading-orb" aria-label="로고 생성 진행 중">
            <div className="logo-loading-ring">
              <Sparkles className="logo-loading-sparkle sparkle-one" aria-hidden="true" size={70} strokeWidth={1.6} />
              <LucideSparkle className="logo-loading-sparkle sparkle-two" aria-hidden="true" size={40} strokeWidth={1.8} />
            </div>
          </div>
          <div className="logo-loading-status">{generationError ? '로고 생성에 문제가 발생했어요' : '로고 생성 중...'}</div>
          {generationError && <div className="logo-loading-error" role="alert"><p>{generationError}</p><button type="button" onClick={() => void startLogoGeneration()}>다시 시도하기</button></div>}

          <section className="logo-loading-steps" aria-label="로고 생성 단계">
            {loadingSteps.map((step, index) => (
              <article className={index === 0 ? 'logo-loading-step active' : 'logo-loading-step'} key={step.number}>
                <span className="logo-loading-step-number">{step.number}</span>
                <span className={`logo-loading-step-icon icon-${step.icon}`} aria-hidden="true">
                  {step.icon === 'clipboard' ? <ClipboardCheck size={47} strokeWidth={1.8} />
                    : step.icon === 'mood' ? <Heart size={47} strokeWidth={1.8} fill="currentColor" />
                      : step.icon === 'palette' ? <Palette size={47} strokeWidth={1.8} />
                        : step.icon === 'pen' ? <PenLine size={47} strokeWidth={1.8} />
                          : <FolderCheck size={47} strokeWidth={1.8} />}
                </span>
                <p>{step.text}</p>
                {index === 0 && <LoaderCircle className="logo-loading-dots" aria-hidden="true" size={27} strokeWidth={2.6} />}
              </article>
            ))}
          </section>

          <section className="logo-loading-time-card" aria-label="예상 소요 시간">
            <Clock3 className="logo-loading-side-icon clock-icon" aria-hidden="true" size={59} strokeWidth={1.8} />
            <div>
              <p>약 1~3분 정도 걸릴 수 있어요.</p>
              <div className="logo-loading-progress" aria-hidden="true"><span /></div>
            </div>
            <AlarmClock className="logo-loading-side-icon alarm-icon" aria-hidden="true" size={59} strokeWidth={1.8} />
          </section>

          <section className="logo-loading-save-card" aria-label="입력 내용 저장 안내">
            <ShieldCheck className="logo-loading-save-icon" aria-hidden="true" size={60} strokeWidth={1.8} />
            <div>
              <strong>입력한 내용은 저장되어 있어요.</strong>
              <p>잠시 다른 화면을 둘러봐도 괜찮아요.</p>
            </div>
            <span className="logo-loading-cloud" aria-hidden="true"><CloudCheck size={58} strokeWidth={1.7} /><FileCheck2 size={45} strokeWidth={1.7} /></span>
          </section>
        </section>
      </main>
    )
  }

  const renderTrademarkLoadingScreen = () => {
    const analysisSteps = [
      { number: '1', text: '로고의 시각적 특징을 추출하고 있어요', state: 'complete' },
      { number: '2', text: '비슷한 도형과 구도의 상표를 찾고 있어요', state: 'complete' },
      { number: '3', text: '가장 유사한 상표와 점수를 정리하고 있어요', state: 'active' },
    ]

    return (
      <main className="trademark-loading-screen" aria-labelledby="trademark-loading-title">
        <section className="trademark-loading-content">
          <div className="trademark-brand-lockup" aria-label="GenMark AI">
            <BrandLogo className="trademark-brand-mark" />
            <span>GenMark AI</span>
          </div>

          <div className="trademark-progress" aria-label="상표 분석 3단계 중 2단계">
            <span className="trademark-step-badge">2 / 3</span>
            <div className="trademark-progress-track" aria-hidden="true">
              <span className="trademark-progress-line" />
              <span className="trademark-progress-node complete"><Check size={14} strokeWidth={2.5} /></span>
              <span className="trademark-progress-node complete"><Check size={14} strokeWidth={2.5} /></span>
              <span className="trademark-progress-node active" />
              <span className="trademark-progress-node" />
            </div>
          </div>

          <header className="trademark-loading-heading">
            <h1 id="trademark-loading-title">비슷한 화장품<br /><strong>상표 이미지</strong>를 찾고 있어요</h1>
            <p>생성한 로고의 형태와 배치를<br />기존 등록 상표 이미지와 비교하고 있어요.</p>
          </header>

          <div className="trademark-search-visual" aria-label="상표 이미지 비교 분석 중">
            <div className="trademark-reference-card reference-left"><span className="trademark-leaf-icon">♢</span><i /><i /></div>
            <div className="trademark-magnifier"><span /></div>
            <div className="trademark-reference-card reference-right"><span className="trademark-bottle-icon">▯</span><i /><i /></div>
            <Sparkles className="trademark-visual-sparkle sparkle-a" aria-hidden="true" size={24} strokeWidth={1.6} />
            <Sparkles className="trademark-visual-sparkle sparkle-b" aria-hidden="true" size={20} strokeWidth={1.6} />
          </div>

          <section className="trademark-analysis-steps" aria-label="상표 분석 단계">
            {analysisSteps.map((step) => (
              <div className={`trademark-analysis-step ${step.state}`} key={step.number}>
                <span className="trademark-analysis-number">{step.number}</span>
                <p>{step.text}</p>
                {step.state === 'complete' ? <span className="trademark-analysis-check" aria-hidden="true"><Check size={18} strokeWidth={2.5} /></span> : <span className="trademark-analysis-spinner" aria-hidden="true" />}
              </div>
            ))}
          </section>

          <section className="trademark-info-card" aria-label="상표 분석 안내">
            <span className="trademark-info-icon" aria-hidden="true"><Info size={24} strokeWidth={1.8} /></span>
            <p>이름 검색이 아니라<br /><strong>로고 이미지의 외관</strong>을 비교하는 과정이에요.</p>
            <span className="trademark-info-art" aria-hidden="true">⌕</span>
          </section>

          <p className="trademark-waiting"><Sparkles aria-hidden="true" size={18} strokeWidth={1.6} /> 분석 중이에요. 잠시만 기다려주세요. <Sparkles aria-hidden="true" size={18} strokeWidth={1.6} /></p>
        </section>
      </main>
    )
  }

  const renderTrademarkSelectionScreen = () => {
    const benefits = [
      { icon: 'image', title: '이미지로 비슷한 상표 찾기', description: '생성한 로고와 형태, 구도, 배치가 비슷한 화장품 상표를 찾아요.' },
      { icon: 'chart', title: '유사도 점수 확인', description: '가장 비슷한 상표와 어느 정도 닮았는지 점수로 보여드려요.' },
      { icon: 'pencil', title: '확정 전 수정', description: '유사도가 높으면 패키지와 쇼핑몰을 만들기 전에 로고를 수정할 수 있어요.' },
    ]

    return (
      <main className="trademark-selection-screen" aria-labelledby="trademark-selection-title">
        <ScreenBackButton label="이전 화면으로 돌아가기" onClick={() => setMode(trademarkEntry === 'generation' ? 'final' : 'result')} />
        <header className="trademark-selection-header">
          <div className="trademark-selection-brand"><BrandLogo className="trademark-selection-brand-mark" /><span>GenMark AI</span></div>
          <button className="trademark-help" type="button" aria-label="상표 분석 도움말"><CircleHelp aria-hidden="true" size={23} strokeWidth={1.8} /></button>
        </header>

        <section className="trademark-selection-content">
          <div className="trademark-selection-hero-icon" aria-hidden="true">
            <span className="trademark-selection-shield" />
            <span className="trademark-selection-search" />
          </div>

          <header className="trademark-selection-heading">
            <h1 id="trademark-selection-title">로고를 확정하기 전에<br />비슷한 상표 이미지도 확인할까요?</h1>
            <p>기존 서비스에서는 이름 검색은 가능하지만,<br />로고의 형태나 배치가 비슷한 상표를 직접 찾기는 어려워요.</p>
          </header>

          <section className="trademark-benefit-card" aria-label="상표 분석 기능">
            {benefits.map((benefit) => (
              <article className="trademark-benefit-row" key={benefit.title}>
                <span className={`trademark-benefit-icon icon-${benefit.icon}`} aria-hidden="true" />
                <div>
                  <h2>{benefit.title}</h2>
                  <p>{benefit.description}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="trademark-question-card" aria-label="상표 분석 안내">
            <div className="trademark-question-row">
              <span className="trademark-question-badge">Q</span>
              <p>이름이 다른데 로고 모양이 비슷해도 문제가 되나요?</p>
            </div>
            <div className="trademark-answer-row">
              <span className="trademark-answer-badge">A</span>
              <p>상표는 이름뿐 아니라 로고의 외관도 함께 검토될 수 있어요.<br />GenMark AI는 그중 이미지의 시각적 유사성을 확인하는 데 도움을 드려요.</p>
            </div>
          </section>

          <div className="trademark-selection-actions">
            <button className="trademark-check-button" type="button" onClick={() => { setTrademarkAnalysisSkipped(false); setTrademarkAnalysisCompleted(false); void startTrademarkAnalysis() }}>
              <span className="trademark-check-search" aria-hidden="true" />
              <span>비슷한 상표 이미지 확인하기</span>
              <ChevronRight aria-hidden="true" size={23} strokeWidth={1.8} />
            </button>
            <button className="trademark-skip-button" type="button" onClick={() => { setTrademarkAnalysisSkipped(true); setTrademarkAnalysisCompleted(false); setMode(trademarkEntry === 'result' ? 'result' : 'loading') }}>
              <span>지금은 건너뛰기</span>
              <ChevronRight aria-hidden="true" size={23} strokeWidth={1.8} />
            </button>
          </div>

          <p className="trademark-disclaimer"><Info aria-hidden="true" size={20} strokeWidth={1.8} /><span>본 분석은 기존 등록 상표 이미지와의 시각적 유사성을 보여주는 참고 자료입니다.<br />상표 등록 가능 여부나 법적 침해 여부를 판단하지 않습니다.</span></p>
        </section>
      </main>
    )
  }

  const renderTrademarkResultScreen = () => {
    const matches = trademarkMatches
    const topMatch = matches[0]

    return (
      <main className="trademark-result-screen" aria-labelledby="trademark-result-title">
        <header className="trademark-result-header">
          <button className="trademark-result-back" type="button" aria-label="로고 결과 화면으로 돌아가기" onClick={() => setMode('result')}><ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} /></button>
          <div className="trademark-result-brand"><BrandLogo /><strong>GenMark AI</strong></div>
          <button className="trademark-result-help" type="button" aria-label="상표 분석 도움말"><CircleHelp aria-hidden="true" size={24} strokeWidth={1.8} /></button>
        </header>

        <section className="trademark-result-content">
          <div className="trademark-result-complete"><CircleCheck aria-hidden="true" size={20} strokeWidth={1.8} /> 상표 이미지 분석 완료</div>
          <h1 id="trademark-result-title">비슷한 상표 이미지<br /><strong>분석 결과를 확인해보세요</strong></h1>
          <p className="trademark-result-lead">생성한 로고의 형태와 배치를 기존 등록 상표 이미지와 비교했어요.</p>

          <section className="trademark-result-summary" aria-label="가장 유사한 상표 요약">
            <div className="trademark-result-summary-icon" aria-hidden="true"><span /><i /><b /></div>
            <div className="trademark-result-summary-copy">
              <span>가장 유사한 상표</span>
              <strong>{topMatch?.name ?? '분석 결과 없음'}</strong>
              <p>{topMatch?.category ?? '비슷한 상표가 없어요.'}</p>
            </div>
            <div className="trademark-result-score">
              <strong>{trademarkSimilarity ?? topMatch?.similarity ?? 0}%</strong>
              <span>이미지 유사도</span>
            </div>
          </section>

          <section className={`trademark-risk-card ${trademarkRiskLabel === '안전' ? 'safe' : 'caution'}`} aria-label="유사도 위험 범주">
            <div className="trademark-risk-mark" aria-hidden="true"><Check size={24} strokeWidth={2.5} /></div>
            <div>
              <div className="trademark-risk-heading"><strong>{trademarkRiskLabel || '분석 완료'}</strong><span>{trademarkSimilarity ?? 0}% 유사도</span></div>
              <p>{trademarkRiskDescription || '실제 상표 등록 전에는 전문가의 확인을 권장해요.'}</p>
            </div>
          </section>

          <section className="trademark-match-section" aria-labelledby="trademark-match-title">
            <div className="trademark-match-heading">
              <h2 id="trademark-match-title">비슷한 상표 이미지</h2>
              <span>상위 {matches.length}건</span>
            </div>
            <div className="trademark-match-list">
              {matches.map((match) => (
                <article className="trademark-match-row" key={match.name}>
                  <span className="trademark-match-rank">{match.rank}</span>
                  <div className="trademark-match-visual trademark-match-placeholder" aria-hidden="true"><i /><b /><em /></div>
                  <div className="trademark-match-copy">
                    <strong>{match.name}</strong>
                    <span>{match.category}</span>
                    <p>출원번호 {match.applicationNumber}</p>
                  </div>
                  <strong className="trademark-match-score">{match.similarity}%</strong>
                </article>
              ))}
            </div>
          </section>

          <p className="trademark-result-disclaimer"><Info aria-hidden="true" size={18} strokeWidth={1.8} /><span>{trademarkDisclaimer || '본 결과는 로고 이미지의 시각적 유사성을 보여주는 참고 자료예요. 상표 등록 가능 여부나 법적 침해 여부를 판단하지 않아요.'}</span></p>

          <div className="trademark-result-actions">
            <button className="trademark-result-primary" type="button" onClick={() => setMode('result')}>로고 결과로 돌아가기 <ChevronRight aria-hidden="true" size={22} strokeWidth={1.8} /></button>
          </div>
        </section>
      </main>
    )
  }

  const renderLogoResultScreen = () => {
    const candidateProfiles = [
      { name: '후보 1', subtitle: 'GENMARK AI', style: 'lavender', direction: '미니멀 · 내추럴' },
      { name: '후보 2', subtitle: 'GENMARK AI', style: 'rose', direction: '우아한 · 감성적' },
      { name: '후보 3', subtitle: 'GENMARK AI', style: 'sage', direction: '깨끗한 · 프리미엄' },
      { name: '후보 4', subtitle: 'GENMARK AI', style: 'pearl', direction: '현대적 · 세련된' },
    ]
    const candidates = logoCandidates.map((candidate, index) => ({ ...candidate, ...candidateProfiles[index] }))
    const candidate = candidates[resultCandidate] ?? candidates[0]

    if (!candidate) {
      return (
        <main className="logo-result-screen" aria-labelledby="logo-result-title">
          <section className="logo-result-content">
            <h1 id="logo-result-title">로고 후보를 아직 불러오지 못했어요</h1>
            <p className="logo-result-lead">로고 생성이 완료되면 후보 4개가 이곳에 표시됩니다.</p>
            {generationError && <p className="generation-error" role="alert">{generationError}</p>}
            <button className="final-generate-button" type="button" onClick={() => void startLogoGeneration()}>다시 확인하기</button>
          </section>
        </main>
      )
    }

    return (
      <main className="logo-result-screen" aria-labelledby="logo-result-title">
        <header className="logo-result-header">
          <div className="logo-result-brand"><BrandLogo /><strong>GenMark AI</strong></div>
          <button className="logo-result-help" type="button" aria-label="도움말"><CircleHelp aria-hidden="true" size={23} strokeWidth={1.8} /></button>
        </header>

        <section className="logo-result-content">
          <div className="logo-result-complete"><CircleCheck aria-hidden="true" size={21} strokeWidth={1.8} /> 로고 후보가 완성됐어요</div>
          <h1 id="logo-result-title">가장 마음에 드는 로고를 선택해주세요</h1>
          <p className="logo-result-lead">후보를 비교하고 색상이나 글씨체를 수정할 수 있어요.</p>
          <div className="logo-result-counter" aria-label={`로고 ${resultCandidate + 1} / 4`}>{resultCandidate + 1} / 4</div>

          <section className="logo-candidate-panel" aria-label="로고 후보 미리보기">
            <button className={resultLiked ? 'logo-candidate-action like liked' : 'logo-candidate-action like'} type="button" aria-label={resultLiked ? '찜 취소' : '찜'} aria-pressed={resultLiked} onClick={() => setResultLiked((current) => !current)}>
              <Heart size={22} strokeWidth={1.9} fill={resultLiked ? 'currentColor' : 'none'} />
            </button>
            <button className="logo-candidate-arrow previous" type="button" aria-label="이전 후보" onClick={() => { const next = (resultCandidate + candidates.length - 1) % candidates.length; void selectLogoCandidate(candidates[next], next) }}><ChevronLeft aria-hidden="true" size={26} strokeWidth={1.8} /></button>
            <div className="logo-candidate-art">
              <img
                className="logo-candidate-image"
                src={getLogoCandidateImageUrl(candidate.storageKey)}
                alt={`${candidate.name} AI 생성 로고`}
              />
              <strong>{candidate.name}</strong>
              <small>{candidate.subtitle}</small>
            </div>
            <button className="logo-candidate-arrow next" type="button" aria-label="다음 후보" onClick={() => { const next = (resultCandidate + 1) % candidates.length; void selectLogoCandidate(candidates[next], next) }}><ChevronRight aria-hidden="true" size={26} strokeWidth={1.8} /></button>
            <button className="logo-candidate-action download" type="button" aria-label="로고 파일 다운로드" onClick={() => requestLogoDownload(candidate)}>
              <Download size={21} strokeWidth={1.9} />
            </button>
          </section>
          <div className="logo-result-dots" aria-label="후보 선택">
            {candidates.map((item, index) => <button key={item.id} className={index === resultCandidate ? 'active' : ''} type="button" aria-label={`후보 ${index + 1}`} aria-pressed={index === resultCandidate} onClick={() => void selectLogoCandidate(item, index)} />)}
          </div>

          <section className="logo-result-details" aria-label="로고 디자인 상세">
            <div className="logo-result-detail-row"><span className="result-detail-icon compass" aria-hidden="true"><Compass size={23} strokeWidth={1.8} /></span><strong>디자인 방향</strong><span>{candidate.direction}</span></div>
            <div className="logo-result-detail-row"><span className="result-detail-icon type" aria-hidden="true"><TypeIcon size={23} strokeWidth={1.8} /></span><strong>추천 글씨체</strong><span>우아한 세리프 + 깔끔한 산세리프</span></div>
            <div className="logo-result-detail-row"><span className="result-detail-icon drop" aria-hidden="true"><Droplets size={23} strokeWidth={1.8} /></span><strong>브랜드 컬러</strong><span className="result-color-swatches"><i /><i /><i /><i /></span></div>
            <div className="logo-result-detail-row feeling"><span className="result-detail-icon heart" aria-hidden="true"><Heart size={26} strokeWidth={1.8} /></span><strong>이 로고가 전달하는 느낌</strong><span>부드럽고 깨끗하면서도<br />프리미엄한 스킨케어 브랜드 이미지</span></div>
          </section>

          <section className={trademarkAnalysisCompleted ? 'logo-result-trademark analyzed' : 'logo-result-trademark'} aria-label="상표 이미지 유사도">
            <span className="trademark-result-icon" aria-hidden="true"><Search size={44} strokeWidth={1.8} /></span>
            {trademarkAnalysisCompleted ? (
              <div><strong>상표 이미지 유사도 분석 완료</strong><p>가장 높은 유사도는 {trademarkSimilarity ?? 0}%로, 현재 <b>{trademarkRiskLabel || '분석 완료'}</b> 범위예요.</p><button type="button" onClick={() => setMode('trademark-result')}>유사도 분석 결과 보기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
            ) : !canAnalyzeTrademark ? (
              <div><strong>상표 이미지 유사도</strong><p>선택한 로고 스타일은 이미지 유사도 분석을 지원하지 않아요.</p></div>
            ) : trademarkAnalysisSkipped ? (
              <div><strong>상표 이미지 유사도</strong><p>이전 단계에서 유사도 분석을 건너뛰었어요.</p></div>
            ) : (
              <div><strong>상표 이미지 유사도</strong><p>아직 상표 이미지 유사도를 확인하지 않았어요.</p><button type="button" onClick={() => openTrademarkSelection('result')}>비슷한 상표 이미지 확인하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
            )}
          </section>

          <div className="logo-result-actions">
            <button className="logo-result-edit" type="button" onClick={() => setMode('edit')}><Pencil aria-hidden="true" size={23} strokeWidth={1.8} />색상 · 글씨체 수정<ChevronRight aria-hidden="true" size={25} strokeWidth={1.8} /></button>
          </div>

          <div className="logo-result-utility-grid">
            <button className="utility-primary" type="button" onClick={() => void startLogoGeneration()}><RefreshCw className="result-utility-icon" aria-hidden="true" size={22} strokeWidth={1.8} />조건을 바꿔<br />다시 만들기<ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
            <button className="utility-secondary" type="button"><ImageIcon className="result-utility-icon" aria-hidden="true" size={22} strokeWidth={1.8} />제품 썸네일 만들기<ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
          </div>
        </section>
      </main>
    )
  }

  const renderLogoEditScreen = () => {
    const symbolOptions = ['leaf', 'heart', 'flower', 'lotus']
    const fontOptions = ['LUVÉRA', 'LUVÉRA', 'LUVÉRA', 'LUVÉRA']

    return (
      <main className="logo-editor-screen" aria-labelledby="logo-editor-title">
        <header className="logo-editor-header">
          <button className="logo-editor-back" type="button" aria-label="결과 화면으로 돌아가기" onClick={() => setMode('result')}><ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} /></button>
          <div className="logo-editor-brand"><BrandLogo /><strong>GenMark AI</strong></div>
          <button className="logo-editor-save" type="button" onClick={() => void saveEditorChanges()}>{editorSaved ? '저장됨' : '저장'}<ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} /></button>
          <button className="logo-editor-help" type="button" aria-label="도움말"><CircleHelp aria-hidden="true" size={22} strokeWidth={1.8} /></button>
        </header>

        <section className="logo-editor-content">
          <div className="logo-editor-meta">
            <div className="logo-editor-counter"><button type="button" aria-label="이전 후보" onClick={() => setResultCandidate((current) => (current + 3) % 4)}><ChevronLeft size={18} strokeWidth={1.8} /></button><strong>후보 {resultCandidate + 1} / 4</strong><button type="button" aria-label="다음 후보" onClick={() => setResultCandidate((current) => (current + 1) % 4)}><ChevronRight size={18} strokeWidth={1.8} /></button></div>
            <span className="logo-editor-autosave"><Check size={15} strokeWidth={2} /> 자동 저장됨</span>
          </div>

          <section className="logo-editor-preview-card" aria-label="로고 편집 캔버스">
            <div className="logo-editor-artboard">
              <button className={editTarget === 'symbol' ? 'editor-symbol-target selected' : 'editor-symbol-target'} type="button" aria-label="로고 그림 수정" onClick={() => setEditTarget('symbol')}>
                <span className={`editor-symbol-graphic symbol-${symbolOptions[editorSymbol]}`} style={{ transform: `scale(${editorScale / 100}) rotate(${editorRotation}deg)`, opacity: editorOpacity / 100 }}><i /><b /><em /></span>
                {editTarget === 'symbol' && <span className="editor-selection-trash" aria-hidden="true" />}
              </button>
              <button className={editTarget === 'text' ? 'editor-wordmark-target selected' : 'editor-wordmark-target'} type="button" aria-label="로고 글자 수정" onClick={() => setEditTarget('text')}>
                <strong style={{ letterSpacing: `${editorLetterSpacing}px` }}>{editorBrandName}</strong>
                <small>C O S M E T I C S</small>
              </button>
              {editTarget === 'symbol' && <span className="editor-rotate-handle" aria-hidden="true"><RefreshCw size={22} strokeWidth={1.8} /></span>}
            </div>
            <div className="logo-editor-preview-footer">
              <div className="editor-history"><button type="button" aria-label="실행 취소"><ArrowLeft size={20} strokeWidth={1.8} /></button><button type="button" aria-label="다시 실행"><ArrowRight size={20} strokeWidth={1.8} /></button></div>
              <div className="editor-mini-preview"><span className="mini-mark">L<em>V</em></span><small>❧</small></div>
            </div>
          </section>

          <section className="logo-editor-panel" aria-labelledby="logo-editor-title">
            <h1 id="logo-editor-title" className="sr-only">로고 수정</h1>
            <div className="logo-editor-tabs" role="tablist" aria-label="수정할 로고 요소">
              <button className={editTarget === 'symbol' ? 'active' : ''} type="button" role="tab" aria-selected={editTarget === 'symbol'} onClick={() => setEditTarget('symbol')}>심볼</button>
              <button className={editTarget === 'text' ? 'active' : ''} type="button" role="tab" aria-selected={editTarget === 'text'} onClick={() => setEditTarget('text')}>글자</button>
              <button type="button" role="tab" aria-selected="false" onClick={() => setEditTarget('text')}>배치</button>
            </div>

            {editTarget === 'text' ? (
              <div className="editor-control-section text-controls">
                <label className="editor-field-label" htmlFor="editor-brand-name">브랜드명</label>
                <input id="editor-brand-name" value={editorBrandName} onChange={(event) => setEditorBrandName(event.target.value)} />
                <div className="editor-control-heading"><strong>추천 글씨체</strong><span>상업적 이용 가능 <b>ⓘ</b></span></div>
                <div className="editor-font-grid">
                  {fontOptions.map((font, index) => <button key={index} type="button" className={index === 0 ? 'selected' : ''} style={{ fontFamily: index === 0 ? 'Georgia, serif' : index === 1 ? 'Arial, sans-serif' : index === 2 ? 'Garamond, serif' : 'Times New Roman, serif' }}>{font}{index === 0 && <Check aria-hidden="true" size={11} strokeWidth={2.5} />}</button>)}
                </div>
                <div className="editor-control-heading"><strong>글자 설정</strong><button type="button" onClick={() => { setEditorScale(100); setEditorLetterSpacing(0) }}>초기화</button></div>
                <label className="editor-slider-row"><span>크기</span><input type="range" min="70" max="140" value={editorScale} onChange={(event) => setEditorScale(Number(event.target.value))} /><output>{editorScale}%</output></label>
                <label className="editor-slider-row"><span>자간</span><input type="range" min="-4" max="12" value={editorLetterSpacing} onChange={(event) => setEditorLetterSpacing(Number(event.target.value))} /><output>{editorLetterSpacing}</output></label>
                <label className="editor-slider-row"><span>행간</span><input type="range" min="0" max="12" value={0} readOnly /><output>0</output></label>
                <label className="editor-color-row"><span>색상</span><select value={editorColor} onChange={(event) => setEditorColor(event.target.value)}><option value="#7B5CDF">●  #7B5CDF</option><option value="#E36BAE">●  #E36BAE</option><option value="#2D3047">●  #2D3047</option></select></label>
              </div>
            ) : (
              <div className="editor-control-section symbol-controls">
                <div className="editor-control-heading"><strong>심볼 변경</strong><button type="button">다른 심볼 보기 ›</button></div>
                <div className="editor-symbol-grid">
                  {symbolOptions.map((symbol, index) => <button key={symbol} type="button" className={editorSymbol === index ? 'selected' : ''} onClick={() => setEditorSymbol(index)}><span className={`editor-symbol-thumb symbol-${symbol}`}><i /><b /><em /></span></button>)}
                </div>
                <div className="editor-control-heading"><strong>심볼 설정</strong><button type="button" onClick={() => { setEditorScale(100); setEditorRotation(0); setEditorOpacity(100) }}>초기화</button></div>
                <label className="editor-slider-row"><span>크기</span><input type="range" min="70" max="140" value={editorScale} onChange={(event) => setEditorScale(Number(event.target.value))} /><output>{editorScale}%</output></label>
                <label className="editor-slider-row"><span>회전</span><input type="range" min="-180" max="180" value={editorRotation} onChange={(event) => setEditorRotation(Number(event.target.value))} /><output>{editorRotation}°</output></label>
                <label className="editor-color-row"><span>색상</span><select value={editorColor} onChange={(event) => setEditorColor(event.target.value)}><option value="#7B5CDF">●  #7B5CDF</option><option value="#E36BAE">●  #E36BAE</option><option value="#2D3047">●  #2D3047</option></select></label>
                <label className="editor-slider-row"><span>투명도</span><input type="range" min="30" max="100" value={editorOpacity} onChange={(event) => setEditorOpacity(Number(event.target.value))} /><output>{editorOpacity}%</output></label>
                <button className="editor-regenerate" type="button" onClick={() => setEditorSymbol((current) => (current + 1) % symbolOptions.length)}><Sparkles aria-hidden="true" size={18} strokeWidth={1.8} />심볼 다시 생성하기</button>
              </div>
            )}
          </section>

          <div className="logo-editor-actions">
            <button className="logo-editor-apply" type="button" onClick={() => void saveEditorChanges().then(() => setMode('result'))}>수정 적용하기</button>
            {canAnalyzeTrademark && <button className="logo-editor-trademark" type="button" onClick={() => openTrademarkSelection('result')}>상표 이미지 유사도 다시 확인하기</button>}
          </div>
          <p className="logo-editor-note">· 로고의 형태나 배치를 변경하면 상표 이미지 유사도에 영향을 줄 수 있어요.</p>
        </section>
      </main>
    )
  }

  const renderMypageScreen = () => {
    const displayUserName = brandName.trim() || '사용자'
    const completedProjects = [{ id: 'luvera', name: 'LUVÉRA', detail: '스킨케어 · 콤비네이션', status: '로고 생성 완료' }]

    return (
      <main className="mypage-screen" aria-labelledby="mypage-title">
        <header className="workspace-header">
          <button className="workspace-back" type="button" aria-label="홈으로 돌아가기" onClick={() => setMode('home')}><ChevronLeft aria-hidden="true" size={23} strokeWidth={1.8} /></button>
          <div className="workspace-brand"><BrandLogo /><strong>GenMark AI</strong></div>
          <button className="workspace-help" type="button" aria-label="도움말"><CircleHelp aria-hidden="true" size={22} strokeWidth={1.8} /></button>
        </header>

        <section className="mypage-content">
          <header className="mypage-heading">
            <p className="mypage-eyebrow">마이페이지</p>
            <h1 id="mypage-title">{displayUserName}님의 브랜드 작업</h1>
            <p>작성 중인 프로젝트와 완성된 로고를 한곳에서 확인하세요.</p>
          </header>

          <section className="mypage-section" aria-labelledby="continue-title">
            <div className="section-title-row">
              <div><h2 id="continue-title">이어서 만들기</h2><p>이전에 입력한 내용부터 계속 진행할 수 있어요.</p></div>
              <PenLine aria-hidden="true" size={26} strokeWidth={1.8} />
            </div>
            <div className="continue-project-card">
              <div className="project-art-placeholder" aria-hidden="true"><Sparkles size={30} strokeWidth={1.6} /></div>
              <div className="project-card-copy"><strong>{brandKind === 'ci' ? '기업 로고 프로젝트' : '새 브랜드 프로젝트'}</strong><span>브랜드 설명 단계에서 작성 중</span></div>
              <button className="gradient-button" type="button" onClick={() => setMode(brandKind === 'ci' ? 'company-details' : 'brand-details')}>이어서 작성하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
            </div>
          </section>

          <section className="mypage-section" aria-labelledby="completed-title">
            <div className="section-title-row"><div><h2 id="completed-title">완성한 브랜드</h2><p>생성한 로고와 분석 결과를 다시 확인할 수 있어요.</p></div><FolderCheck aria-hidden="true" size={27} strokeWidth={1.8} /></div>
            {completedProjects.length > 0 ? completedProjects.map((project) => (
              <article className="completed-project-card" key={project.id}>
                <div className="completed-project-preview" aria-hidden="true"><span><Sparkles size={22} strokeWidth={1.5} /></span><strong>{project.name}</strong><small>COSMETICS</small></div>
                <div className="completed-project-info"><div className="project-info-heading"><strong>{project.name}</strong><span className="project-status"><Check size={14} strokeWidth={2.3} /> {project.status}</span></div><p>{project.detail}</p><div className="project-status-list"><span><Check size={14} strokeWidth={2} /> 로고 생성 완료</span><span><Check size={14} strokeWidth={2} /> 상표 이미지 분석 완료</span><span><Check size={14} strokeWidth={2} /> 브랜드 키트 완료</span></div></div>
                <div className="project-action-grid">
                  <button type="button" onClick={() => setMode('result')}><ImageIcon size={19} strokeWidth={1.8} />결과 보기</button>
                  <button type="button" onClick={() => setMode('trademark-result')}><Search size={19} strokeWidth={1.8} />유사도 결과 보기</button>
                  <button type="button" onClick={() => downloadLogo({ name: project.name, subtitle: 'COSMETICS' })}><Download size={19} strokeWidth={1.8} />로고 다운로드</button>
                  <button type="button" onClick={() => setMode('result')}><FolderCheck size={19} strokeWidth={1.8} />브랜드 키트 만들기</button>
                  <button type="button" onClick={() => setMode('style')}><RefreshCw size={19} strokeWidth={1.8} />다시 생성하기</button>
                </div>
              </article>
            )) : (
              <div className="mypage-empty-state"><div className="empty-state-icon"><Sparkles size={30} strokeWidth={1.7} /></div><h3>아직 만든 브랜드가 없어요</h3><p>첫 번째 화장품 브랜드 로고를 만들어보세요.</p><button className="gradient-button" type="button" onClick={startOnboarding}>로고 만들기 시작 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
            )}
          </section>

          <button className="survey-entry-card" type="button" onClick={() => { setSurveySubmitted(false); setMode('survey') }}><span><MessageSquare aria-hidden="true" size={23} strokeWidth={1.8} /></span><div><strong>서비스를 이용해보셨나요?</strong><p>더 쉬운 브랜드 제작을 위해 의견을 들려주세요.</p></div><ChevronRight aria-hidden="true" size={21} strokeWidth={1.8} /></button>
        </section>
      </main>
    )
  }

  const renderSurveyScreen = () => {
    return (
      <main className="survey-screen" aria-labelledby="survey-title">
        <header className="workspace-header">
          <button className="workspace-back" type="button" aria-label="마이페이지로 돌아가기" onClick={() => setMode('mypage')}><ChevronLeft aria-hidden="true" size={23} strokeWidth={1.8} /></button>
          <div className="workspace-brand"><BrandLogo /><strong>GenMark AI</strong></div>
          <span className="survey-step">만족도 평가</span>
        </header>

        {surveySubmitted ? (
          <section className="survey-complete-card" aria-live="polite"><div className="survey-complete-icon"><Check aria-hidden="true" size={36} strokeWidth={2.2} /></div><h1>의견을 보내주셔서 감사합니다.</h1><p>더 쉬운 브랜드 제작 서비스를 만드는 데 활용할게요.</p><button className="gradient-button" type="button" onClick={() => setMode('mypage')}>마이페이지로 돌아가기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></section>
        ) : (
          <form className="survey-content" onSubmit={(event) => { event.preventDefault(); setSurveySubmitted(true) }}>
            <header className="survey-heading"><div className="survey-heading-icon"><MessageSquare aria-hidden="true" size={28} strokeWidth={1.7} /></div><h1 id="survey-title">로고를 만드는 과정은 어떠셨나요?</h1><p>초기 화장품 창업자가 더 쉽게 사용할 수 있도록 의견을 들려주세요.</p></header>

            <section className="survey-section" aria-labelledby="rating-title"><h2 id="rating-title">결과에 얼마나 만족하시나요?</h2><div className="rating-options" role="radiogroup" aria-label="결과 만족도"><button type="button" role="radio" aria-checked={surveyRating === 5} className={surveyRating === 5 ? 'rating-choice like selected' : 'rating-choice like'} onClick={() => setSurveyRating(5)}><ThumbsUp aria-hidden="true" size={34} strokeWidth={1.7} fill={surveyRating === 5 ? 'currentColor' : 'none'} /><span>좋아요</span></button><button type="button" role="radio" aria-checked={surveyRating === 1} className={surveyRating === 1 ? 'rating-choice dislike selected' : 'rating-choice dislike'} onClick={() => setSurveyRating(1)}><ThumbsDown aria-hidden="true" size={34} strokeWidth={1.7} fill={surveyRating === 1 ? 'currentColor' : 'none'} /><span>싫어요</span></button></div></section>

            <section className="survey-section" aria-labelledby="improvement-title"><h2 id="improvement-title">어떤 부분이 더 좋아졌으면 하나요?</h2><p className="survey-helper">개선이 필요하다고 느낀 항목을 모두 선택해주세요.</p><div className="improvement-grid">{surveyImprovementOptions.map((item) => { const selected = surveyImprovements.includes(item); return <button key={item} type="button" className={selected ? 'improvement-option selected' : 'improvement-option'} aria-pressed={selected} onClick={() => toggleSurveyImprovement(item)}><span>{selected ? <Check size={16} strokeWidth={2.4} /> : <Plus size={16} strokeWidth={1.8} />}</span>{item}</button> })}</div></section>

            <section className="survey-section" aria-labelledby="comment-title"><h2 id="comment-title">추가 의견</h2><textarea value={surveyComment} onChange={(event) => setSurveyComment(event.target.value)} placeholder="어렵거나 이해되지 않았던 부분을 자유롭게 작성해주세요." maxLength={500} /><div className="survey-character-count">{surveyComment.length} / 500</div></section>

            <button className="survey-submit gradient-button" type="submit">의견 보내기 <ChevronRight aria-hidden="true" size={22} strokeWidth={1.8} /></button>
          </form>
        )}
      </main>
    )
  }

  const renderCreditModal = () => (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreditModal(null) }}>
      <section className="credit-modal" role="dialog" aria-modal="true" aria-labelledby="credit-modal-title">
        <button className="modal-close" type="button" aria-label="크레딧 안내 닫기" onClick={() => setCreditModal(null)}><X aria-hidden="true" size={22} strokeWidth={1.8} /></button>
        <div className="credit-modal-icon"><Download aria-hidden="true" size={28} strokeWidth={1.8} /></div>
        <h2 id="credit-modal-title">크레딧을 확인해볼까요?</h2>
        <p>현재 남은 크레딧은 <strong>{remainingCredits}개</strong>예요.</p>
        <p>짧은 설문조사에 참여하시면 크레딧 <strong>1개</strong>를 더 드릴게요. 지금 의견을 남겨볼까요?</p>
        <div className="credit-modal-actions">
          <button className="gradient-button" type="button" onClick={() => setCreditModal('survey')}>설문 참여하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
          <button className="modal-secondary-button" type="button" onClick={remainingCredits > 0 ? downloadWithCredit : () => setCreditModal(null)}>{remainingCredits > 0 ? '크레딧 사용하고 다운로드' : '닫기'}</button>
        </div>
      </section>
    </div>
  )

  const renderCreditSurveyModal = () => (
    <div className="modal-backdrop" role="presentation">
      <section className="credit-modal survey-modal" role="dialog" aria-modal="true" aria-labelledby="credit-survey-title">
        <button className="modal-close" type="button" aria-label="설문 닫기" onClick={() => setCreditModal(null)}><X aria-hidden="true" size={22} strokeWidth={1.8} /></button>
        <div className="survey-modal-heading"><MessageSquare aria-hidden="true" size={24} strokeWidth={1.8} /><div><h2 id="credit-survey-title">잠깐만 의견을 들려주세요</h2><p>설문에 참여하시면 크레딧 1개를 드려요.</p></div></div>
        <form onSubmit={submitCreditSurvey}>
          <div className="modal-survey-block"><h3>결과에 얼마나 만족하시나요?</h3><div className="modal-rating-options" role="radiogroup" aria-label="결과 만족도"><button type="button" role="radio" aria-checked={surveyRating === 5} className={surveyRating === 5 ? 'modal-rating-choice like selected' : 'modal-rating-choice like'} onClick={() => setSurveyRating(5)}><ThumbsUp aria-hidden="true" size={24} strokeWidth={1.8} fill={surveyRating === 5 ? 'currentColor' : 'none'} /><span>좋아요</span></button><button type="button" role="radio" aria-checked={surveyRating === 1} className={surveyRating === 1 ? 'modal-rating-choice dislike selected' : 'modal-rating-choice dislike'} onClick={() => setSurveyRating(1)}><ThumbsDown aria-hidden="true" size={24} strokeWidth={1.8} fill={surveyRating === 1 ? 'currentColor' : 'none'} /><span>싫어요</span></button></div></div>
          <div className="modal-survey-block"><h3>어떤 부분이 더 좋아졌으면 하나요?</h3><div className="modal-improvement-grid">{surveyImprovementOptions.map((item) => { const selected = surveyImprovements.includes(item); return <button key={item} type="button" className={selected ? 'modal-improvement-option selected' : 'modal-improvement-option'} aria-pressed={selected} onClick={() => toggleSurveyImprovement(item)}><span>{selected ? <Check size={13} strokeWidth={2.4} /> : <Plus size={13} strokeWidth={1.8} />}</span>{item}</button> })}</div></div>
          <div className="modal-survey-block"><h3>추가 의견</h3><textarea value={surveyComment} onChange={(event) => setSurveyComment(event.target.value)} placeholder="어렵거나 이해되지 않았던 부분을 자유롭게 작성해주세요." maxLength={500} /></div>
          <button className="gradient-button modal-submit" type="submit">의견 보내고 크레딧 받기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
        </form>
      </section>
    </div>
  )

  const renderLoginScreen = () => (
    <main className="login-screen">
      <section className="login-content" aria-labelledby="login-title">
        <div className="login-brand-lockup">
          <BrandLogo />
          <span>GenMark AI</span>
        </div>
        <div className="login-hero-mark">
          <img className="login-stamp-art" src="/stamp-sharp.svg" alt="선명하게 보정된 도장 이미지" />
        </div>
        <h1 id="login-title">만들던 브랜드를<br /><strong>안전하게 저장하세요</strong></h1>
        <p className="login-description">로그인하면 작성 중인 내용과 생성한 로고,<br className="login-break" /> 상표 이미지 분석 결과를 나중에도 확인할 수 있어요.</p>
        {authError ? <p className="login-error" role="alert">{authError}</p> : null}
        <div className="login-providers">
          <button className="provider-button kakao-button" type="button" onClick={() => void completeLogin('kakao')} disabled={authLoading}>
            <img className="provider-logo" src="/kakao-logo.png" alt="" />
            <span>{authLoading ? '로그인 처리 중…' : '카카오로 계속하기'}</span>
          </button>
          <button className="provider-button google-button" type="button" onClick={() => void completeLogin('google')} disabled={authLoading}>
            <img className="provider-logo" src="/google-logo.png" alt="" />
            <span>{authLoading ? '로그인 처리 중…' : 'Google로 계속하기'}</span>
          </button>
        </div>
        <p className="login-terms">계속하면 GenMark AI의 <a href="#terms">이용약관</a>과<br /><a href="#privacy">개인정보 처리방침</a>에 동의하게 됩니다.</p>
        <button className="skip-login" type="button" onClick={() => setMode(loginReturnMode)}>나중에 할게요 <span aria-hidden="true">›</span></button>
      </section>
    </main>
  )

  return (
    <div className="app-shell light-shell">
      {mode === 'login' ? (
        <header className="login-header">
          <button className="login-back" type="button" onClick={() => setMode(loginReturnMode)}>‹ <span>{loginReturnMode === 'hero' ? '랜딩' : '홈'}</span></button>
          <span className="login-header-state">안전하게 저장하기</span>
        </header>
      ) : mode === 'onboarding' || mode === 'industry' || mode === 'brand-details' || mode === 'company-details' || mode === 'hero' || mode === 'choice' || mode === 'tone' || mode === 'style' || mode === 'final' || mode === 'loading' || mode === 'trademark-loading' || mode === 'trademark-selection' || mode === 'trademark-result' || mode === 'result' || mode === 'edit' || mode === 'mypage' || mode === 'survey' ? null : (
        <header className="main-header">
          <a className="main-brand" href="#home" aria-label="GenMark AI 홈" onClick={() => setMode('home')}>
            <BrandLogo />
            <span>GenMark AI</span>
          </a>
          <button className="outline-login" type="button" disabled={authRestoring} onClick={() => loggedIn ? void handleLogout() : setMode('login')}>
            {authRestoring ? '확인 중…' : loggedIn ? '로그아웃' : '로그인'}
          </button>
        </header>
      )}

      {mode === 'login' ? renderLoginScreen() : mode === 'onboarding' ? renderOnboardingScreen() : mode === 'industry' ? renderIndustrySelectionScreen() : mode === 'brand-details' ? renderBrandDetailsScreen() : mode === 'company-details' ? renderCompanyDetailsScreen() : mode === 'choice' ? renderChoiceScreen() : mode === 'tone' ? renderToneSelectionScreen() : mode === 'style' ? renderStyleSelectionScreen() : mode === 'final' ? renderFinalRequestScreen() : mode === 'loading' ? renderLoadingScreen() : mode === 'trademark-loading' ? renderTrademarkLoadingScreen() : mode === 'trademark-selection' ? renderTrademarkSelectionScreen() : mode === 'trademark-result' ? renderTrademarkResultScreen() : mode === 'result' ? renderLogoResultScreen() : mode === 'edit' ? renderLogoEditScreen() : mode === 'mypage' ? renderMypageScreen() : mode === 'survey' ? renderSurveyScreen() : mode === 'hero' ? (
        renderAnimatedGalleryHeroScreen()
      ) : mode === 'home' ? (
        <main id="home" className="main-home">
          {renderFeaturedHero()}

          <section className="curation-section" aria-labelledby="curation-title">
            <div className="filter-row" role="tablist" aria-label="로고 스타일 필터">
              {categories.map((category) => (
                <button key={category} type="button" className={activeCategory === category ? 'filter-button active' : 'filter-button'} onClick={() => setActiveCategory(category)}>
                  {category}
                </button>
              ))}
            </div>
            <div className="section-heading">
              <h2 id="curation-title">큐레이션 갤러리</h2>
              <div className="gallery-controls">
                <button type="button" aria-label="이전 로고 보기" onClick={() => scrollGallery(-340)}><ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} /></button>
                <button type="button" aria-label="다음 로고 보기" onClick={() => scrollGallery(340)}><ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} /></button>
              </div>
            </div>
            <div
              className="gallery-track"
              ref={galleryRef}
              onPointerDown={handleGalleryPointerDown}
              onPointerMove={handleGalleryPointerMove}
              onPointerUp={handleGalleryPointerUp}
              onPointerCancel={handleGalleryPointerUp}
            >
              {filteredItems.map((item) => {
                const liked = likedIds.includes(item.id)
                return (
                  <article className="gallery-card" key={item.id}>
                    <div className={`gallery-visual ${item.tone}`} style={{ backgroundPosition: item.position }}>
                      <button type="button" className={liked ? 'favorite-button liked' : 'favorite-button'} aria-label={`${item.name} 좋아요 ${liked ? '취소' : '추가'}`} onClick={() => toggleLike(item.id)}>
                        <Heart aria-hidden="true" size={22} strokeWidth={1.8} fill={liked ? 'currentColor' : 'none'} />
                      </button>
                      <div className="gallery-art-copy">
                        <span aria-hidden="true">{item.id === 'luna' ? <CircleCheck size={32} strokeWidth={1.4} /> : item.id === 'sora' ? <Droplets size={32} strokeWidth={1.4} /> : <Sparkles size={32} strokeWidth={1.4} />}</span>
                        <strong>{item.name}</strong>
                        <small>{item.category === '콤비네이션' ? 'CLEAN BEAUTY' : item.category.toUpperCase()}</small>
                      </div>
                      <span className="visual-tag">{item.category}</span>
                    </div>
                    <div className="gallery-meta">
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.meta}</p>
                      </div>
                      <div className="like-count"><Heart aria-hidden="true" size={17} strokeWidth={1.8} fill="currentColor" />{item.likes}</div>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="gallery-dots" aria-hidden="true"><span className="active" /><span /><span /><span /><span /></div>
          </section>
        </main>
      ) : null}

      {!['loading', 'trademark-loading', 'hero', 'login'].includes(mode) && <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={mode === 'home' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setMode('home')}>
          <House className="nav-icon" aria-hidden="true" size={26} strokeWidth={1.8} /><span>홈</span>
        </button>
        <button className={mode === 'mypage' || mode === 'survey' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setMode('mypage')}>
          <UserRound className="nav-icon" aria-hidden="true" size={26} strokeWidth={1.8} /><span>마이페이지</span>
        </button>
      </nav>}

      {creditModal === 'credit' ? renderCreditModal() : creditModal === 'survey' ? renderCreditSurveyModal() : null}
    </div>
  )
}

function App() {
  const isAdminPath = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

  if (isAdminPath) {
    return (
      <Suspense fallback={<main aria-live="polite">관리자 화면을 불러오는 중입니다.</main>}>
        <AdminDashboard />
      </Suspense>
    )
  }

  return <CustomerApp />
}

export default App
