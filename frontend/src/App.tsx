import { FormEvent, lazy, PointerEvent, Suspense, useEffect, useRef, useState } from 'react'
import { AlarmClock, ArrowLeft, ArrowRight, BarChart3, Building2, Check, CircleCheck, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, CloudCheck, Compass, CreditCard, Download, Droplets, FileCheck2, Flower2, FolderCheck, Gem, Gift, GraduationCap, Heart, House, Image as ImageIcon, Info, Laptop, Leaf, MessageSquare, Palette, PawPrint, Pencil, PenLine, Plus, RefreshCw, Search, Shapes, ShieldCheck, Shirt, Sparkles, ThumbsDown, ThumbsUp, Type as TypeIcon, UserRound, UsersRound, Utensils, Video, X, Clock3, type LucideIcon } from 'lucide-react'
import CopperplateHatch from './components/ui/CopperplateHatch'
import AnimatedGallery from './components/ui/AnimatedGallery'
import GenMarkLogo from './components/ui/GenMarkLogo'
import { AiLoader } from './components/ui/ai-loader'
import { apiBlobRequest, AuthError, type AuthProvider, type AuthUser, downloadAuthenticatedFile, loginWithProvider, logout, restoreSession } from './auth'
import { ciProjectsApi, getLogoCandidateImageUrl, meApi, onboardingApi, projectsApi, type BrandKit, type BusinessCardInfoInput, type DownloadRecord, type LogoCandidate, type PinnedLogo, type SurveyImprovement, type SurveySubmitInput, type TrademarkMatch, waitForLogoGeneration, waitForTrademarkAnalysis, type ProjectInput } from './lib/genmarkApi'
import { buildEditedSvg } from './lib/svgEditor'

const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

const TRADEMARK_SCORE_FALLBACK = 23

// 화면 설계서용 임시 목업 모드입니다. 실제 로그인 사용자와 API 데이터에는 영향을 주지 않으며,
// 원래의 비로그인 빈 상태로 되돌릴 때는 false로 바꾸면 됩니다.
const MYPAGE_MOCK_MODE = true

type ViewMode = 'home' | 'hero' | 'onboarding' | 'industry' | 'brand-details' | 'company-details' | 'choice' | 'tone' | 'style' | 'final' | 'loading' | 'trademark-loading' | 'trademark-selection' | 'trademark-result' | 'result' | 'brand-kit' | 'edit' | 'login' | 'mypage' | 'survey'
type LoginDestination = 'home' | 'industry' | 'choice' | 'mypage'
type LoginReturnMode = 'hero' | 'home'
type OnboardingOption = 'online' | 'social' | 'offline'
type AudienceOption = 'company' | 'owner' | 'hobby' | 'sidejob'
type IndustryOption = 'beauty' | 'fashion' | 'food' | 'health' | 'tech' | 'education' | 'pet' | 'other'
type CoreValue = 'vegan' | 'lowIrritation' | 'derma' | 'cleanBeauty' | 'natural' | 'premium' | 'sustainable' | 'scientific' | 'reasonable'
type ToneOption = 'friendly' | 'professional' | 'warm' | 'trendy' | 'minimal'
type RgbColor = { r: number; g: number; b: number }
type LogoStyle = 'symbol' | 'wordmark' | 'combination' | 'lettermark'
type TrademarkMatchImage = { rank: number; src: string }

const categories = ['전체', '심볼마크', '워드마크', '콤비네이션', '레터마크']

const toneOptions: Array<{ id: ToneOption; label: string; description: string; colors: [string, string] }> = [
  { id: 'friendly', label: '친근하고 다정한', description: '편안하고 부드러운 인상', colors: ['#f39bbd', '#b9d3f7'] },
  { id: 'professional', label: '전문적이고 신뢰감 있는', description: '정돈되고 믿음직한 인상', colors: ['#17185b', '#a45c72'] },
  { id: 'warm', label: '감성적이고 따뜻한', description: '섬세하고 따뜻한 인상', colors: ['#d29474', '#f2eadc'] },
  { id: 'trendy', label: '유니크하고 트렌디한', description: '개성 있고 감각적인 인상', colors: ['#171713', '#f2f2f4'] },
  { id: 'minimal', label: '미니멀하고 직관적인', description: '군더더기 없이 명확한 인상', colors: ['#396fc8', '#dde4ff'] },
]

const coreValueIds = new Set<CoreValue>(['vegan', 'lowIrritation', 'derma', 'cleanBeauty', 'natural', 'premium', 'sustainable', 'scientific', 'reasonable'])
const coreValueLabels: Record<CoreValue, string> = {
  vegan: '비건',
  lowIrritation: '저자극',
  derma: '더마',
  cleanBeauty: '클린뷰티',
  natural: '자연주의',
  premium: '프리미엄',
  sustainable: '지속가능성',
  scientific: '과학적 검증',
  reasonable: '합리적인 가격',
}

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

const logoStylePreviewImages: Record<LogoStyle, string> = {
  symbol: '/logo-style-icons/symbol.png',
  wordmark: '/logo-style-icons/wordmark.png',
  combination: '/logo-style-icons/combination.png',
  lettermark: '/logo-style-icons/lettermark.png',
}

const finalSummaryIconMap: Record<string, LucideIcon> = {
  name: Building2,
  audience: UsersRound,
  value: Gem,
  mood: Sparkles,
}

// id는 백엔드/DB(chk_bi_target_age)가 허용하는 값 그대로, label만 화면에 보여주는 표기.
const targetAgeOptions: Array<{ id: string; label: string; description: string }> = [
  { id: '10~20', label: '10-20대', description: '트렌드와 개성을 중시하는 고객' },
  { id: '30~40', label: '30-40대', description: '일상과 균형을 중시하는 고객' },
  { id: '50~60', label: '50-60대', description: '편안함과 신뢰를 중시하는 고객' },
  { id: '전 연령층', label: '전 연령층', description: '폭넓은 고객을 위한 브랜드' },
]

const toTargetAgeApiValue = (value: string) => targetAgeOptions.find((option) => option.id === value || option.label === value)?.id ?? '전 연령층'

const logoShapeRequirementPrefix = '로고 형태:'

const extractLogoShapeRequirement = (requirements: string | null | undefined) => {
  const match = requirements?.match(new RegExp(`(?:^|\\n)${logoShapeRequirementPrefix}\\s*([^\\n]*)`))
  return match?.[1]?.trim() ?? ''
}

const galleryItems = [
  { id: 'quendra', name: 'QUENDRA', category: '워드마크', meta: '뷰티 · 워드마크', likes: '2.8k', image: '/curation-gallery/quendra.png', position: '50% 50%', tone: 'quendra' },
  { id: 'rk-monogram', name: 'RK', category: '레터마크', meta: '뷰티 · 레터마크', likes: '2.2k', image: '/curation-gallery/rk-monogram.png', position: '50% 50%', tone: 'rk-monogram' },
  { id: 'bramont', name: 'BRAMONT', category: '콤비네이션', meta: '라이프스타일 · 콤비네이션', likes: '1.9k', image: '/curation-gallery/bramont.png', position: '50% 50%', tone: 'bramont' },
  { id: 'gn-monogram', name: 'GN', category: '레터마크', meta: '뷰티 · 레터마크', likes: '1.7k', image: '/curation-gallery/gn-monogram.png', position: '50% 50%', tone: 'gn-monogram' },
  { id: 'vastel', name: 'VASTEL', category: '콤비네이션', meta: '뷰티 · 콤비네이션', likes: '1.5k', image: '/curation-gallery/vastel.png', position: '50% 50%', tone: 'vastel' },
  { id: 'sevria', name: 'SEVRIA', category: '워드마크', meta: '뷰티 · 워드마크', likes: '1.4k', image: '/curation-gallery/sevria.png', position: '50% 50%', tone: 'sevria' },
  { id: 'aurelia-symbol', name: 'AURELIA', category: '심볼마크', meta: '뷰티 · 심볼마크', likes: '1.2k', image: '/curation-gallery/aurelia-symbol.png', position: '50% 50%', tone: 'aurelia-symbol' },
  { id: 'sunwave-mark', name: 'SUNWAVE', category: '심볼마크', meta: '웰니스 · 심볼마크', likes: '1.1k', image: '/curation-gallery/sunwave-mark.png', position: '50% 50%', tone: 'sunwave-mark' },
  { id: 'orivel', name: 'ORIVEL', category: '콤비네이션', meta: '테크 · 콤비네이션', likes: '980', image: '/curation-gallery/orivel.png', position: '50% 50%', tone: 'orivel' },
  { id: 'lysenne', name: 'LYSENNE', category: '워드마크', meta: '뷰티 · 워드마크', likes: '860', image: '/curation-gallery/lysenne.png', position: '50% 50%', tone: 'lysenne' },
]

const productGalleryItems = [
  { id: 'lavenor-product', name: 'LAVENOR', category: '클렌저', meta: '라벤더 · 포밍 클렌저', likes: '2.4k', image: '/product-gallery/lavenor.png', position: '50% 50%', tone: 'lavenor' },
  { id: 'solairea-product', name: 'SOLAIREA', category: '선케어', meta: '선밤 · SPF 50', likes: '2.1k', image: '/product-gallery/solairea.png', position: '50% 50%', tone: 'solairea' },
  { id: 'noirel-product', name: 'NOIRÉL', category: '에센스', meta: '리뉴얼 · 프리미엄 에센스', likes: '1.7k', image: '/product-gallery/noirel.png', position: '50% 50%', tone: 'noirel' },
  { id: 'verena-product', name: 'VERENA', category: '크림', meta: '보태니컬 · 페이스 크림', likes: '1.5k', image: '/product-gallery/verena.png', position: '50% 50%', tone: 'verena' },
  { id: 'peache-product', name: 'PEACHÉ', category: '세럼', meta: '피치 · 스킨 리뉴얼 세럼', likes: '1.4k', image: '/product-gallery/peache.png', position: '50% 50%', tone: 'peache' },
  { id: 'lavenora-product', name: 'LAVENORA', category: '클렌저', meta: '보태니컬 · 젠틀 클렌저', likes: '1.3k', image: '/product-gallery/lavenora.png', position: '50% 50%', tone: 'lavenora' },
  { id: 'azura-product', name: 'AZURA', category: '에센스', meta: '럭스 · 래디언스 에센스', likes: '1.2k', image: '/product-gallery/azura.png', position: '50% 50%', tone: 'azura' },
  { id: 'citrea-product', name: 'CITRÉA', category: '미스트', meta: '시트러스 · 페이셜 미스트', likes: '1.1k', image: '/product-gallery/citrea.png', position: '50% 50%', tone: 'citrea' },
  { id: 'aurelis-product', name: 'AURELIS', category: '바디로션', meta: '시트러스 · 바디 로션', likes: '980', image: '/product-gallery/aurelis.png', position: '50% 50%', tone: 'aurelis' },
  { id: 'terraluna-product', name: 'TERRALUNA', category: '토너', meta: '보태니컬 · 클라리파잉 토너', likes: '860', image: '/product-gallery/terraluna.png', position: '50% 50%', tone: 'terraluna' },
]

const businessCardGalleryItems = [
  { id: 'nevia-card', name: 'NEVIA', category: '명함', meta: '미니멀 · 내추럴', likes: '1.8k', image: '/business-card-gallery/nevia.png', position: '50% 50%', tone: 'nevia' },
  { id: 'morvan-card', name: 'MORVAN', category: '명함', meta: '브라운 · 내추럴', likes: '1.5k', image: '/business-card-gallery/morvan.png', position: '50% 50%', tone: 'morvan' },
  { id: 'eloris-card', name: 'ELORIS', category: '명함', meta: '라벤더 · 감성', likes: '1.3k', image: '/business-card-gallery/eloris.png', position: '50% 50%', tone: 'eloris' },
  { id: 'vitara-card', name: 'VITARA', category: '명함', meta: '골드 · 내추럴', likes: '1.1k', image: '/business-card-gallery/vitara.png', position: '50% 50%', tone: 'vitara' },
  { id: 'aurion-card', name: 'AURION', category: '명함', meta: '네이비 · 프리미엄', likes: '980', image: '/business-card-gallery/aurion.png', position: '50% 50%', tone: 'aurion' },
]

const surveyImprovementOptions: SurveyImprovement[] = ['로고 생성·재생성', '브랜드 맞춤 로고', '로고 수정', '유사 상표 확인', '로고 저장·활용', '기타']

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
  if (requestedView === 'brand-kit' || requestedView === 'brand-kit-selection') return 'brand-kit'
  if (requestedView === 'edit' || requestedView === 'logo-edit' || requestedView === 'logo-editor') return 'edit'
  if (requestedView === 'mypage' || requestedView === 'my-page' || requestedView === 'profile') return 'mypage'
  if (requestedView === 'survey' || requestedView === 'feedback' || requestedView === 'satisfaction') return 'survey'
  return 'home'
}

// TEMP_RESULT_PREVIEW: 결과 후보가 없을 때 결과 화면 레이아웃을 생성 API 없이
// 검토하기 위한 로컬 목업 데이터입니다. 실제 생성·저장 흐름에는 사용하지 않습니다.
const resultPreviewCandidates: LogoCandidate[] = [
  { id: 'preview-candidate-1', order: 1, storageKey: 'preview-candidate-1', svgUrl: null, svgEdited: false, mimeType: 'image/svg+xml', width: 760, height: 760, selected: true, pinnedAt: null, createdAt: '' },
]
const resultPreviewImageUrl = '/logo-result-preview-bramont.png'
const GENERATED_LOGO_COUNT = 1

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const rgbToHex = ({ r, g, b }: RgbColor) => `#${[r, g, b].map((channel) => clampColorChannel(channel).toString(16).padStart(2, '0')).join('')}`
const mixRgb = (source: RgbColor, target: RgbColor, amount: number): RgbColor => ({
  r: source.r + (target.r - source.r) * amount,
  g: source.g + (target.g - source.g) * amount,
  b: source.b + (target.b - source.b) * amount,
})
const hexToRgb = (hex: string): RgbColor => {
  const normalized = hex.replace('#', '')
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) || 0,
    g: Number.parseInt(normalized.slice(2, 4), 16) || 0,
    b: Number.parseInt(normalized.slice(4, 6), 16) || 0,
  }
}

const rgbToHsv = ({ r, g, b }: RgbColor) => {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    v: max,
  }
}

const hsvToRgb = (h: number, s: number, v: number): RgbColor => {
  const chroma = v * s
  const segment = h / 60
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1))
  const match = v - chroma
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0] : segment < 2 ? [secondary, chroma, 0] : segment < 3 ? [0, chroma, secondary] : segment < 4 ? [0, secondary, chroma] : segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary]
  return { r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 }
}

