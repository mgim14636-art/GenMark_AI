import { FormEvent, PointerEvent, useEffect, useRef, useState } from 'react'
import CopperplateHatch from './components/ui/CopperplateHatch'

type ViewMode = 'home' | 'hero' | 'onboarding' | 'brand-details' | 'choice' | 'setup' | 'tone' | 'style' | 'final' | 'loading' | 'trademark-loading' | 'trademark-selection' | 'result' | 'edit' | 'login'
type OnboardingOption = 'online' | 'social' | 'offline'
type AudienceOption = 'company' | 'owner' | 'hobby' | 'sidejob'
type CoreValue = 'vegan' | 'crueltyFree' | 'lowIrritation' | 'derma' | 'cleanBeauty' | 'natural' | 'premium' | 'sustainable' | 'scientific' | 'reasonable' | 'emotional'
type ToneOption = 'friendly' | 'professional' | 'warm' | 'trendy' | 'minimal'
type LogoStyle = 'symbol' | 'wordmark' | 'combination' | 'lettermark'

const categories = ['전체', '워드마크', '콤비네이션', '레터마크', '미니멀']

const toneOptions: Array<{ id: ToneOption; label: string; description: string; colors: [string, string] }> = [
  { id: 'friendly', label: '친근하고 다정한', description: '편안하고 부드러운 인상', colors: ['#f39bbd', '#b9d3f7'] },
  { id: 'professional', label: '전문적이고 신뢰감 있는', description: '정돈되고 믿음직한 인상', colors: ['#17185b', '#a45c72'] },
  { id: 'warm', label: '감성적이고 따뜻한', description: '섬세하고 따뜻한 인상', colors: ['#d29474', '#f2eadc'] },
  { id: 'trendy', label: '유니크하고 트렌디한', description: '개성 있고 감각적인 인상', colors: ['#171713', '#f2f2f4'] },
  { id: 'minimal', label: '미니멀하고 직관적인', description: '군더더기 없이 명확한 인상', colors: ['#396fc8', '#dde4ff'] },
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

function Sparkle() {
  return <span aria-hidden="true" className="sparkle">✦</span>
}

function BrandLogo() {
  return (
    <span className="brand-emblem" aria-hidden="true">
      <span className="leaf leaf-left" />
      <span className="leaf leaf-center" />
      <span className="leaf leaf-right" />
      <span className="leaf-stem" />
    </span>
  )
}

function App() {
  const [mode, setMode] = useState<ViewMode>(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view')
    if (requestedView === 'login') return 'login'
    if (requestedView === 'hero') return 'hero'
    if (requestedView === 'onboarding') return 'onboarding'
    if (requestedView === 'brand-details' || requestedView === 'brand-info' || requestedView === 'values') return 'brand-details'
    if (requestedView === 'choice' || requestedView === 'ci-bi' || requestedView === 'brand-type') return 'choice'
    if (requestedView === 'setup') return 'setup'
    if (requestedView === 'tone' || requestedView === 'tone-color' || requestedView === 'tone-and-color') return 'tone'
    if (requestedView === 'style' || requestedView === 'logo-style' || requestedView === 'logo-shape') return 'style'
    if (requestedView === 'final' || requestedView === 'details' || requestedView === 'request') return 'final'
    if (requestedView === 'loading' || requestedView === 'logo-loading' || requestedView === 'generating') return 'loading'
    if (requestedView === 'trademark-loading' || requestedView === 'trademark' || requestedView === 'trademark-analysis') return 'trademark-loading'
    if (requestedView === 'trademark-selection' || requestedView === 'trademark-choice' || requestedView === 'trademark-select') return 'trademark-selection'
    if (requestedView === 'result' || requestedView === 'logo-result' || requestedView === 'generated-logo') return 'result'
    if (requestedView === 'edit' || requestedView === 'logo-edit' || requestedView === 'logo-editor') return 'edit'
    return 'home'
  })
  const [loggedIn, setLoggedIn] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [activeCategory, setActiveCategory] = useState('전체')
  const [likedIds, setLikedIds] = useState<string[]>([])
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1)
  const [onboardingSelection, setOnboardingSelection] = useState<OnboardingOption[]>(['online'])
  const [audienceSelection, setAudienceSelection] = useState<AudienceOption[]>(['company'])
  const [brandKind, setBrandKind] = useState<'ci' | 'bi' | null>(null)
  const [projectName, setProjectName] = useState('')
  const [direction, setDirection] = useState('깨끗하고 신뢰감 있게')
  const [additionalRequest, setAdditionalRequest] = useState('')
  const [brandName, setBrandName] = useState('')
  const [coreValues, setCoreValues] = useState<CoreValue[]>([])
  const [toneSelection, setToneSelection] = useState<ToneOption>('friendly')
  const [toneMode, setToneMode] = useState<'ai' | 'manual'>('ai')
  const [logoStyle, setLogoStyle] = useState<LogoStyle>('combination')
  const [resultCandidate, setResultCandidate] = useState(0)
  const [resultSaved, setResultSaved] = useState(false)
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

  useEffect(() => {
    if (mode !== 'loading' && mode !== 'trademark-loading') return

    const timer = window.setTimeout(() => setMode('result'), mode === 'loading' ? 1700 : 1900)
    return () => window.clearTimeout(timer)
  }, [mode])
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

  const submitProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (projectName.trim()) setMode('final')
  }

  const completeLogin = () => {
    setLoggedIn(true)
    setOnboardingStep(1)
    setMode(onboardingCompleted ? 'brand-details' : 'onboarding')
  }

  const startOnboarding = () => {
    if (!loggedIn) {
      setMode('login')
      return
    }

    setOnboardingStep(1)
    setMode(onboardingCompleted ? 'brand-details' : 'onboarding')
  }

  const advanceOnboarding = () => {
    if (onboardingStep === 1) {
      setOnboardingStep(2)
      return
    }

    setOnboardingCompleted(true)
    setMode('choice')
  }

  const openTrademarkSelection = (entry: 'generation' | 'result') => {
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
    illustration: string
  }> = [
    { id: 'company', eyebrow: '회사 / 팀', title: '회사 / 팀', description: '법인 · 팀 프로젝트', illustration: '/onboarding-company.svg' },
    { id: 'owner', eyebrow: '자영업', title: '자영업', description: '개인 사업 · 가게', illustration: '/onboarding-owner.svg' },
    { id: 'hobby', eyebrow: '취미 / 창작', title: '취미 / 창작', description: '개인 활동 · 포트폴리오', illustration: '/onboarding-hobby.svg' },
    { id: 'sidejob', eyebrow: '부업 & 투잡', title: '부업 & 투잡', description: 'N잡 · 사이드 프로젝트', illustration: '/onboarding-sidejob.svg' },
  ]

  const renderOnboardingIllustration = (option: OnboardingOption) => {
    const illustration = option === 'online'
      ? '/onboarding-online.svg'
      : option === 'social'
        ? '/onboarding-social.svg'
        : '/onboarding-offline.svg'
    return (
      <div className={`onboarding-illustration illustration-${option}`} aria-hidden="true">
        <img className="onboarding-card-art" src={illustration} alt="" />
      </div>
    )
  }

  const renderAudienceIllustration = (option: AudienceOption) => {
    const audience = audienceOptions.find((item) => item.id === option)
    return (
      <div className={`onboarding-illustration illustration-${option}`} aria-hidden="true">
        <img className="onboarding-card-art" src={audience?.illustration ?? ''} alt="" />
      </div>
    )
  }

  const renderOnboardingScreen = () => (
    <main className={`onboarding-screen onboarding-step-${onboardingStep}`}>
      <img className="onboarding-art" src="/aurora-bubbles.png" alt="" aria-hidden="true" />
      <div className="onboarding-overlay" />
      <section className="onboarding-content" aria-labelledby="onboarding-title">
        <div className="onboarding-brand"><BrandLogo /><span>GenMark AI</span></div>
        <div className="onboarding-step"><span>{onboardingStep} / 2</span></div>
        {onboardingStep === 1 ? (
          <h1 id="onboarding-title">로고를 어디에<br /><strong>사용할 예정인가요?</strong></h1>
        ) : (
          <h1 id="onboarding-title">어떤 계기로<br /><strong>방문하게 되셨나요?</strong></h1>
        )}
        <p className="onboarding-selection-hint">{onboardingStep === 1 ? '복수 선택 가능' : '하나만 선택 가능'}</p>
        <div className="onboarding-options">
          {onboardingStep === 1 ? onboardingOptions.map((option) => {
            const selected = onboardingSelection.includes(option.id)
            return (
              <button key={option.id} type="button" className={selected ? 'onboarding-option selected' : 'onboarding-option'} onClick={() => toggleOnboardingSelection(option.id)} aria-pressed={selected}>
                {renderOnboardingIllustration(option.id)}
                <span className="onboarding-option-copy">
                  <small>{option.eyebrow}</small>
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </span>
                <span className="onboarding-radio" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            )
          }) : audienceOptions.map((option) => {
            const selected = audienceSelection.includes(option.id)
            return (
              <button key={option.id} type="button" className={selected ? 'onboarding-option selected' : 'onboarding-option'} onClick={() => toggleAudienceSelection(option.id)} aria-pressed={selected}>
                {renderAudienceIllustration(option.id)}
                <span className="onboarding-option-copy">
                  <small>{option.eyebrow}</small>
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </span>
                <span className="onboarding-radio" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            )
          })}
        </div>
        <button className="onboarding-next" type="button" onClick={advanceOnboarding}>
          {onboardingStep === 1 ? '다음' : '시작하기'}
        </button>
      </section>
    </main>
  )

  const renderBrandDetailsScreen = () => {
    const coreValueOptions: Array<{ id: CoreValue; label: string; icon: string }> = [
      { id: 'vegan', label: '비건', icon: 'leaf' },
      { id: 'crueltyFree', label: '크루얼티프리', icon: 'bunny' },
      { id: 'lowIrritation', label: '저자극', icon: 'drop' },
      { id: 'derma', label: '더마', icon: 'shield' },
      { id: 'cleanBeauty', label: '클린뷰티', icon: 'flower' },
      { id: 'natural', label: '자연주의', icon: 'leaf' },
      { id: 'premium', label: '프리미엄', icon: 'crown' },
      { id: 'sustainable', label: '지속가능성', icon: 'recycle' },
      { id: 'scientific', label: '과학적 검증', icon: 'flask' },
      { id: 'reasonable', label: '합리적인 가격', icon: 'tag' },
      { id: 'emotional', label: '감성적인 경험', icon: 'heart' },
    ]

    return (
      <main className="brand-details-screen">
        <section className="brand-details-content" aria-labelledby="brand-details-title">
          <div className="brand-details-progress" aria-label="브랜드 생성 4단계 중 2단계">
            <span className="brand-details-step-badge">2 / 4</span>
            <div className="brand-details-progress-track" aria-hidden="true">
              <span className="brand-details-progress-line" />
              <span className="brand-details-progress-node complete">✓</span>
              <span className="brand-details-progress-node active" />
              <span className="brand-details-progress-node" />
              <span className="brand-details-progress-node" />
            </div>
          </div>

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
            <h2 id="core-values-title">브랜드가 추구하는 가치 <small>(최대 3개 선택)</small></h2>
            <div className="core-values-grid">
              {coreValueOptions.map((option) => {
                const selected = coreValues.includes(option.id)
                return (
                  <button key={option.id} type="button" className={selected ? 'core-value-button selected' : 'core-value-button'} aria-pressed={selected} onClick={() => toggleCoreValue(option.id)}>
                    <span className={`core-value-icon ${option.icon}`} aria-hidden="true" />
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="core-values-note"><span aria-hidden="true">ⓘ</span>3개까지 선택할 수 있어요. 선택하지 않아도 다음 단계로 진행할 수 있어요.</p>
          </section>

          <button className="brand-details-next" type="button" onClick={() => setMode('tone')}>
            다음 <span aria-hidden="true">›</span>
          </button>
        </section>
      </main>
    )
  }

  const renderToneSelectionScreen = () => (
    <main className="tone-selection-screen">
      <section className="tone-selection-content" aria-labelledby="tone-selection-title">
        <div className="tone-progress" aria-label="브랜드 생성 4단계 중 3단계">
          <span className="tone-step-badge">3 / 4</span>
          <div className="tone-progress-track" aria-hidden="true">
            <span className="tone-progress-line" />
            <span className="tone-progress-node complete">✓</span>
            <span className="tone-progress-node complete">✓</span>
            <span className="tone-progress-node active" />
            <span className="tone-progress-node" />
          </div>
        </div>

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
                <span className="tone-radio" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            )
          })}
        </section>

        <div className="tone-mode-toggle" role="tablist" aria-label="색상 지정 방식">
          <button className={toneMode === 'ai' ? 'tone-mode-button active' : 'tone-mode-button'} type="button" role="tab" aria-selected={toneMode === 'ai'} onClick={() => setToneMode('ai')}>
            <Sparkle /> AI 추천
          </button>
          <button className={toneMode === 'manual' ? 'tone-mode-button active' : 'tone-mode-button'} type="button" role="tab" aria-selected={toneMode === 'manual'} onClick={() => setToneMode('manual')}>
            직접 지정
          </button>
        </div>

        <section className="tone-color-card" aria-label="색상 추천 안내">
          <span className="tone-color-sparkles" aria-hidden="true">✦</span>
          <div>
            <h2>{toneMode === 'ai' ? 'AI 색상 추천' : '직접 색상 지정'}</h2>
            <p>{toneMode === 'ai' ? '브랜드 정보를 분석해 최적의 색상을 선택해요' : '원하는 색상을 직접 지정할 수 있어요'}</p>
          </div>
          <span className="tone-auto-chip">{toneMode === 'ai' ? '자동' : '직접'}</span>
        </section>

        <button className="tone-next" type="button" onClick={() => setMode('style')}>
          다음 <span aria-hidden="true">›</span>
        </button>
      </section>
    </main>
  )

  const renderStyleSelectionScreen = () => (
    <main className="logo-style-screen">
      <section className="logo-style-content" aria-labelledby="logo-style-title">
        <div className="logo-style-progress" aria-label="브랜드 생성 4단계 중 3단계">
          <span className="logo-style-step-badge">3 / 4</span>
          <div className="logo-style-progress-track" aria-hidden="true">
            <span className="logo-style-progress-line" />
            <span className="logo-style-progress-node complete">1</span>
            <span className="logo-style-progress-node complete">2</span>
            <span className="logo-style-progress-node active">3</span>
            <span className="logo-style-progress-node">4</span>
          </div>
        </div>

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
                <span className="logo-style-radio" aria-hidden="true">{selected ? '✓' : ''}</span>
              </button>
            )
          })}
        </section>

        <button className="logo-style-next" type="button" onClick={() => setMode('final')}>
          다음 <span aria-hidden="true">›</span>
        </button>
      </section>
    </main>
  )

  const renderFeaturedHero = () => (
    <section className="featured-hero" aria-labelledby="featured-title">
      <img className="featured-art" src="/aurora-bubbles.png" alt="핑크와 보라색의 투명한 구체가 겹쳐진 스킨케어 이미지" />
      <div className="featured-scrim" />
      <div className="featured-lockup">
        <BrandLogo />
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
        <div className="hero-screen-brand"><span className="hero-screen-mark" aria-hidden="true">✦</span><span>GenMark AI</span></div>
        <button type="button" className="hero-screen-login" onClick={() => setMode('login')}>로그인</button>
      </header>
      <section className="hero-screen-panel" aria-labelledby="hero-screen-title">
        <CopperplateHatch className="hero-screen-art" density={1.1} intensity={1.1} speed={0.42} interactive />
        <div className="hero-screen-overlay" />
        <div className="hero-screen-copy">
          <p className="hero-screen-eyebrow"><Sparkle /> Beauty brand starter</p>
          <h1 id="hero-screen-title">화장품 로고를 만들고<br /><strong>비슷한 상표가 있는지도</strong><br />확인하세요</h1>
          <p className="hero-screen-description">브랜드 정보를 입력하면 AI 로고 후보를 만들고,<br />기존 화장품 상표 표본 이미지와 비교해 안전성도 확인해드려요.</p>
          <button className="hero-screen-cta" type="button" onClick={() => setMode('home')}><Sparkle /> <span>서비스 시작하기</span></button>
          <p className="hero-screen-note">◇ 디자인 경험이 없어도 괜찮아요&nbsp;&nbsp;·&nbsp;&nbsp;약 5분이면 시작할 수 있어요</p>
        </div>
      </section>
    </main>
  )

  const renderChoiceScreen = () => {
    const chooseBrandKind = (kind: 'ci' | 'bi') => {
      setBrandKind(kind)
      setMode('brand-details')
    }

    return (
      <main className="brand-choice-screen">
        <section className="brand-choice-content" aria-label="CI와 BI 로고 선택">
          <div className="brand-choice-list">
            <article className="brand-choice-card ci-card">
              <div className="brand-choice-art-wrap"><img src="/ci-white.svg" alt="회사와 기업을 대표하는 CI 로고 예시" /></div>
              <div className="brand-choice-copy">
                <span className="brand-choice-label">회사 · 기업 로고</span>
                <h2>CI 만들기</h2>
                <p>회사나 매장 전체를<br />대표하는 로고예요.</p>
                <div className="brand-choice-recommend"><strong>✦ 이런 경우 추천</strong><ul><li>회사명을 로고로 만들고 싶어요</li><li>여러 제품을 하나의 회사 브랜드로 운영할 예정이에요</li><li>명함이나 회사 소개 자료에도 사용할 예정이에요</li></ul></div>
                <div className="brand-choice-result"><strong><span className="choice-gift" aria-hidden="true" />결과물</strong><span>기업 로고 · 대표 컬러 · 추천 글씨체 · 명함 시안</span></div>
                <button className="brand-choice-cta ci-cta" type="button" onClick={() => chooseBrandKind('ci')}>회사 로고 만들기 <span aria-hidden="true">›</span></button>
              </div>
            </article>
            <article className="brand-choice-card bi-card">
              <div className="brand-choice-copy">
                <span className="brand-choice-label">제품 · 브랜드 로고</span>
                <h2>BI 만들기</h2>
                <p>특정 화장품 브랜드나 제품 라인을<br />대표하는 로고예요.</p>
                <div className="brand-choice-recommend"><strong>✦ 이런 경우 추천</strong><ul><li>새로운 화장품 브랜드를 출시하려고 해요</li><li>기존 회사에서 새로운 제품 라인을 만들고 있어요</li><li>스마트스토어 제품 썸네일에 사용할 로고가 필요해요</li></ul></div>
                <div className="brand-choice-result"><strong><span className="choice-gift" aria-hidden="true" />결과물</strong><span>제품 브랜드 로고 · 대표 컬러 · 추천 글씨체 · 제품 썸네일</span></div>
                <button className="brand-choice-cta bi-cta" type="button" onClick={() => chooseBrandKind('bi')}>제품 · 브랜드 로고 만들기 <span aria-hidden="true">›</span></button>
              </div>
              <div className="brand-choice-art-wrap"><img src="/bi-white.svg" alt="제품과 화장품 브랜드를 대표하는 BI 로고 예시" /></div>
            </article>
          </div>
        </section>
        <button className="brand-choice-edit" type="button" onClick={() => setMode('onboarding')}>편집</button>
        <button className="brand-choice-share" type="button" aria-label="선택 화면 공유"><span className="share-glyph" aria-hidden="true" /></button>
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
        <section className="final-request-content" aria-labelledby="final-request-title">
          <div className="final-progress" aria-label="브랜드 생성 4단계 중 4단계">
            <span className="final-step-badge">4 / 4</span>
            <div className="final-progress-track" aria-hidden="true">
              <span className="final-progress-line" />
              <span className="final-progress-node complete">✓</span>
              <span className="final-progress-node complete">✓</span>
              <span className="final-progress-node complete">✓</span>
              <span className="final-progress-node active" />
            </div>
          </div>

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
            <span className="final-tip-icon" aria-hidden="true">♧</span>
            <div>
              <p>다음과 같은 내용을 작성할 수 있어요.</p>
              <div className="final-suggestion-list">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => addSuggestion(suggestion)}>
                    <span aria-hidden="true">＋</span>{suggestion}
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
                  <button className="final-edit-button" type="button" onClick={() => setMode('brand-details')}>수정하기 <span aria-hidden="true">›</span></button>
                </div>
              ))}
              <div className="final-summary-row">
                <span className="final-detail-icon icon-color" aria-hidden="true" />
                <span className="final-summary-label">선호 색상</span>
                <span className="final-color-swatches" aria-label="선호 색상 4개">
                  <i className="swatch-green" /><i className="swatch-yellow" /><i className="swatch-cream" /><i className="swatch-gray" />
                </span>
                  <button className="final-edit-button" type="button" onClick={() => setMode('brand-details')}>수정하기 <span aria-hidden="true">›</span></button>
              </div>
              <div className="final-summary-row">
                <span className="final-detail-icon icon-logo" aria-hidden="true" />
                <span className="final-summary-label">로고 형태</span>
                <span className="final-summary-value">콤비네이션 (그림 + 브랜드명) <em>추천</em></span>
                <button className="final-edit-button" type="button" onClick={() => setMode('brand-details')}>수정하기 <span aria-hidden="true">›</span></button>
              </div>
              <div className="final-summary-row final-summary-last">
                <span className="final-detail-icon icon-question" aria-hidden="true">?</span>
                <span className="final-summary-label">추가 요청사항</span>
                <span className="final-summary-value">{additionalRequest || '별도 요청 없음'}</span>
                <span className="final-summary-dash" aria-hidden="true">—</span>
              </div>
            </div>
          </section>

          <button className="final-generate-button" type="button" onClick={() => openTrademarkSelection('generation')}>
            <span className="final-sparkle-cluster" aria-hidden="true"><i>✧</i><i>✧</i><i>✧</i></span>
            로고 생성하기
            <span className="final-generate-arrow" aria-hidden="true">›</span>
          </button>
          <p className="final-footnote"><span aria-hidden="true">ⓘ</span> 생성된 후보는 나중에 색상과 글씨체를 수정할 수 있어요.</p>
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
              <span className="logo-loading-sparkle sparkle-one">✦</span>
              <span className="logo-loading-sparkle sparkle-two">✦</span>
            </div>
          </div>
          <div className="logo-loading-status">로고 생성 중...</div>

          <section className="logo-loading-steps" aria-label="로고 생성 단계">
            {loadingSteps.map((step, index) => (
              <article className={index === 0 ? 'logo-loading-step active' : 'logo-loading-step'} key={step.number}>
                <span className="logo-loading-step-number">{step.number}</span>
                <span className={`logo-loading-step-icon icon-${step.icon}`} aria-hidden="true" />
                <p>{step.text}</p>
                {index === 0 && <span className="logo-loading-dots" aria-hidden="true" />}
              </article>
            ))}
          </section>

          <section className="logo-loading-time-card" aria-label="예상 소요 시간">
            <span className="logo-loading-side-icon clock-icon" aria-hidden="true" />
            <div>
              <p>약 1~3분 정도 걸릴 수 있어요.</p>
              <div className="logo-loading-progress" aria-hidden="true"><span /></div>
            </div>
            <span className="logo-loading-side-icon alarm-icon" aria-hidden="true" />
          </section>

          <section className="logo-loading-save-card" aria-label="입력 내용 저장 안내">
            <span className="logo-loading-save-icon" aria-hidden="true" />
            <div>
              <strong>입력한 내용은 저장되어 있어요.</strong>
              <p>잠시 다른 화면을 둘러봐도 괜찮아요.</p>
            </div>
            <span className="logo-loading-cloud" aria-hidden="true" />
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
            <span className="trademark-brand-mark" aria-hidden="true">◇</span>
            <span>GenMark AI</span>
          </div>

          <div className="trademark-progress" aria-label="상표 분석 3단계 중 2단계">
            <span className="trademark-step-badge">2 / 3</span>
            <div className="trademark-progress-track" aria-hidden="true">
              <span className="trademark-progress-line" />
              <span className="trademark-progress-node complete">✓</span>
              <span className="trademark-progress-node complete">✓</span>
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
            <span className="trademark-visual-sparkle sparkle-a">✦</span>
            <span className="trademark-visual-sparkle sparkle-b">✦</span>
          </div>

          <section className="trademark-analysis-steps" aria-label="상표 분석 단계">
            {analysisSteps.map((step) => (
              <div className={`trademark-analysis-step ${step.state}`} key={step.number}>
                <span className="trademark-analysis-number">{step.number}</span>
                <p>{step.text}</p>
                {step.state === 'complete' ? <span className="trademark-analysis-check" aria-hidden="true">✓</span> : <span className="trademark-analysis-spinner" aria-hidden="true" />}
              </div>
            ))}
          </section>

          <section className="trademark-info-card" aria-label="상표 분석 안내">
            <span className="trademark-info-icon" aria-hidden="true">i</span>
            <p>이름 검색이 아니라<br /><strong>로고 이미지의 외관</strong>을 비교하는 과정이에요.</p>
            <span className="trademark-info-art" aria-hidden="true">⌕</span>
          </section>

          <p className="trademark-waiting"><span>✦</span> 분석 중이에요. 잠시만 기다려주세요. <span>✦</span></p>
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
        <header className="trademark-selection-header">
          <div className="trademark-selection-brand"><span className="trademark-selection-brand-mark" aria-hidden="true">✦</span><span>GenMark AI</span></div>
          <button className="trademark-help" type="button" aria-label="상표 분석 도움말">?</button>
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
            <button className="trademark-check-button" type="button" onClick={() => setMode('trademark-loading')}>
              <span className="trademark-check-search" aria-hidden="true" />
              <span>비슷한 상표 이미지 확인하기</span>
              <span aria-hidden="true">›</span>
            </button>
            <button className="trademark-skip-button" type="button" onClick={() => setMode(trademarkEntry === 'result' ? 'result' : 'loading')}>
              <span>지금은 건너뛰기</span>
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <p className="trademark-disclaimer"><span aria-hidden="true">ⓘ</span><span>본 분석은 기존 등록 상표 이미지와의 시각적 유사성을 보여주는 참고 자료입니다.<br />상표 등록 가능 여부나 법적 침해 여부를 판단하지 않습니다.</span></p>
        </section>
      </main>
    )
  }

  const renderLogoResultScreen = () => {
    const candidates = [
      { name: 'LUVÉRA', subtitle: 'COSMETICS', style: 'lavender', direction: '미니멀 · 내추럴' },
      { name: 'LUNÉE', subtitle: 'SKINCARE', style: 'rose', direction: '우아한 · 감성적' },
      { name: 'VERA', subtitle: 'BOTANICAL BEAUTY', style: 'sage', direction: '깨끗한 · 프리미엄' },
      { name: 'NOVA', subtitle: 'BEAUTY LAB', style: 'pearl', direction: '현대적 · 세련된' },
    ]
    const candidate = candidates[resultCandidate]

    return (
      <main className="logo-result-screen" aria-labelledby="logo-result-title">
        <header className="logo-result-header">
          <div className="logo-result-brand"><span aria-hidden="true">✦</span><strong>GenMark AI</strong></div>
          <button className="logo-result-help" type="button" aria-label="도움말">?</button>
        </header>

        <section className="logo-result-content">
          <div className="logo-result-complete"><span aria-hidden="true">✓</span> 로고 후보가 완성됐어요</div>
          <h1 id="logo-result-title">가장 마음에 드는 로고를 선택해주세요</h1>
          <p className="logo-result-lead">후보를 비교하고 색상이나 글씨체를 수정할 수 있어요.</p>
          <div className="logo-result-counter" aria-label={`후보 ${resultCandidate + 1} / 4`}>후보 {resultCandidate + 1} / 4</div>

          <section className="logo-candidate-panel" aria-label="로고 후보 미리보기">
            <button className="logo-candidate-arrow previous" type="button" aria-label="이전 후보" onClick={() => setResultCandidate((current) => (current + candidates.length - 1) % candidates.length)}>‹</button>
            <div className={`logo-candidate-art ${candidate.style}`}>
              <div className="candidate-emblem" aria-hidden="true"><span /><i /><b /></div>
              <strong>{candidate.name}</strong>
              <small>{candidate.subtitle}</small>
            </div>
            <button className="logo-candidate-arrow next" type="button" aria-label="다음 후보" onClick={() => setResultCandidate((current) => (current + 1) % candidates.length)}>›</button>
          </section>
          <div className="logo-result-dots" aria-label="후보 선택">
            {candidates.map((item, index) => <button key={item.name} className={index === resultCandidate ? 'active' : ''} type="button" aria-label={`후보 ${index + 1}`} aria-pressed={index === resultCandidate} onClick={() => setResultCandidate(index)} />)}
          </div>

          <section className="logo-result-details" aria-label="로고 디자인 상세">
            <div className="logo-result-detail-row"><span className="result-detail-icon compass" aria-hidden="true" /><strong>디자인 방향</strong><span>{candidate.direction}</span></div>
            <div className="logo-result-detail-row"><span className="result-detail-icon type" aria-hidden="true">Aa</span><strong>추천 글씨체</strong><span>우아한 세리프 + 깔끔한 산세리프</span></div>
            <div className="logo-result-detail-row"><span className="result-detail-icon drop" aria-hidden="true" /><strong>브랜드 컬러</strong><span className="result-color-swatches"><i /><i /><i /><i /></span></div>
            <div className="logo-result-detail-row feeling"><span className="result-detail-icon heart" aria-hidden="true">♡</span><strong>이 로고가 전달하는 느낌</strong><span>부드럽고 깨끗하면서도<br />프리미엄한 스킨케어 브랜드 이미지</span></div>
          </section>

          <section className="logo-result-trademark" aria-label="상표 이미지 유사도">
            <span className="trademark-result-icon" aria-hidden="true"><i /><b /></span>
            <div><strong>상표 이미지 유사도</strong><p>아직 상표 이미지 유사도를 확인하지 않았어요.</p><button type="button" onClick={() => openTrademarkSelection('result')}>비슷한 상표 이미지 확인하기 <span aria-hidden="true">›</span></button></div>
          </section>

          <div className="logo-result-actions">
            <button className="logo-result-primary" type="button" onClick={() => setResultSaved(true)}><span aria-hidden="true">✦</span>{resultSaved ? '이 로고를 선택했어요' : '이 로고 선택하기'}<span aria-hidden="true">›</span></button>
            <button className="logo-result-edit" type="button" onClick={() => setMode('edit')}><span aria-hidden="true">⌕</span>색상 · 글씨체 수정<span aria-hidden="true">›</span></button>
          </div>

          <div className="logo-result-utility-grid">
            <button type="button" onClick={() => setResultSaved(true)}><span className="result-utility-icon bookmark" aria-hidden="true" />후보로 저장<span aria-hidden="true">›</span></button>
            <button type="button" onClick={() => setResultCandidate((current) => (current + 1) % candidates.length)}><span className="result-utility-icon refresh" aria-hidden="true" />조건을 바꿔<br />다시 만들기<span aria-hidden="true">›</span></button>
            <button type="button"><span className="result-utility-icon download" aria-hidden="true" />로고 파일 받기<span aria-hidden="true">›</span></button>
            <button type="button"><span className="result-utility-icon picture" aria-hidden="true" />제품 썸네일 만들기<span aria-hidden="true">›</span></button>
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
          <button className="logo-editor-back" type="button" aria-label="결과 화면으로 돌아가기" onClick={() => setMode('result')}>‹</button>
          <div className="logo-editor-brand"><span aria-hidden="true">✦</span><strong>GenMark AI</strong></div>
          <button className="logo-editor-save" type="button" onClick={() => setEditorSaved(true)}>{editorSaved ? '저장됨' : '저장'}<span aria-hidden="true">⌄</span></button>
          <button className="logo-editor-help" type="button" aria-label="도움말">?</button>
        </header>

        <section className="logo-editor-content">
          <div className="logo-editor-meta">
            <div className="logo-editor-counter"><button type="button" aria-label="이전 후보" onClick={() => setResultCandidate((current) => (current + 3) % 4)}>‹</button><strong>후보 {resultCandidate + 1} / 4</strong><button type="button" aria-label="다음 후보" onClick={() => setResultCandidate((current) => (current + 1) % 4)}>›</button></div>
            <span className="logo-editor-autosave"><b>✓</b> 자동 저장됨</span>
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
              {editTarget === 'symbol' && <span className="editor-rotate-handle" aria-hidden="true">↻</span>}
            </div>
            <div className="logo-editor-preview-footer">
              <div className="editor-history"><button type="button" aria-label="실행 취소">↶</button><button type="button" aria-label="다시 실행">↷</button></div>
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
                  {fontOptions.map((font, index) => <button key={index} type="button" className={index === 0 ? 'selected' : ''} style={{ fontFamily: index === 0 ? 'Georgia, serif' : index === 1 ? 'Arial, sans-serif' : index === 2 ? 'Garamond, serif' : 'Times New Roman, serif' }}>{font}{index === 0 && <span>✓</span>}</button>)}
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
                <button className="editor-regenerate" type="button" onClick={() => setEditorSymbol((current) => (current + 1) % symbolOptions.length)}>✦　심볼 다시 생성하기</button>
              </div>
            )}
          </section>

          <div className="logo-editor-actions">
            <button className="logo-editor-apply" type="button" onClick={() => { setEditorSaved(true); setMode('result') }}>수정 적용하기</button>
            <button className="logo-editor-trademark" type="button" onClick={() => openTrademarkSelection('result')}>상표 이미지 유사도 다시 확인하기</button>
          </div>
          <p className="logo-editor-note">· 로고의 형태나 배치를 변경하면 상표 이미지 유사도에 영향을 줄 수 있어요.</p>
        </section>
      </main>
    )
  }

  const renderFlowScreen = () => (
    <main className="flow-screen">
      <section className="flow-card">
        {mode === 'setup' ? (
          <form onSubmit={submitProject}>
            <p className="flow-eyebrow">{brandKind === 'ci' ? 'CI 브랜드 프로젝트' : brandKind === 'bi' ? 'BI 브랜드 프로젝트' : '새 브랜드 프로젝트'}</p>
            <h1>어떤 브랜드를<br /><strong>만들고 싶나요?</strong></h1>
            <p className="flow-helper">브랜드 이름과 원하는 인상을 알려주면 로고 생성을 시작합니다.</p>
            <label htmlFor="project-name">브랜드 이름</label>
            <input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="예: Glow Lab" autoFocus />
            <label htmlFor="brand-direction">브랜드가 주는 인상</label>
            <select id="brand-direction" value={direction} onChange={(event) => setDirection(event.target.value)}>
              <option>깨끗하고 신뢰감 있게</option>
              <option>감각적이고 대담하게</option>
              <option>자연스럽고 편안하게</option>
            </select>
            <div className="flow-actions">
              <button className="secondary-button" type="button" onClick={() => setMode('home')}>홈으로</button>
              <button className="gradient-button" type="submit">분석 시작 <Sparkle /></button>
            </div>
          </form>
        ) : (
          <div className="result-state">
            <div className="result-symbol"><Sparkle /></div>
            <p className="flow-eyebrow">첫 분석이 준비됐어요</p>
            <h1><strong>{projectName}</strong>의<br />브랜드 방향을 잡아볼게요.</h1>
            <p className="flow-helper">“{direction}” 방향으로 로고 후보를 준비합니다. 다음 단계에서 생성 결과와 상표 유사도를 함께 확인할 수 있습니다.</p>
            <button className="gradient-button" type="button" onClick={() => setMode('home')}>홈으로 돌아가기 <Sparkle /></button>
          </div>
        )}
      </section>
    </main>
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
        <div className="login-providers">
          <button className="provider-button kakao-button" type="button" onClick={completeLogin}>
            <img className="provider-logo" src="/kakao-logo.png" alt="" />
            <span>카카오로 계속하기</span>
          </button>
          <button className="provider-button google-button" type="button" onClick={completeLogin}>
            <img className="provider-logo" src="/google-logo.png" alt="" />
            <span>Google로 계속하기</span>
          </button>
        </div>
        <p className="login-terms">계속하면 GenMark AI의 <a href="#terms">이용약관</a>과<br /><a href="#privacy">개인정보 처리방침</a>에 동의하게 됩니다.</p>
        <button className="skip-login" type="button" onClick={() => setMode('home')}>나중에 할게요 <span aria-hidden="true">›</span></button>
      </section>
    </main>
  )

  return (
    <div className="app-shell light-shell">
      {mode === 'login' ? (
        <header className="login-header">
          <button className="login-back" type="button" onClick={() => setMode('home')}>‹ <span>홈</span></button>
          <span className="login-header-state">안전하게 저장하기</span>
        </header>
      ) : mode === 'onboarding' || mode === 'brand-details' || mode === 'hero' || mode === 'choice' || mode === 'tone' || mode === 'style' || mode === 'final' || mode === 'loading' || mode === 'trademark-loading' || mode === 'trademark-selection' || mode === 'result' || mode === 'edit' ? null : (
        <header className="main-header">
          <a className="main-brand" href="#home" aria-label="GenMark AI 홈" onClick={() => setMode('home')}>
            <BrandLogo />
            <span>GenMark AI</span>
          </a>
          <button className="outline-login" type="button" onClick={() => mode === 'home' ? setMode('login') : setLoggedIn((current) => !current)}>
            {loggedIn ? '로그아웃' : '로그인'}
          </button>
        </header>
      )}

      {mode === 'login' ? renderLoginScreen() : mode === 'onboarding' ? renderOnboardingScreen() : mode === 'brand-details' ? renderBrandDetailsScreen() : mode === 'choice' ? renderChoiceScreen() : mode === 'tone' ? renderToneSelectionScreen() : mode === 'style' ? renderStyleSelectionScreen() : mode === 'final' ? renderFinalRequestScreen() : mode === 'loading' ? renderLoadingScreen() : mode === 'trademark-loading' ? renderTrademarkLoadingScreen() : mode === 'trademark-selection' ? renderTrademarkSelectionScreen() : mode === 'result' ? renderLogoResultScreen() : mode === 'edit' ? renderLogoEditScreen() : mode === 'hero' ? (
        renderHeroScreen()
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
                <button type="button" aria-label="이전 로고 보기" onClick={() => scrollGallery(-340)}>‹</button>
                <button type="button" aria-label="다음 로고 보기" onClick={() => scrollGallery(340)}>›</button>
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
                        {liked ? '♥' : '♡'}
                      </button>
                      <div className="gallery-art-copy">
                        <span>{item.id === 'luna' ? '☾' : item.id === 'sora' ? '✿' : '◉'}</span>
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
                      <div className="like-count"><span>♥</span>{item.likes}</div>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="gallery-dots" aria-hidden="true"><span className="active" /><span /><span /><span /><span /></div>
          </section>
        </main>
      ) : renderFlowScreen()}

      {mode !== 'login' && mode !== 'onboarding' && mode !== 'brand-details' && mode !== 'hero' && mode !== 'choice' && mode !== 'tone' && mode !== 'style' && mode !== 'final' && mode !== 'loading' && mode !== 'trademark-loading' && mode !== 'trademark-selection' && <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={mode === 'home' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setMode('home')}>
          <span className="nav-icon home-icon" aria-hidden="true">⌂</span><span>홈</span>
        </button>
        <button className={mode !== 'home' ? 'nav-item active' : 'nav-item'} type="button" onClick={startOnboarding}>
          <span className="nav-icon wand-icon" aria-hidden="true">✧</span><span>로고 생성</span>
        </button>
        <button className="nav-item" type="button" onClick={() => setLoggedIn((current) => !current)}>
          <span className="nav-icon profile-icon" aria-hidden="true" /><span>마이페이지</span>
        </button>
      </nav>}
    </div>
  )
}

export default App