const ToneColorPalette = ({ value, onChange, onComplete, ariaLabel }: { value: RgbColor; onChange: (color: RgbColor) => void; onComplete: () => void; ariaLabel: string }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const hsv = rgbToHsv(value)
  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    onChange(hsvToRgb((x / rect.width) * 360, 1, 1 - y / rect.height))
  }

  const updateHueFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    onChange(hsvToRgb((x / rect.width) * 360, hsv.s || 1, hsv.v))
  }

  const updateChannel = (channel: keyof RgbColor, nextValue: string) => {
    const numericValue = nextValue === '' ? 0 : Number(nextValue)
    onChange({ ...value, [channel]: clampColorChannel(Number.isFinite(numericValue) ? numericValue : 0) })
  }

  return (
    <div className="tone-palette-control">
      <div
        className="tone-color-palette"
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuetext={rgbToHex(value)}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateFromPointer(event) }}
        onPointerMove={(event) => { if (event.buttons === 1) updateFromPointer(event) }}
      >
        <span className="tone-color-palette-preview" style={{ left: `${hsv.h / 3.6}%`, top: `${(1 - hsv.v) * 100}%`, background: rgbToHex(value) }} />
      </div>
      <div className="tone-palette-actions">
        <button className={advancedOpen ? 'tone-native-picker-button active' : 'tone-native-picker-button'} type="button" onClick={() => setAdvancedOpen((current) => !current)}>
          <span className="tone-native-picker-dot" style={{ background: rgbToHex(value) }} aria-hidden="true" />
          <span>색상 세부 조정</span>
        </button>
        <button className="tone-native-picker-done" type="button" onClick={onComplete}>선택 완료</button>
      </div>
      {advancedOpen && (
        <div className="tone-advanced-picker" role="dialog" aria-label={`${ariaLabel} 세부 조정`}>
          <div className="tone-advanced-picker-heading"><strong>원하는 색상 선택</strong><button type="button" aria-label="세부 색상 조정 닫기" onClick={() => setAdvancedOpen(false)}>×</button></div>
          <div
            className="tone-advanced-hue"
            role="slider"
            tabIndex={0}
            aria-label="색상 계열"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateHueFromPointer(event) }}
            onPointerMove={(event) => { if (event.buttons === 1) updateHueFromPointer(event) }}
          >
            <span style={{ left: `${hsv.h / 3.6}%` }} />
          </div>
          <div className="tone-advanced-rgb-fields">
            {(['r', 'g', 'b'] as const).map((channel) => (
              <label key={channel}><span>{channel.toUpperCase()}</span><input type="number" min="0" max="255" value={Math.round(value[channel])} onChange={(event) => updateChannel(channel, event.target.value)} /></label>
            ))}
          </div>
          <button className="tone-advanced-complete" type="button" onClick={() => setAdvancedOpen(false)}>선택 완료</button>
        </div>
      )}
    </div>
  )
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
  const [loggingOut, setLoggingOut] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authRestoring, setAuthRestoring] = useState(true)
  const [authError, setAuthError] = useState('')
  const [loginDestination, setLoginDestination] = useState<LoginDestination>('home')
  const [loginReturnMode, setLoginReturnMode] = useState<LoginReturnMode>('home')
  const [resumePromptProject, setResumePromptProject] = useState<{ id: string; brandType: 'CI' | 'BI' } | null>(null)
  const [resumePromptBusy, setResumePromptBusy] = useState(false)
  const [resumePromptError, setResumePromptError] = useState('')
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
  const [brandName, setBrandName] = useState('')
  const [targetAge, setTargetAge] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyMotto, setCompanyMotto] = useState('')
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileCompanyNameDraft, setProfileCompanyNameDraft] = useState('')
  const [profileCompanyMottoDraft, setProfileCompanyMottoDraft] = useState('')
  const [coreValues, setCoreValues] = useState<CoreValue[]>([])
  const [coreValueInputMode, setCoreValueInputMode] = useState<'category' | 'direct'>('category')
  const [brandValueDescription, setBrandValueDescription] = useState('')
  const [toneSelection, setToneSelection] = useState<ToneOption | null>(null)
  const [toneMode, setToneMode] = useState<'recommended' | 'direct'>('recommended')
  const [tonePaletteTarget, setTonePaletteTarget] = useState<{ toneId: ToneOption; slot: number } | null>(null)
  const [tonePaletteDraft, setTonePaletteDraft] = useState<{ toneId: ToneOption; colors: string[] } | null>(null)
  const [customToneColors, setCustomToneColors] = useState<Partial<Record<ToneOption, string[]>>>({})
  const [manualColors, setManualColors] = useState<string[]>([])
  const [manualColorsSelected, setManualColorsSelected] = useState(false)
  const [manualColorSlot, setManualColorSlot] = useState(0)
  const [colorSelectionMode, setColorSelectionMode] = useState<'tone' | 'manual'>('tone')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [logoStyle, setLogoStyle] = useState<LogoStyle | null>(null)
  const [logoShapePrompt, setLogoShapePrompt] = useState('')
  const [logoShapeAccordionOpen, setLogoShapeAccordionOpen] = useState(false)
  const [resultCandidate, setResultCandidate] = useState(0)
  const [resultLiked, setResultLiked] = useState(false)
  const [trademarkAnalysisSkipped, setTrademarkAnalysisSkipped] = useState(false)
  const [trademarkAnalysisRequested, setTrademarkAnalysisRequested] = useState(false)
  const [editTarget, setEditTarget] = useState<'symbol' | 'text'>('symbol')
  const [editorScale, setEditorScale] = useState(100)
  const [editorRotation, setEditorRotation] = useState(0)
  const [editorOpacity, setEditorOpacity] = useState(100)
  const [editorColor, setEditorColor] = useState('#7B5CDF')
  const [editorColorChanged, setEditorColorChanged] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [editorSaved, setEditorSaved] = useState(false)
  const [editorSvgSource, setEditorSvgSource] = useState<string | null>(null)
  const [editorSvgPreviewUrl, setEditorSvgPreviewUrl] = useState<string | null>(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [trademarkEntry, setTrademarkEntry] = useState<'generation' | 'result'>('generation')
  const [trademarkAnalysisCompleted, setTrademarkAnalysisCompleted] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(() => window.localStorage.getItem('genmark-project-id'))
  const [projectColors, setProjectColors] = useState<string[]>([])
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState('')
  const [generationLoading, setGenerationLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [logoCandidates, setLogoCandidates] = useState<LogoCandidate[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [pinnedLogos, setPinnedLogos] = useState<PinnedLogo[]>([])
  const [downloadHistory, setDownloadHistory] = useState<DownloadRecord[]>([])
  const [pinError, setPinError] = useState('')
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [brandKitError, setBrandKitError] = useState('')
  const [brandKitDownloading, setBrandKitDownloading] = useState(false)
  const [brandKitType, setBrandKitType] = useState<BrandKit['kitType'] | null>(null)
  const [businessCardModalOpen, setBusinessCardModalOpen] = useState(false)
  const [businessCardInfo, setBusinessCardInfo] = useState<BusinessCardInfoInput>({
    name: '', title: '', company: '', phone: '', email: '', address: '',
  })
  const [businessCardInfoErrors, setBusinessCardInfoErrors] = useState<{ name?: string; email?: string }>({})
  const [businessCardTarget, setBusinessCardTarget] = useState<{ candidateId: string; projectId: string } | null>(null)
  const [ciProfileLoading, setCiProfileLoading] = useState(false)
  const ciProfileLoaded = useRef(false)
  const assetEpochRef = useRef(0)
  const brandKitRequestEpochRef = useRef(0)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [trademarkMatches, setTrademarkMatches] = useState<TrademarkMatch[]>([])
  const [trademarkMatchImages, setTrademarkMatchImages] = useState<TrademarkMatchImage[]>([])
  const [trademarkDisclaimer, setTrademarkDisclaimer] = useState('')
  const [trademarkSimilarity, setTrademarkSimilarity] = useState<number | null>(null)
  const [trademarkRiskLabel, setTrademarkRiskLabel] = useState('')
  const [trademarkRiskDescription, setTrademarkRiskDescription] = useState('')
  const [surveyRating, setSurveyRating] = useState(0)
  const [surveyImprovements, setSurveyImprovements] = useState<SurveyImprovement[]>([])
  const [surveyComment, setSurveyComment] = useState('')
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [remainingCredits, setRemainingCredits] = useState(2)
  const [creditModal, setCreditModal] = useState<'credit' | 'survey' | null>(null)
  const activeModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!creditModal && !businessCardModalOpen && !resumePromptProject) return

    const modalRoot = activeModalRef.current
    if (!modalRoot) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const backgroundElements = Array.from(document.querySelectorAll<HTMLElement>('.app-shell > main, .app-shell > .bottom-nav'))
    const previousOverflow = document.body.style.overflow
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const getFocusableElements = () => Array.from(modalRoot.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.offsetParent !== null)

    backgroundElements.forEach((element) => element.setAttribute('inert', ''))
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      const preferredTarget = modalRoot.querySelector<HTMLElement>('[autofocus]') ?? getFocusableElements()[0]
      preferredTarget?.focus()
    })

    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (businessCardModalOpen) {
          setBusinessCardModalOpen(false)
          setBusinessCardTarget(null)
          setBusinessCardInfoErrors({})
        } else if (creditModal) {
          setCreditModal(null)
        } else {
          setResumePromptProject(null)
        }
        return
      }

      if (event.key !== 'Tab') return
      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleModalKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleModalKeyDown)
      backgroundElements.forEach((element) => element.removeAttribute('inert'))
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [businessCardModalOpen, creditModal, resumePromptProject])
  const [choiceInfoModal, setChoiceInfoModal] = useState<'ci' | 'bi' | null>(null)
  const [pendingDownload, setPendingDownload] = useState<{ name: string; subtitle: string; candidateId?: string; storageKey?: string; svgUrl?: string | null } | null>(null)
  const editorCandidate = logoCandidates[resultCandidate] ?? logoCandidates[0]

  useEffect(() => {
    if (mode !== 'edit' && mode !== 'result') return () => undefined
    const candidate = editorCandidate
    let disposed = false

    if (mode === 'edit') {
      setEditorSaved(false)
      setEditorDirty(false)
      setEditorColorChanged(false)
      setEditorScale(100)
      setEditorRotation(0)
      setEditorOpacity(100)
    }
    setEditorError('')
    setEditorSvgSource(null)
    if (!candidate?.svgUrl) {
      setEditorLoading(false)
      return () => { disposed = true }
    }

    setEditorLoading(true)
    void projectsApi.getCandidateSvg(candidate.svgUrl)
      .then((svg) => {
        if (!disposed) setEditorSvgSource(svg)
      })
      .catch((error) => {
        if (!disposed) setEditorError(error instanceof Error ? error.message : 'SVG를 불러오지 못했어요.')
      })
      .finally(() => {
        if (!disposed) setEditorLoading(false)
      })

    return () => { disposed = true }
  }, [mode, editorCandidate?.id, editorCandidate?.svgUrl])

  useEffect(() => {
    if (!editorSvgSource) {
      setEditorSvgPreviewUrl(null)
      return () => undefined
    }

    let objectUrl: string | null = null
    try {
      const edited = editorDirty
        ? buildEditedSvg(editorSvgSource, {
          target: editTarget,
          color: editorColorChanged ? editorColor : undefined,
          scale: editorScale,
          rotation: editorRotation,
          opacity: editorOpacity,
        })
        : editorSvgSource
      objectUrl = URL.createObjectURL(new Blob([edited], { type: 'image/svg+xml' }))
      setEditorSvgPreviewUrl(objectUrl)
      setEditorError('')
    } catch (error) {
      setEditorSvgPreviewUrl(null)
      setEditorError(error instanceof Error ? error.message : 'SVG 편집 미리보기를 만들지 못했어요.')
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [editorSvgSource, editorDirty, editTarget, editorColorChanged, editorColor, editorScale, editorRotation, editorOpacity])

  useEffect(() => {
    let disposed = false
    const createdUrls: string[] = []
    const matchesWithImages = trademarkMatches.filter((match) => match.imageUrl)

    if (matchesWithImages.length === 0) {
      setTrademarkMatchImages([])
      return () => undefined
    }

    void Promise.all(matchesWithImages.map(async (match) => {
      const blob = await apiBlobRequest(match.imageUrl as string)
      const src = URL.createObjectURL(blob)
      createdUrls.push(src)
      return { rank: match.rank, src }
    })).then((images) => {
      if (!disposed) setTrademarkMatchImages(images)
    }).catch(() => {
      if (!disposed) setTrademarkMatchImages([])
    })

    return () => {
      disposed = true
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [trademarkMatches])

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

  const canAnalyzeTrademark = logoStyle === 'combination'

  useEffect(() => {
    const handlePopState = () => setModeState(getModeFromUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [mode])

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
    if (mode !== 'loading' || !generationLoading) {
      setLoadingStep(0)
      return undefined
    }

    setLoadingStep(0)
    const totalLoadingSteps = trademarkAnalysisRequested ? 6 : 5
    const timer = window.setInterval(() => {
      setLoadingStep((current) => Math.min(current + 1, totalLoadingSteps - 1))
    }, 1600)

    return () => window.clearInterval(timer)
  }, [generationLoading, mode, trademarkAnalysisRequested])

  useEffect(() => {
    if (mode !== 'company-details' || !loggedIn || brandKind !== 'ci' || ciProfileLoaded.current) return undefined

    let cancelled = false
    ciProfileLoaded.current = true
    setCiProfileLoading(true)
    void ciProjectsApi.latestProfile()
      .then((profile) => {
        if (cancelled || !profile.hasPrevious) return
        if (profile.companyName && !companyName.trim()) setCompanyName(profile.companyName)
        if (profile.coreValues && !companyMotto.trim()) setCompanyMotto(profile.coreValues)
      })
      .catch((error) => {
        // A first-time CI user may not have a previous profile yet.
        if (!(error instanceof AuthError) || error.status !== 404) setProjectError('이전 CI 정보를 불러오지 못했어요. 직접 입력해 진행해주세요.')
      })
      .finally(() => {
        if (!cancelled) setCiProfileLoading(false)
      })

    return () => { cancelled = true }
  }, [brandKind, companyMotto, companyName, loggedIn, mode])

  useEffect(() => {
    if (!loggedIn || (mode !== 'mypage' && mode !== 'survey')) return
    void Promise.allSettled([
      meApi.getCredits().then((result) => setRemainingCredits(result.balance)),
      meApi.getSurvey().then((result) => {
        setSurveySubmitted(result.completed)
        setRemainingCredits(result.creditBalance)
      }),
      meApi.getPins().then(setPinnedLogos),
      Promise.all([
        meApi.getDownloads('CI'),
        meApi.getDownloads('BI'),
      ]).then(([ciDownloads, biDownloads]) => setDownloadHistory([...ciDownloads, ...biDownloads].sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt)))),
    ])
  }, [loggedIn, mode])

  useEffect(() => {
    if (!loggedIn || (mode !== 'brand-kit' && mode !== 'mypage')) return
    let cancelled = false
    void meApi.getBrandKits()
      .then((kits) => {
        if (cancelled) return
        const latest = selectedCandidateId
          ? kits.find((kit) => kit.candidateId === selectedCandidateId) ?? null
          : kits[0] ?? null
        setBrandKit(latest)
        if (latest) {
          const restoredRequestEpoch = ++brandKitRequestEpochRef.current
          setBrandKitType(latest.kitType)
          setSelectedCandidateId(latest.candidateId)
          setProjectId(latest.projectId)
          if (latest.status === 'QUEUED' || latest.status === 'RUNNING') {
            void pollBrandKit(latest, restoredRequestEpoch, () => cancelled).catch((error) => {
              if (!cancelled && mode === 'brand-kit') {
                setBrandKitError(error instanceof Error ? error.message : '브랜드 키트 상태를 갱신하지 못했어요.')
              }
            })
          }
        }
      })
      .catch((error) => {
        if (!cancelled && mode === 'brand-kit') {
          setBrandKitError(error instanceof Error ? error.message : '기존 브랜드 키트를 불러오지 못했어요.')
        }
      })
    return () => { cancelled = true }
  }, [loggedIn, mode, selectedCandidateId])

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
  const productGalleryRef = useRef<HTMLDivElement>(null)
  const productGalleryDragStartX = useRef(0)
  const productGalleryDragStartScrollLeft = useRef(0)
  const isDraggingProductGallery = useRef(false)
  const businessCardGalleryRef = useRef<HTMLDivElement>(null)
  const businessCardGalleryDragStartX = useRef(0)
  const businessCardGalleryDragStartScrollLeft = useRef(0)
  const isDraggingBusinessCardGallery = useRef(false)

  const [curationActiveDot, setCurationActiveDot] = useState(0)
  const [productActiveDot, setProductActiveDot] = useState(0)
  const [businessCardActiveDot, setBusinessCardActiveDot] = useState(0)

  // 카드 4개를 한 페이지로 보고, 스크롤 위치 비율로 몇 번째 페이지인지 계산한다.
  const computeActiveDot = (track: HTMLDivElement, itemCount: number) => {
    const dotCount = Math.max(1, Math.ceil(itemCount / 4))
    const maxScroll = track.scrollWidth - track.clientWidth
    if (maxScroll <= 0) return 0
    const ratio = track.scrollLeft / maxScroll
    return Math.min(dotCount - 1, Math.round(ratio * (dotCount - 1)))
  }

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

  const scrollProductGallery = (amount: number) => {
    productGalleryRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const handleProductGalleryPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const track = productGalleryRef.current
    if (!track || event.button !== 0) return

    isDraggingProductGallery.current = true
    productGalleryDragStartX.current = event.clientX
    productGalleryDragStartScrollLeft.current = track.scrollLeft
    track.setPointerCapture(event.pointerId)
    track.classList.add('is-dragging')
  }

  const handleProductGalleryPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const track = productGalleryRef.current
    if (!track || !isDraggingProductGallery.current) return

    event.preventDefault()
    track.scrollLeft = productGalleryDragStartScrollLeft.current - (event.clientX - productGalleryDragStartX.current)
  }

  const handleProductGalleryPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const track = productGalleryRef.current
    if (!track) return

    isDraggingProductGallery.current = false
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId)
    track.classList.remove('is-dragging')
  }

  const scrollBusinessCardGallery = (amount: number) => {
    businessCardGalleryRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const handleBusinessCardGalleryPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const track = businessCardGalleryRef.current
    if (!track || event.button !== 0) return

    isDraggingBusinessCardGallery.current = true
    businessCardGalleryDragStartX.current = event.clientX
    businessCardGalleryDragStartScrollLeft.current = track.scrollLeft
    track.setPointerCapture(event.pointerId)
    track.classList.add('is-dragging')
  }

  const handleBusinessCardGalleryPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const track = businessCardGalleryRef.current
    if (!track || !isDraggingBusinessCardGallery.current) return

    event.preventDefault()
    track.scrollLeft = businessCardGalleryDragStartScrollLeft.current - (event.clientX - businessCardGalleryDragStartX.current)
  }

  const handleBusinessCardGalleryPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const track = businessCardGalleryRef.current
    if (!track) return

    isDraggingBusinessCardGallery.current = false
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId)
    track.classList.remove('is-dragging')
  }

  const handleGalleryScroll = () => {
    const track = galleryRef.current
    if (!track) return
    setCurationActiveDot(computeActiveDot(track, filteredItems.length))
  }

  const handleProductGalleryScroll = () => {
    const track = productGalleryRef.current
    if (!track) return
    setProductActiveDot(computeActiveDot(track, productGalleryItems.length))
  }

  const handleBusinessCardGalleryScroll = () => {
    const track = businessCardGalleryRef.current
    if (!track) return
    setBusinessCardActiveDot(computeActiveDot(track, businessCardGalleryItems.length))
  }

  const toggleSurveyImprovement = (item: SurveyImprovement) => {
    setSurveyImprovements((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])
  }

  const applyLogoCandidateState = async (candidateProjectId: string, candidates: LogoCandidate[]) => {
    let nextCandidates = candidates
    let selected = candidates.findIndex((candidate) => candidate.selected)
    if (selected < 0 && candidates.length === 1) {
      const selectedCandidate = await projectsApi.selectCandidate(candidateProjectId, candidates[0].id)
      nextCandidates = candidates.map((candidate) => ({ ...candidate, selected: candidate.id === selectedCandidate.id }))
      selected = 0
    }

    setLogoCandidates(nextCandidates)
    setResultCandidate(selected >= 0 ? selected : 0)
    setSelectedCandidateId(selected >= 0 ? nextCandidates[selected].id : null)
    setResultLiked(Boolean(nextCandidates[selected >= 0 ? selected : 0]?.pinnedAt))
  }

  const restoreProjectState = async (resumeId: string): Promise<ViewMode | null> => {
    try {
      const project = await projectsApi.get(resumeId)
      setProjectId(project.id)
      setProjectColors(project.colors?.slice(0, 4) ?? [])
      window.localStorage.setItem('genmark-project-id', project.id)

      const nextBrandKind = project.brandType === 'CI' ? 'ci' : project.brandType === 'BI' ? 'bi' : null
      setBrandKind(nextBrandKind)
      setIndustrySelection(industryOptions.find((option) => option.apiValue === project.industry)?.id ?? null)
      setBrandName(project.brandName ?? '')
      setCompanyName(project.companyName ?? '')
      setCompanyMotto(project.companyMotto ?? '')
      setBrandValueDescription(project.brandValuesText ?? '')
      setCoreValues((project.brandValues ?? []).filter((value): value is CoreValue => coreValueIds.has(value as CoreValue)))
      setCoreValueInputMode(project.brandValues?.length ? 'category' : 'direct')
      setTargetAge(project.targetAge
        ? targetAgeOptions.find((option) => option.id === project.targetAge || option.label === project.targetAge)?.id ?? ''
        : '')
      setLogoShapePrompt(project.logoShape ?? extractLogoShapeRequirement(project.additionalRequirements))
      if (project.tone && toneOptions.some((option) => option.id === project.tone)) setToneSelection(project.tone as ToneOption)
      else setToneSelection(null)
      if (project.colors?.length) {
        setManualColors(project.colors.slice(0, 4))
        const matchingTone = project.colors.length >= 2
          ? toneOptions.find((option) => option.colors[0].toLowerCase() === project.colors?.[0]?.toLowerCase() && option.colors[1].toLowerCase() === project.colors?.[1]?.toLowerCase())
          : undefined
        if (project.colorMode) {
          const manual = project.colorMode.toUpperCase() === 'MANUAL'
          setColorSelectionMode(manual ? 'manual' : 'tone')
          setToneMode(manual ? 'direct' : 'recommended')
          setManualColorsSelected(Boolean(manual && project.colors.length >= 2))
          if (!manual && matchingTone) setToneSelection(matchingTone.id)
        } else {
          setColorSelectionMode(matchingTone ? 'tone' : 'manual')
          setToneMode(matchingTone ? 'recommended' : 'direct')
          setManualColorsSelected(Boolean(!matchingTone && project.colors.length >= 2))
          if (matchingTone) setToneSelection(matchingTone.id)
        }
      }
      if (project.logoStyle && logoStyleOptions.some((option) => option.id === project.logoStyle)) setLogoStyle(project.logoStyle as LogoStyle)

      const step = typeof project.currentStep === 'number' ? project.currentStep : Number(project.currentStep)
      const hasResult = project.brandType === 'BI'
        ? step >= 6 || project.status === 'GENERATING' || project.status === 'RESULT_READY' || project.status === 'COMPLETED'
        : step >= 5 || project.status === 'GENERATING' || project.status === 'RESULT_READY' || project.status === 'COMPLETED'
      if (hasResult) {
        try {
          await applyLogoCandidateState(project.id, await projectsApi.getLatestCandidates(project.id))
        } catch (error) {
          if (!(error instanceof AuthError) || error.status !== 404) throw error
          setLogoCandidates([])
          setSelectedCandidateId(null)
          setResultCandidate(0)
          setResultLiked(false)
        }
        return 'result'
      }

      if (project.brandType === 'BI') {
        if (step >= 5) return 'final'
        if (step >= 4) return 'style'
        if (step >= 3) return 'tone'
        return 'brand-details'
      }
      if (step >= 4) return 'final'
      if (step >= 3) return 'style'
      if (step >= 2) return 'tone'
      return nextBrandKind === 'ci' ? 'company-details' : 'brand-details'
    } catch (error) {
      if (error instanceof AuthError && error.status === 404) {
        setProjectId(null)
        window.localStorage.removeItem('genmark-project-id')
        return null
      }
      throw error
    }
  }

  /** 이어쓸 만한 초안이 있을 때, 곧장 이어쓰지 않고 "이어서 작성하시겠습니까?" 확인창부터 보여준다. */
  const presentResumePrompt = async (resumeId: string, fallback: () => void, options: { skipSilentResume?: boolean } = {}) => {
    try {
      const project = await projectsApi.get(resumeId)
      const alreadyHasResult = project.status === 'RESULT_READY' || project.status === 'GENERATING' || project.status === 'ANALYZING'
      if (project.status === 'COMPLETED' || (options.skipSilentResume && alreadyHasResult)) {
        // 완전히 끝났거나(COMPLETED) 이미 생성 결과가 있는 프로젝트는 더 이상 이어쓰기 대상이 아니다
        // — 새로고침 없이도 새 프로젝트를 시작할 수 있게 비워준다.
        setProjectId(null)
        window.localStorage.removeItem('genmark-project-id')
        fallback()
        return
      }
      if (project.status !== 'DRAFT' && project.status !== 'BRIEF_READY') {
        // 아직 진행 중인(GENERATING 등) 프로젝트는 "이어서 작성"할 내용이 없으므로 묻지 않고 바로 이동한다.
        const next = await restoreProjectState(resumeId)
        setMode(next ?? 'industry')
        return
      }
      setProjectId(project.id)
      window.localStorage.setItem('genmark-project-id', project.id)
      setResumePromptProject({ id: project.id, brandType: project.brandType })
      setResumePromptError('')
    } catch (error) {
      if (error instanceof AuthError && error.status === 404) {
        setProjectId(null)
        window.localStorage.removeItem('genmark-project-id')
        fallback()
        return
      }
      throw error
    }
  }

  const confirmResumeProject = async () => {
    if (!resumePromptProject || resumePromptBusy) return
    setResumePromptBusy(true)
    setResumePromptError('')
    try {
      const next = await restoreProjectState(resumePromptProject.id)
      setResumePromptProject(null)
      setMode(next ?? 'industry')
    } catch {
      setResumePromptError('이어쓰기 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setResumePromptBusy(false)
    }
  }

  const discardResumeProject = async () => {
    if (!resumePromptProject || resumePromptBusy) return
    setResumePromptBusy(true)
    setResumePromptError('')
    try {
      await projectsApi.discard(resumePromptProject.id, resumePromptProject.brandType)
      setProjectId(null)
      window.localStorage.removeItem('genmark-project-id')
      setResumePromptProject(null)
      setIndustryBackMode('home')
      setMode('industry')
    } catch (error) {
      const message = error instanceof AuthError ? error.message : '삭제하지 못했어요. 잠시 후 다시 시도해주세요.'
      setResumePromptError(message)
    } finally {
      setResumePromptBusy(false)
    }
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
       if (!session.user.onboardingCompleted) {
         setMode('onboarding')
       } else if (session.resumeProjectId) {
         const destination = loginDestination
         setMode('home')
         await presentResumePrompt(session.resumeProjectId, () => setMode(destination), { skipSilentResume: true })
         setLoginDestination('home')
       } else {
         setMode(loginDestination)
         setLoginDestination('home')
       }
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

  const handleLogout = () => {
    // 같은 화면이라도 뭔가 전환되는 느낌을 주려고, 짧게 화면을 덮었다가 걷어내는
    // 동안 실제 로그아웃 상태 변경을 처리한다 (사용자에게는 순간이동이 아니라
    // 페이지가 넘어가는 것처럼 보임).
    setLoggingOut(true)
    window.setTimeout(() => {
      const returnMode = mode === 'login' ? 'home' : mode
      setAuthUser(null)
      setLoggedIn(false)
      setMode(returnMode, { replace: true })
      void logout()
      window.setTimeout(() => setLoggingOut(false), 260)
    }, 260)
  }

  const startOnboarding = async () => {
    setLoginDestination('industry')
    if (!loggedIn) {
      setLoginReturnMode('home')
      setMode('login')
      return
    }

    setOnboardingStep(1)
    if (!onboardingCompleted) {
      setMode('onboarding')
      return
    }
    if (projectId) {
      await presentResumePrompt(projectId, () => { setIndustryBackMode('home'); setMode('industry') }, { skipSilentResume: true })
      return
    }
    setIndustryBackMode('home')
    setMode('industry')
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
      })
      setOnboardingCompleted(true)
      window.localStorage.setItem('genmark-onboarding-completed', 'true')
      setIndustryBackMode('home')
      setMode(loginDestination)
      setLoginDestination('home')
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
      setTrademarkAnalysisRequested(false)
      setMode(entry === 'result' ? 'result' : 'loading')
      return
    }

    setTrademarkAnalysisSkipped(false)
    setTrademarkAnalysisRequested(false)
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

  const updateManualColorFromHex = (hex: string) => {
    setManualColors((current) => {
      const next = [...current]
      next[manualColorSlot] = hex
      return next
    })
  }

  // 색을 1개로 줄일 수 있어야 단색 로고를 만들 수 있다. 지금까지 슬롯에 추가(+)만
  // 있고 삭제가 없어, 직접 지정 모드가 항상 2색으로 시작한 뒤 줄일 방법이 없었다.
  // 그 결과 AI 서버의 단색 강제 분기가 한 번도 실행되지 않았다(실측 확인됨).
  const removeManualColor = (slot: number) => {
    setManualColors((current) => {
      if (current.length <= 1) return current
      const next = current.filter((_, index) => index !== slot)
      setManualColorSlot((active) => Math.min(active, next.length - 1))
      return next
    })
    setManualColorsSelected(true)
  }

  const resetManualColors = () => {
    setManualColors(['#9765e9', '#dcaff5'])
    setManualColorSlot(0)
    setManualColorsSelected(false)
  }

  const updateToneColorFromHex = (toneId: ToneOption, slot: number, hex: string) => {
    setTonePaletteDraft((current) => {
      const base = current?.toneId === toneId
        ? current.colors
        : customToneColors[toneId] ?? toneOptions.find((tone) => tone.id === toneId)?.colors ?? ['#eadfff', '#ffe1ef']
      const next = [...base]
      next[slot] = hex
      return { toneId, colors: next }
    })
  }

  const resetToneColors = (toneId: ToneOption) => {
    const original = toneOptions.find((tone) => tone.id === toneId)?.colors ?? ['#eadfff', '#ffe1ef']
    setCustomToneColors((current) => {
      const next = { ...current }
      delete next[toneId]
      return next
    })
    setTonePaletteDraft({ toneId, colors: [...original] })
    setTonePaletteTarget({ toneId, slot: 0 })
  }

  const getSelectedColors = () => {
    if (colorSelectionMode === 'tone' && toneSelection) {
      return customToneColors[toneSelection]
        ?? toneOptions.find((option) => option.id === toneSelection)?.colors
        ?? toneOptions[0].colors
    }

    return manualColors
  }

  const buildProjectInput = (step: 'brand-brief' | 'tone' | 'logo-style' | 'final-review'): ProjectInput => {
    const input: ProjectInput = {
      brandType: brandKind === 'ci' ? 'CI' : 'BI',
      industry: industryOptions.find((option) => option.id === industrySelection)?.apiValue ?? 'COSMETICS',
    }

    if (brandKind === 'ci') {
      input.companyName = companyName.trim() || undefined
      input.companyMotto = companyMotto.trim() || undefined
    } else {
      input.brandName = brandName.trim() || undefined
      input.brandValues = coreValueInputMode === 'category' ? coreValues : undefined
      input.brandValuesText = coreValueInputMode === 'direct' ? brandValueDescription.trim() || undefined : undefined
      input.targetAge = toTargetAgeApiValue(targetAge || '전 연령층')
    }

    if (step === 'tone') {
      input.tone = toneSelection ?? undefined
      const customizedRecommendedPalette = Boolean(toneSelection && customToneColors[toneSelection])
      input.colorMode = colorSelectionMode === 'manual' || customizedRecommendedPalette ? 'MANUAL' : 'TONE'
      input.colors = getSelectedColors()
      input.paletteReplace = true
    }

    if (step === 'logo-style') {
      input.logoStyle = logoStyle ?? undefined
      input.logoShape = logoShapePrompt.trim()
    }
    if (step === 'final-review') input.logoShape = logoShapePrompt.trim()

    return input
  }

  const buildProjectCreateInput = (step: 'brand-brief' | 'tone' | 'logo-style' | 'final-review') => {
    const input = buildProjectInput('brand-brief')
    if (step === 'brand-brief') return input

    Object.assign(input, buildProjectInput('tone'))
    if (step === 'logo-style' || step === 'final-review') Object.assign(input, buildProjectInput('logo-style'))
    if (step === 'final-review') Object.assign(input, buildProjectInput('final-review'))
    return input
  }

  const ensureProject = async (step: 'brand-brief' | 'tone' | 'logo-style' | 'final-review' = 'final-review') => {
    const input = buildProjectInput(step)
    if (projectId) {
      try {
        const project = await projectsApi.updateStep(projectId, step, input)
        setProjectColors(project.colors?.slice(0, 4) ?? (input.colors?.slice(0, 4) ?? []))
        return projectId
      } catch (error) {
        if (!(error instanceof AuthError) || error.status !== 404) throw error
        setProjectId(null)
        window.localStorage.removeItem('genmark-project-id')
      }
    }

    const project = await projectsApi.create(buildProjectCreateInput(step))
    setProjectId(project.id)
    setProjectColors(project.colors?.slice(0, 4) ?? [])
    window.localStorage.setItem('genmark-project-id', project.id)
    const updatedProject = await projectsApi.updateStep(project.id, step, input)
    setProjectColors(updatedProject.colors?.slice(0, 4) ?? (input.colors?.slice(0, 4) ?? []))
    return project.id
  }

  const saveProjectStep = async (step: 'brand-brief' | 'tone' | 'logo-style', nextMode: ViewMode) => {
    if (projectSaving) return
    if (step === 'logo-style' && !logoStyle) return
    setProjectSaving(true)
    setProjectError('')
    try {
      // brand-brief 단계부터 서버에 저장한다. color1/color2가 nullable로 바뀌어서
      // 색상을 고르기 전에도(=이 단계에서) 프로젝트를 만들 수 있다 — 이어야
      // 2번 화면(tone)을 보다가 이탈해도 그 화면으로 이어쓰기가 된다.
      await ensureProject(step)
      setMode(nextMode)
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : '프로젝트 정보를 저장하지 못했어요.')
    } finally {
      setProjectSaving(false)
    }
  }

  const markEditorDirty = () => {
    setEditorDirty(true)
    setEditorSaved(false)
  }

  const resetEditorControls = () => {
    setEditorScale(100)
    setEditorRotation(0)
    setEditorOpacity(100)
    setEditorColorChanged(false)
    markEditorDirty()
  }

  const selectEditorTarget = (target: 'symbol' | 'text') => {
    if (target === editTarget) return
    if (editorDirty) {
      setEditorError('현재 요소의 편집 내용을 먼저 저장해주세요.')
      return
    }
    setEditTarget(target)
    setEditorScale(100)
    setEditorRotation(0)
    setEditorOpacity(100)
    setEditorColorChanged(false)
    setEditorError('')
  }

  const saveEditorChanges = async (): Promise<boolean> => {
    const candidate = logoCandidates[resultCandidate] ?? logoCandidates[0]
    if (!projectId || !candidate?.svgUrl || !editorSvgSource) {
      setEditorError('저장할 SVG 로고를 불러오지 못했어요.')
      setEditorSaved(false)
      return false
    }

    setEditorSaving(true)
    setEditorError('')
    try {
      const editedSvg = editorDirty
        ? buildEditedSvg(editorSvgSource, {
          target: editTarget,
          color: editorColorChanged ? editorColor : undefined,
          scale: editorScale,
          rotation: editorRotation,
          opacity: editorOpacity,
        })
        : editorSvgSource
      await projectsApi.saveCandidateSvg(candidate.svgUrl, editedSvg)
      if (editorColorChanged) {
        const currentPalette = projectColors.length > 0 ? projectColors : getSelectedColors()
        const nextPalette = [...currentPalette]
        if (nextPalette.length === 0) nextPalette.push(editorColor)
        else nextPalette[0] = editorColor
        const patchedProject = await projectsApi.patch(projectId, {
          brandType: brandKind === 'bi' ? 'BI' : 'CI',
          colors: nextPalette,
          paletteReplace: true,
        })
        setProjectColors(patchedProject.colors?.slice(0, 4) ?? nextPalette.slice(0, 4))
      }
      assetEpochRef.current += 1
      setEditorSvgSource(editedSvg)
      setEditorDirty(false)
      setEditorColorChanged(false)
      setEditorSaved(true)
      setLogoCandidates((current) => current.map((item) => item.id === candidate.id
        ? { ...item, svgEdited: true }
        : item))
      setAnalysisId(null)
      setAnalysisError('')
      setTrademarkAnalysisCompleted(false)
      setTrademarkAnalysisSkipped(false)
      setTrademarkAnalysisRequested(false)
      setTrademarkMatches([])
      setTrademarkMatchImages([])
      setTrademarkSimilarity(null)
      setTrademarkRiskLabel('')
      setTrademarkRiskDescription('')
      setTrademarkDisclaimer('')
      setBrandKit(null)
      setBrandKitError('')
      setBrandKitType(null)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '편집 내용을 저장하지 못했어요.'
      setEditorError(message)
      setProjectError(message)
      setEditorSaved(false)
      return false
    } finally {
      setEditorSaving(false)
    }
  }

  const startLogoGeneration = async () => {
    if (generationLoading) return
    setGenerationLoading(true)
    setGenerationError('')
    setTrademarkAnalysisRequested(false)
    setTrademarkAnalysisSkipped(false)
    setMode('loading')
    try {
      const nextProjectId = await ensureProject('final-review')
      if (!nextProjectId) throw new Error('프로젝트 정보를 먼저 입력해주세요.')
      const generation = await projectsApi.createGeneration(nextProjectId, crypto.randomUUID())
      setGenerationId(generation.id)
      const completedGeneration = await waitForLogoGeneration(nextProjectId, generation.id)
      if (completedGeneration.status === 'FAILED') {
        throw new Error(completedGeneration.errorMessage ?? '로고 생성에 실패했어요.')
      }

      const candidates = await projectsApi.getCandidates(nextProjectId, generation.id)
      if (candidates.length !== GENERATED_LOGO_COUNT) throw new Error('생성된 로고 1개를 불러오지 못했어요.')

      await applyLogoCandidateState(nextProjectId, candidates)
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
      setResultLiked(Boolean(candidate.pinnedAt))
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '로고 후보를 선택하지 못했어요.')
    }
  }

  const startTrademarkAnalysis = async () => {
    if (!projectId) return
    const candidate = logoCandidates[resultCandidate]
    if (!candidate) {
      setAnalysisError('먼저 로고 후보를 생성해주세요.')
      return
    }
    const requestEpoch = assetEpochRef.current
    setAnalysisError('')
    setMode('trademark-loading')
    try {
      await projectsApi.selectCandidate(projectId, candidate.id)
      if (requestEpoch !== assetEpochRef.current) return
      setSelectedCandidateId(candidate.id)
      const analysis = await projectsApi.createAnalysis(projectId)
      if (requestEpoch !== assetEpochRef.current) return
      setAnalysisId(analysis.id)
      const completedAnalysis = await waitForTrademarkAnalysis(projectId, analysis.id)
      if (requestEpoch !== assetEpochRef.current) return
      if (completedAnalysis.status === 'FAILED') {
        throw new Error(completedAnalysis.errorMessage ?? '상표 분석에 실패했어요.')
      }
      const matches = await projectsApi.getMatches(projectId, analysis.id)
      if (requestEpoch !== assetEpochRef.current) return
      setTrademarkMatches(matches)
      setTrademarkSimilarity(completedAnalysis.maxSimilarity)
      setTrademarkRiskLabel(completedAnalysis.riskLabel ?? '')
      setTrademarkRiskDescription(completedAnalysis.riskDescription ?? '')
      setTrademarkDisclaimer(completedAnalysis.disclaimer ?? '')
      setTrademarkAnalysisCompleted(true)
      setMode('trademark-result')
    } catch (error) {
      if (requestEpoch !== assetEpochRef.current) return
      setAnalysisError(error instanceof Error ? error.message : '상표 분석 중 문제가 발생했어요.')
      setMode('result')
    }
  }

  const pollBrandKit = async (initial: BrandKit, brandKitRequestEpoch: number, shouldStop?: () => boolean) => {
    if (initial.status !== 'QUEUED' && initial.status !== 'RUNNING') return
    const requestEpoch = assetEpochRef.current
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000))
      if (shouldStop?.() || requestEpoch !== assetEpochRef.current
          || brandKitRequestEpoch !== brandKitRequestEpochRef.current) return
      const next = await projectsApi.getBrandKit(initial.projectId, initial.candidateId, initial.id)
      if (shouldStop?.() || requestEpoch !== assetEpochRef.current
          || brandKitRequestEpoch !== brandKitRequestEpochRef.current) return
      setBrandKit(next)
      if (next.status === 'SUCCEEDED' || next.status === 'FAILED') return
    }
  }

  const requestBrandKit = async (
    candidateId: string | null = selectedCandidateId,
    targetProjectId: string | null = projectId,
    cardInfo?: BusinessCardInfoInput,
  ) => {
    if (!targetProjectId || !candidateId) return
    const requestEpoch = assetEpochRef.current
    const brandKitRequestEpoch = ++brandKitRequestEpochRef.current
    setBrandKitError('')
    try {
      const requested = await projectsApi.requestBrandKit(
        targetProjectId,
        candidateId,
        cardInfo ? { cardInfo } : undefined,
      )
      if (requestEpoch !== assetEpochRef.current
          || brandKitRequestEpoch !== brandKitRequestEpochRef.current) return
      setBrandKit(requested)
      await pollBrandKit(requested, brandKitRequestEpoch)
    } catch (error) {
      if (requestEpoch !== assetEpochRef.current
          || brandKitRequestEpoch !== brandKitRequestEpochRef.current) return
      setBrandKitError(error instanceof Error ? error.message : '브랜드 키트를 요청하지 못했어요.')
    }
  }

  const openBrandKitSelection = () => {
    setBrandKitError('')
    setBrandKitType(brandKind === 'ci' ? 'BUSINESS_CARD' : 'THUMBNAIL')
    setMode('brand-kit')
  }

  const downloadBrandKitArchive = async (kit: BrandKit) => {
    if (brandKitDownloading) return
    setBrandKitDownloading(true)
    setBrandKitError('')
    try {
      const blob = await projectsApi.downloadBrandKit(kit.projectId, kit.candidateId, kit.id)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = kit.kitType === 'BUSINESS_CARD'
        ? 'genmark-business-card.zip'
        : 'genmark-thumbnail.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      setBrandKitError(error instanceof Error ? error.message : '브랜드 키트를 다운로드하지 못했어요.')
    } finally {
      setBrandKitDownloading(false)
    }
  }

  const openBusinessCardModal = (target: { candidateId: string; projectId: string } | null = null) => {
    setBusinessCardTarget(target)
    setBusinessCardInfoErrors({})
    setBusinessCardInfo((current) => ({
      ...current,
      name: current.name || authUser?.name?.trim() || '',
      company: current.company || (brandKind === 'ci' ? companyName : brandName).trim(),
      email: current.email || authUser?.email?.trim() || '',
    }))
    setBusinessCardModalOpen(true)
  }

  const runSelectedBrandKit = async (cardInfo?: BusinessCardInfoInput) => {
    if (!brandKitType) return
    if (!projectId) {
      setBrandKitError('로고 후보를 선택한 뒤 브랜드 키트를 만들 수 있어요.')
      return
    }

    if (logoCandidates.length === 0 && selectedCandidateId) {
      await requestBrandKit(selectedCandidateId, projectId, cardInfo)
      return
    }

    const candidate = logoCandidates[resultCandidate] ?? logoCandidates[0]
    if (!candidate) {
      setBrandKitError('로고 후보를 선택한 뒤 브랜드 키트를 만들 수 있어요.')
      return
    }

    try {
      let candidateId = selectedCandidateId
      if (!candidate.selected || candidate.id !== selectedCandidateId) {
        const selected = await projectsApi.selectCandidate(projectId, candidate.id)
        candidateId = selected.id
        setSelectedCandidateId(selected.id)
        setLogoCandidates((current) => current.map((item) => ({ ...item, selected: item.id === selected.id })))
      }
      await requestBrandKit(candidateId, projectId, cardInfo)
    } catch (error) {
      setBrandKitError(error instanceof Error ? error.message : '로고 후보를 선택하지 못했어요.')
    }
  }

  const createSelectedBrandKit = async () => {
    if (!brandKitType) return
    if (brandKitType === 'BUSINESS_CARD') {
      openBusinessCardModal()
      return
    }
    await runSelectedBrandKit()
  }

  const submitBusinessCardInfo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized: BusinessCardInfoInput = {
      name: businessCardInfo.name.trim(),
      title: businessCardInfo.title?.trim() || undefined,
      company: businessCardInfo.company?.trim() || undefined,
      phone: businessCardInfo.phone?.trim() || undefined,
      email: businessCardInfo.email?.trim() || undefined,
      address: businessCardInfo.address?.trim() || undefined,
    }
    const errors: { name?: string; email?: string } = {}
    if (!normalized.name) errors.name = '명함에 표시할 이름을 입력해 주세요.'
    if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      errors.email = '이메일 주소 형식을 확인해 주세요.'
    }
    if (Object.keys(errors).length > 0) {
      setBusinessCardInfoErrors(errors)
      return
    }

    setBusinessCardInfo(normalized)
    setBusinessCardInfoErrors({})
    setBusinessCardModalOpen(false)
    const target = businessCardTarget
    setBusinessCardTarget(null)
    if (target) {
      await requestBrandKit(target.candidateId, target.projectId, normalized)
    } else {
      await runSelectedBrandKit(normalized)
    }
  }

  const downloadLogo = async (candidate: { name: string; subtitle?: string; candidateId?: string; storageKey?: string; svgUrl?: string | null }): Promise<boolean> => {
    if (!candidate.storageKey && !candidate.svgUrl) return false

    try {
      let blob: Blob
      let extension = 'png'
      if (projectId && candidate.candidateId) {
        const download = await projectsApi.downloadCandidate(projectId, candidate.candidateId)
        setDownloadHistory((current) => [download, ...current.filter((item) => item.downloadId !== download.downloadId)])
        if (candidate.svgUrl) {
          const svg = await projectsApi.getCandidateSvg(candidate.svgUrl)
          blob = new Blob([svg], { type: 'image/svg+xml' })
          extension = 'svg'
        } else {
          blob = await downloadAuthenticatedFile(download.imageUrl)
        }
      } else if (candidate.svgUrl) {
        const svg = await projectsApi.getCandidateSvg(candidate.svgUrl)
        blob = new Blob([svg], { type: 'image/svg+xml' })
        extension = 'svg'
      } else {
        const response = await fetch(getLogoCandidateImageUrl(candidate.storageKey as string))
        if (!response.ok) throw new Error('로고 파일을 불러오지 못했어요.')
        blob = await response.blob()
      }

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${candidate.name.toLowerCase()}-logo.${extension}`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 0)
      return true
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : '로고를 다운로드하지 못했어요.')
      return false
    }
  }

  const requestLogoDownload = (candidate: { name: string; subtitle: string; candidateId?: string; storageKey?: string; svgUrl?: string | null }) => {
    setPendingDownload(candidate)
    setCreditModal('credit')
  }

  const downloadWithCredit = () => {
    if (!pendingDownload || remainingCredits < 1) return
    void downloadLogo(pendingDownload).then((downloaded) => {
      if (!downloaded) return
      setRemainingCredits((current) => Math.max(0, current - 1))
      setPendingDownload(null)
      setCreditModal(null)
    })
  }

  const submitSurveyResponse = async () => {
    if (surveyRating !== 1 && surveyRating !== 5) throw new Error('만족도를 선택해주세요.')
    const input: SurveySubmitInput = {
      rating: surveyRating,
      improvements: surveyImprovements,
      comment: surveyComment.trim() || undefined,
    }
    const result = await meApi.submitSurvey(input)
    setRemainingCredits(result.creditBalance)
    setSurveySubmitted(true)
  }

  const submitCreditSurvey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitSurveyResponse()
      .then(() => setCreditModal(null))
      .catch((error) => setProjectError(error instanceof Error ? error.message : '설문을 제출하지 못했어요.'))
  }

  const toggleCandidatePin = async (candidate: LogoCandidate) => {
    if (!projectId) return
    setPinError('')
    try {
      if (candidate.pinnedAt) {
        await projectsApi.unpinCandidate(projectId, candidate.id)
        setLogoCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, pinnedAt: null } : item))
        setResultLiked(false)
        setPinnedLogos((current) => current.filter((item) => item.candidateId !== candidate.id))
        return
      }

      const pinned = await projectsApi.pinCandidate(projectId, candidate.id)
      setLogoCandidates((current) => current.map((item) => item.id === candidate.id
        ? { ...item, pinnedAt: pinned.pinnedAt ?? null }
        : item))
      setResultLiked(Boolean(pinned.pinnedAt))
      setPinnedLogos((current) => [{ ...pinned, projectId }, ...current.filter((item) => item.candidateId !== candidate.id)])
    } catch (error) {
      setPinError(error instanceof Error ? error.message : '찜 상태를 변경하지 못했어요.')
    }
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
            {onboardingSaving ? '저장 중...' : onboardingStep === 1 ? '다음' : '제출하기'}
          </button>
        </div>
      </section>
    </main>
  )

  const renderResumePromptModal = () => (
    <div ref={activeModalRef} className="modal-backdrop" role="presentation">
      <section className="credit-modal resume-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="resume-prompt-title">
        <p className="resume-prompt-brand">GenMark</p>
        <h2 id="resume-prompt-title">기존에 작성된<br /><strong>내용이 있습니다</strong></h2>
        <p>이어서 작성하시겠습니까?</p>
        {resumePromptError && <p className="project-error" role="alert">{resumePromptError}</p>}
        <div className="credit-modal-actions">
          <button className="gradient-button" type="button" onClick={() => void confirmResumeProject()} disabled={resumePromptBusy}>
            {resumePromptBusy ? '처리 중...' : '예, 이어서 작성할게요'}
          </button>
          <button className="modal-secondary-button" type="button" onClick={() => void discardResumeProject()} disabled={resumePromptBusy}>
            아니오, 새로 시작할게요
          </button>
        </div>
      </section>
    </div>
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
      { id: 'lowIrritation', label: '저자극' },
      { id: 'derma', label: '더마' },
      { id: 'cleanBeauty', label: '클린뷰티' },
      { id: 'natural', label: '자연주의' },
      { id: 'premium', label: '프리미엄' },
      { id: 'sustainable', label: '지속가능성' },
      { id: 'scientific', label: '과학적 검증' },
      { id: 'reasonable', label: '합리적인 가격' },
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
                aria-required="true"
                maxLength={80}
                required
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
                  aria-describedby="brand-values-direct-hint"
                  value={brandValueDescription}
                  onChange={(event) => setBrandValueDescription(event.target.value)}
                  placeholder="예: 친환경 성분을 중시하는 비건 스킨케어 브랜드, 자연스럽고 믿음직한 인상"
                />
                <p id="brand-values-direct-hint" className="core-values-direct-hint">
                  핵심 가치와 원하는 인상을 구체적으로 적을수록 AI가 더 정교한 로고 방향을 잡을 수 있어요.
                </p>
              </div>
            )}
          </section>

          <section className="brand-details-section target-audience-section" aria-labelledby="target-audience-title">
            <div className="target-audience-heading">
              <div>
                <h2 id="target-audience-title">주요 타겟</h2>
                <p>누구를 위한 브랜드인지 알려주세요.</p>
              </div>
              <span className="target-audience-caption">하나를 선택해 주세요</span>
            </div>
            <div className="target-audience-grid" role="group" aria-label="주요 타겟 선택">
              {targetAgeOptions.map((option) => {
                const selected = targetAge === option.id
                return (
                  <button
                    key={option.label}
                    type="button"
                    className={selected ? 'target-audience-card selected' : 'target-audience-card'}
                    aria-pressed={selected}
                    onClick={() => setTargetAge((current) => current === option.id ? '' : option.id)}
                  >
                    <span className="target-audience-card-copy">
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                    <span className="target-audience-check" aria-hidden="true">{selected && <Check size={16} strokeWidth={2.5} />}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <button className="brand-details-next" type="button" onClick={() => void saveProjectStep('brand-brief', 'tone')} disabled={projectSaving || !brandName.trim() || !targetAge}>
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
          <p>기업의 방향과 고객에게 전하고 싶은 이미지를 알려주세요.{ciProfileLoading ? ' 이전 CI 정보를 불러오는 중이에요.' : ''}</p>
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

        <button className="brand-details-next" type="button" onClick={handleCompanyDetailsNext} disabled={projectSaving || !companyName.trim()}>
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
          <div className="tone-mode-tabs" role="tablist" aria-label="색상 선택 방식">
            <button
              type="button"
              role="tab"
              aria-selected={toneMode === 'recommended'}
              className={toneMode === 'recommended' ? 'tone-mode-tab active' : 'tone-mode-tab'}
              onClick={() => { setToneMode('recommended'); setColorSelectionMode('tone'); setColorPickerOpen(false); setTonePaletteTarget(null); setTonePaletteDraft(null) }}
            >추천</button>
            <button
              type="button"
              role="tab"
              aria-selected={toneMode === 'direct'}
              className={toneMode === 'direct' ? 'tone-mode-tab active' : 'tone-mode-tab'}
              onClick={() => { setToneMode('direct'); setColorSelectionMode('manual'); setManualColors((current) => current.length >= 2 ? current : ['#9765e9', '#dcaff5']); setManualColorsSelected(false); setColorPickerOpen(true); setTonePaletteTarget(null); setTonePaletteDraft(null) }}
            >직접 지정</button>
          </div>
          <h1 id="tone-selection-title">톤앤매너와<br />색상을 골라주세요</h1>
          <p>톤 선택 시 어울리는 색상이 자동으로 적용돼요</p>
        </header>

        {toneMode === 'recommended' && (
        <section className="tone-options" aria-label="톤앤매너 선택">
          {toneOptions.map((tone) => {
            const selected = toneSelection === tone.id
            const toneColors = customToneColors[tone.id] ?? tone.colors
            const canAddColor = toneColors.length < 4
            return (
              <div className="tone-option-shell" key={tone.id}>
              <button
                type="button"
                className={selected ? 'tone-option selected' : 'tone-option'}
                aria-pressed={selected}
                 onClick={() => { setToneSelection((current) => current === tone.id ? null : tone.id); setColorSelectionMode('tone') }}
              >
                <span className="tone-swatches" aria-hidden="true">
                  {toneColors.map((color, index) => <i key={`${tone.id}-${index}-${color}`} style={{ background: color }} />)}
                </span>
                <span className="tone-option-copy">
                  <strong>{tone.label}</strong>
                  <small>{tone.description}</small>
                </span>
                <span className="tone-radio" aria-hidden="true">{selected && <Check size={21} strokeWidth={2.5} />}</span>
              </button>
              <button
                className="tone-custom-trigger"
                type="button"
                aria-label={`${tone.label} 색상 직접 지정`}
                aria-expanded={tonePaletteTarget?.toneId === tone.id}
              onClick={() => {
                if (tonePaletteTarget?.toneId === tone.id) {
                  setTonePaletteTarget(null)
                  setTonePaletteDraft(null)
                  return
                }
                const currentColors = customToneColors[tone.id] ?? tone.colors
                if (!canAddColor) {
                  setTonePaletteDraft({ toneId: tone.id, colors: [...currentColors] })
                  setTonePaletteTarget({ toneId: tone.id, slot: 0 })
                  return
                }
                setTonePaletteDraft({ toneId: tone.id, colors: [...currentColors, '#eadfff'] })
                setTonePaletteTarget({ toneId: tone.id, slot: currentColors.length })
              }}
              ><Plus aria-hidden="true" size={20} strokeWidth={1.9} /></button>
              {tonePaletteTarget?.toneId === tone.id && (
                <div className="tone-inline-picker" role="group" aria-label={`${tone.label} 색상 지정`}>
                  <div className="tone-inline-picker-heading"><strong>색상을 선택하세요</strong><span>기존 색상을 조정하거나 새 색상을 하나씩 추가할 수 있어요.</span></div>
                  <div className="tone-picker-slots">
                    {(tonePaletteDraft?.toneId === tone.id ? tonePaletteDraft.colors : customToneColors[tone.id] ?? tone.colors).map((_, slot) => {
                      const colors = tonePaletteDraft?.toneId === tone.id
                        ? tonePaletteDraft.colors
                        : customToneColors[tone.id] ?? tone.colors
                      return <button key={slot} type="button" className={tonePaletteTarget.slot === slot ? 'tone-picker-slot active' : 'tone-picker-slot'} onClick={() => setTonePaletteTarget({ toneId: tone.id, slot })}><i style={{ background: colors[slot] }} /><span>{slot < 2 ? `${slot + 1}번째 색` : `추가 색상 ${slot - 1}`}</span></button>
                    })}
                  </div>
                  <ToneColorPalette
                    value={hexToRgb((tonePaletteDraft?.toneId === tone.id ? tonePaletteDraft.colors : customToneColors[tone.id] ?? tone.colors)[tonePaletteTarget.slot])}
                    onChange={(color) => updateToneColorFromHex(tone.id, tonePaletteTarget.slot, rgbToHex(color))}
                    onComplete={() => {
                      if (tonePaletteDraft?.toneId === tone.id) {
                        setCustomToneColors((current) => ({ ...current, [tone.id]: tonePaletteDraft.colors }))
                      }
                      setTonePaletteTarget(null)
                      setTonePaletteDraft(null)
                    }}
                    ariaLabel={`${tone.label} 색상 팔레트`}
                  />
                  <div className="tone-inline-picker-footer">
                    <span>선택한 색상 · {(tonePaletteDraft?.toneId === tone.id ? tonePaletteDraft.colors : customToneColors[tone.id] ?? tone.colors).join(' / ')}</span>
                    <button type="button" className="tone-inline-reset" onClick={() => resetToneColors(tone.id)}>초기화</button>
                  </div>
                </div>
              )}
              </div>
            )
          })}
        </section>
        )}

        {toneMode === 'direct' && (<section className="tone-color-card tone-direct-card" aria-label="직접 색상 지정">
          <div className="tone-direct-swatches" aria-label="직접 선택한 색상">
            {manualColors.map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
            <button
              className="tone-direct-custom-trigger"
              type="button"
              aria-label={manualColors.length < 4 ? '색상 추가' : '색상 편집'}
              aria-expanded={colorPickerOpen}
              onClick={() => {
                if (manualColors.length >= 4) {
                  setManualColorSlot(0)
                  setColorPickerOpen(true)
                  return
                }
                setManualColors((current) => [...current, '#eadfff'])
                setManualColorSlot(manualColors.length)
                setColorPickerOpen(true)
              }}
            ><Plus aria-hidden="true" size={19} strokeWidth={1.9} /></button>
          </div>
          <div>
            <h2>직접 색상 지정</h2>
            <p>원하는 색상을 직접 지정할 수 있어요</p>
          </div>
          <button
            className="tone-auto-chip tone-picker-trigger"
            type="button"
            aria-expanded={colorPickerOpen}
            aria-controls="tone-color-picker"
            onClick={() => {
              setColorSelectionMode('manual')
              if (!colorPickerOpen) setManualColorSlot(0)
              setColorPickerOpen((current) => !current)
            }}
          >
            <span className="tone-picker-summary" aria-hidden="true">{manualColors.map((color, index) => <i className="tone-picker-swatch" key={`${color}-${index}`} style={{ background: color }} />)}</span>
            직접
          </button>

          {colorPickerOpen && (
            <div className="tone-color-picker tone-color-picker-inline" id="tone-color-picker" role="group" aria-label="RGB 색상 선택">
              <div className="tone-color-picker-heading">
                <strong>원하는 색상 선택</strong>
                <button type="button" aria-label="색상 팔레트 닫기" onClick={() => setColorPickerOpen(false)}>×</button>
              </div>
              <div className="tone-picker-slots direct-slots">
                {manualColors.map((color, slot) => (
                  <span key={slot} className="tone-picker-slot-wrap">
                    <button type="button" className={manualColorSlot === slot ? 'tone-picker-slot active' : 'tone-picker-slot'} onClick={() => setManualColorSlot(slot)}><i style={{ background: color }} /><span>{slot < 2 ? `${slot + 1}번째 색` : `추가 색상 ${slot - 1}`}</span></button>
                    {manualColors.length > 1 && (
                      <button type="button" className="tone-picker-slot-remove" aria-label={`${slot + 1}번째 색 삭제`} onClick={() => removeManualColor(slot)}>×</button>
                    )}
                  </span>
                ))}
              </div>
              <ToneColorPalette
                value={hexToRgb(manualColors[manualColorSlot] ?? manualColors[0])}
              onChange={(color) => { updateManualColorFromHex(rgbToHex(color)); setManualColorsSelected(true) }}
                onComplete={() => setColorPickerOpen(false)}
                ariaLabel="색상 팔레트"
              />
              <div className="tone-color-picker-footer">
                <span>선택한 색상 · {manualColors.join(' / ')}</span>
                <button type="button" className="tone-inline-reset" onClick={resetManualColors}>초기화</button>
              </div>
            </div>
          )}
        </section>)}

        <button className="tone-next" type="button" onClick={() => void saveProjectStep('tone', 'style')} disabled={projectSaving || (toneMode === 'recommended' ? !toneSelection : !manualColorsSelected)}>
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
            const shapeInputEnabled = option.id === 'symbol' || option.id === 'combination'
            const shapeInputOpen = selected && shapeInputEnabled && logoShapeAccordionOpen
            return (
              <div key={option.id} className={shapeInputOpen ? 'logo-style-option-group shape-open' : 'logo-style-option-group'}>
                <button
                  type="button"
                  className={selected ? 'logo-style-option selected' : 'logo-style-option'}
                  aria-pressed={selected}
                  onClick={() => {
                    const nextSelected = selected ? null : option.id
                    setLogoStyle(nextSelected)
                    setLogoShapeAccordionOpen(Boolean(nextSelected && shapeInputEnabled))
                  }}
                >
                <span className={`logo-style-preview ${option.id}`} aria-hidden="true">
                  <img src={logoStylePreviewImages[option.id]} alt="" />
                </span>
                <span className="logo-style-copy">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                  <span className="logo-style-fit"><em>적합한 경우</em>{option.fit}</span>
                  {option.recommended && <small className="logo-style-recommend"><Sparkle /> 처음 만드는 브랜드에 추천</small>}
                </span>
                <span className="logo-style-radio" aria-hidden="true">{selected && <Check size={22} strokeWidth={2.5} />}</span>
                </button>
                {shapeInputOpen && (
                  <div className="logo-shape-accordion" role="region" aria-label="로고 형태 입력">
                    <label htmlFor="logo-shape-prompt">원하는 로고 형태를 입력해 주세요</label>
                    <p>예: 별 모양, 달 모양, 잎사귀 형태처럼 자유롭게 적어 주세요.</p>
                    <textarea
                      id="logo-shape-prompt"
                      value={logoShapePrompt}
                      onChange={(event) => setLogoShapePrompt(event.target.value)}
                      placeholder="예: 달 모양, 둥근 별 모양"
                      maxLength={100}
                      rows={2}
                    />
                    <span>{logoShapePrompt.length} / 100</span>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        <button className="logo-style-next" type="button" onClick={() => void saveProjectStep('logo-style', 'final')} disabled={projectSaving || !logoStyle}>
          {projectSaving ? '저장 중...' : '다음'} <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} />
        </button>
        {projectError && <p className="project-error" role="alert">{projectError}</p>}
      </section>
    </main>
  )

  const renderFeaturedHero = () => (
    <section className="featured-hero" aria-label="NOVAIRE STUDIO 브랜드 로고 소개">
      <img className="featured-art" src="/home/lunee-studio.png" alt="LUNÉE 금색 로고 이미지" />
      <div className="featured-scrim" />
      <div className="featured-dots" aria-label="대표 큐레이션 진행 상태">
        <span className="active" /><span /><span /><span />
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
      ciProfileLoaded.current = false
      setProjectError('')
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
    const displayValue = (value: string | undefined, fallback = '입력하지 않음') => value?.trim() || fallback
    const selectedToneLabel = toneOptions.find((option) => option.id === toneSelection)?.label ?? toneSelection
    const selectedLogoStyle = logoStyleOptions.find((option) => option.id === logoStyle)?.label ?? '선택하지 않음'
    const selectedBrandValues = coreValues.length > 0
      ? coreValues.map((value) => coreValueLabels[value] ?? value).join(', ')
      : displayValue(brandValueDescription)
    const summaryRows = brandKind === 'ci'
      ? [
          { key: 'company-name', label: '회사명', value: displayValue(companyName), icon: 'name', editMode: 'company-details' as ViewMode },
          { key: 'company-motto', label: '회사 모토', value: displayValue(companyMotto), icon: 'value', editMode: 'company-details' as ViewMode },
          { key: 'mood', label: '원하는 분위기', value: selectedToneLabel, icon: 'mood', editMode: 'tone' as ViewMode },
        ]
      : [
          { key: 'brand-name', label: '브랜드명', value: displayValue(brandName), icon: 'name', editMode: 'brand-details' as ViewMode },
          { key: 'audience', label: '주요 고객', value: displayValue(targetAgeOptions.find((option) => option.id === targetAge)?.label), icon: 'audience', editMode: 'brand-details' as ViewMode },
          { key: 'value', label: '핵심 가치', value: selectedBrandValues, icon: 'value', editMode: 'brand-details' as ViewMode },
          { key: 'mood', label: '분위기', value: selectedToneLabel, icon: 'mood', editMode: 'tone' as ViewMode },
        ]

    return (
      <main className="final-request-screen">
        <ScreenBackButton label="로고 스타일 선택 화면으로 돌아가기" onClick={() => setMode('style')} />
        <section className="final-request-content" aria-labelledby="final-request-title">
          <BrandFlowProgress step={4} />

          <header className="final-request-heading">
            <h1 id="final-request-title">마지막으로 꼭 반영할 내용을 알려주세요</h1>
            <p>원하는 요소뿐 아니라 피하고 싶은 형태도 작성할 수 있어요.</p>
          </header>

          <section className="final-summary-section" aria-labelledby="summary-title">
            <h2 id="summary-title">이 내용으로 로고를 만들게요</h2>
            <div className="final-summary-card">
              {summaryRows.map((row) => (
                <div className="final-summary-row" key={row.key}>
                  {(() => {
                    const SummaryIcon = finalSummaryIconMap[row.icon] ?? Shapes
                    return <SummaryIcon className="final-detail-icon" aria-hidden="true" size={22} strokeWidth={1.8} />
                  })()}
                  <span className="final-summary-label">{row.label}</span>
                  <span className="final-summary-value">{row.value}</span>
                  <button className="final-edit-button" type="button" onClick={() => setMode(row.editMode)}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
                </div>
              ))}
              <div className="final-summary-row">
                <Palette className="final-detail-icon" aria-hidden="true" size={22} strokeWidth={1.8} />
                <span className="final-summary-label">선호 색상</span>
                <span className="final-color-swatches" aria-label="선호 색상 4개">
                  {getSelectedColors().map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
                </span>
                  <button className="final-edit-button" type="button" onClick={() => setMode('tone')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
              </div>
              <div className="final-summary-row">
                <TypeIcon className="final-detail-icon" aria-hidden="true" size={22} strokeWidth={1.8} />
                <span className="final-summary-label">로고 타입</span>
                <span className="final-summary-value">{selectedLogoStyle}{logoStyle === 'combination' && <em>추천</em>}</span>
                <button className="final-edit-button" type="button" onClick={() => setMode('style')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
              </div>
              <div className="final-summary-row">
                <Shapes className="final-detail-icon" aria-hidden="true" size={22} strokeWidth={1.8} />
                <span className="final-summary-label">원하는 로고 모양</span>
                <span className="final-summary-value">{displayValue(logoShapePrompt)}</span>
                <button className="final-edit-button" type="button" onClick={() => setMode('style')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
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
      ...(trademarkAnalysisRequested ? [{ number: '6', icon: 'search', text: '유사도를 분석하고 있어요' }] : []),
    ]

    return (
      <main className="logo-loading-screen" aria-labelledby="logo-loading-title">
        <section className="logo-loading-content">
          <header className="logo-loading-heading">
            <h1 id="logo-loading-title">브랜드 정보를 바탕으로<br />로고를 만들고 있어요</h1>
            <p>요청하신 로고 1개를 준비하고 있어요.</p>
          </header>

          <div className="logo-loading-orb" aria-label="로고 생성 진행 중">
            {!generationError && <AiLoader label="Generating" />}
          </div>
          {generationError && <div className="logo-loading-status" role="status">로고 생성에 문제가 발생했어요</div>}
          {generationError && <div className="logo-loading-error" role="alert"><p>{generationError}</p><button type="button" onClick={() => void startLogoGeneration()}>다시 시도하기</button></div>}

          <section className={`logo-loading-steps step-progress-${loadingStep}`} aria-label="로고 생성 단계">
            {loadingSteps.map((step, index) => (
              <article className={`logo-loading-step ${index < loadingStep ? 'complete' : ''} ${index === loadingStep && !generationError ? 'active' : ''}`} key={step.number}>
                <span className="logo-loading-step-number">{step.number}</span>
                <span className={`logo-loading-step-icon icon-${step.icon}`} aria-hidden="true">
                  {step.icon === 'clipboard' ? <ClipboardCheck size={47} strokeWidth={1.8} />
                    : step.icon === 'mood' ? <Heart size={47} strokeWidth={1.8} fill="currentColor" />
                        : step.icon === 'palette' ? <Palette size={47} strokeWidth={1.8} />
                          : step.icon === 'pen' ? <PenLine size={47} strokeWidth={1.8} />
                          : step.icon === 'folder' ? <FolderCheck size={47} strokeWidth={1.8} />
                            : <Search size={47} strokeWidth={1.8} />}
                </span>
                <p>{step.text}</p>
                {index === loadingStep && !generationError && <span className="logo-loading-dots" aria-label="진행 중"><i /><i /><i /></span>}
              </article>
            ))}
          </section>

          <section className="logo-loading-time-card" aria-label="예상 소요 시간">
            <Clock3 className="logo-loading-side-icon clock-icon" aria-hidden="true" size={59} strokeWidth={1.8} />
            <div>
              <p>약 1~3분 정도 걸릴 수 있어요.</p>
              <div className={`logo-loading-progress step-progress-${loadingStep}`} aria-hidden="true"><span /></div>
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
            <button className="trademark-check-button" type="button" onClick={() => { setTrademarkAnalysisSkipped(false); setTrademarkAnalysisRequested(true); setTrademarkAnalysisCompleted(false); void startTrademarkAnalysis() }}>
              <span className="trademark-check-search" aria-hidden="true" />
              <span>비슷한 상표 이미지 확인하기</span>
              <ChevronRight aria-hidden="true" size={23} strokeWidth={1.8} />
            </button>
            <button className="trademark-skip-button" type="button" onClick={() => { setTrademarkAnalysisSkipped(true); setTrademarkAnalysisRequested(false); setTrademarkAnalysisCompleted(false); setMode(trademarkEntry === 'result' ? 'result' : 'loading') }}>
              <span>지금은 건너뛰기</span>
              <ChevronRight aria-hidden="true" size={23} strokeWidth={1.8} />
            </button>
          </div>

          <p className="trademark-disclaimer"><Info aria-hidden="true" size={20} strokeWidth={1.8} /><span>본 분석은 기존 등록 상표 이미지와의 시각적 유사성을 보여주는 참고 자료입니다.<br />상표 등록 가능 여부나 법적 침해 여부를 판단하지 않습니다.</span></p>
        </section>
      </main>
    )
  }

  const renderTrademarkResultScreenRedesign = () => {
    const topMatch = trademarkMatches[0]
    const displayedTrademarkScore = trademarkSimilarity ?? topMatch?.similarity ?? TRADEMARK_SCORE_FALLBACK
    const matchImage = topMatch ? trademarkMatchImages.find((image) => image.rank === topMatch.rank) : undefined
    const selectedCandidate = logoCandidates[resultCandidate]
    const generatedLogoSrc = selectedCandidate ? getLogoCandidateImageUrl(selectedCandidate.storageKey) : resultPreviewImageUrl
    const scoreTone = displayedTrademarkScore >= 60 ? 'caution' : 'low'
    const scoreLabel = trademarkRiskLabel || (scoreTone === 'caution' ? '확인이 필요해요' : '낮은 유사도')
    const comparisonInsight = topMatch?.note?.trim() || (scoreTone === 'caution'
      ? '원형 배치와 곡선 중심의 실루엣에서 비슷한 요소가 비교적 뚜렷하게 보였어요.'
      : '원형 배치와 곡선 중심의 실루엣에서 일부 비슷한 요소를 발견했어요.')

    return (
      <main className="trademark-result-screen trademark-result-screen-redesign" aria-labelledby="trademark-result-title">
        <header className="trademark-result-header trademark-result-header-redesign">
          <button className="trademark-result-back" type="button" aria-label="로고 결과 화면으로 돌아가기" onClick={() => setMode('result')}><ChevronLeft aria-hidden="true" size={22} strokeWidth={1.8} /></button>
          <div className="trademark-result-brand"><BrandLogo /><strong>GenMark AI</strong></div>
        </header>

        <section className="trademark-result-content trademark-result-content-redesign">
          <div className="trademark-result-complete trademark-result-complete-redesign"><CircleCheck aria-hidden="true" size={17} strokeWidth={2} /> 분석을 마쳤어요</div>
          <h1 id="trademark-result-title">생성한 로고의<br /><strong>상표 유사도를 확인했어요</strong></h1>
          <p className="trademark-result-lead">KIPRIS 등록 상표 이미지와 비교해 현재 로고가 얼마나 비슷한지 살펴봤어요.</p>

          <section className="trademark-compare-board" aria-label="생성 로고와 KIPRIS 상표 비교">
            <article className="trademark-generated-card">
              <div className="trademark-visual-label"><Sparkles aria-hidden="true" size={16} strokeWidth={1.8} /><span>생성한 로고</span></div>
              <div className="trademark-generated-art">
                <img src={generatedLogoSrc} alt="AI가 생성한 로고" />
              </div>
            </article>

            <article className={`trademark-score-card ${scoreTone}`}>
              <div className="trademark-score-card-heading"><BarChart3 aria-hidden="true" size={18} strokeWidth={1.8} /><span>유사도 점수</span></div>
              <strong>{displayedTrademarkScore}<small>점</small></strong>
              <span className="trademark-score-status">{scoreLabel}</span>
              <p>비교 점수가 낮을수록 기존 상표와 겹치는 인상이 적어요.</p>
            </article>
          </section>

          <section className="trademark-analysis-copy" aria-label="23점이 나온 이유">
            <div className="trademark-analysis-copy-visual" aria-label={topMatch ? `${topMatch.name} KIPRIS 등록 상표` : 'KIPRIS 비교 상표 이미지'}>
              {matchImage ? <img src={matchImage.src} alt={`${topMatch?.name ?? 'KIPRIS'} 등록 상표`} /> : <Search aria-hidden="true" size={30} strokeWidth={1.7} />}
            </div>
              <div>
              <p className="trademark-analysis-copy-lead">{comparisonInsight}</p>
            </div>
          </section>

          <p className="trademark-result-disclaimer trademark-result-disclaimer-redesign"><Info aria-hidden="true" size={16} strokeWidth={1.8} /><span>이 결과는 이미지 유사도에 대한 참고 자료예요. 상표 등록 가능 여부를 확정하지 않으니, 실제 출원 전에는 전문가의 검토를 권장해요.</span></p>

          <div className="trademark-result-actions trademark-result-actions-redesign">
            <button className="trademark-result-primary" type="button" onClick={() => setMode('result')}>로고 결과로 돌아가기<ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
          </div>
        </section>
      </main>
    )
  }

  const renderTrademarkResultScreen = () => {
    const matches = trademarkMatches
    const topMatch = matches[0]
    const hasTrademarkMatch = Boolean(topMatch)
    const displayedTrademarkScore = trademarkSimilarity ?? topMatch?.similarity ?? TRADEMARK_SCORE_FALLBACK
    const displayedRiskLabel = trademarkRiskLabel || (hasTrademarkMatch ? '분석 완료' : '낮은 유사도')
    const displayedRiskDescription = trademarkRiskDescription || (hasTrademarkMatch
      ? '실제 상표 등록 전에는 전문가의 확인을 권장해요.'
      : '기존 등록 상표와 시각적으로 비슷한 정도가 낮아요. 실제 상표 등록 전에는 전문가의 확인을 권장해요.')

    return (
      <main className="trademark-result-screen" aria-labelledby="trademark-result-title">
        <header className="trademark-result-header">
          <button className="trademark-result-back" type="button" aria-label="로고 결과 화면으로 돌아가기" onClick={() => setMode('result')}><ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} /></button>
          <div className="trademark-result-brand"><BrandLogo /><strong>GenMark AI</strong></div>
        </header>

        <section className="trademark-result-content">
          <div className="trademark-result-complete"><CircleCheck aria-hidden="true" size={20} strokeWidth={1.8} /> 상표 이미지 분석 완료</div>
          <h1 id="trademark-result-title">비슷한 상표 이미지<br /><strong>분석 결과를 확인해보세요</strong></h1>
          <p className="trademark-result-lead">생성한 로고의 형태와 배치를 기존 등록 상표 이미지와 비교했어요.</p>

          <section className="trademark-result-summary" aria-label="가장 유사한 상표 요약">
            <div className="trademark-result-summary-icon" aria-hidden="true"><span /><i /><b /></div>
            <div className="trademark-result-summary-copy">
              <span>가장 유사한 상표</span>
              <strong>{topMatch?.name ?? '비슷한 상표를 찾지 못했어요'}</strong>
              <p>{topMatch?.category ?? '현재 로고와 유사도가 낮은 편이에요.'}</p>
            </div>
            <div className="trademark-result-score">
              <strong>{displayedTrademarkScore}점</strong>
              <span>이미지 유사도</span>
            </div>
          </section>

          <section className={`trademark-risk-card ${trademarkRiskLabel === '안전' || (!trademarkRiskLabel && !hasTrademarkMatch) ? 'safe' : 'caution'}`} aria-label="유사도 위험 범주">
            <div className="trademark-risk-mark" aria-hidden="true"><Check size={24} strokeWidth={2.5} /></div>
            <div>
              <div className="trademark-risk-heading"><strong>{displayedRiskLabel}</strong><span>{displayedTrademarkScore}점</span></div>
              <p>{displayedRiskDescription}</p>
            </div>
          </section>

          <section className="trademark-match-section" aria-labelledby="trademark-match-title">
            <div className="trademark-match-heading">
              <h2 id="trademark-match-title">비슷한 상표 이미지</h2>
              <span>{matches.length > 0 ? `상위 ${matches.length}건` : '유사 상표 없음'}</span>
            </div>
            <div className="trademark-match-list">
              {matches.length > 0 ? matches.map((match) => (
                <article className="trademark-match-row" key={match.name}>
                  <span className="trademark-match-rank">{match.rank}</span>
                  <div className="trademark-match-visual trademark-match-placeholder" aria-hidden="true"><i /><b /><em /></div>
                  <div className="trademark-match-copy">
                    <strong>{match.name}</strong>
                    <span>{match.category}</span>
                    <p>출원번호 {match.applicationNumber}</p>
                    {match.note?.trim() && <p className="trademark-match-note">{match.note}</p>}
                  </div>
                  <strong className="trademark-match-score">{match.similarity}점</strong>
                </article>
              )) : (
                <div className="trademark-match-empty">
                  <strong>유사도가 높은 상표를 찾지 못했어요</strong>
                  <p>현재 로고와 비슷한 등록 상표가 많지 않은 편이에요.</p>
                </div>
              )}
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
    const isResultPreview = logoCandidates.length === 0
    const candidateProfiles = [
      { name: '후보 1', subtitle: 'GENMARK AI', style: 'lavender', direction: '미니멀 · 내추럴' },
      { name: '후보 2', subtitle: 'GENMARK AI', style: 'rose', direction: '우아한 · 감성적' },
      { name: '후보 3', subtitle: 'GENMARK AI', style: 'sage', direction: '깨끗한 · 프리미엄' },
      { name: '후보 4', subtitle: 'GENMARK AI', style: 'pearl', direction: '현대적 · 세련된' },
    ]
    const sourceCandidates = isResultPreview && logoCandidates.length === 0 ? resultPreviewCandidates : logoCandidates
    const candidates = sourceCandidates.map((candidate, index) => ({ ...candidate, ...candidateProfiles[index] }))
    const candidate = candidates[resultCandidate] ?? candidates[0]
    const candidateImageUrl = candidate && !isResultPreview && editorSvgPreviewUrl
      ? editorSvgPreviewUrl
      : candidate
        ? (isResultPreview ? resultPreviewImageUrl : getLogoCandidateImageUrl(candidate.storageKey))
        : resultPreviewImageUrl

    if (!candidate) {
      return (
        <main className="logo-result-screen" aria-labelledby="logo-result-title">
          <section className="logo-result-content">
            <h1 id="logo-result-title">로고 후보를 아직 불러오지 못했어요</h1>
            <p className="logo-result-lead">로고 생성이 완료되면 결과 1개가 이곳에 표시됩니다.</p>
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
        </header>

        <section className="logo-result-content">
          <div className="logo-result-complete"><CircleCheck aria-hidden="true" size={21} strokeWidth={1.8} /> 로고 후보가 완성됐어요</div>
          <h1 id="logo-result-title">가장 마음에 드는 로고를 선택해주세요</h1>
          <p className="logo-result-lead">후보를 비교하고 색상이나 글씨체를 수정할 수 있어요.</p>
          <div className="logo-result-counter" aria-label={`로고 ${resultCandidate + 1} / ${candidates.length}`}>{resultCandidate + 1} / {candidates.length}</div>

          <section className="logo-candidate-panel" aria-label="로고 후보 미리보기">
            <button className={resultLiked ? 'logo-candidate-action like liked' : 'logo-candidate-action like'} type="button" aria-label={resultLiked ? '찜 취소' : '찜'} aria-pressed={resultLiked} onClick={() => isResultPreview ? setResultLiked((current) => !current) : void toggleCandidatePin(candidate)}>
              <Heart size={22} strokeWidth={1.9} fill={resultLiked ? 'currentColor' : 'none'} />
            </button>
            {candidates.length > 1 && <button className="logo-candidate-arrow previous" type="button" aria-label="이전 후보" onClick={() => { const next = (resultCandidate + candidates.length - 1) % candidates.length; if (isResultPreview) setResultCandidate(next); else void selectLogoCandidate(candidates[next], next) }}><ChevronLeft aria-hidden="true" size={26} strokeWidth={1.8} /></button>}
            <div className="logo-candidate-art">
              <img
                className="logo-candidate-image"
                src={candidateImageUrl}
                alt={`${candidate.name} AI 생성 로고`}
              />
            </div>
            {candidates.length > 1 && <button className="logo-candidate-arrow next" type="button" aria-label="다음 후보" onClick={() => { const next = (resultCandidate + 1) % candidates.length; if (isResultPreview) setResultCandidate(next); else void selectLogoCandidate(candidates[next], next) }}><ChevronRight aria-hidden="true" size={26} strokeWidth={1.8} /></button>}
              <button className="logo-candidate-action download" type="button" aria-label="로고 파일 다운로드" disabled={isResultPreview} onClick={() => requestLogoDownload({ ...candidate, candidateId: candidate.id })}>
              <Download size={21} strokeWidth={1.9} />
            </button>
          </section>
          {candidate.pinnedAt ? <p className="logo-pin-expiry">찜한 로고예요. 3일 뒤 자동으로 사라져요.</p> : null}
          {pinError && <p className="project-error" role="alert">{pinError}</p>}
          <div className="logo-result-dots" aria-label="후보 선택">
            {candidates.map((item, index) => <button key={item.id} className={index === resultCandidate ? 'active' : ''} type="button" aria-label={`후보 ${index + 1}`} aria-pressed={index === resultCandidate} onClick={() => isResultPreview ? setResultCandidate(index) : void selectLogoCandidate(item, index)} />)}
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
              <div><strong>상표 이미지 유사도 분석 완료</strong><p>가장 높은 유사도는 {trademarkSimilarity ?? TRADEMARK_SCORE_FALLBACK}점으로, 현재 <b>{trademarkRiskLabel || '낮은 유사도'}</b> 범위예요.</p><button type="button" onClick={() => setMode('trademark-result')}>유사도 분석 결과 보기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
            ) : !canAnalyzeTrademark ? (
              <div><strong>상표 이미지 유사도</strong><p>선택한 로고 스타일은 이미지 유사도 분석을 지원하지 않아요.</p></div>
            ) : trademarkAnalysisSkipped ? (
              <div><strong>상표 이미지 유사도</strong><p>이전 단계에서 유사도 분석을 건너뛰었어요.</p></div>
            ) : (
              <div><strong>상표 이미지 유사도</strong><p>아직 상표 이미지 유사도를 확인하지 않았어요.</p><button type="button" onClick={() => openTrademarkSelection('result')}>비슷한 상표 이미지 확인하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
            )}
          </section>
          {analysisError && <p className="project-error" role="alert">{analysisError}</p>}

          <div className="logo-result-actions">
            <button className="logo-result-edit" type="button" onClick={() => setMode('edit')}><Pencil aria-hidden="true" size={23} strokeWidth={1.8} />로고 수정<ChevronRight aria-hidden="true" size={25} strokeWidth={1.8} /></button>
          </div>

          <div className="logo-result-utility-grid">
            <button className="utility-primary" type="button" onClick={() => void startLogoGeneration()}><RefreshCw className="result-utility-icon" aria-hidden="true" size={22} strokeWidth={1.8} />조건을 바꿔<br />다시 만들기<ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
            <button className="utility-secondary" type="button" onClick={openBrandKitSelection}><ImageIcon className="result-utility-icon" aria-hidden="true" size={22} strokeWidth={1.8} />{brandKit?.status === 'SUCCEEDED' ? '브랜드 키트 확인하기' : '브랜드 키트 만들기'}<ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
          </div>
          {brandKit && <p className="project-error" role="status">브랜드 키트 상태: {brandKit.status === 'QUEUED' || brandKit.status === 'RUNNING' ? '생성 중' : brandKit.status === 'SUCCEEDED' ? '완료' : '실패'}</p>}
          {brandKitError && <p className="project-error" role="alert">{brandKitError}</p>}
        </section>
      </main>
    )
  }

  const renderBrandKitSelectionScreen = () => {
    const expectedKitType: BrandKit['kitType'] = brandKind === 'ci' ? 'BUSINESS_CARD' : 'THUMBNAIL'
    const options: Array<{ type: BrandKit['kitType']; title: string; caption: string; description: string; icon: typeof CreditCard }> = expectedKitType === 'BUSINESS_CARD'
      ? [{ type: 'BUSINESS_CARD', title: '명함', caption: '첫 인사를 더 또렷하게', description: '기업의 인상을 담은 명함 앞·뒷면 시안을 만들어요.', icon: CreditCard }]
      : [{ type: 'THUMBNAIL', title: '제품 썸네일', caption: '제품을 한눈에 보여주기', description: '상품 페이지와 SNS에 쓸 썸네일 시안을 만들어요.', icon: ImageIcon }]
    const selectedOption = options.find((option) => option.type === brandKitType)
    const completedStorageKeys = brandKit?.status === 'SUCCEEDED'
      ? brandKit.storageKeys?.length
        ? brandKit.storageKeys
        : brandKit.storageKey
          ? [brandKit.storageKey]
          : []
      : []
    const completedBrandKit = brandKit?.status === 'SUCCEEDED' && completedStorageKeys.length > 0 ? brandKit : null
    const brandKitImageUrls = completedStorageKeys.map(getLogoCandidateImageUrl)
    const missingBusinessCardBack = completedBrandKit?.kitType === 'BUSINESS_CARD' && brandKitImageUrls.length < 2

    return (
      <main className="brand-kit-selection-screen" aria-labelledby="brand-kit-selection-title">
        <ScreenBackButton label="로고 결과 화면으로 돌아가기" onClick={() => setMode('result')} />
        <section className="brand-kit-selection-content">
          <header className="brand-kit-selection-header">
            <div className="brand-kit-selection-mark" aria-hidden="true"><BrandLogo /></div>
            <p>브랜드 키트 만들기</p>
            <h1 id="brand-kit-selection-title">로고를 어디에<br />먼저 써볼까요?</h1>
            <span>필요한 활용처를 골라 주세요.</span>
          </header>

          {completedBrandKit && brandKitImageUrls.length > 0 ? (
            <section className="brand-kit-result-preview" aria-labelledby="brand-kit-result-title">
              <div className="brand-kit-result-images">
                {brandKitImageUrls.map((imageUrl, index) => {
                  const sideLabel = completedBrandKit.kitType === 'BUSINESS_CARD'
                    ? index === 0 ? '앞면' : '뒷면'
                    : '완성본'
                  return (
                    <figure className="brand-kit-result-image" key={`${imageUrl}-${index}`}>
                      <figcaption>
                        <strong>{sideLabel}</strong>
                        {completedBrandKit.kitType !== 'BUSINESS_CARD' && (
                          <a href={imageUrl} download="genmark-thumbnail.png">
                            <Download aria-hidden="true" size={17} strokeWidth={1.9} />다운로드
                          </a>
                        )}
                      </figcaption>
                      <img src={imageUrl} alt={`완성된 ${completedBrandKit.kitType === 'BUSINESS_CARD' ? `명함 ${sideLabel}` : '제품 썸네일'} 브랜드 키트`} />
                    </figure>
                  )
                })}
              </div>
              <div className="brand-kit-result-copy">
                <span>브랜드 키트 완성</span>
                {completedBrandKit.preliminary && <span className="brand-kit-preliminary-badge">임시 결과</span>}
                <h2 id="brand-kit-result-title">{completedBrandKit.kitType === 'BUSINESS_CARD' ? '명함' : '제품 썸네일'} 시안이 준비됐어요.</h2>
                <p>{missingBusinessCardBack ? '이 결과는 이전 방식으로 만든 앞면만 있어요. 아래 버튼으로 뒷면까지 바로 만들 수 있어요.' : completedBrandKit.kitType === 'BUSINESS_CARD' ? '앞면과 뒷면을 확인한 뒤 ZIP 파일 하나로 함께 받을 수 있어요.' : '선택한 로고가 실제 활용 이미지에 적용된 결과예요.'}</p>
                {completedBrandKit.warnings?.length ? (
                  <ul className="brand-kit-warnings" aria-label="브랜드 키트 경고">
                    {completedBrandKit.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                ) : null}
                {completedBrandKit.kitType === 'BUSINESS_CARD' && !missingBusinessCardBack && (
                  <button className="brand-kit-download-button" type="button" disabled={brandKitDownloading} onClick={() => void downloadBrandKitArchive(completedBrandKit)}>
                    <Download aria-hidden="true" size={18} strokeWidth={1.9} />
                    {brandKitDownloading ? '묶는 중…' : '앞면·뒷면 한 번에 받기'}
                  </button>
                )}
                {missingBusinessCardBack && (
                  <button className="brand-kit-regenerate-button" type="button" onClick={() => openBusinessCardModal({ candidateId: completedBrandKit.candidateId, projectId: completedBrandKit.projectId })}>
                    앞면·뒷면 다시 만들기
                    <RefreshCw aria-hidden="true" size={18} strokeWidth={1.9} />
                  </button>
                )}
              </div>
            </section>
          ) : (
            <div className="brand-kit-choice-grid" role="radiogroup" aria-label="브랜드 키트 종류 선택">
              {options.map((option) => {
                const Icon = option.icon
                const selected = option.type === brandKitType
                return (
                  <button
                    key={option.type}
                    className={selected ? 'brand-kit-choice selected' : 'brand-kit-choice'}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setBrandKitType(option.type)}
                  >
                    <span className="brand-kit-choice-visual" aria-hidden="true"><Icon size={40} strokeWidth={1.6} /></span>
                    <span className="brand-kit-choice-copy"><strong>{option.title}</strong><em>{option.caption}</em><small>{option.description}</small></span>
                    <span className="brand-kit-choice-radio" aria-hidden="true">{selected ? <Check size={18} strokeWidth={2.6} /> : null}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="brand-kit-selection-footer">
            <p aria-live="polite">{brandKitImageUrls.length > 0 ? '완성된 이미지를 확인하거나 내려받을 수 있어요.' : selectedOption ? `${selectedOption.title} 키트를 만들 준비가 됐어요.` : '원하는 브랜드 키트를 선택해 주세요.'}</p>
            {brandKitImageUrls.length > 0 ? (
              <button className="brand-kit-create-button secondary" type="button" onClick={() => { setBrandKit(null); setBrandKitType(expectedKitType) }}>
                새 시안 만들기
                <ChevronRight aria-hidden="true" size={23} strokeWidth={1.9} />
              </button>
            ) : (
              <button className="brand-kit-create-button" type="button" disabled={!brandKitType} onClick={createSelectedBrandKit}>
                {selectedOption ? `${selectedOption.title} 키트 만들기` : '브랜드 키트 선택하기'}
                <ChevronRight aria-hidden="true" size={23} strokeWidth={1.9} />
              </button>
            )}
            {brandKit && <p className="brand-kit-status" role="status">{brandKit.status === 'QUEUED' || brandKit.status === 'RUNNING' ? '브랜드 키트를 만들고 있어요.' : brandKit.status === 'SUCCEEDED' ? '브랜드 키트가 준비됐어요.' : '브랜드 키트 생성에 문제가 생겼어요.'}</p>}
            {brandKitError && <p className="brand-kit-error" role="alert">{brandKitError}</p>}
          </div>
        </section>
      </main>
    )
  }

  const renderLogoEditScreen = () => {
    const candidates = logoCandidates.length > 0 ? logoCandidates : resultPreviewCandidates
    const safeCandidateIndex = Math.min(resultCandidate, Math.max(0, candidates.length - 1))
    const candidate = candidates[safeCandidateIndex]
    const fallbackImageUrl = logoCandidates.length > 0 && candidate
      ? getLogoCandidateImageUrl(candidate.storageKey)
      : resultPreviewImageUrl
    const editorImageUrl = editorSvgPreviewUrl ?? fallbackImageUrl
    const showCandidateNavigation = candidates.length > 1

    const moveEditorCandidate = (offset: number) => {
      if (!showCandidateNavigation) return
      setResultCandidate((current) => (current + offset + candidates.length) % candidates.length)
    }

    return (
      <main className="logo-editor-screen" aria-labelledby="logo-editor-title">
        <header className="logo-editor-header">
          <button className="logo-editor-back" type="button" aria-label="결과 화면으로 돌아가기" onClick={() => setMode('result')}><ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} /></button>
          <div className="logo-editor-brand"><BrandLogo /><strong>GenMark AI</strong></div>
          <button className="logo-editor-save" type="button" disabled={editorLoading || editorSaving || !editorSvgSource} onClick={() => void saveEditorChanges()}>{editorSaving ? '저장 중' : editorSaved ? '저장됨' : '저장'}<ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} /></button>
        </header>

        <section className="logo-editor-content">
          <div className="logo-editor-meta">
            <div className="logo-editor-counter">{showCandidateNavigation && <button type="button" aria-label="이전 후보" onClick={() => moveEditorCandidate(-1)}><ChevronLeft size={18} strokeWidth={1.8} /></button>}<strong>후보 {safeCandidateIndex + 1} / {candidates.length}</strong>{showCandidateNavigation && <button type="button" aria-label="다음 후보" onClick={() => moveEditorCandidate(1)}><ChevronRight size={18} strokeWidth={1.8} /></button>}</div>
            <span className="logo-editor-autosave"><Check size={15} strokeWidth={2} /> {editorSaved ? '저장됨' : '편집 중'}</span>
          </div>

          <section className="logo-editor-preview-card" aria-label="로고 편집 캔버스">
            <div className="logo-editor-artboard">
              <button className={editTarget === 'symbol' ? 'editor-uploaded-logo-target selected' : 'editor-uploaded-logo-target'} type="button" aria-label="선택한 로고 수정" onClick={() => selectEditorTarget('symbol')}>
                <img className="editor-uploaded-logo" src={editorImageUrl} alt="선택한 AI 생성 로고" style={editorSvgPreviewUrl ? { objectFit: 'contain' } : { objectFit: 'contain', transform: `scale(${editorScale / 100}) rotate(${editorRotation}deg)`, opacity: editorOpacity / 100 }} />
                {editTarget === 'symbol' && <span className="editor-selection-trash" aria-hidden="true" />}
              </button>
              {editTarget === 'symbol' && <span className="editor-rotate-handle" aria-hidden="true"><RefreshCw size={22} strokeWidth={1.8} /></span>}
            </div>
            <div className="logo-editor-preview-footer">
              <div className="editor-history"><button type="button" aria-label="실행 취소"><ArrowLeft size={20} strokeWidth={1.8} /></button><button type="button" aria-label="다시 실행"><ArrowRight size={20} strokeWidth={1.8} /></button></div>
            </div>
          </section>

          <section className="logo-editor-panel" aria-labelledby="logo-editor-title">
            <h1 id="logo-editor-title" className="sr-only">로고 수정</h1>
            <div className="logo-editor-tabs" role="tablist" aria-label="수정할 로고 요소">
              <button className={editTarget === 'symbol' ? 'active' : ''} type="button" role="tab" aria-selected={editTarget === 'symbol'} onClick={() => selectEditorTarget('symbol')}>심볼</button>
              <button className={editTarget === 'text' ? 'active' : ''} type="button" role="tab" aria-selected={editTarget === 'text'} onClick={() => selectEditorTarget('text')}>글자</button>
              <button type="button" role="tab" aria-selected="false" disabled>배치 준비 중</button>
            </div>

            {editTarget === 'text' ? (
              <div className="editor-control-section text-controls">
                <div className="editor-control-heading"><strong>글자 요소 설정</strong><button type="button" onClick={resetEditorControls}>초기화</button></div>
                <label className="editor-slider-row"><span>크기</span><input type="range" min="70" max="140" value={editorScale} onChange={(event) => { setEditorScale(Number(event.target.value)); markEditorDirty() }} /><output>{editorScale}%</output></label>
                <label className="editor-slider-row"><span>회전</span><input type="range" min="-180" max="180" value={editorRotation} onChange={(event) => { setEditorRotation(Number(event.target.value)); markEditorDirty() }} /><output>{editorRotation}°</output></label>
                <label className="editor-slider-row"><span>투명도</span><input type="range" min="30" max="100" value={editorOpacity} onChange={(event) => { setEditorOpacity(Number(event.target.value)); markEditorDirty() }} /><output>{editorOpacity}%</output></label>
                <label className="editor-color-row"><span>색상</span><select value={editorColor} onChange={(event) => { setEditorColor(event.target.value); setEditorColorChanged(true); markEditorDirty() }}><option value="#7B5CDF">●  #7B5CDF</option><option value="#E36BAE">●  #E36BAE</option><option value="#2D3047">●  #2D3047</option></select></label>
                <p className="logo-editor-note">브랜드명과 글씨체 교체는 현재 지원하지 않으며, 생성된 글자 모양의 크기·회전·색상만 수정할 수 있어요.</p>
              </div>
            ) : (
              <div className="editor-control-section symbol-controls">
                <div className="editor-control-heading"><strong>심볼 설정</strong><button type="button" onClick={resetEditorControls}>초기화</button></div>
                <label className="editor-slider-row"><span>크기</span><input type="range" min="70" max="140" value={editorScale} onChange={(event) => { setEditorScale(Number(event.target.value)); markEditorDirty() }} /><output>{editorScale}%</output></label>
                <label className="editor-slider-row"><span>회전</span><input type="range" min="-180" max="180" value={editorRotation} onChange={(event) => { setEditorRotation(Number(event.target.value)); markEditorDirty() }} /><output>{editorRotation}°</output></label>
                <label className="editor-slider-row"><span>투명도</span><input type="range" min="30" max="100" value={editorOpacity} onChange={(event) => { setEditorOpacity(Number(event.target.value)); markEditorDirty() }} /><output>{editorOpacity}%</output></label>
                <label className="editor-color-row"><span>색상</span><select value={editorColor} onChange={(event) => { setEditorColor(event.target.value); setEditorColorChanged(true); markEditorDirty() }}><option value="#7B5CDF">●  #7B5CDF</option><option value="#E36BAE">●  #E36BAE</option><option value="#2D3047">●  #2D3047</option></select></label>
              </div>
            )}
          </section>

          <div className="logo-editor-actions">
            <button className="logo-editor-apply" type="button" disabled={editorLoading || editorSaving || !editorSvgSource} onClick={() => void saveEditorChanges().then((saved) => { if (saved) setMode('result') })}>수정 적용하기</button>
          </div>
          {editorLoading && <p className="project-error" role="status">SVG 로고를 불러오고 있어요.</p>}
          {editorError && <p className="project-error" role="alert">{editorError}</p>}
          <p className="logo-editor-note">· 로고의 형태나 배치를 변경하면 상표 이미지 유사도에 영향을 줄 수 있어요.</p>
        </section>
      </main>
    )
  }

  const renderMypageScreen = () => {
    if (!authRestoring && !loggedIn) {
      const goToLogin = () => { setLoginDestination('mypage'); setLoginReturnMode('home'); setMode('login') }
      return (
        <main className="mypage-screen" aria-labelledby="mypage-title">
          <header className="main-header">
            <a className="main-brand" href="#home" aria-label="GenMark AI 홈" onClick={() => setMode('home')}>
              <BrandLogo />
              <span>GenMark AI</span>
            </a>
          </header>
          <section className="mypage-content mypage-login-gate">
            <div className="mypage-login-gate-icon"><UserRound aria-hidden="true" size={30} strokeWidth={1.6} /></div>
            <h1 id="mypage-title">로그인을 진행해주세요.</h1>
            <p>마이페이지는 로그인 후 이용하실 수 있어요.</p>
            <button className="gradient-button" type="button" onClick={goToLogin}>
              로그인하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
          </section>
        </main>
      )
    }
    const useMypageMock = MYPAGE_MOCK_MODE && !authRestoring && !loggedIn
    const displayUserName = useMypageMock ? '김명은' : authUser?.name?.trim() || '사용자'
    const displayEmail = useMypageMock ? '연결된 이메일 정보가 없어요. tkss1217@gmail.com' : authUser?.email?.trim() || '연결된 이메일 정보가 없어요.'
    const displayCompanyName = useMypageMock ? '육하원칙' : companyName.trim() || '아직 입력된 회사명이 없어요.'
    const displayCompanyMotto = useMypageMock ? '브랜드 프로젝트를 위한 회사 모토를 입력해보세요.' : companyMotto.trim() || '브랜드 프로젝트에서 회사 모토를 입력해보세요.'
    const selectedLogo = logoCandidates.find((candidate) => candidate.id === selectedCandidateId)
      ?? logoCandidates.find((candidate) => candidate.selected)
    const projectName = (brandKind === 'ci' ? companyName : brandName).trim()
    const projectDescription = (brandKind === 'ci' ? companyMotto : brandValueDescription).trim()
    const selectedIndustry = industryOptions.find((option) => option.id === industrySelection)?.title ?? '업종 미입력'
    const selectedStyle = logoStyleOptions.find((option) => option.id === logoStyle)?.label ?? '스타일 미입력'
    const completedProjects = useMypageMock ? [{
      id: 'mypage-mock-completed-brand',
      name: '육하원칙',
      detail: '뷰티 · 콤비네이션',
      description: '완성된 브랜드 로고 목업',
      candidate: { id: 'mypage-mock-completed-candidate', storageKey: 'mypage/mock-completed-brand.png' } as LogoCandidate,
    }] : projectId && selectedLogo && projectName
      ? [{
          id: projectId,
          name: projectName,
          detail: `${selectedIndustry} · ${selectedStyle}`,
          description: projectDescription,
          candidate: selectedLogo,
        }]
      : []
    const displayDownloadHistory: DownloadRecord[] = useMypageMock ? [
      {
        downloadId: -1,
        candidateId: 'mypage-mock-pinned-1',
        projectType: 'BI',
        imageUrl: '/mypage/mock-pinned/mypage-mock-pinned-1.png',
        firstTime: false,
        downloadedAt: '2026-08-14T09:00:00.000Z',
      },
      {
        downloadId: -2,
        candidateId: 'mypage-mock-pinned-2',
        projectType: 'BI',
        imageUrl: '/mypage/mock-pinned/mypage-mock-pinned-2.png',
        firstTime: false,
        downloadedAt: '2026-08-14T09:05:00.000Z',
      },
    ] : downloadHistory
    const displayPinnedLogos: PinnedLogo[] = useMypageMock ? [
      { candidateId: 'mypage-mock-pinned-1', projectType: 'BI', storageKey: 'mypage/pinned/lysenne.png', pinnedAt: '2026-08-14T08:00:00.000Z', expiresAt: '2026-08-17T08:00:00.000Z', createdAt: '2026-08-14T08:00:00.000Z' },
      { candidateId: 'mypage-mock-pinned-2', projectType: 'BI', storageKey: 'mypage/pinned/sunwave.png', pinnedAt: '2026-08-14T08:00:00.000Z', expiresAt: '2026-08-17T08:00:00.000Z', createdAt: '2026-08-14T08:00:00.000Z' },
      { candidateId: 'mypage-mock-pinned-3', projectType: 'BI', storageKey: 'mypage/pinned/gn.png', pinnedAt: '2026-08-14T08:00:00.000Z', expiresAt: '2026-08-17T08:00:00.000Z', createdAt: '2026-08-14T08:00:00.000Z' },
      { candidateId: 'mypage-mock-pinned-4', projectType: 'BI', storageKey: 'mypage/pinned/vastel.png', pinnedAt: '2026-08-14T08:00:00.000Z', expiresAt: '2026-08-17T08:00:00.000Z', createdAt: '2026-08-14T08:00:00.000Z' },
      { candidateId: 'mypage-mock-pinned-5', projectType: 'BI', storageKey: 'mypage/pinned/rk.png', pinnedAt: '2026-08-14T08:00:00.000Z', expiresAt: '2026-08-17T08:00:00.000Z', createdAt: '2026-08-14T08:00:00.000Z' },
    ] : pinnedLogos
    const savedBrandKitStorageKeys = brandKit?.status === 'SUCCEEDED'
      ? brandKit.storageKeys?.length
        ? brandKit.storageKeys
        : brandKit.storageKey
          ? [brandKit.storageKey]
          : []
      : []
    const savedBrandKitImageUrls = savedBrandKitStorageKeys.map(getLogoCandidateImageUrl)
    const mockBrandKitItems = [
      { image: '/mypage/mock-brand-kit/lavenor.png', name: 'LAVENOR' },
      { image: '/mypage/mock-brand-kit/aurelis.png', name: 'AURELIS' },
      { image: '/mypage/mock-brand-kit/solairea.png', name: 'SOLAIREA' },
      { image: '/mypage/mock-brand-kit/noirel.png', name: 'NOIRÉL' },
      { image: '/mypage/mock-brand-kit/citrea.png', name: 'CITRÉA' },
    ]
    const getPinnedImageUrl = (item: PinnedLogo) => useMypageMock
      ? `/mypage/mock-pinned/${item.candidateId}.png`
      : getLogoCandidateImageUrl(item.storageKey)
    const remainingPinDays = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
    const beginProfileEdit = () => {
      setProfileCompanyNameDraft(useMypageMock ? '육하원칙' : companyName)
      setProfileCompanyMottoDraft(useMypageMock ? '브랜드 프로젝트를 위한 회사 모토를 입력해보세요.' : companyMotto)
      setProfileEditing(true)
    }
    const saveProfileEdit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setCompanyName(profileCompanyNameDraft.trim())
      setCompanyMotto(profileCompanyMottoDraft.trim())
      setProfileEditing(false)
    }
    const downloadHistoryItem = async (item: DownloadRecord) => {
      try {
        if (item.imageUrl.startsWith('/')) {
          const link = document.createElement('a')
          link.href = item.imageUrl
          link.download = `genmark-${item.projectType.toLowerCase()}-${item.candidateId}.png`
          document.body.appendChild(link)
          link.click()
          link.remove()
          return
        }
        const blob = await downloadAuthenticatedFile(item.imageUrl)
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `genmark-${item.projectType.toLowerCase()}-${item.candidateId}.png`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(link.href)
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : '다운로드 파일을 불러오지 못했어요.')
      }
    }

    return (
      <main className="mypage-screen" aria-labelledby="mypage-title">
        <header className="workspace-header">
          <button className="workspace-back" type="button" aria-label="홈으로 돌아가기" onClick={() => setMode('home')}><ChevronLeft aria-hidden="true" size={23} strokeWidth={1.8} /></button>
          <div className="workspace-brand"><BrandLogo /><strong>GenMark AI</strong></div>
        </header>

        <section className="mypage-content">
          <header className="mypage-heading">
            <h1 id="mypage-title">{displayUserName}님의 브랜드 작업</h1>
            <p>프로필과 저장된 브랜드 자산을 한곳에서 확인하세요.</p>
          </header>

          <section className="mypage-profile-panel" aria-labelledby="profile-title">
            <div className="profile-identity">
              <span className="profile-avatar" aria-hidden="true">{displayUserName.slice(0, 1)}</span>
              <div><h2 id="profile-title">{displayUserName}</h2><p>{displayEmail}</p></div>
            </div>
            <form className="profile-details" onSubmit={saveProfileEdit}>
              <div className="profile-edit-actions">
                {profileEditing ? (
                  <><button type="button" onClick={() => setProfileEditing(false)}>취소</button><button className="save" type="submit">저장</button></>
                ) : (
                  <button type="button" onClick={beginProfileEdit}><Pencil aria-hidden="true" size={13} strokeWidth={2} />수정</button>
                )}
              </div>
              <dl className="profile-detail-list">
                <div>
                  <dt><Building2 size={17} strokeWidth={1.8} />회사명</dt>
                  <dd>{profileEditing ? <input aria-label="회사명 수정" maxLength={80} value={profileCompanyNameDraft} onChange={(event) => setProfileCompanyNameDraft(event.target.value)} placeholder="회사명을 입력해주세요." /> : displayCompanyName}</dd>
                </div>
                <div>
                  <dt><Sparkles size={17} strokeWidth={1.8} />회사 모토</dt>
                  <dd>{profileEditing ? <textarea aria-label="회사 모토 수정" maxLength={300} rows={2} value={profileCompanyMottoDraft} onChange={(event) => setProfileCompanyMottoDraft(event.target.value)} placeholder="회사 모토를 입력해주세요." /> : displayCompanyMotto}</dd>
                </div>
              </dl>
            </form>
          </section>

          <section className="mypage-section" aria-labelledby="completed-title">
            <div className="section-title-row"><div><h2 id="completed-title">완성한 브랜드</h2><p>생성한 로고와 분석 결과를 다시 확인할 수 있어요.</p></div><FolderCheck aria-hidden="true" size={27} strokeWidth={1.8} /></div>
            {completedProjects.length > 0 ? completedProjects.map((project) => (
              <article className="completed-project-card" key={project.id}>
                <div className="completed-project-preview"><img src={useMypageMock ? '/mypage/mock-completed-brand.png' : getLogoCandidateImageUrl(project.candidate.storageKey)} alt={`${project.name} 선택 로고`} /></div>
                <div className="completed-project-info"><div className="project-info-heading"><strong>{project.name}</strong><span className="project-status"><Check size={14} strokeWidth={2.3} /> 로고 선택 완료</span></div><p>{project.detail}</p>{project.description && <p className="project-description">{project.description}</p>}<div className="project-status-list"><span><Check size={14} strokeWidth={2} /> 로고 생성 완료</span><span className={trademarkAnalysisCompleted ? '' : 'muted'}><Check size={14} strokeWidth={2} /> 상표 분석 {trademarkAnalysisCompleted ? '완료' : '미완료'}</span><span className={brandKit?.status === 'SUCCEEDED' ? '' : 'muted'}><Check size={14} strokeWidth={2} /> 브랜드킷 {brandKit?.status === 'SUCCEEDED' ? '완료' : '미완료'}</span></div></div>
                <div className="project-action-grid">
                  <button type="button" onClick={() => setMode('result')}><ImageIcon size={19} strokeWidth={1.8} />결과 보기</button>
                  <button type="button" disabled={!trademarkAnalysisCompleted} onClick={() => setMode('trademark-result')}><Search size={19} strokeWidth={1.8} />유사도 결과</button>
                  <button type="button" onClick={() => requestLogoDownload({ name: project.name, subtitle: selectedIndustry, candidateId: project.candidate.id, storageKey: project.candidate.storageKey, svgUrl: project.candidate.svgUrl })}><Download size={19} strokeWidth={1.8} />로고 다운로드</button>
                  <button type="button" onClick={openBrandKitSelection}><FolderCheck size={19} strokeWidth={1.8} />브랜드킷 만들기</button>
                  <button type="button" onClick={() => setMode('style')}><RefreshCw size={19} strokeWidth={1.8} />다시 생성하기</button>
                </div>
              </article>
            )) : (
              <div className="mypage-empty-state"><div className="empty-state-icon"><Sparkles size={30} strokeWidth={1.7} /></div><h3>아직 완성한 브랜드가 없어요</h3><p>로고를 생성하고 최종 후보를 선택하면 이곳에 표시돼요.</p><button className="gradient-button" type="button" onClick={startOnboarding} disabled={authRestoring}>로고 만들기 시작 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
            )}
          </section>

          <section className="mypage-section" aria-labelledby="download-history-title">
            <div className="section-title-row"><div><h2 id="download-history-title">내 다운로드 목록</h2><p>CI·BI 유형별로 최근 20개까지 보관돼요. 한도를 넘으면 오래된 기록부터 자동으로 정리됩니다.</p></div></div>
            {displayDownloadHistory.length > 0 ? (
              useMypageMock ? (
                <div className="download-logo-grid">
                  {displayDownloadHistory.map((item) => (
                    <article className="download-logo-card" key={item.downloadId}>
                      <img src={item.imageUrl} alt="다운로드한 로고" />
                      <div><strong>{item.projectType} 로고</strong><p>{new Date(item.downloadedAt).toLocaleString('ko-KR')}에 저장</p><button type="button" onClick={() => void downloadHistoryItem(item)}>다시 받기</button></div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mypage-record-list">
                  {displayDownloadHistory.map((item) => (
                    <article className="mypage-record-row" key={item.downloadId}>
                      <span className="record-icon"><Download size={19} strokeWidth={1.8} /></span>
                      <div><strong>{item.projectType} 로고</strong><p>{new Date(item.downloadedAt).toLocaleString('ko-KR')}에 저장</p></div>
                      <button type="button" onClick={() => void downloadHistoryItem(item)}>다시 받기</button>
                    </article>
                  ))}
                </div>
              )
            ) : <div className="mypage-inline-empty"><Download size={22} strokeWidth={1.6} /><span>아직 다운로드한 로고가 없어요.</span></div>}
          </section>

          <section className="mypage-section" aria-labelledby="pinned-title">
              <div className="section-title-row"><div><h2 id="pinned-title">찜한 로고</h2><p>찜한 로고는 3일 동안 잠시 보관돼요. 기간이 지나면 목록에서 자동으로 사라집니다.</p></div></div>
            {displayPinnedLogos.length > 0 ? (
              <div className="pinned-logo-grid">
                {displayPinnedLogos.map((item) => (
                  <article className="pinned-logo-card" key={item.candidateId}>
                    <img src={getPinnedImageUrl(item)} alt="찜한 로고" />
                    <div><strong>{item.projectType ?? '브랜드'} 로고</strong><span>{remainingPinDays(item.expiresAt)}일 후 목록에서 사라져요</span><small>{new Date(item.expiresAt).toLocaleDateString('ko-KR')}까지 보관</small></div>
                  </article>
                ))}
              </div>
            ) : <div className="mypage-inline-empty"><Heart size={22} strokeWidth={1.6} /><span>잠시 보관하고 싶은 로고를 찜해보세요.</span></div>}
          </section>

          <section className="mypage-section" aria-labelledby="brand-kit-list-title">
            <div className="section-title-row"><div><h2 id="brand-kit-list-title">내 브랜드킷</h2><p>선택한 로고로 만든 명함과 제품 썸네일을 확인하세요.</p></div></div>
            {useMypageMock ? (
              <div className="pinned-logo-grid brand-kit-mock-grid">
                {mockBrandKitItems.map((item) => (
                  <article className="pinned-logo-card" key={item.name}>
                    <img src={item.image} alt={`${item.name} 제품 썸네일`} />
                    <div><strong>{item.name}</strong><span>제품 썸네일</span><small>브랜드 키트 목업</small></div>
                  </article>
                ))}
              </div>
            ) : brandKit?.status === 'SUCCEEDED' && savedBrandKitImageUrls.length > 0 ? (
              <article className="mypage-brand-kit-result">
                <div className="mypage-brand-kit-images">
                  {savedBrandKitImageUrls.map((imageUrl, index) => {
                    const label = brandKit.kitType === 'BUSINESS_CARD'
                      ? index === 0 ? '앞면' : '뒷면'
                      : '제품 썸네일'
                    return (
                      <figure className="mypage-brand-kit-image" key={`${imageUrl}-${index}`}>
                        <figcaption>{label}</figcaption>
                        <img src={imageUrl} alt={`완성된 ${label}`} />
                      </figure>
                    )
                  })}
                </div>
                <button className="mypage-brand-kit-download" type="button" disabled={brandKitDownloading} onClick={() => void downloadBrandKitArchive(brandKit)}>
                  <Download aria-hidden="true" size={18} strokeWidth={1.9} />
                  {brandKitDownloading ? '묶는 중…' : brandKit.kitType === 'BUSINESS_CARD' ? '앞면·뒷면 한 번에 다운로드' : '다운로드'}
                </button>
              </article>
            ) : brandKit ? (
              <article className="brand-kit-summary-row">
                <span className="record-icon"><FolderCheck size={20} strokeWidth={1.8} /></span>
                <div><strong>{brandKit.kitType === 'BUSINESS_CARD' ? '명함' : '제품 썸네일'}</strong><p>{brandKit.status === 'SUCCEEDED' ? '생성이 완료됐어요.' : brandKit.status === 'FAILED' ? '생성에 실패했어요.' : '현재 생성 중이에요.'}</p></div>
                <span className={`brand-kit-state ${brandKit.status.toLowerCase()}`}>{brandKit.status === 'SUCCEEDED' ? '완료' : brandKit.status === 'FAILED' ? '실패' : '생성 중'}</span>
              </article>
            ) : <div className="mypage-inline-empty"><FolderCheck size={22} strokeWidth={1.6} /><span>아직 만든 브랜드킷이 없어요.</span></div>}
          </section>

          {projectError && <p className="project-error mypage-project-error" role="alert">{projectError}</p>}
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
          <form className="survey-content" onSubmit={(event) => { event.preventDefault(); void submitSurveyResponse().catch((error) => setProjectError(error instanceof Error ? error.message : '설문을 제출하지 못했어요.')) }}>
            <header className="survey-heading"><div className="survey-heading-icon"><MessageSquare aria-hidden="true" size={28} strokeWidth={1.7} /></div><h1 id="survey-title">로고를 만드는 과정은 어떠셨나요?</h1><p>초기 화장품 창업자가 더 쉽게 사용할 수 있도록 의견을 들려주세요.</p></header>

            <section className="survey-section" aria-labelledby="rating-title"><h2 id="rating-title">결과에 얼마나 만족하시나요?</h2><div className="rating-options" role="radiogroup" aria-label="결과 만족도"><button type="button" role="radio" aria-checked={surveyRating === 5} className={surveyRating === 5 ? 'rating-choice like selected' : 'rating-choice like'} onClick={() => setSurveyRating(5)}><ThumbsUp aria-hidden="true" size={34} strokeWidth={1.7} fill={surveyRating === 5 ? 'currentColor' : 'none'} /><span>좋아요</span></button><button type="button" role="radio" aria-checked={surveyRating === 1} className={surveyRating === 1 ? 'rating-choice dislike selected' : 'rating-choice dislike'} onClick={() => setSurveyRating(1)}><ThumbsDown aria-hidden="true" size={34} strokeWidth={1.7} fill={surveyRating === 1 ? 'currentColor' : 'none'} /><span>싫어요</span></button></div></section>

            <section className="survey-section" aria-labelledby="improvement-title"><h2 id="improvement-title">어떤 부분이 더 좋아졌으면 하나요?</h2><p className="survey-helper">개선이 필요하다고 느낀 항목을 모두 선택해주세요.</p><div className="improvement-grid">{surveyImprovementOptions.map((item) => { const selected = surveyImprovements.includes(item); return <button key={item} type="button" className={selected ? 'improvement-option selected' : 'improvement-option'} aria-pressed={selected} onClick={() => toggleSurveyImprovement(item)}>{item}</button> })}</div></section>

            <section className="survey-section" aria-labelledby="comment-title"><h2 id="comment-title">추가 의견</h2><textarea value={surveyComment} onChange={(event) => setSurveyComment(event.target.value)} placeholder="어렵거나 이해되지 않았던 부분을 자유롭게 작성해주세요." maxLength={500} /><div className="survey-character-count">{surveyComment.length} / 500</div></section>

            {projectError && <p className="project-error" role="alert">{projectError}</p>}
            <button className="survey-submit gradient-button" type="submit" disabled={surveyRating === 0}>의견 보내기 <ChevronRight aria-hidden="true" size={22} strokeWidth={1.8} /></button>
          </form>
        )}
      </main>
    )
  }

  const renderCreditModal = () => (
    <div ref={activeModalRef} className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreditModal(null) }}>
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
    <div ref={activeModalRef} className="modal-backdrop" role="presentation">
      <section className="credit-modal survey-modal" role="dialog" aria-modal="true" aria-labelledby="credit-survey-title">
        <button className="modal-close" type="button" aria-label="설문 닫기" onClick={() => setCreditModal(null)}><X aria-hidden="true" size={22} strokeWidth={1.8} /></button>
        <div className="survey-modal-heading"><MessageSquare aria-hidden="true" size={24} strokeWidth={1.8} /><div><h2 id="credit-survey-title">잠깐만 의견을 들려주세요</h2><p>설문에 참여하시면 크레딧 1개를 드려요.</p></div></div>
        <form onSubmit={submitCreditSurvey}>
          <div className="modal-survey-block"><h3>결과에 얼마나 만족하시나요?</h3><div className="modal-rating-options" role="radiogroup" aria-label="결과 만족도"><button type="button" role="radio" aria-checked={surveyRating === 5} className={surveyRating === 5 ? 'modal-rating-choice like selected' : 'modal-rating-choice like'} onClick={() => setSurveyRating(5)}><ThumbsUp aria-hidden="true" size={24} strokeWidth={1.8} fill={surveyRating === 5 ? 'currentColor' : 'none'} /><span>좋아요</span></button><button type="button" role="radio" aria-checked={surveyRating === 1} className={surveyRating === 1 ? 'modal-rating-choice dislike selected' : 'modal-rating-choice dislike'} onClick={() => setSurveyRating(1)}><ThumbsDown aria-hidden="true" size={24} strokeWidth={1.8} fill={surveyRating === 1 ? 'currentColor' : 'none'} /><span>싫어요</span></button></div></div>
          <div className="modal-survey-block"><h3>어떤 부분이 더 좋아졌으면 하나요?</h3><div className="modal-improvement-grid">{surveyImprovementOptions.map((item) => { const selected = surveyImprovements.includes(item); return <button key={item} type="button" className={selected ? 'modal-improvement-option selected' : 'modal-improvement-option'} aria-pressed={selected} onClick={() => toggleSurveyImprovement(item)}>{item}</button> })}</div></div>
          <div className="modal-survey-block"><h3>추가 의견</h3><textarea value={surveyComment} onChange={(event) => setSurveyComment(event.target.value)} placeholder="어렵거나 이해되지 않았던 부분을 자유롭게 작성해주세요." maxLength={500} /></div>
          <button className="gradient-button modal-submit" type="submit">의견 보내고 크레딧 받기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
        </form>
      </section>
    </div>
  )

  const closeBusinessCardModal = () => {
    setBusinessCardModalOpen(false)
    setBusinessCardTarget(null)
    setBusinessCardInfoErrors({})
  }

  const updateBusinessCardInfo = (field: keyof BusinessCardInfoInput, value: string) => {
    setBusinessCardInfo((current) => ({ ...current, [field]: value }))
    if (field === 'name' || field === 'email') {
      setBusinessCardInfoErrors((current) => ({ ...current, [field]: undefined }))
    }
  }

  const renderBusinessCardModal = () => (
    <div
      ref={activeModalRef}
      className="modal-backdrop business-card-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) closeBusinessCardModal() }}
      onKeyDown={(event) => { if (event.key === 'Escape') closeBusinessCardModal() }}
    >
      <section className="credit-modal business-card-modal" role="dialog" aria-modal="true" aria-labelledby="business-card-modal-title" aria-describedby="business-card-modal-description">
        <button className="modal-close" type="button" aria-label="명함 정보 입력 닫기" onClick={closeBusinessCardModal}><X aria-hidden="true" size={22} strokeWidth={1.8} /></button>
        <header className="business-card-modal-intro">
          <div className="business-card-modal-icon" aria-hidden="true"><CreditCard size={30} strokeWidth={1.7} /></div>
          <div>
            <h2 id="business-card-modal-title">명함에 들어갈 정보를 알려주세요</h2>
            <p id="business-card-modal-description">입력한 정보는 이번 명함 결과에 연결해 저장합니다.</p>
          </div>
        </header>
        <form className="business-card-form" noValidate onSubmit={submitBusinessCardInfo}>
          <div className="business-card-form-grid">
            <label className="business-card-field">
              <span>이름 <em>필수</em></span>
              <input
                autoFocus
                required
                maxLength={40}
                autoComplete="name"
                value={businessCardInfo.name}
                aria-invalid={Boolean(businessCardInfoErrors.name)}
                aria-describedby={businessCardInfoErrors.name ? 'business-card-name-error' : undefined}
                onChange={(event) => updateBusinessCardInfo('name', event.target.value)}
                placeholder="김명은"
              />
              {businessCardInfoErrors.name && <small id="business-card-name-error" className="business-card-field-error" role="alert">{businessCardInfoErrors.name}</small>}
            </label>
            <label className="business-card-field">
              <span>직책</span>
              <input maxLength={40} autoComplete="organization-title" value={businessCardInfo.title ?? ''} onChange={(event) => updateBusinessCardInfo('title', event.target.value)} placeholder="대표 / 디자이너" />
            </label>
            <label className="business-card-field business-card-field-wide">
              <span>회사명</span>
              <input maxLength={60} autoComplete="organization" value={businessCardInfo.company ?? ''} onChange={(event) => updateBusinessCardInfo('company', event.target.value)} placeholder="회사 또는 브랜드 이름" />
            </label>
            <label className="business-card-field">
              <span>전화번호</span>
              <input type="tel" maxLength={40} autoComplete="tel" value={businessCardInfo.phone ?? ''} onChange={(event) => updateBusinessCardInfo('phone', event.target.value)} placeholder="010-1234-5678" />
            </label>
            <label className="business-card-field">
              <span>이메일</span>
              <input
                type="email"
                maxLength={80}
                autoComplete="email"
                value={businessCardInfo.email ?? ''}
                aria-invalid={Boolean(businessCardInfoErrors.email)}
                aria-describedby={businessCardInfoErrors.email ? 'business-card-email-error' : undefined}
                onChange={(event) => updateBusinessCardInfo('email', event.target.value)}
                placeholder="hello@example.com"
              />
              {businessCardInfoErrors.email && <small id="business-card-email-error" className="business-card-field-error" role="alert">{businessCardInfoErrors.email}</small>}
            </label>
            <label className="business-card-field business-card-field-wide">
              <span>주소</span>
              <input maxLength={120} autoComplete="street-address" value={businessCardInfo.address ?? ''} onChange={(event) => updateBusinessCardInfo('address', event.target.value)} placeholder="명함에 표시할 주소" />
            </label>
          </div>
          <p className="business-card-form-note"><Info aria-hidden="true" size={16} strokeWidth={1.9} /> 비워 둔 선택 정보는 명함에 표시되지 않아요.</p>
          <div className="business-card-form-actions">
            <button className="modal-secondary-button" type="button" onClick={closeBusinessCardModal}>취소</button>
            <button className="gradient-button" type="submit">이 정보로 명함 만들기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.9} /></button>
          </div>
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
          <img className="login-stamp-art" src="/login-hero-bubbles-wide.png" alt="빛나는 거품과 잎사귀를 담은 브랜드 이미지" />
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
        <button className="skip-login" type="button" onClick={() => setMode(loginReturnMode)}>나중에 할게요 <span aria-hidden="true">›</span></button>
      </section>
    </main>
  )

  return (
    <div className="app-shell light-shell">
      {loggingOut && <div className="page-transition-overlay" aria-hidden="true" />}
      {mode === 'login' ? (
        <header className="login-header">
          <button className="login-back" type="button" onClick={() => setMode(loginReturnMode)}>‹ <span>{loginReturnMode === 'hero' ? '랜딩' : '홈'}</span></button>
        </header>
      ) : mode === 'onboarding' || mode === 'industry' || mode === 'brand-details' || mode === 'company-details' || mode === 'hero' || mode === 'choice' || mode === 'tone' || mode === 'style' || mode === 'final' || mode === 'loading' || mode === 'trademark-loading' || mode === 'trademark-selection' || mode === 'trademark-result' || mode === 'result' || mode === 'brand-kit' || mode === 'edit' || mode === 'mypage' || mode === 'survey' ? null : (
        <header className="main-header">
          <a className="main-brand" href="#home" aria-label="GenMark AI 홈" onClick={() => setMode('home')}>
            <BrandLogo />
            <span>GenMark AI</span>
          </a>
          <button className="outline-login" type="button" disabled={authRestoring} onClick={() => {
            if (loggedIn) { void handleLogout(); return }
            setLoginDestination('home')
            setMode('login')
          }}>
            <span key={authRestoring ? 'checking' : loggedIn ? 'logout' : 'login'} className="outline-login-label">
              {authRestoring ? '확인 중…' : loggedIn ? '로그아웃' : '로그인'}
            </span>
          </button>
        </header>
      )}

      {mode === 'login' ? renderLoginScreen() : mode === 'onboarding' ? renderOnboardingScreen() : mode === 'industry' ? renderIndustrySelectionScreen() : mode === 'brand-details' ? renderBrandDetailsScreen() : mode === 'company-details' ? renderCompanyDetailsScreen() : mode === 'choice' ? renderChoiceScreen() : mode === 'tone' ? renderToneSelectionScreen() : mode === 'style' ? renderStyleSelectionScreen() : mode === 'final' ? renderFinalRequestScreen() : mode === 'loading' ? renderLoadingScreen() : mode === 'trademark-loading' ? renderTrademarkLoadingScreen() : mode === 'trademark-selection' ? renderTrademarkSelectionScreen() : mode === 'trademark-result' ? renderTrademarkResultScreenRedesign() : mode === 'result' ? renderLogoResultScreen() : mode === 'brand-kit' ? renderBrandKitSelectionScreen() : mode === 'edit' ? renderLogoEditScreen() : mode === 'mypage' ? renderMypageScreen() : mode === 'survey' ? renderSurveyScreen() : mode === 'hero' ? (
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
              onScroll={handleGalleryScroll}
            >
              {filteredItems.map((item) => {
                const liked = likedIds.includes(item.id)
                return (
                  <article className="gallery-card" key={item.id}>
                    <div className={`gallery-visual ${item.tone}`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position }}>
                      <button type="button" className={liked ? 'favorite-button liked' : 'favorite-button'} aria-label={`${item.name} 좋아요 ${liked ? '취소' : '추가'}`} onClick={() => toggleLike(item.id)}>
                        <Heart aria-hidden="true" size={22} strokeWidth={1.8} fill={liked ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="gallery-dots" aria-hidden="true">
              {Array.from({ length: Math.max(1, Math.ceil(filteredItems.length / 4)) }).map((_, index) => (
                <span key={index} className={index === curationActiveDot ? 'active' : undefined} />
              ))}
            </div>
          </section>

          <section className="curation-section product-gallery-section" aria-labelledby="product-gallery-title">
            <div className="section-heading">
              <h2 id="product-gallery-title">제품 썸네일 갤러리</h2>
              <div className="gallery-controls">
                <button type="button" aria-label="이전 제품 보기" onClick={() => scrollProductGallery(-340)}><ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} /></button>
                <button type="button" aria-label="다음 제품 보기" onClick={() => scrollProductGallery(340)}><ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} /></button>
              </div>
            </div>
            <div
              className="gallery-track"
              ref={productGalleryRef}
              onPointerDown={handleProductGalleryPointerDown}
              onPointerMove={handleProductGalleryPointerMove}
              onPointerUp={handleProductGalleryPointerUp}
              onPointerCancel={handleProductGalleryPointerUp}
              onScroll={handleProductGalleryScroll}
            >
              {productGalleryItems.map((item) => {
                return (
                  <article className="gallery-card" key={item.id}>
                    <div className={`gallery-visual product-gallery-visual ${item.tone}`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position }} />
                  </article>
                )
              })}
            </div>
            <div className="gallery-dots" aria-hidden="true">
              {Array.from({ length: Math.max(1, Math.ceil(productGalleryItems.length / 4)) }).map((_, index) => (
                <span key={index} className={index === productActiveDot ? 'active' : undefined} />
              ))}
            </div>
          </section>

          <section className="curation-section business-card-gallery-section" aria-labelledby="business-card-gallery-title">
            <div className="section-heading">
              <h2 id="business-card-gallery-title">명함 갤러리</h2>
              <div className="gallery-controls">
                <button type="button" aria-label="이전 명함 보기" onClick={() => scrollBusinessCardGallery(-340)}><ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} /></button>
                <button type="button" aria-label="다음 명함 보기" onClick={() => scrollBusinessCardGallery(340)}><ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} /></button>
              </div>
            </div>
            <div
              className="gallery-track"
              ref={businessCardGalleryRef}
              onPointerDown={handleBusinessCardGalleryPointerDown}
              onPointerMove={handleBusinessCardGalleryPointerMove}
              onPointerUp={handleBusinessCardGalleryPointerUp}
              onPointerCancel={handleBusinessCardGalleryPointerUp}
              onScroll={handleBusinessCardGalleryScroll}
            >
              {businessCardGalleryItems.map((item) => {
                return (
                  <article className="gallery-card" key={item.id}>
                    <div className={`gallery-visual business-card-gallery-visual ${item.tone}`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position }} />
                  </article>
                )
              })}
            </div>
            <div className="gallery-dots" aria-hidden="true">
              {Array.from({ length: Math.max(1, Math.ceil(businessCardGalleryItems.length / 4)) }).map((_, index) => (
                <span key={index} className={index === businessCardActiveDot ? 'active' : undefined} />
              ))}
            </div>
          </section>
        </main>
      ) : null}

      {!['loading', 'trademark-loading', 'hero', 'login'].includes(mode) && <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={mode === 'home' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setMode('home')}>
          <House className="nav-icon" aria-hidden="true" size={26} strokeWidth={1.8} /><span>홈</span>
        </button>
        <button className="nav-item nav-item-create" type="button" onClick={startOnboarding} disabled={authRestoring}>
          <Sparkles className="nav-icon" aria-hidden="true" size={26} strokeWidth={1.8} /><span>로고 생성</span>
        </button>
        <button className={mode === 'mypage' || mode === 'survey' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setMode('mypage')}>
          <UserRound className="nav-icon" aria-hidden="true" size={26} strokeWidth={1.8} /><span>마이페이지</span>
        </button>
      </nav>}

      {creditModal === 'credit' ? renderCreditModal() : creditModal === 'survey' ? renderCreditSurveyModal() : null}
      {businessCardModalOpen && renderBusinessCardModal()}
      {resumePromptProject && renderResumePromptModal()}
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
