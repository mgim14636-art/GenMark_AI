import { CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent, lazy, MouseEvent as ReactMouseEvent, PointerEvent, Suspense, useEffect, useRef, useState } from 'react'
import { AlarmClock, ArrowLeft, ArrowRight, BarChart3, Building2, Check, CircleCheck, CircleHelp, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, CloudCheck, Compass, CreditCard, Download, Droplets, FileCheck2, Flower2, FolderCheck, Gem, Gift, Heart, House, Image as ImageIcon, Info, Laptop, Leaf, MessageCircle, MessageSquare, Palette, Pencil, PenLine, Plus, RefreshCw, Search, Shapes, ShieldCheck, Shirt, Sparkles, ThumbsDown, ThumbsUp, Trash2, Type as TypeIcon, UserRound, UsersRound, Utensils, Video, X, Clock3, type LucideIcon } from 'lucide-react'
import CopperplateHatch from './components/ui/CopperplateHatch'
import AnimatedGallery from './components/ui/AnimatedGallery'
import GenMarkLogo from './components/ui/GenMarkLogo'
import { AiLoader } from './components/ui/ai-loader'
import { apiBlobRequest, AuthError, type AuthProvider, type AuthUser, downloadAuthenticatedFile, loginWithProvider, logout, restoreSession } from './auth'
import { ciProjectsApi, getLogoCandidateImageUrl, meApi, onboardingApi, projectsApi, type BrandKit, type BusinessCardInfoInput, type DownloadRecord, type LogoCandidate, type PinnedLogo, type SurveyImprovement, type SurveySubmitInput, type TrademarkMatch, waitForLogoGeneration, waitForTrademarkAnalysis, type ProjectInput } from './lib/genmarkApi'
import { buildEditedSvg, prepareEditableSvg } from './lib/svgEditor'

const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

const TRADEMARK_SCORE_FALLBACK = 23

// 화면 설계서용 임시 목업 모드입니다. 실제 로그인 사용자와 API 데이터에는 영향을 주지 않으며,
// 원래의 비로그인 빈 상태로 되돌릴 때는 false로 바꾸면 됩니다.
const MYPAGE_MOCK_MODE = import.meta.env.DEV

const getLocalDateKey = (value: Date | string = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value.slice(0, 10) : ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type ViewMode = 'home' | 'hero' | 'logo-intro' | 'onboarding' | 'industry' | 'brand-details' | 'company-details' | 'choice' | 'tone' | 'style' | 'final' | 'loading' | 'trademark-loading' | 'trademark-selection' | 'trademark-result' | 'result' | 'brand-kit' | 'edit' | 'login' | 'mypage' | 'survey'
type LoginDestination = 'home' | 'industry' | 'choice' | 'mypage'
type LoginReturnMode = 'hero' | 'home'
type OnboardingOption = 'online' | 'social' | 'offline'
type AudienceOption = 'company' | 'owner' | 'hobby' | 'sidejob'
type IndustryOption = 'beauty' | 'fashion' | 'food' | 'health' | 'tech' | 'other'
type CoreValue = 'vegan' | 'lowIrritation' | 'derma' | 'cleanBeauty' | 'natural' | 'premium' | 'sustainable' | 'scientific'
type ToneOption = 'friendly' | 'professional' | 'warm' | 'trendy' | 'minimal'
type RgbColor = { r: number; g: number; b: number }
type LogoStyle = 'symbol' | 'wordmark' | 'combination' | 'lettermark'
type TrademarkMatchImage = { rank: number; src: string }
type FinalEditKind = 'identity' | 'values' | 'tone' | 'color' | 'style' | 'shape'
type FinalToneMode = 'recommended' | 'direct'
type EditorTarget = string
type MypageAssetKind = 'logo' | 'business-card' | 'thumbnail'
type MypageAssetResource = 'downloads' | 'pins' | 'hidden' | 'brandKits' | 'candidates'
type MypageAssetItem = {
  id: string
  kind: MypageAssetKind
  title: string
  subtitle: string
  imageUrl: string
  imageUrls?: string[]
  brandKit?: BrandKit
  downloadId?: number
  projectId?: string
  candidateId?: string
  projectType?: 'CI' | 'BI'
  dateKey: string
}
type MypageAssetGroup = {
  dateKey: string
  label: string
  isToday?: boolean
  items: MypageAssetItem[]
}

const mypageAssetResourceLabels: Array<{ id: MypageAssetResource; label: string }> = [
  { id: 'downloads', label: '다운로드 목록' },
  { id: 'pins', label: '찜 목록' },
  { id: 'hidden', label: '삭제 목록' },
  { id: 'brandKits', label: '브랜드 키트' },
  { id: 'candidates', label: '생성 로고' },
]
type EditorDraft = {
  scale: number
  rotation: number
  opacity: number
  offsetX: number
  offsetY: number
  color: string
  colorChanged: boolean
  dirty: boolean
}
type EditorDrafts = Record<string, EditorDraft>
type EditorDragState = {
  pointerId: number
  target: string
  startClientX: number
  startClientY: number
  startSvgX: number
  startSvgY: number
  startOffsetX: number
  startOffsetY: number
}

const createEditorDraft = (color = '#7B5CDF'): EditorDraft => ({
  scale: 100,
  rotation: 0,
  opacity: 100,
  offsetX: 0,
  offsetY: 0,
  color,
  colorChanged: false,
  dirty: false,
})

const createEditorDrafts = (color = '#7B5CDF'): EditorDrafts => ({})

const EDITOR_TEST_MODE = true
const EDITOR_TEST_SVG_URL = '/genmark_logo.svg'

const uniqueColors = (colors: string[]) => Array.from(new Map(
  colors.filter(Boolean).map((color) => [color.trim().toLowerCase(), color.trim()]),
).values()).slice(0, 4)

const formatBusinessPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  if (/^1\d{3}/.test(digits)) {
    if (digits.length <= 4) return digits
    return `${digits.slice(0, 4)}-${digits.slice(4)}`
  }
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`
  }
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`
}

const categories = ['전체', '심볼마크', '워드마크', '콤비네이션', '레터마크']

const toneOptions: Array<{ id: ToneOption; label: string; description: string; colors: [string] }> = [
  { id: 'friendly', label: '친근하고 다정한', description: '편안하고 부드러운 인상', colors: ['#f39bbd'] },
  { id: 'professional', label: '전문적이고 신뢰감 있는', description: '정돈되고 믿음직한 인상', colors: ['#17185b'] },
  { id: 'warm', label: '감성적이고 따뜻한', description: '섬세하고 따뜻한 인상', colors: ['#d29474'] },
  { id: 'trendy', label: '유니크하고 트렌디한', description: '개성 있고 감각적인 인상', colors: ['#171713'] },
  { id: 'minimal', label: '미니멀하고 직관적인', description: '군더더기 없이 명확한 인상', colors: ['#396fc8'] },
]

const DEFAULT_MANUAL_COLOR = '#9765e9'

const coreValueIds = new Set<CoreValue>(['vegan', 'lowIrritation', 'derma', 'cleanBeauty', 'natural', 'premium', 'sustainable', 'scientific'])
const coreValueLabels: Record<CoreValue, string> = {
  vegan: '비건',
  lowIrritation: '저자극',
  derma: '더마',
  cleanBeauty: '클린뷰티',
  natural: '자연주의',
  premium: '프리미엄',
  sustainable: '지속가능성',
  scientific: '과학적 검증',
}

const industryOptions: Array<{ id: IndustryOption; title: string; description: string; apiValue: string; icon: LucideIcon }> = [
  { id: 'beauty', title: '뷰티', description: '스킨케어 · 메이크업 · 향수', apiValue: 'COSMETICS', icon: Sparkles },
  { id: 'fashion', title: '패션', description: '의류 · 액세서리 · 슈즈', apiValue: 'FASHION', icon: Shirt },
  { id: 'food', title: '푸드 · 카페', description: '카페 · 베이커리 · 식품', apiValue: 'FOOD', icon: Utensils },
  { id: 'health', title: '헬스 · 웰니스', description: '피트니스 · 건강 · 요가', apiValue: 'HEALTH_WELLNESS', icon: Heart },
  { id: 'tech', title: '테크', description: 'IT · 앱 · 소프트웨어', apiValue: 'TECH', icon: Laptop },
  { id: 'other', title: '기타', description: '그 외 업종', apiValue: 'OTHER', icon: Shapes },
]

const logoStyleOptions: Array<{ id: LogoStyle; label: string; description: string; fit: string; recommended?: boolean }> = [
  // 추천 항목을 맨 위에 둔다. 안내 문구 없이 순서와 배지만으로 알 수 있게.
  { id: 'combination', label: '콤비네이션', description: '그림과 브랜드 이름을 함께 사용하는 로고', fit: '그림과 이름을 함께 보여주어 브랜드를 쉽게 기억하게 해요.', recommended: true },
  { id: 'symbol', label: '심볼마크', description: '그림이나 도형만으로 브랜드를 표현하는 로고', fit: '브랜드를 상징하는 이미지를 직관적으로 보여주어 기억에 오래 남아요.' },
  { id: 'wordmark', label: '워드마크', description: '브랜드 이름의 글씨체를 중심으로 만든 로고', fit: '브랜드 이름을 직관적으로 보여주어 기억에 오래 남아요.' },
  { id: 'lettermark', label: '레터마크', description: '브랜드 이름의 첫 글자나 이니셜을 활용한 로고', fit: '긴 이름을 간결하게 담아 세련된 인상을 남겨요.' },
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

const featuredHeroSlides = [
  { id: 'deer', src: '/home/deer-green.svg', alt: '초록색 사슴 로고 이미지' },
  { id: 'bone', src: '/home/bone-navy.svg', alt: '개뼈다귀 로고 이미지' },
  { id: 'dokdo', src: '/home/dokdo.svg', alt: '독도 로고 이미지' },
  { id: 'musclegym', src: '/home/musclegym.svg', alt: '머슬짐 로고 이미지' },
  { id: 'soomin', src: '/home/soomin.svg', alt: '수민 로고 이미지' },
  { id: 'hip', src: '/home/hip-logo.svg', alt: '힙 로고 이미지' },
]

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

const businessCardGalleryItems = [
  { id: 'nevia-card', name: 'NEVIA', category: '명함', meta: '미니멀 · 내추럴', likes: '1.8k', image: '/business-card-gallery/nevia.png', position: '50% 50%', tone: 'nevia' },
  { id: 'morvan-card', name: 'MORVAN', category: '명함', meta: '브라운 · 내추럴', likes: '1.5k', image: '/business-card-gallery/morvan.png', position: '50% 50%', tone: 'morvan' },
  { id: 'eloris-card', name: 'ELORIS', category: '명함', meta: '라벤더 · 감성', likes: '1.3k', image: '/business-card-gallery/eloris.png', position: '50% 50%', tone: 'eloris' },
  { id: 'vitara-card', name: 'VITARA', category: '명함', meta: '골드 · 내추럴', likes: '1.1k', image: '/business-card-gallery/vitara.png', position: '50% 50%', tone: 'vitara' },
  { id: 'aurion-card', name: 'AURION', category: '명함', meta: '네이비 · 프리미엄', likes: '980', image: '/business-card-gallery/aurion.png', position: '50% 50%', tone: 'aurion' },
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
  { id: 'preview-candidate-1', projectId: 'preview-project', projectType: 'CI', order: 1, storageKey: 'preview-candidate-1', svgUrl: null, svgEdited: false, mimeType: 'image/svg+xml', width: 760, height: 760, selected: true, pinnedAt: null, createdAt: '' },
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
  const previewRef = useRef<HTMLSpanElement>(null)
  const huePreviewRef = useRef<HTMLSpanElement>(null)
  const colorRef = useRef<RgbColor>(value)
  const hsvRef = useRef(hsv)
  const pendingColorRef = useRef<RgbColor | null>(null)
  const frameRef = useRef<number | null>(null)

  colorRef.current = value
  hsvRef.current = hsv

  const applyPreview = (color: RgbColor) => {
    const nextHsv = rgbToHsv(color)
    const hex = rgbToHex(color)
    colorRef.current = color
    hsvRef.current = nextHsv
    if (previewRef.current) {
      previewRef.current.style.setProperty('--tone-x', `${nextHsv.h / 3.6}%`)
      previewRef.current.style.setProperty('--tone-y', `${(1 - nextHsv.v) * 100}%`)
      previewRef.current.style.background = hex
    }
    if (huePreviewRef.current) huePreviewRef.current.style.left = `${nextHsv.h / 3.6}%`
  }

  useEffect(() => {
    applyPreview(value)
  }, [value])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  const flushPendingColor = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const pendingColor = pendingColorRef.current
    pendingColorRef.current = null
    if (pendingColor) onChange(pendingColor)
  }

  const queueColorChange = (color: RgbColor) => {
    applyPreview(color)
    pendingColorRef.current = color
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const nextColor = pendingColorRef.current
      pendingColorRef.current = null
      if (nextColor) onChange(nextColor)
    })
  }

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    queueColorChange(hsvToRgb((x / rect.width) * 360, 1, 1 - y / rect.height))
  }

  const updateHueFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
    const currentHsv = hsvRef.current
    queueColorChange(hsvToRgb((x / rect.width) * 360, currentHsv.s || 1, currentHsv.v))
  }

  const updateChannel = (channel: keyof RgbColor, nextValue: string) => {
    const numericValue = nextValue === '' ? 0 : Number(nextValue)
    const nextColor = { ...colorRef.current, [channel]: clampColorChannel(Number.isFinite(numericValue) ? numericValue : 0) }
    pendingColorRef.current = null
    applyPreview(nextColor)
    onChange(nextColor)
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
        onPointerUp={flushPendingColor}
        onPointerCancel={flushPendingColor}
      >
        <span ref={previewRef} className="tone-color-palette-preview" style={{ '--tone-x': `${hsv.h / 3.6}%`, '--tone-y': `${(1 - hsv.v) * 100}%`, background: rgbToHex(value) } as CSSProperties} />
      </div>
      <div className="tone-palette-actions">
        <button className={advancedOpen ? 'tone-native-picker-button active' : 'tone-native-picker-button'} type="button" onClick={() => setAdvancedOpen((current) => !current)}>
          <span className="tone-native-picker-dot" style={{ background: rgbToHex(value) }} aria-hidden="true" />
          <span>색상 세부 조정</span>
        </button>
        <button className="tone-native-picker-done" type="button" onClick={() => { flushPendingColor(); onComplete() }}>선택 완료</button>
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
            <span ref={huePreviewRef} style={{ left: `${hsv.h / 3.6}%` }} />
          </div>
          <div className="tone-advanced-rgb-fields">
            {(['r', 'g', 'b'] as const).map((channel) => (
              <label key={channel}><span>{channel.toUpperCase()}</span><input type="number" min="0" max="255" value={Math.round(value[channel])} onChange={(event) => updateChannel(channel, event.target.value)} /></label>
            ))}
          </div>
          <button className="tone-advanced-complete" type="button" onClick={() => { flushPendingColor(); setAdvancedOpen(false) }}>선택 완료</button>
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
  const [logoIntroStage, setLogoIntroStage] = useState<'opening' | 'ready'>('opening')
  const [featuredHeroIndex, setFeaturedHeroIndex] = useState(0)
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
  const [openMypageAssetDate, setOpenMypageAssetDate] = useState('2026-08-18')
  const [coreValues, setCoreValues] = useState<CoreValue[]>([])
  const [coreValueInputMode, setCoreValueInputMode] = useState<'category' | 'direct'>('category')
  const [brandValueDescription, setBrandValueDescription] = useState('')
  const [toneSelection, setToneSelection] = useState<ToneOption | null>(null)
  const [toneMode, setToneMode] = useState<'recommended' | 'direct'>('recommended')
  const [directTone, setDirectTone] = useState('')
  const [tonePaletteTarget, setTonePaletteTarget] = useState<{ toneId: ToneOption; slot: number } | null>(null)
  const [tonePaletteDraft, setTonePaletteDraft] = useState<{ toneId: ToneOption; colors: string[] } | null>(null)
  const [customToneColors, setCustomToneColors] = useState<Partial<Record<ToneOption, string[]>>>({})
  const [manualColors, setManualColors] = useState<string[]>([DEFAULT_MANUAL_COLOR])
  const [manualColorSlot, setManualColorSlot] = useState(0)
  const [colorSelectionMode, setColorSelectionMode] = useState<'tone' | 'manual'>('tone')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [logoStyle, setLogoStyle] = useState<LogoStyle | null>(null)
  const [logoShapePrompt, setLogoShapePrompt] = useState('')
  const [logoShapeAccordionOpen, setLogoShapeAccordionOpen] = useState(false)
  const [resultCandidate, setResultCandidate] = useState(0)
  const [trademarkAnalysisSkipped, setTrademarkAnalysisSkipped] = useState(false)
  const [trademarkAnalysisRequested, setTrademarkAnalysisRequested] = useState(false)
  const [editorTestMode, setEditorTestMode] = useState(() => getModeFromUrl() === 'edit')
  const [editTarget, setEditTarget] = useState<EditorTarget | null>(null)
  const [editorScale, setEditorScale] = useState(100)
  const [editorRotation, setEditorRotation] = useState(0)
  const [editorOpacity, setEditorOpacity] = useState(100)
  const [editorOffsetX, setEditorOffsetX] = useState(0)
  const [editorOffsetY, setEditorOffsetY] = useState(0)
  const [editorColor, setEditorColor] = useState('#7B5CDF')
  const [editorColorPickerOpen, setEditorColorPickerOpen] = useState(false)
  const [editorColorChanged, setEditorColorChanged] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [editorSaved, setEditorSaved] = useState(false)
  const [editorSvgSource, setEditorSvgSource] = useState<string | null>(null)
  const [editorSvgPreviewSource, setEditorSvgPreviewSource] = useState<string | null>(null)
  const [editorSvgPreviewUrl, setEditorSvgPreviewUrl] = useState<string | null>(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [editorDrafts, setEditorDrafts] = useState<EditorDrafts>(() => createEditorDrafts())
  const [trademarkEntry, setTrademarkEntry] = useState<'generation' | 'result'>('generation')
  const [trademarkAnalysisCompleted, setTrademarkAnalysisCompleted] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(() => window.localStorage.getItem('genmark-project-id'))
  const [projectColors, setProjectColors] = useState<string[]>([])
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState('')
  const [generationLoading, setGenerationLoading] = useState(false)
  const [finalGenerationLocked, setFinalGenerationLocked] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [mypageAssetFailures, setMypageAssetFailures] = useState<Set<MypageAssetResource>>(() => new Set())
  const [mypageAssetRefreshVersion, setMypageAssetRefreshVersion] = useState(0)
  const failedMypageAssetLabels = mypageAssetResourceLabels
    .filter((resource) => mypageAssetFailures.has(resource.id))
    .map((resource) => resource.label)
  const mypageAssetError = failedMypageAssetLabels.length > 0
    ? `일부 자산을 불러오지 못했어요: ${failedMypageAssetLabels.join(', ')}. 잠시 후 다시 시도해주세요.`
    : ''
  const [logoCandidates, setLogoCandidates] = useState<LogoCandidate[]>([])
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [downloadHistory, setDownloadHistory] = useState<DownloadRecord[]>([])
  const [pinnedLogos, setPinnedLogos] = useState<PinnedLogo[]>([])
  const [brandKitHistory, setBrandKitHistory] = useState<BrandKit[]>([])
  const [mypageDownloadImageUrls, setMypageDownloadImageUrls] = useState<Record<string, string>>({})
  const [mypageGeneratedLogoCandidates, setMypageGeneratedLogoCandidates] = useState<Record<string, LogoCandidate>>({})
  const [hiddenMypageLogoCandidateIds, setHiddenMypageLogoCandidateIds] = useState<string[]>([])
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [brandKitError, setBrandKitError] = useState('')
  const [brandKitDownloading, setBrandKitDownloading] = useState(false)
  const [brandKitType, setBrandKitType] = useState<BrandKit['kitType'] | null>(null)
  const [brandKitPreview, setBrandKitPreview] = useState<{ imageUrls: string[]; label: string } | null>(null)
  const [mypageLogoAction, setMypageLogoAction] = useState<MypageAssetItem | null>(null)
  const [mypageLogoActionLoading, setMypageLogoActionLoading] = useState(false)
  const [mypageLogoActionError, setMypageLogoActionError] = useState('')
  const [assetDeleteTarget, setAssetDeleteTarget] = useState<MypageAssetItem | null>(null)
  const [assetDeleteLoading, setAssetDeleteLoading] = useState(false)
  const [assetDeleteError, setAssetDeleteError] = useState('')
  const [mockDeletedAssetIds, setMockDeletedAssetIds] = useState<string[]>([])
  const [businessCardModalOpen, setBusinessCardModalOpen] = useState(false)
  const [businessCardInfo, setBusinessCardInfo] = useState<BusinessCardInfoInput>({
    name: '', title: '', company: '', phone: '', email: '', address: '',
  })
  const [businessCardInfoErrors, setBusinessCardInfoErrors] = useState<{ name?: string; email?: string }>({})
  const [businessCardSubmitError, setBusinessCardSubmitError] = useState('')
  const [brandKitCreating, setBrandKitCreating] = useState(false)
  const [businessCardTarget, setBusinessCardTarget] = useState<{ candidateId: string; projectId: string } | null>(null)
  const [ciProfileLoading, setCiProfileLoading] = useState(false)
  const ciProfileLoaded = useRef(false)
  const assetEpochRef = useRef(0)
  const mypageAssetLoadEpochRef = useRef(0)
  const generationLoadingRef = useRef(false)
  const finalGenerationLockRef = useRef(false)
  const finalGenerationFrameRef = useRef<number | null>(null)
  const finalGenerationSecondFrameRef = useRef<number | null>(null)
  const brandKitCreatingRef = useRef(false)
  const brandKitRequestEpochRef = useRef(0)
  const brandKitSelectionOnlyRef = useRef(false)
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
  const [finalEditModal, setFinalEditModal] = useState<FinalEditKind | null>(null)
  const resultHydrationProjectRef = useRef<string | null>(null)
  const [finalEditToneMode, setFinalEditToneMode] = useState<FinalToneMode>('recommended')
  const [finalEditDraft, setFinalEditDraft] = useState({ companyName: '', companyMotto: '', brandName: '', targetAge: '', valuesText: '', tone: '', colors: [] as string[], logoStyle: '' as LogoStyle | '', logoShape: '' })
  const activeModalRef = useRef<HTMLDivElement>(null)
  const editorDragRef = useRef<EditorDragState | null>(null)

  const buildEditorDraftSvg = (source: string, drafts: EditorDrafts) => {
    let edited = source
    for (const [target, draft] of Object.entries(drafts)) {
      if (!draft.dirty) continue
      edited = buildEditedSvg(edited, {
        target,
        color: draft.colorChanged ? draft.color : undefined,
        scale: draft.scale,
        rotation: draft.rotation,
        opacity: draft.opacity,
        offsetX: draft.offsetX,
        offsetY: draft.offsetY,
      })
    }
    return edited
  }

  const updateCurrentEditorDraft = (patch: Partial<EditorDraft>) => {
    if (!editTarget) return
    setEditorDrafts((current) => ({
      ...current,
      [editTarget]: {
        ...(current[editTarget] ?? createEditorDraft(editorColor)),
        ...patch,
        dirty: true,
      },
    }))
  }

  const updateEditorOffsets = (offsetX: number, offsetY: number) => {
    const nextOffsetX = Math.round(Math.max(-700, Math.min(700, offsetX)))
    const nextOffsetY = Math.round(Math.max(-500, Math.min(500, offsetY)))
    setEditorOffsetX(nextOffsetX)
    setEditorOffsetY(nextOffsetY)
    updateCurrentEditorDraft({ offsetX: nextOffsetX, offsetY: nextOffsetY })
    markEditorDirty()
  }

  useEffect(() => {
    if (!creditModal && !businessCardModalOpen && !resumePromptProject && !finalEditModal && !brandKitPreview && !mypageLogoAction && !assetDeleteTarget) return

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
        if (mypageLogoAction) {
          setMypageLogoAction(null)
          setMypageLogoActionError('')
        } else if (brandKitPreview) {
          setBrandKitPreview(null)
        } else if (businessCardModalOpen) {
          if (!brandKitCreating) {
            setBusinessCardModalOpen(false)
            setBusinessCardTarget(null)
            setBusinessCardInfoErrors({})
            setBusinessCardSubmitError('')
          }
        } else if (finalEditModal) {
          setFinalEditModal(null)
        } else if (assetDeleteTarget) {
          if (!assetDeleteLoading) {
            setAssetDeleteTarget(null)
            setAssetDeleteError('')
          }
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
  }, [assetDeleteLoading, assetDeleteTarget, brandKitCreating, brandKitPreview, businessCardModalOpen, creditModal, finalEditModal, mypageLogoAction, resumePromptProject])

  useEffect(() => {
    const handleBackgroundWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || document.body.style.overflow === 'hidden' || event.deltaY === 0) return
      const shell = document.querySelector<HTMLElement>('.app-shell')
      const target = event.target
      if (!shell || (target instanceof Node && shell.contains(target))) return

      const main = shell.querySelector<HTMLElement>(':scope > main')
      if (!main || main.scrollHeight <= main.clientHeight) return

      const maxScrollTop = main.scrollHeight - main.clientHeight
      const nextScrollTop = Math.min(maxScrollTop, Math.max(0, main.scrollTop + event.deltaY))
      if (nextScrollTop === main.scrollTop) return
      main.scrollTop = nextScrollTop
      event.preventDefault()
    }

    window.addEventListener('wheel', handleBackgroundWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleBackgroundWheel)
  }, [mode])

  const [choiceInfoModal, setChoiceInfoModal] = useState<'ci' | 'bi' | null>(null)
  const [pendingDownload, setPendingDownload] = useState<{ name: string; subtitle: string; candidateId?: string; storageKey?: string; svgUrl?: string | null } | null>(null)
  const editorCandidate = logoCandidates[resultCandidate] ?? logoCandidates[0]

  useEffect(() => {
    if (mode !== 'edit' && mode !== 'result') return () => undefined
    const candidate = editorCandidate
    let disposed = false

    if (mode === 'edit') {
      const baseColor = projectColors[0] ?? '#7B5CDF'
      setEditorSaved(false)
      setEditorDirty(false)
      setEditorColorChanged(false)
      setEditorColorPickerOpen(false)
      setEditorColor(baseColor)
      setEditorScale(100)
      setEditorRotation(0)
      setEditorOpacity(100)
      setEditorOffsetX(0)
      setEditorOffsetY(0)
      setEditTarget(null)
      setEditorDrafts(createEditorDrafts(baseColor))
    }
    setEditorError('')
    setEditorSvgSource(null)
    setEditorSvgPreviewSource(null)
    if (mode === 'edit' && EDITOR_TEST_MODE && editorTestMode) {
      setEditorLoading(true)
      void fetch(EDITOR_TEST_SVG_URL)
        .then((response) => {
          if (!response.ok) throw new Error('테스트용 SVG를 불러오지 못했어요.')
          return response.text()
        })
        .then((svg) => {
          if (!disposed) setEditorSvgSource(svg)
        })
        .catch((error) => {
          if (!disposed) setEditorError(error instanceof Error ? error.message : '테스트용 SVG를 불러오지 못했어요.')
        })
        .finally(() => {
          if (!disposed) setEditorLoading(false)
        })
      return () => { disposed = true }
    }
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
  }, [editorCandidate?.id, editorCandidate?.svgUrl, editorTestMode, mode])

  useEffect(() => {
    if (!editorSvgSource) {
      setEditorSvgPreviewSource(null)
      setEditorSvgPreviewUrl(null)
      return () => undefined
    }

    let objectUrl: string | null = null
    try {
      const edited = editorDirty ? buildEditorDraftSvg(editorSvgSource, editorDrafts) : editorSvgSource
      setEditorSvgPreviewSource(prepareEditableSvg(edited, editTarget))
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
  }, [editorSvgSource, editorDirty, editorDrafts, editTarget])

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
    if (mode !== 'final') return
    finalGenerationLockRef.current = false
    setFinalGenerationLocked(false)
  }, [mode])

  useEffect(() => () => {
    if (finalGenerationFrameRef.current !== null) window.cancelAnimationFrame(finalGenerationFrameRef.current)
    if (finalGenerationSecondFrameRef.current !== null) window.cancelAnimationFrame(finalGenerationSecondFrameRef.current)
  }, [])

  useEffect(() => {
    if (mode !== 'logo-intro') return undefined

    setLogoIntroStage('opening')
    // 문구 3줄이 180ms부터 340ms 간격(180/520/860ms)으로 나오므로,
    // 버튼도 같은 리듬을 이어서 1240ms에 등장하도록 맞춘다.
    // 예전에는 4줄 x 600ms 간격이라 버튼까지 2.7초가 걸려 답답했다.
    const timer = window.setTimeout(() => setLogoIntroStage('ready'), 1240)
    return () => window.clearTimeout(timer)
  }, [mode])

  useEffect(() => {
    if (mode !== 'home') return undefined
    const timer = window.setInterval(() => {
      setFeaturedHeroIndex((index) => (index + 1) % featuredHeroSlides.length)
    }, 5000)
    return () => window.clearInterval(timer)
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
    ])
  }, [loggedIn, mode])

  useEffect(() => {
    if (!loggedIn || mode !== 'brand-kit') return
    let cancelled = false
    void meApi.getBrandKits()
      .then((kits) => {
        if (cancelled) return
        setBrandKitHistory(kits)
        if (mode === 'brand-kit' && brandKitSelectionOnlyRef.current) return
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

  useEffect(() => {
    if (!loggedIn || mode !== 'mypage') {
      mypageAssetLoadEpochRef.current += 1
      setMypageAssetFailures(new Set())
      if (!loggedIn) setMypageGeneratedLogoCandidates({})
      return undefined
    }

    const loadEpoch = ++mypageAssetLoadEpochRef.current
    const isCurrentLoad = () => mypageAssetLoadEpochRef.current === loadEpoch
    const setResourceFailure = (resource: MypageAssetResource, failed: boolean) => {
      if (!isCurrentLoad()) return
      setMypageAssetFailures((current) => {
        const next = new Set(current)
        if (failed) next.add(resource)
        else next.delete(resource)
        return next
      })
    }

    setMypageAssetFailures(new Set())
    void Promise.all([meApi.getDownloads('CI'), meApi.getDownloads('BI')])
      .then(([ciDownloads, biDownloads]) => {
        if (!isCurrentLoad()) return
        setDownloadHistory([...ciDownloads, ...biDownloads].sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt)))
        setResourceFailure('downloads', false)
      })
      .catch(() => setResourceFailure('downloads', true))
    void meApi.getPins()
      .then((pins) => {
        if (!isCurrentLoad()) return
        setPinnedLogos(pins)
        setResourceFailure('pins', false)
      })
      .catch(() => setResourceFailure('pins', true))
    void meApi.getHiddenLogoCandidateIds()
      .then((candidateIds) => {
        if (!isCurrentLoad()) return
        setHiddenMypageLogoCandidateIds(candidateIds)
        setResourceFailure('hidden', false)
      })
      .catch(() => setResourceFailure('hidden', true))
    void meApi.getBrandKits()
      .then((kits) => {
        if (!isCurrentLoad()) return
        setBrandKitHistory(kits)
        setResourceFailure('brandKits', false)
      })
      .catch(() => setResourceFailure('brandKits', true))
    void meApi.getLogoCandidates()
      .then((candidates) => {
        if (!isCurrentLoad()) return
        setMypageGeneratedLogoCandidates(Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate])))
        setResourceFailure('candidates', false)
      })
      .catch(() => setResourceFailure('candidates', true))

    return () => {
      if (mypageAssetLoadEpochRef.current === loadEpoch) mypageAssetLoadEpochRef.current += 1
    }
  }, [loggedIn, mode, mypageAssetRefreshVersion])

  useEffect(() => {
    if (!loggedIn || mode !== 'mypage' || downloadHistory.length === 0) {
      setMypageDownloadImageUrls({})
      return undefined
    }

    let cancelled = false
    const objectUrls: string[] = []
    void Promise.all(downloadHistory.map(async (item) => {
      const itemId = `download-${item.downloadId}`
      try {
        const blob = await downloadAuthenticatedFile(item.imageUrl)
        if (cancelled) return [itemId, ''] as const
        const objectUrl = URL.createObjectURL(blob)
        objectUrls.push(objectUrl)
        return [itemId, objectUrl] as const
      } catch {
        return [itemId, ''] as const
      }
    })).then((entries) => {
      if (cancelled) return
      setMypageDownloadImageUrls(Object.fromEntries(entries.filter(([, imageUrl]) => imageUrl)))
    })

    return () => {
      cancelled = true
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
    }
  }, [downloadHistory, loggedIn, mode])

  useEffect(() => {
    if (mode !== 'mypage') return
    const todayDateKey = getLocalDateKey()
    const assetDates = [
      ...downloadHistory.map((item) => getLocalDateKey(item.downloadedAt)),
      ...brandKitHistory.map((kit) => kit.createdAt ? getLocalDateKey(kit.createdAt) : ''),
      ...Object.values(mypageGeneratedLogoCandidates).map((candidate) => getLocalDateKey(candidate.createdAt)),
    ].filter(Boolean)
    const latestAssetDate = assetDates.sort((left, right) => right.localeCompare(left))[0]
    const preferredOpenDate = assetDates.includes(todayDateKey) ? todayDateKey : latestAssetDate
    if (preferredOpenDate) {
      setOpenMypageAssetDate((current) => current === preferredOpenDate ? current : preferredOpenDate)
    } else if (MYPAGE_MOCK_MODE && !loggedIn) {
      setOpenMypageAssetDate((current) => current === '2026-08-18' ? current : '2026-08-18')
    }
  }, [brandKitHistory, downloadHistory, loggedIn, mode, mypageGeneratedLogoCandidates])

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

  const filteredItems = activeCategory === '전체'
    ? galleryItems
    : galleryItems.filter((item) => item.category === activeCategory)

  const toggleLike = (id: string) => {
    setLikedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const scrollTrackByPage = (track: HTMLDivElement | null, direction: number) => {
    if (!track) return
    const maxScroll = track.scrollWidth - track.clientWidth
    const target = Math.min(maxScroll, Math.max(0, track.scrollLeft + direction * track.clientWidth))
    track.scrollTo({ left: target, behavior: 'smooth' })
  }

  const scrollGallery = (direction: number) => {
    scrollTrackByPage(galleryRef.current, direction)
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

  const scrollProductGallery = (direction: number) => {
    scrollTrackByPage(productGalleryRef.current, direction)
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

  const scrollBusinessCardGallery = (direction: number) => {
    scrollTrackByPage(businessCardGalleryRef.current, direction)
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
      setDirectTone(project.colorMode?.toUpperCase() === 'MANUAL' ? project.tone ?? '' : '')
      if (project.colors?.length) {
        setManualColors(project.colors.slice(0, 1))
        const matchingTone = toneOptions.find((option) => option.colors[0].toLowerCase() === project.colors?.[0]?.toLowerCase())
        if (project.colorMode) {
          const manual = project.colorMode.toUpperCase() === 'MANUAL'
          setColorSelectionMode(manual ? 'manual' : 'tone')
          setToneMode(manual ? 'direct' : 'recommended')
          if (!manual && matchingTone) setToneSelection(matchingTone.id)
        } else {
          setColorSelectionMode(matchingTone ? 'tone' : 'manual')
          setToneMode(matchingTone ? 'recommended' : 'direct')
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
  // 결과 화면을 URL로 바로 열거나 새로고침한 경우에도 서버에 저장된
  // 프로젝트 조건을 먼저 복원해 재생성 전후의 요약 정보가 비어 보이지 않게 한다.
  useEffect(() => {
    if (!loggedIn || mode !== 'result' || !projectId || resultHydrationProjectRef.current === projectId) return

    resultHydrationProjectRef.current = projectId
    void restoreProjectState(projectId).catch(() => {
      if (resultHydrationProjectRef.current === projectId) resultHydrationProjectRef.current = null
    })
  }, [loggedIn, mode, projectId])

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
      if (error instanceof AuthError && error.code === 'LOGIN_CANCELLED') {
        setAuthError('')
        return
      }
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

  const openLogoCreationIntro = () => {
    setMode('logo-intro')
  }

  const startLogoCreationFromIntro = async () => {
    setIndustryBackMode('home')
    if (!loggedIn) {
      setLoginDestination('industry')
      setLoginReturnMode('home')
      setMode('login')
      return
    }
    if (projectId) {
      await presentResumePrompt(projectId, () => setMode('industry'), { skipSilentResume: true })
      return
    }
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
      if (entry === 'result') setMode('result')
      else void startLogoGeneration(false)
      return
    }

    setTrademarkAnalysisSkipped(false)
    setTrademarkAnalysisRequested(false)
    setTrademarkEntry(entry)
    setMode('trademark-selection')
  }

  const queueLogoGenerationFlow = () => {
    if (finalGenerationLockRef.current || generationLoadingRef.current) return
    finalGenerationLockRef.current = true
    setFinalGenerationLocked(true)
    finalGenerationFrameRef.current = window.requestAnimationFrame(() => {
      finalGenerationFrameRef.current = null
      finalGenerationSecondFrameRef.current = window.requestAnimationFrame(() => {
        finalGenerationSecondFrameRef.current = null
        openTrademarkSelection('generation')
      })
    })
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
      return uniqueColors(next)
    })
  }

  const resetManualColors = () => {
    setManualColors([DEFAULT_MANUAL_COLOR])
    setManualColorSlot(0)
  }

  const updateToneColorFromHex = (toneId: ToneOption, slot: number, hex: string) => {
    setTonePaletteDraft((current) => {
      const base = current?.toneId === toneId
        ? current.colors
        : customToneColors[toneId] ?? toneOptions.find((tone) => tone.id === toneId)?.colors ?? ['#eadfff']
      const next = [...base]
      next[slot] = hex
      return { toneId, colors: uniqueColors(next) }
    })
  }

  const resetToneColors = (toneId: ToneOption) => {
    const original = toneOptions.find((tone) => tone.id === toneId)?.colors ?? ['#eadfff']
    setCustomToneColors((current) => {
      const next = { ...current }
      delete next[toneId]
      return next
    })
    setTonePaletteDraft({ toneId, colors: [...original] })
    setTonePaletteTarget({ toneId, slot: 0 })
  }

  const getToneColors = (toneId: ToneOption) => uniqueColors(customToneColors[toneId]
    ?? toneOptions.find((option) => option.id === toneId)?.colors
    ?? toneOptions[0].colors).slice(0, 1)

  const getSelectedColors = () => {
    if (colorSelectionMode === 'tone' && toneSelection) {
      return getToneColors(toneSelection)
    }

    return [uniqueColors(manualColors)[0] ?? DEFAULT_MANUAL_COLOR]
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

    if (step === 'tone' || step === 'logo-style' || step === 'final-review') {
      input.tone = (toneMode === 'direct' ? directTone.trim() : toneSelection) || undefined
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
    if (!editTarget) return
    const baseColor = projectColors[0] ?? '#7B5CDF'
    setEditorScale(100)
    setEditorRotation(0)
    setEditorOpacity(100)
    setEditorOffsetX(0)
    setEditorOffsetY(0)
    setEditorColor(baseColor)
    setEditorColorPickerOpen(false)
    setEditorColorChanged(false)
    setEditorDrafts((current) => ({
      ...current,
      [editTarget]: {
        scale: 100,
        rotation: 0,
        opacity: 100,
        offsetX: 0,
        offsetY: 0,
        color: baseColor,
        colorChanged: false,
        dirty: true,
      },
    }))
    markEditorDirty()
  }

  const selectEditorTarget = (target: EditorTarget) => {
    if (target === editTarget) return
    if (editTarget) {
      setEditorDrafts((current) => ({
        ...current,
        [editTarget]: {
          ...(current[editTarget] ?? createEditorDraft(editorColor)),
          scale: editorScale,
          rotation: editorRotation,
          opacity: editorOpacity,
          offsetX: editorOffsetX,
          offsetY: editorOffsetY,
          color: editorColor,
          colorChanged: editorColorChanged,
        },
      }))
    }
    const nextDraft = editorDrafts[target] ?? createEditorDraft(editorColor)
    setEditTarget(target)
    setEditorScale(nextDraft.scale)
    setEditorRotation(nextDraft.rotation)
    setEditorOpacity(nextDraft.opacity)
    setEditorOffsetX(nextDraft.offsetX)
    setEditorOffsetY(nextDraft.offsetY)
    setEditorColor(nextDraft.color)
    setEditorColorPickerOpen(false)
    setEditorColorChanged(nextDraft.colorChanged)
    setEditorError('')
  }

  const saveEditorChanges = async (): Promise<boolean> => {
    const candidate = logoCandidates[resultCandidate] ?? logoCandidates[0]
    if (!editorSvgSource || (!EDITOR_TEST_MODE && (!projectId || !candidate?.svgUrl))) {
      setEditorError('저장할 SVG 로고를 불러오지 못했어요.')
      setEditorSaved(false)
      return false
    }

    setEditorSaving(true)
    setEditorError('')
    try {
      const editedSvg = editorDirty ? buildEditorDraftSvg(editorSvgSource, editorDrafts) : editorSvgSource
      if (!EDITOR_TEST_MODE && candidate?.svgUrl) await projectsApi.saveCandidateSvg(candidate.svgUrl, editedSvg)
      const changedColorDraft = Object.values(editorDrafts).find((draft) => draft.dirty && draft.colorChanged)
      if (!EDITOR_TEST_MODE && changedColorDraft && projectId) {
        const currentPalette = projectColors.length > 0 ? projectColors : getSelectedColors()
        const nextPalette = [...currentPalette]
        if (nextPalette.length === 0) nextPalette.push(changedColorDraft.color)
        else nextPalette[0] = changedColorDraft.color
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
      setEditorDrafts((current) => Object.fromEntries(Object.entries(current).map(([target, draft]) => [target, { ...draft, dirty: false }])))
      setEditorSaved(true)
      if (candidate) setLogoCandidates((current) => current.map((item) => item.id === candidate.id
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

  const runTrademarkAnalysisForCandidate = async (targetProjectId: string, candidate: LogoCandidate, requestEpoch: number) => {
    await projectsApi.selectCandidate(targetProjectId, candidate.id)
    if (requestEpoch !== assetEpochRef.current) return false
    setSelectedCandidateId(candidate.id)
    const analysis = await projectsApi.createAnalysis(targetProjectId)
    if (requestEpoch !== assetEpochRef.current) return false
    setAnalysisId(analysis.id)
    const completedAnalysis = await waitForTrademarkAnalysis(targetProjectId, analysis.id)
    if (requestEpoch !== assetEpochRef.current) return false
    if (completedAnalysis.status === 'FAILED') {
      throw new Error(completedAnalysis.errorMessage ?? '상표 분석에 실패했어요.')
    }
    const matches = await projectsApi.getMatches(targetProjectId, analysis.id)
    if (requestEpoch !== assetEpochRef.current) return false
    setTrademarkMatches(matches)
    setTrademarkSimilarity(completedAnalysis.maxSimilarity)
    setTrademarkRiskLabel(completedAnalysis.riskLabel ?? '')
    setTrademarkRiskDescription(completedAnalysis.riskDescription ?? '')
    setTrademarkDisclaimer(completedAnalysis.disclaimer ?? '')
    setTrademarkAnalysisCompleted(true)
    return true
  }

  const startLogoGeneration = async (analyzeTrademark = trademarkAnalysisRequested) => {
    if (generationLoadingRef.current) return
    generationLoadingRef.current = true
    // 결과 화면에서 시작한 재생성은 현재 폼 상태로 프로젝트를 다시 저장하지 않는다.
    // 새로고침 직후에는 폼 상태가 아직 비어 있을 수 있으므로 서버 프로젝트를
    // 먼저 복원한 뒤 같은 프로젝트에 새 generation만 추가한다.
    const preserveExistingProject = mode === 'result' || (mode === 'loading' && logoCandidates.length > 0)
    setGenerationLoading(true)
    setGenerationError('')
    setAnalysisError('')
    setTrademarkAnalysisRequested(analyzeTrademark)
    setTrademarkAnalysisSkipped(!analyzeTrademark)
    setMode('loading')
    try {
      let nextProjectId = projectId ?? window.localStorage.getItem('genmark-project-id')
      if (preserveExistingProject) {
        if (!nextProjectId) {
          const session = await restoreSession()
          nextProjectId = session?.resumeProjectId ?? null
        }
        if (!nextProjectId) throw new Error('기존 프로젝트를 찾을 수 없습니다. 결과 화면을 다시 불러온 뒤 시도해주세요.')
        if (!projectId) setProjectId(nextProjectId)
        const needsProjectHydration = !brandKind || (brandKind === 'ci'
          ? !companyName.trim() && !companyMotto.trim()
          : !brandName.trim() && coreValues.length === 0 && !brandValueDescription.trim())
        if (needsProjectHydration) await restoreProjectState(nextProjectId)
      } else {
        nextProjectId = await ensureProject('final-review')
      }
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
      if (analyzeTrademark) {
        try {
          const selectedIndex = candidates.findIndex((candidate) => candidate.selected)
          const candidate = candidates[selectedIndex >= 0 ? selectedIndex : 0]
          if (!candidate) throw new Error('상표 분석에 사용할 로고를 찾지 못했어요.')
          const analysisCompleted = await runTrademarkAnalysisForCandidate(nextProjectId, candidate, assetEpochRef.current)
          if (!analysisCompleted) return
        } catch (error) {
          setAnalysisError(error instanceof Error ? error.message : '상표 분석 중 문제가 발생했어요.')
          setTrademarkAnalysisCompleted(false)
          setTrademarkAnalysisSkipped(false)
          setTrademarkAnalysisRequested(true)
          setMode('result')
          return
        }
      }
      setMode('result')
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '로고 생성 중 문제가 발생했어요.')
    } finally {
      generationLoadingRef.current = false
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

  const startTrademarkAnalysis = async (target?: { projectId: string; candidate: LogoCandidate }) => {
    const analysisProjectId = target?.projectId ?? projectId
    if (!analysisProjectId) return
    const candidate = target?.candidate ?? logoCandidates[resultCandidate]
    if (!candidate) {
      setAnalysisError('먼저 로고 후보를 생성해주세요.')
      return
    }
    const requestEpoch = assetEpochRef.current
    setAnalysisError('')
    setMode('trademark-loading')
    try {
      const analysisCompleted = await runTrademarkAnalysisForCandidate(analysisProjectId, candidate, requestEpoch)
      if (!analysisCompleted) return
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
      setBrandKitHistory((current) => [next, ...current.filter((kit) => kit.id !== next.id)])
      if (next.status === 'SUCCEEDED' || next.status === 'FAILED') return
    }
  }

  const requestBrandKit = async (
    candidateId: string | null = selectedCandidateId,
    targetProjectId: string | null = projectId,
    cardInfo?: BusinessCardInfoInput,
    callbacks?: { onAccepted?: () => void; onRejected?: (message: string) => void },
  ): Promise<boolean> => {
    if (!targetProjectId || !candidateId) {
      const message = '로고 후보를 선택한 뒤 브랜드 키트를 만들 수 있어요.'
      setBrandKitError(message)
      callbacks?.onRejected?.(message)
      return false
    }
    const requestEpoch = assetEpochRef.current
    const brandKitRequestEpoch = ++brandKitRequestEpochRef.current
    let accepted = false
    setBrandKitError('')
    try {
      const requested = await projectsApi.requestBrandKit(
        targetProjectId,
        candidateId,
        { kitType: brandKitType ?? 'THUMBNAIL', ...(cardInfo ? { cardInfo } : {}) },
      )
      if (requestEpoch !== assetEpochRef.current
          || brandKitRequestEpoch !== brandKitRequestEpochRef.current) return false
      accepted = true
      setBrandKit(requested)
      setBrandKitHistory((current) => [requested, ...current.filter((kit) => kit.id !== requested.id)])
      callbacks?.onAccepted?.()
      await pollBrandKit(requested, brandKitRequestEpoch)
      return true
    } catch (error) {
      if (requestEpoch !== assetEpochRef.current
          || brandKitRequestEpoch !== brandKitRequestEpochRef.current) return false
      const message = error instanceof Error ? error.message : '브랜드 키트를 요청하지 못했어요.'
      setBrandKitError(message)
      if (!accepted) callbacks?.onRejected?.(message)
      return accepted
    }
  }

  const openBrandKitSelection = () => {
    setBrandKitError('')
    brandKitSelectionOnlyRef.current = false
    setBrandKitType(null)
    setMode('brand-kit')
  }

  const openMypageLogoAction = (asset: MypageAssetItem) => {
    setMypageLogoActionError('')
    setMypageLogoAction(asset)
  }

  const restoreMypageLogoContext = async (asset: MypageAssetItem) => {
    if (!asset.projectId || !asset.candidateId || !asset.projectType) {
      throw new Error('이 로고의 프로젝트 연결 정보를 찾지 못했어요. 새로고침 후 다시 시도해주세요.')
    }
    let savedCandidate = mypageGeneratedLogoCandidates[asset.candidateId]
    if (!savedCandidate) {
      savedCandidate = await projectsApi.getCandidate(asset.projectId, asset.candidateId)
    }
    if (!savedCandidate) throw new Error('이 프로젝트에서 저장된 로고를 찾지 못했어요.')
    const nextMode = await restoreProjectState(asset.projectId)
    if (!nextMode) throw new Error('이 로고가 속한 프로젝트를 불러오지 못했어요.')
    const candidate = savedCandidate.selected
      ? savedCandidate
      : await projectsApi.selectCandidate(asset.projectId, asset.candidateId)
    setLogoCandidates([candidate])
    setResultCandidate(0)
    setSelectedCandidateId(candidate.id)
    setBrandKit(brandKitHistory.find((kit) => kit.candidateId === candidate.id) ?? null)
    resultHydrationProjectRef.current = asset.projectId
    return { candidate, projectId: asset.projectId, projectType: asset.projectType }
  }

  const navigateFromMypageLogo = async (destination: 'result' | 'trademark' | 'brand-kit') => {
    if (!mypageLogoAction || mypageLogoActionLoading) return
    setMypageLogoActionLoading(true)
    setMypageLogoActionError('')
    try {
      const context = await restoreMypageLogoContext(mypageLogoAction)
      setMypageLogoAction(null)
      if (destination === 'trademark') {
        setTrademarkAnalysisSkipped(false)
        setTrademarkAnalysisRequested(true)
        await startTrademarkAnalysis({ projectId: context.projectId, candidate: context.candidate })
      } else if (destination === 'brand-kit') {
        setBrandKitError('')
        brandKitSelectionOnlyRef.current = true
        setBrandKit(null)
        setBrandKitType(null)
        setMode('brand-kit')
      } else {
        setMode('result')
      }
    } catch (error) {
      setMypageLogoActionError(error instanceof Error ? error.message : '로고 활용 화면을 열지 못했어요.')
    } finally {
      setMypageLogoActionLoading(false)
    }
  }

  const downloadBrandKitArchive = async (kit: BrandKit, onError: (message: string) => void = setBrandKitError) => {
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
      onError(error instanceof Error ? error.message : '브랜드 키트를 다운로드하지 못했어요.')
    } finally {
      setBrandKitDownloading(false)
    }
  }

  const openBusinessCardModal = (target: { candidateId: string; projectId: string } | null = null) => {
    if (brandKitCreatingRef.current) return
    setBusinessCardTarget(target)
    setBusinessCardInfoErrors({})
    setBusinessCardSubmitError('')
    setBusinessCardInfo((current) => ({
      ...current,
      name: current.name || authUser?.name?.trim() || '',
      company: current.company || (brandKind === 'ci' ? companyName : brandName).trim(),
      email: current.email || authUser?.email?.trim() || '',
    }))
    setBusinessCardModalOpen(true)
  }

  const releaseBrandKitCreation = () => {
    brandKitCreatingRef.current = false
    setBrandKitCreating(false)
  }

  const runSelectedBrandKit = async (
    cardInfo?: BusinessCardInfoInput,
    callbacks?: { onAccepted?: () => void; onRejected?: (message: string) => void },
    lockAlreadyHeld = false,
  ): Promise<boolean> => {
    const ownsLock = !lockAlreadyHeld
    if (ownsLock) {
      if (brandKitCreatingRef.current) return false
      brandKitCreatingRef.current = true
      setBrandKitCreating(true)
    }
    try {
      if (!brandKitType || !projectId) {
        const message = '로고 후보를 선택한 뒤 브랜드 키트를 만들 수 있어요.'
        setBrandKitError(message)
        callbacks?.onRejected?.(message)
        return false
      }
      if (logoCandidates.length === 0 && selectedCandidateId) {
        return await requestBrandKit(selectedCandidateId, projectId, cardInfo, callbacks)
      }
      const candidate = logoCandidates[resultCandidate] ?? logoCandidates[0]
      if (!candidate) {
        const message = '로고 후보를 선택한 뒤 브랜드 키트를 만들 수 있어요.'
        setBrandKitError(message)
        callbacks?.onRejected?.(message)
        return false
      }
      let candidateId = selectedCandidateId
      if (!candidate.selected || candidate.id !== selectedCandidateId) {
        const selected = await projectsApi.selectCandidate(projectId, candidate.id)
        candidateId = selected.id
        setSelectedCandidateId(selected.id)
        setLogoCandidates((current) => current.map((item) => ({ ...item, selected: item.id === selected.id })))
      }
      return await requestBrandKit(candidateId, projectId, cardInfo, callbacks)
    } catch (error) {
      const message = error instanceof Error ? error.message : '로고 후보를 선택하지 못했어요.'
      setBrandKitError(message)
      callbacks?.onRejected?.(message)
      return false
    } finally {
      if (ownsLock) releaseBrandKitCreation()
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
    if (brandKitCreatingRef.current) return
    const normalized: BusinessCardInfoInput = {
      name: businessCardInfo.name.trim(),
      title: businessCardInfo.title?.trim() || undefined,
      company: businessCardInfo.company?.trim() || undefined,
      phone: formatBusinessPhone(businessCardInfo.phone ?? '') || undefined,
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
    setBusinessCardSubmitError('')
    brandKitCreatingRef.current = true
    setBrandKitCreating(true)
    const target = businessCardTarget
    const callbacks = {
      onAccepted: () => {
        setBusinessCardModalOpen(false)
        setBusinessCardTarget(null)
      },
      onRejected: (message: string) => setBusinessCardSubmitError(message),
    }
    try {
      if (target) await requestBrandKit(target.candidateId, target.projectId, normalized, callbacks)
      else await runSelectedBrandKit(normalized, callbacks, true)
    } finally {
      releaseBrandKitCreation()
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

  const openCreditSurvey = () => {
    setSurveyRating(5)
    setSurveyImprovements([])
    setSurveyComment('')
    setProjectError('')
    setCreditModal('survey')
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
          <div className="onboarding-brand"><BrandLogo /><span>GenMark AI</span></div>
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

  const renderLogoCreationIntroScreen = () => (
    <main
      className={`logo-intro-screen ${logoIntroStage === 'opening' ? 'is-opening' : 'is-ready'}`}
      aria-labelledby={logoIntroStage === 'ready' ? 'logo-intro-title' : undefined}
      aria-label={logoIntroStage === 'opening' ? '브랜드 시작 안내' : undefined}
    >
      <button className="logo-intro-back" type="button" onClick={() => setMode('home')}>
        <ArrowLeft aria-hidden="true" size={19} strokeWidth={1.8} /> 홈으로
      </button>
      <section className={`logo-intro-opening ${logoIntroStage === 'ready' ? 'is-complete' : ''}`} aria-live="polite" aria-label="브랜드 시작 문구">
        <p id="logo-intro-title" className="logo-intro-opening-copy">
          <span>생각한 그대로</span>
          <br />
          <span>나만의 로고를</span>
          <br />
          <span>완성해보세요</span>
        </p>
        {logoIntroStage === 'ready' && (
          <button className="logo-intro-continue" type="button" onClick={startLogoCreationFromIntro}>
            계속하기 <ChevronRight aria-hidden="true" size={22} strokeWidth={1.8} />
          </button>
        )}
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
      { id: 'lowIrritation', label: '저자극' },
      { id: 'derma', label: '더마' },
      { id: 'cleanBeauty', label: '클린뷰티' },
      { id: 'natural', label: '자연주의' },
      { id: 'premium', label: '프리미엄' },
      { id: 'sustainable', label: '지속가능성' },
      { id: 'scientific', label: '과학적 검증' },
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
            onClick={() => { setToneMode('direct'); setToneSelection(null); setColorSelectionMode('manual'); setManualColors((current) => [uniqueColors(current)[0] ?? DEFAULT_MANUAL_COLOR]); setColorPickerOpen(false); setTonePaletteTarget(null); setTonePaletteDraft(null) }}
            >직접 지정</button>
          </div>
          <h1 id="tone-selection-title">톤앤매너와<br />색상을 골라주세요</h1>
          <p>톤 선택 시 어울리는 색상이 자동으로 적용돼요</p>
        </header>

        {toneMode === 'recommended' && (
        <section className="tone-options" aria-label="톤앤매너 선택">
          {toneOptions.map((tone) => {
            const selected = toneSelection === tone.id
            const toneColor = (customToneColors[tone.id] ?? tone.colors)[0]
            return (
              <div className="tone-option-shell" key={tone.id}>
              <button
                type="button"
                className={selected ? 'tone-option selected' : 'tone-option'}
                aria-pressed={selected}
                 onClick={() => { setToneSelection((current) => current === tone.id ? null : tone.id); setColorSelectionMode('tone') }}
              >
                <span className="tone-swatches" aria-hidden="true">
                  <i style={{ background: toneColor }} />
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
                aria-label={`${tone.label} 색상 편집`}
                aria-expanded={tonePaletteTarget?.toneId === tone.id}
              onClick={() => {
                if (tonePaletteTarget?.toneId === tone.id) {
                  setTonePaletteTarget(null)
                  setTonePaletteDraft(null)
                  return
                }
                setTonePaletteDraft({ toneId: tone.id, colors: [toneColor] })
                setTonePaletteTarget({ toneId: tone.id, slot: 0 })
              }}
              ><Pencil aria-hidden="true" size={13} strokeWidth={2} /> Edit</button>
              {tonePaletteTarget?.toneId === tone.id && (
                <div className="tone-inline-picker" role="group" aria-label={`${tone.label} 색상 지정`}>
                  <div className="tone-inline-picker-heading"><strong>색상을 선택하세요</strong><span>톤에 어울리는 대표 색상 1개를 조정할 수 있어요.</span></div>
                  <ToneColorPalette
                    value={hexToRgb((tonePaletteDraft?.toneId === tone.id ? tonePaletteDraft.colors : customToneColors[tone.id] ?? tone.colors)[0])}
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
                    <span>선택한 색상 · {(tonePaletteDraft?.toneId === tone.id ? tonePaletteDraft.colors : customToneColors[tone.id] ?? tone.colors)[0]}</span>
                    <button type="button" className="tone-inline-reset" onClick={() => resetToneColors(tone.id)}>초기화</button>
                  </div>
                </div>
              )}
              </div>
            )
          })}
        </section>
        )}

        {toneMode === 'direct' && (<section className="tone-color-card tone-direct-card" aria-label="직접 색상과 분위기 지정">
          <div className="tone-direct-swatches" aria-label="직접 선택한 색상">
            <i style={{ background: manualColors[0] || DEFAULT_MANUAL_COLOR }} />
            <button
              className="tone-direct-edit-trigger"
              type="button"
              aria-label="직접 지정 색상 편집"
              aria-expanded={colorPickerOpen}
              onClick={() => {
                setManualColorSlot(0)
                setColorPickerOpen(true)
              }}
            ><Pencil aria-hidden="true" size={13} strokeWidth={2} /> Edit</button>
          </div>
          <div className="tone-direct-copy">
            <h2>색상과 분위기 직접 지정</h2>
            <p>원하는 색상과 분위기를 직접 지정할 수 있어요</p>
            <label className="tone-direct-mood-field">
              <span>원하는 분위기 <small>필수</small></span>
              <input
                type="text"
                value={directTone}
                maxLength={100}
                placeholder="예: 차분하고 고급스러운, 대담하고 세련된"
                aria-label="직접 입력할 분위기"
                onChange={(event) => setDirectTone(event.target.value)}
              />
            </label>
          </div>
          {colorPickerOpen && (
            <div className="tone-color-picker tone-color-picker-inline" id="tone-color-picker" role="group" aria-label="RGB 색상 선택">
              <div className="tone-color-picker-heading">
                <strong>원하는 색상 선택</strong>
                <button type="button" aria-label="색상 팔레트 닫기" onClick={() => setColorPickerOpen(false)}>×</button>
              </div>
              <ToneColorPalette
                value={hexToRgb(manualColors[0] || DEFAULT_MANUAL_COLOR)}
                onChange={(color) => updateManualColorFromHex(rgbToHex(color))}
                onComplete={() => setColorPickerOpen(false)}
                ariaLabel="색상 팔레트"
              />
              <div className="tone-color-picker-footer">
                <span>선택한 색상 · {manualColors[0] || DEFAULT_MANUAL_COLOR}</span>
                <button type="button" className="tone-inline-reset" onClick={resetManualColors}>초기화</button>
              </div>
            </div>
          )}
        </section>)}

        <button className="tone-next" type="button" onClick={() => void saveProjectStep('tone', 'style')} disabled={projectSaving || (toneMode === 'recommended' ? !toneSelection : !directTone.trim() || !getSelectedColors()[0])}>
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
                    {option.recommended && <small className="logo-style-recommend"><Sparkle /> 처음 만드는 브랜드에 추천</small>}
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                    <span className="logo-style-fit"><CircleCheck aria-hidden="true" size={17} strokeWidth={2} />{option.fit}</span>
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
    <section className="featured-hero" aria-label="대표 브랜드 로고 소개">
      <img
        key={featuredHeroSlides[featuredHeroIndex].id}
        className="featured-art"
        src={featuredHeroSlides[featuredHeroIndex].src}
        alt={featuredHeroSlides[featuredHeroIndex].alt}
      />
      <div className="featured-scrim" />
      <button
        type="button"
        className="featured-hero-arrow prev"
        aria-label="이전 로고 보기"
        onClick={() => setFeaturedHeroIndex((index) => (index + featuredHeroSlides.length - 1) % featuredHeroSlides.length)}
      >
        <ChevronLeft aria-hidden="true" size={22} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="featured-hero-arrow next"
        aria-label="다음 로고 보기"
        onClick={() => setFeaturedHeroIndex((index) => (index + 1) % featuredHeroSlides.length)}
      >
        <ChevronRight aria-hidden="true" size={22} strokeWidth={2} />
      </button>
    </section>
  )

  const renderHeroScreen = () => (
    <main className="hero-screen">
      <header className="hero-screen-header">
        <div className="hero-screen-brand"><BrandLogo className="hero-screen-mark" /><span><span className="brand-mark-accent">GenMark AI</span></span></div>
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
            <span><span className="brand-mark-accent">GenMark AI</span></span>
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
        <section className="brand-choice-content" aria-labelledby="brand-choice-title">
          <header className="brand-choice-intro">
            <h1 id="brand-choice-title">어떤 용도의<br /><strong>로고가 필요하신가요?</strong></h1>
            <p>선택한 종류에 맞춰 다음 질문이 달라져요.</p>
          </header>
          <div className="brand-choice-list">
            {/* 카드 전체가 하나의 버튼이다. 안에 ⓘ 버튼이 들어 있어서
                <button>으로 감싸면 버튼 중첩이 되므로 role/tabIndex로 만든다. */}
            <article
              className="brand-choice-card ci-card"
              role="button"
              tabIndex={0}
              aria-label="기업 · 회사 로고(CI) 만들기"
              onClick={() => chooseBrandKind('ci')}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseBrandKind('ci') } }}
            >
              <button className="brand-choice-info" type="button" aria-label="CI 설명 보기" onClick={(event) => { event.stopPropagation(); setChoiceInfoModal('ci') }}><Info aria-hidden="true" size={19} strokeWidth={2} /></button>
              <div className="brand-choice-copy">
                <h2>기업 · 회사 로고<br /><span className="brand-choice-kind">(CI)</span></h2>
                <p>기업의 신뢰와 정체성을 담은 대표 로고예요.</p>
              </div>
              <span className="brand-choice-start">이 스타일로 시작하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={2.2} /></span>
            </article>
            <article
              className="brand-choice-card bi-card"
              role="button"
              tabIndex={0}
              aria-label="제품 · 브랜드 로고(BI) 만들기"
              onClick={() => chooseBrandKind('bi')}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseBrandKind('bi') } }}
            >
              <button className="brand-choice-info" type="button" aria-label="BI 설명 보기" onClick={(event) => { event.stopPropagation(); setChoiceInfoModal('bi') }}><Info aria-hidden="true" size={19} strokeWidth={2} /></button>
              <div className="brand-choice-copy">
                <h2>제품 · 브랜드 로고<br /><span className="brand-choice-kind">(BI)</span></h2>
                <p>특정 제품이나 서비스의 매력을 보여주는 로고예요.</p>
              </div>
              <span className="brand-choice-start">이 스타일로 시작하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={2.2} /></span>
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

  const openFinalEditModal = (kind: FinalEditKind) => {
    const initialToneMode = toneMode
    const initialTone = initialToneMode === 'direct'
      ? directTone
      : toneSelection ?? toneOptions[0].id
    const initialToneId = toneOptions.some((option) => option.id === initialTone)
      ? initialTone as ToneOption
      : toneOptions[0].id
    setFinalEditDraft({
      companyName, companyMotto, brandName, targetAge,
      valuesText: coreValueInputMode === 'category' ? coreValues.map((value) => coreValueLabels[value] ?? value).join(', ') : brandValueDescription,
      tone: initialTone,
      colors: initialToneMode === 'direct' ? [...getSelectedColors()] : [...getToneColors(initialToneId)],
      logoStyle: logoStyle ?? '', logoShape: logoShapePrompt,
    })
    setFinalEditToneMode(initialToneMode)
    setFinalEditModal(kind)
  }

  const startRegeneration = () => {
    void startLogoGeneration()
  }

  const saveFinalEditModal = () => {
    if (!finalEditModal) return
    if (finalEditModal === 'identity') {
      setCompanyName(finalEditDraft.companyName)
      setBrandName(finalEditDraft.brandName)
      setTargetAge(finalEditDraft.targetAge)
    } else if (finalEditModal === 'values') {
      setCompanyMotto(finalEditDraft.companyMotto)
      setBrandValueDescription(finalEditDraft.valuesText)
      if (brandKind === 'bi') { setCoreValueInputMode('direct'); setCoreValues([]) }
    } else if (finalEditModal === 'tone') {
      if (finalEditToneMode === 'direct') {
        setDirectTone(finalEditDraft.tone.trim())
        setToneMode('direct')
      } else {
        const selectedTone = toneOptions.some((option) => option.id === finalEditDraft.tone)
          ? finalEditDraft.tone as ToneOption
          : toneOptions[0].id
        setToneSelection(selectedTone)
        setToneMode('recommended')
      }
    } else if (finalEditModal === 'color') {
      const colors = uniqueColors(finalEditDraft.colors).slice(0, 1)
      if (toneMode === 'recommended' && toneSelection) {
        setCustomToneColors((current) => ({ ...current, [toneSelection]: colors }))
        setManualColors(colors)
        setColorSelectionMode('tone')
      } else {
        setManualColors(colors)
        setColorSelectionMode('manual')
      }
    } else {
      setLogoStyle(finalEditDraft.logoStyle || null)
      setLogoShapePrompt(finalEditDraft.logoShape)
    }
    setFinalEditModal(null)
  }

  const renderFinalRequestScreen = () => {
    const displayValue = (value: string | undefined, fallback = '입력하지 않음') => value?.trim() || fallback
    const selectedToneLabel = toneMode === 'direct'
      ? displayValue(directTone)
      : toneOptions.find((option) => option.id === toneSelection)?.label ?? displayValue(toneSelection ?? undefined)
    const selectedLogoStyle = logoStyleOptions.find((option) => option.id === logoStyle)?.label ?? '선택하지 않음'
    const selectedBrandValues = coreValues.length > 0
      ? coreValues.map((value) => coreValueLabels[value] ?? value).join(', ')
      : displayValue(brandValueDescription)
    const summaryRows = brandKind === 'ci'
      ? [
          { key: 'company-name', label: '회사명', value: displayValue(companyName), icon: 'name', editKind: 'identity' as FinalEditKind },
          { key: 'company-motto', label: '회사 모토', value: displayValue(companyMotto), icon: 'value', editKind: 'values' as FinalEditKind },
          { key: 'mood', label: '원하는 분위기', value: selectedToneLabel, icon: 'mood', editKind: 'tone' as FinalEditKind },
        ]
      : [
          { key: 'brand-name', label: '브랜드명', value: displayValue(brandName), icon: 'name', editKind: 'identity' as FinalEditKind },
          { key: 'audience', label: '주요 고객', value: displayValue(targetAgeOptions.find((option) => option.id === targetAge)?.label), icon: 'audience', editKind: 'identity' as FinalEditKind },
          { key: 'value', label: '핵심 가치', value: selectedBrandValues, icon: 'value', editKind: 'values' as FinalEditKind },
          { key: 'mood', label: '분위기', value: selectedToneLabel, icon: 'mood', editKind: 'tone' as FinalEditKind },
        ]

    return (
      <main className="final-request-screen">
        <ScreenBackButton label="로고 스타일 선택 화면으로 돌아가기" onClick={() => setMode('style')} />
        <section className="final-request-content" aria-labelledby="final-request-title">
          <BrandFlowProgress step={4} />

          <header className="final-request-heading">
            <h1 id="final-request-title">입력하신 내용을<br />확인해주세요</h1>
            <p>수정할 항목을 눌러 바로 바꿀 수 있어요.</p>
          </header>

          <section className="final-summary-section" aria-label="입력 내용 요약">
            <div className="final-summary-card">
              {summaryRows.map((row) => (
                <div className="final-summary-row" key={row.key}>
                  {(() => {
                    const SummaryIcon = finalSummaryIconMap[row.icon] ?? Shapes
                    return <SummaryIcon className="final-detail-icon" aria-hidden="true" size={22} strokeWidth={1.8} />
                  })()}
                  <span className="final-summary-label">{row.label}</span>
                  <span className="final-summary-value">{row.value}</span>
                  <button className="final-edit-button" type="button" onClick={() => openFinalEditModal(row.editKind)}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
                </div>
              ))}
              <div className="final-summary-row">
                <Palette className="final-detail-icon" aria-hidden="true" size={22} strokeWidth={1.8} />
                <span className="final-summary-label">선호 색상</span>
                  <span className="final-color-swatches" aria-label="선호 색상 1개">
                    {getSelectedColors().map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
                  </span>
                  <button className="final-edit-button" type="button" onClick={() => openFinalEditModal('color')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
              </div>
              <div className="final-summary-row">
                <TypeIcon className="final-detail-icon" aria-hidden="true" size={22} strokeWidth={1.8} />
                <span className="final-summary-label">로고 타입</span>
                <span className="final-summary-value">{selectedLogoStyle}{logoStyle === 'combination' && <em>추천</em>}</span>
                <button className="final-edit-button" type="button" onClick={() => openFinalEditModal('style')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
              </div>
              <div className="final-summary-row">
                <Shapes className="final-detail-icon" aria-hidden="true" size={22} strokeWidth={1.8} />
                <span className="final-summary-label">원하는 로고 모양</span>
                <span className="final-summary-value">{displayValue(logoShapePrompt)}</span>
                <button className="final-edit-button" type="button" onClick={() => openFinalEditModal('shape')}>수정하기 <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} /></button>
              </div>
            </div>
          </section>

          <button className="logo-style-next" type="button" onClick={queueLogoGenerationFlow} disabled={finalGenerationLocked || generationLoading} aria-busy={finalGenerationLocked || generationLoading}>
            로고 생성하기 <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} />
          </button>
          {generationError && <p className="generation-error" role="alert">{generationError}</p>}
          <p className="final-footnote"><Info aria-hidden="true" size={18} strokeWidth={1.8} /> 생성된 후보는 나중에 색상과 글씨체를 수정할 수 있어요.</p>
        </section>
      </main>
    )
  }

  const renderLoadingScreen = () => {
    const loadingSteps = [
      { icon: 'clipboard', text: '브랜드와 제품의 특징을 정리하고 있어요' },
      { icon: 'mood', text: '고객에게 어울리는 분위기를 찾고 있어요' },
      { icon: 'palette', text: '색상과 글씨체를 조합하고 있어요' },
      { icon: 'pen', text: '로고 후보를 생성하고 있어요' },
      { icon: 'folder', text: '결과를 비교하기 쉽게 정리하고 있어요' },
      ...(trademarkAnalysisRequested ? [{ icon: 'search', text: '로고 유사도를 분석하고 있어요' }] : []),
    ]

    return (
      <main className="logo-loading-screen" aria-labelledby="logo-loading-title">
        <section className="logo-loading-content">
          <header className="logo-loading-heading">
            <h1 id="logo-loading-title">입력 정보를 바탕으로<br />로고를 생성하고 있습니다.</h1>
          </header>

          <div className="logo-loading-orb" aria-label="로고 생성 진행 중">
            {!generationError && <AiLoader label="Generating" />}
          </div>
          {generationError && <div className="logo-loading-status" role="status">로고 생성에 문제가 발생했어요</div>}
          {generationError && <div className="logo-loading-error" role="alert"><p>{generationError}</p><button type="button" onClick={() => void startLogoGeneration()}>다시 시도하기</button></div>}

          <section className={`logo-loading-steps step-progress-${loadingStep}`} aria-label="로고 생성 단계">
            {loadingSteps.map((step, index) => (
              <article className={`logo-loading-step ${index < loadingStep ? 'complete' : ''} ${index === loadingStep && !generationError ? 'active' : ''}`} key={`${step.icon}-${step.text}`}>
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
            <span><span className="brand-mark-accent">GenMark AI</span></span>
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
      { Icon: ImageIcon, title: '이미지로 비슷한 상표 찾기', description: '생성한 로고와 형태, 구도, 배치가 비슷한 화장품 상표를 찾아요.' },
      { Icon: BarChart3, title: '유사도 점수 확인', description: '가장 비슷한 상표와 어느 정도 닮았는지 점수로 보여드려요.' },
      { Icon: Pencil, title: '확정 전 수정', description: '유사도가 높으면 패키지와 쇼핑몰을 만들기 전에 로고를 수정할 수 있어요.' },
    ]

    return (
      <main className="trademark-selection-screen" aria-labelledby="trademark-selection-title">
        <ScreenBackButton label="이전 화면으로 돌아가기" onClick={() => setMode(trademarkEntry === 'generation' ? 'final' : 'result')} />

        <section className="trademark-selection-content">
          <header className="trademark-selection-heading">
            <h1 id="trademark-selection-title">등록된 상표 중에<br />내 로고와 비슷한 게 있는지 확인할까요?</h1>
          </header>

          <section className="trademark-benefit-card" aria-label="상표 분석 기능">
            {benefits.map((benefit) => (
              <article className="trademark-benefit-row" key={benefit.title}>
                <span className="trademark-benefit-icon" aria-hidden="true"><benefit.Icon size={40} strokeWidth={1.8} /></span>
                <div>
                  <h2>{benefit.title}</h2>
                  <p>{benefit.description}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="trademark-question-card" aria-label="상표 분석 안내">
            <div className="trademark-question-row">
              <span className="trademark-question-badge" aria-label="질문"><CircleHelp aria-hidden="true" size={22} strokeWidth={2} /></span>
              <p>이름이 다른데 로고 모양이 비슷해도 문제가 되나요?</p>
            </div>
            <div className="trademark-answer-row">
              <span className="trademark-answer-badge" aria-label="답변"><MessageCircle aria-hidden="true" size={20} strokeWidth={2} /></span>
              <p>상표는 이름뿐 아니라 로고의 외관도 함께 검토될 가능성이 있으며, GenMark AI는 이미지의 시각적 유사성을 확인하는 데 도움을 드려요.</p>
            </div>
          </section>

          <div className="trademark-selection-actions">
            <button className="trademark-check-button" type="button" onClick={() => {
              setTrademarkAnalysisSkipped(false)
              setTrademarkAnalysisRequested(true)
              setTrademarkAnalysisCompleted(false)
              if (trademarkEntry === 'generation') void startLogoGeneration(true)
              else void startTrademarkAnalysis()
            }}>
              <span>유사한 상표 이미지 확인</span>
              <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} />
            </button>
            <button className="trademark-skip-button" type="button" onClick={() => {
              setTrademarkAnalysisSkipped(true)
              setTrademarkAnalysisRequested(false)
              setTrademarkAnalysisCompleted(false)
              if (trademarkEntry === 'generation') void startLogoGeneration(false)
              else setMode('result')
            }}>
              <span>지금은 건너뛰기</span>
              <ChevronRight aria-hidden="true" size={24} strokeWidth={1.8} />
            </button>
          </div>

          <p className="trademark-disclaimer"><Info aria-hidden="true" size={20} strokeWidth={1.8} /><span>본 분석은 기존 등록 상표 이미지와의 시각적 유사성을 보여주는 참고 자료이며, 상표 등록 가능 여부나 법적 침해 여부를 판단하지 않습니다.</span></p>
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
          <div className="trademark-result-brand"><BrandLogo /><strong><span className="brand-mark-accent">GenMark AI</span></strong></div>
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
          <div className="trademark-result-brand"><BrandLogo /><strong><span className="brand-mark-accent">GenMark AI</span></strong></div>
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
        <section className="logo-result-content">
          <h1 id="logo-result-title">로고 생성이 완료되었어요.</h1>
          <section className="logo-candidate-panel" aria-label="로고 후보 미리보기">
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
          {(() => {
            const displayValue = (value: string | undefined, fallback = '입력하지 않음') => value?.trim() || fallback
            const selectedToneLabel = toneMode === 'direct'
              ? displayValue(directTone)
              : toneOptions.find((option) => option.id === toneSelection)?.label ?? displayValue(toneSelection ?? undefined)
            const selectedLogoStyle = logoStyleOptions.find((option) => option.id === logoStyle)?.label ?? '선택하지 않음'
            const selectedBrandValues = coreValues.length > 0
              ? coreValues.map((value) => coreValueLabels[value] ?? value).join(', ')
              : displayValue(brandValueDescription)
            const summaryRows = brandKind === 'ci'
              ? [
                  { key: 'company-name', label: '회사명', value: displayValue(companyName), icon: 'name' },
                  { key: 'company-motto', label: '회사 모토', value: displayValue(companyMotto), icon: 'value' },
                  { key: 'mood', label: '원하는 분위기', value: selectedToneLabel, icon: 'mood' },
                ]
              : [
                  { key: 'brand-name', label: '브랜드명', value: displayValue(brandName), icon: 'name' },
                  { key: 'audience', label: '주요 고객', value: displayValue(targetAgeOptions.find((option) => option.id === targetAge)?.label), icon: 'audience' },
                  { key: 'value', label: '핵심 가치', value: selectedBrandValues, icon: 'value' },
                  { key: 'mood', label: '분위기', value: selectedToneLabel, icon: 'mood' },
                ]

            return (
              <section className="logo-result-details result-summary-details" aria-label="로고 생성 조건">
                {summaryRows.map((row) => {
                  const SummaryIcon = finalSummaryIconMap[row.icon] ?? Shapes
                  return (
                    <div className="logo-result-detail-row" key={row.key}>
                      <span className="result-detail-icon" aria-hidden="true"><SummaryIcon size={22} strokeWidth={1.8} /></span>
                      <strong>{row.label}</strong>
                      <span>{row.value}</span>
                    </div>
                  )
                })}
                <div className="logo-result-detail-row">
                  <span className="result-detail-icon" aria-hidden="true"><Palette size={22} strokeWidth={1.8} /></span>
                  <strong>선호 색상</strong>
                  <span className="result-color-swatches" aria-label="선호 색상 1개">
                    {getSelectedColors().map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
                  </span>
                </div>
                <div className="logo-result-detail-row">
                  <span className="result-detail-icon" aria-hidden="true"><TypeIcon size={22} strokeWidth={1.8} /></span>
                  <strong>로고 타입</strong>
                  <span>{selectedLogoStyle}{logoStyle === 'combination' && <em>추천</em>}</span>
                </div>
                <div className="logo-result-detail-row">
                  <span className="result-detail-icon" aria-hidden="true"><Shapes size={22} strokeWidth={1.8} /></span>
                  <strong>원하는 로고 모양</strong>
                  <span>{displayValue(logoShapePrompt)}</span>
                </div>
              </section>
            )
          })()}

          <section className={trademarkAnalysisCompleted ? 'logo-result-trademark analyzed' : 'logo-result-trademark'} aria-label="상표 이미지 유사도">
            <span className="trademark-result-icon" aria-hidden="true"><Search size={44} strokeWidth={1.8} /></span>
            {trademarkAnalysisCompleted ? (
              <div><strong>상표 이미지 유사도 분석 완료</strong><p>가장 높은 유사도는 {trademarkSimilarity ?? TRADEMARK_SCORE_FALLBACK}점으로, 현재 <b>{trademarkRiskLabel || '낮은 유사도'}</b> 범위예요.</p><button type="button" onClick={() => setMode('trademark-result')}>유사도 분석 결과 보기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
            ) : !canAnalyzeTrademark ? (
              <div><strong>상표 이미지 유사도</strong><p>선택한 로고 스타일은 이미지 유사도 분석을 지원하지 않아요.</p></div>
            ) : trademarkAnalysisSkipped ? (
              <div><strong>상표 이미지 유사도</strong><p>이전 단계에서 유사도 분석을 건너뛰었어요.</p></div>
            ) : (
              <div><strong>상표 이미지 유사도</strong><p>아직 상표 이미지 유사도를 확인하지 않았어요.</p><button type="button" onClick={() => { setTrademarkAnalysisSkipped(false); setTrademarkAnalysisRequested(true); void startTrademarkAnalysis() }}>비슷한 상표 이미지 확인하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button></div>
            )}
          </section>
          {analysisError && <p className="project-error" role="alert">{analysisError}</p>}

          <div className="logo-result-actions">
            <button className="logo-result-edit" type="button" onClick={() => { setEditorTestMode(false); setMode('edit') }}><Pencil aria-hidden="true" size={23} strokeWidth={1.8} />로고 수정<ChevronRight aria-hidden="true" size={25} strokeWidth={1.8} /></button>
          </div>

          <div className="logo-result-utility-grid">
            <button className="utility-primary" type="button" onClick={startRegeneration}><RefreshCw className="result-utility-icon" aria-hidden="true" size={22} strokeWidth={1.8} />로고 재생성<ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
            <button className="utility-secondary" type="button" onClick={openBrandKitSelection}><ImageIcon className="result-utility-icon" aria-hidden="true" size={22} strokeWidth={1.8} />{brandKit?.status === 'SUCCEEDED' ? '브랜드 키트 확인하기' : '브랜드 키트 만들기'}<ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
          </div>
          {brandKit && <p className="project-error" role="status">브랜드 키트 상태: {brandKit.status === 'QUEUED' || brandKit.status === 'RUNNING' ? '생성 중' : brandKit.status === 'SUCCEEDED' ? '완료' : '실패'}</p>}
          {brandKitError && <p className="project-error" role="alert">{brandKitError}</p>}
        </section>
      </main>
    )
  }

  const renderBrandKitSelectionScreen = () => {
    const options: Array<{ type: BrandKit['kitType']; title: string; caption: string; description: string; image: string }> = [
      { type: 'BUSINESS_CARD', title: '명함', caption: '첫 인사를 더 또렷하게', description: '기업의 인상을 담은 명함 앞·뒷면 시안을 만들어요.', image: '/brand-kit-examples/zenith.png' },
      { type: 'THUMBNAIL', title: '제품 썸네일', caption: '제품을 한눈에 보여주기', description: '상품 페이지와 SNS에 쓸 썸네일 시안을 만들어요.', image: '/brand-kit-examples/solen.png' },
    ]
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
            <h1 id="brand-kit-selection-title">
              {completedBrandKit
                ? completedBrandKit.kitType === 'BUSINESS_CARD'
                  ? <>완성된 명함을<br />확인해 보세요.</>
                  : <>완성된 썸네일을<br />확인해 보세요.</>
                : <>로고를 어디에<br />먼저 써볼까요<span className="brand-kit-title-question">?</span></>}
            </h1>
          </header>

          {completedBrandKit && brandKitImageUrls.length > 0 ? (
            <section className={completedBrandKit.kitType === 'BUSINESS_CARD' ? 'brand-kit-result-preview business-card-result-preview' : 'brand-kit-result-preview'} aria-labelledby="brand-kit-result-title">
              <div className={completedBrandKit.kitType === 'BUSINESS_CARD' ? 'brand-kit-result-images business-card-result-images' : 'brand-kit-result-images'}>
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
                      <button className="brand-kit-result-image-button" type="button" aria-label={`${sideLabel} 이미지 크게 보기`} onClick={() => setBrandKitPreview({ imageUrls: [imageUrl], label: sideLabel })}>
                        <img src={imageUrl} alt={`완성된 ${completedBrandKit.kitType === 'BUSINESS_CARD' ? `명함 ${sideLabel}` : '제품 썸네일'} 브랜드 키트`} />
                        <span className="brand-kit-result-image-zoom" aria-hidden="true"><ImageIcon size={16} strokeWidth={2} /> 크게 보기</span>
                      </button>
                    </figure>
                  )
                })}
              </div>
              <div className="brand-kit-result-copy">
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
                    {brandKitDownloading ? '묶는 중…' : 'PNG·SVG·PDF 한 번에 받기'}
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
                    <span className="brand-kit-choice-visual" aria-hidden="true"><img className="brand-kit-choice-image" src={option.image} alt="" /></span>
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
              <button className="brand-kit-create-button secondary" type="button" onClick={() => { setBrandKit(null); setBrandKitType(null) }}>
                새 시안 만들기
                <ChevronRight aria-hidden="true" size={23} strokeWidth={1.9} />
              </button>
            ) : (
              <button className="brand-kit-create-button" type="button" disabled={!brandKitType || brandKitCreating} aria-busy={brandKitCreating} onClick={createSelectedBrandKit}>
                {brandKitCreating ? '만드는 중...' : selectedOption ? `${selectedOption.title} 키트 만들기` : '브랜드 키트 선택하기'}
                {!brandKitCreating && <ChevronRight aria-hidden="true" size={23} strokeWidth={1.9} />}
              </button>
            )}
            {brandKit && <p className="brand-kit-status" role="status">{brandKit.status === 'QUEUED' || brandKit.status === 'RUNNING' ? '브랜드 키트를 만들고 있어요.' : brandKit.status === 'SUCCEEDED' ? '브랜드 키트가 준비됐어요.' : '브랜드 키트 생성에 문제가 생겼어요.'}</p>}
            {brandKitError && <p className="brand-kit-error" role="alert">{brandKitError}</p>}
          </div>
        </section>
      </main>
    )
  }

  const renderMypageLogoActionModal = () => {
    if (!mypageLogoAction) return null
    const hasProjectContext = Boolean(mypageLogoAction.projectId && mypageLogoAction.candidateId && mypageLogoAction.projectType)
    const brandKitLabel = '브랜드킷 제작하기'
    return (
      <div
        ref={activeModalRef}
        className="modal-backdrop mypage-logo-action-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !mypageLogoActionLoading) {
            setMypageLogoAction(null)
            setMypageLogoActionError('')
          }
        }}
      >
        <section className="mypage-logo-action-modal" role="dialog" aria-modal="true" aria-labelledby="mypage-logo-action-title">
          <button
            className="modal-close"
            type="button"
            aria-label="로고 활용 메뉴 닫기"
            disabled={mypageLogoActionLoading}
            onClick={() => {
              setMypageLogoAction(null)
              setMypageLogoActionError('')
            }}
          >
            <X aria-hidden="true" size={21} strokeWidth={1.9} />
          </button>
          <div className="mypage-logo-action-preview">
            <img src={mypageLogoAction.imageUrl} alt={`${mypageLogoAction.title} 미리보기`} />
          </div>
          <div className="mypage-logo-action-copy">
            <h2 id="mypage-logo-action-title">{mypageLogoAction.title} 활용하기</h2>
            <p>저장해 둔 로고에서 필요한 작업을 바로 이어갈 수 있어요.</p>
          </div>
          <div className="mypage-logo-action-list">
            <button className="mypage-logo-action-primary" type="button" disabled={mypageLogoActionLoading || !hasProjectContext} onClick={() => void navigateFromMypageLogo('brand-kit')}>
              <span><ImageIcon aria-hidden="true" size={21} strokeWidth={1.8} /><b>{brandKitLabel}</b></span>
              <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
            </button>
            <button type="button" disabled={mypageLogoActionLoading || !hasProjectContext} onClick={() => void navigateFromMypageLogo('trademark')}>
              <span><ShieldCheck aria-hidden="true" size={21} strokeWidth={1.8} /><b>유사도 검사하러 가기</b></span>
              <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
            </button>
            <button type="button" disabled={mypageLogoActionLoading || !hasProjectContext} onClick={() => void navigateFromMypageLogo('result')}>
              <span><ArrowRight aria-hidden="true" size={21} strokeWidth={1.8} /><b>로고 결과 다시 보기</b></span>
              <ChevronRight aria-hidden="true" size={20} strokeWidth={2} />
            </button>
          </div>
          {!hasProjectContext ? <p className="mypage-logo-action-status" role="status">이 로고의 프로젝트 연결 정보를 찾지 못했어요.</p> : null}
          {mypageLogoActionLoading ? <p className="mypage-logo-action-status" role="status">로고 프로젝트를 불러오고 있어요…</p> : null}
          {mypageLogoActionError ? <p className="mypage-logo-action-error" role="alert">{mypageLogoActionError}</p> : null}
        </section>
      </div>
    )
  }

  const renderAssetDeleteModal = () => {
    if (!assetDeleteTarget) return null
    return (
      <div
        ref={activeModalRef}
        className="modal-backdrop asset-delete-backdrop"
        role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget) closeAssetDeleteModal() }}
      >
        <section className="credit-modal asset-delete-modal" role="dialog" aria-modal="true" aria-labelledby="asset-delete-title">
          <button className="modal-close" type="button" aria-label="삭제 취소" disabled={assetDeleteLoading} onClick={closeAssetDeleteModal}>
            <X aria-hidden="true" size={22} strokeWidth={1.9} />
          </button>
          <div className="asset-delete-icon" aria-hidden="true"><Trash2 size={27} strokeWidth={1.8} /></div>
          <h2 id="asset-delete-title">이 자산을 삭제할까요?</h2>
          <p><strong>{assetDeleteTarget.title}</strong>을(를) 내 자산 목록에서 삭제합니다.</p>
          <p>삭제한 자산은 목록에서 다시 복구할 수 없어요.</p>
          {assetDeleteError && <p className="project-error" role="alert">{assetDeleteError}</p>}
          <div className="asset-delete-actions">
            <button className="gradient-button asset-delete-confirm" type="button" disabled={assetDeleteLoading} onClick={() => void deleteMypageAsset()}>
              {assetDeleteLoading ? '삭제 중…' : '삭제하기'}
            </button>
            <button className="modal-secondary-button" type="button" disabled={assetDeleteLoading} onClick={closeAssetDeleteModal}>취소</button>
          </div>
        </section>
      </div>
    )
  }

  const renderBrandKitPreviewModal = () => {
    if (!brandKitPreview) return null
    return (
      <div
        ref={activeModalRef}
        className="modal-backdrop brand-kit-preview-backdrop"
        role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget) setBrandKitPreview(null) }}
      >
        <section className="brand-kit-preview-modal" role="dialog" aria-modal="true" aria-labelledby="brand-kit-preview-title">
          <header className="brand-kit-preview-modal-header">
            <div>
              <span>브랜드 키트 미리보기</span>
              <h2 id="brand-kit-preview-title">{brandKitPreview.label}</h2>
            </div>
            <button className="brand-kit-preview-close" type="button" aria-label="미리보기 닫기" onClick={() => setBrandKitPreview(null)}>
              <X aria-hidden="true" size={22} strokeWidth={1.9} />
            </button>
          </header>
          <div className={brandKitPreview.imageUrls.length > 1 ? 'brand-kit-preview-stage is-gallery' : 'brand-kit-preview-stage'}>
            {brandKitPreview.imageUrls.map((imageUrl, index) => (
              <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`확대된 ${brandKitPreview.label}${brandKitPreview.imageUrls.length > 1 ? ` ${index === 0 ? '앞면' : '뒷면'}` : ''} 브랜드 키트`} />
            ))}
          </div>
        </section>
      </div>
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
    const handleEditorSvgClick = (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = (event.target as Element).closest('[data-genmark-editor-element]')
      const targetId = target?.getAttribute('data-genmark-editor-element')
      selectEditorTarget(targetId ?? '')
    }

    const getEditorSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
      const matrix = svg.getScreenCTM()
      if (!matrix) return null
      const point = svg.createSVGPoint()
      point.x = clientX
      point.y = clientY
      return point.matrixTransform(matrix.inverse())
    }

    const handleEditorSvgPointerDown = (event: PointerEvent<HTMLDivElement>) => {
      const target = (event.target as Element).closest('[data-genmark-editor-element]')
      const targetId = target?.getAttribute('data-genmark-editor-element')
      if (!targetId) return

      const svg = event.currentTarget.querySelector<SVGSVGElement>('svg')
      const startPoint = svg ? getEditorSvgPoint(svg, event.clientX, event.clientY) : null
      if (!startPoint) return

      const draft = targetId === editTarget
        ? { offsetX: editorOffsetX, offsetY: editorOffsetY }
        : (editorDrafts[targetId] ?? createEditorDraft(editorColor))
      selectEditorTarget(targetId)
      editorDragRef.current = {
        pointerId: event.pointerId,
        target: targetId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startSvgX: startPoint.x,
        startSvgY: startPoint.y,
        startOffsetX: draft.offsetX,
        startOffsetY: draft.offsetY,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    }

    const handleEditorSvgPointerMove = (event: PointerEvent<HTMLDivElement>) => {
      const drag = editorDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const svg = event.currentTarget.querySelector<SVGSVGElement>('svg')
      const point = svg ? getEditorSvgPoint(svg, event.clientX, event.clientY) : null
      if (!point) return
      updateEditorOffsets(drag.startOffsetX + point.x - drag.startSvgX, drag.startOffsetY + point.y - drag.startSvgY)
    }

    const handleEditorSvgPointerUp = (event: PointerEvent<HTMLDivElement>) => {
      if (!editorDragRef.current || editorDragRef.current.pointerId !== event.pointerId) return
      editorDragRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const handleEditorCanvasKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        selectEditorTarget('')
        return
      }
      if (!editTarget || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      const step = event.shiftKey ? 10 : 2
      const nextX = editorOffsetX + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)
      const nextY = editorOffsetY + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)
      event.preventDefault()
      updateEditorOffsets(nextX, nextY)
    }

    const moveEditorCandidate = (offset: number) => {
      if (!showCandidateNavigation) return
      setResultCandidate((current) => (current + offset + candidates.length) % candidates.length)
    }

    const renderEditorColorControl = () => (
      <div className="editor-color-control">
        <div className="editor-color-row">
          <span>색상</span>
          <div className="editor-color-display">
            <i className="editor-color-display-swatch" style={{ background: editorColor }} aria-hidden="true" />
            <button
              className="editor-color-edit"
              type="button"
              disabled={!editTarget}
              aria-label="색상 편집"
              aria-expanded={editorColorPickerOpen}
              aria-controls="editor-color-picker"
              onClick={() => setEditorColorPickerOpen((current) => !current)}
            >
              <PenLine aria-hidden="true" size={13} strokeWidth={2} /> Edit
            </button>
          </div>
        </div>
        {editorColorPickerOpen && (
          <div className="editor-color-picker tone-color-picker tone-color-picker-inline" id="editor-color-picker" role="group" aria-label="로고 요소 색상 팔레트">
            <ToneColorPalette
              value={hexToRgb(editorColor)}
              onChange={(color) => {
                const nextColor = rgbToHex(color)
                setEditorColor(nextColor)
                setEditorColorChanged(true)
                updateCurrentEditorDraft({ color: nextColor, colorChanged: true })
                markEditorDirty()
              }}
              onComplete={() => setEditorColorPickerOpen(false)}
              ariaLabel={`${editTarget ? '선택한 요소' : '로고 요소'} 색상 팔레트`}
            />
            <div className="editor-color-picker-footer">
              <span>원하는 색상을 자유롭게 선택할 수 있어요.</span>
              <button type="button" onClick={() => {
                const baseColor = projectColors[0] ?? '#7B5CDF'
                setEditorColor(baseColor)
                setEditorColorChanged(false)
                updateCurrentEditorDraft({ color: baseColor, colorChanged: false })
                markEditorDirty()
              }}>초기화</button>
            </div>
          </div>
        )}
      </div>
    )

    return (
      <main className="logo-editor-screen" aria-labelledby="logo-editor-title">
        <header className="logo-editor-header">
          <button className="logo-editor-back" type="button" aria-label="결과 화면으로 돌아가기" onClick={() => setMode('result')}><ChevronLeft aria-hidden="true" size={24} strokeWidth={1.8} /></button>
          <div className="logo-editor-brand"><BrandLogo /><strong><span className="brand-mark-accent">GenMark AI</span></strong></div>
          <button className="logo-editor-save" type="button" disabled={editorLoading || editorSaving || !editorSvgSource} onClick={() => void saveEditorChanges()}>{editorSaving ? '저장 중' : editorSaved ? '저장됨' : '저장'}<ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} /></button>
        </header>

        <section className="logo-editor-content">
          <section className="logo-editor-preview-card" aria-label="로고 편집 캔버스">
            <div className="logo-editor-artboard">
              <div className="editor-uploaded-logo-target" role="button" tabIndex={0} aria-label="수정할 로고 요소 선택" aria-describedby="editor-move-help" onClick={(event) => { if (event.target === event.currentTarget) selectEditorTarget(''); else handleEditorSvgClick(event) }} onKeyDown={handleEditorCanvasKeyDown}>
                <span className="editor-safe-area-guide" aria-hidden="true" />
                {editorSvgPreviewSource ? <div className="editor-uploaded-logo-svg" aria-label="SVG 로고 편집 미리보기" onClick={handleEditorSvgClick} onPointerDown={handleEditorSvgPointerDown} onPointerMove={handleEditorSvgPointerMove} onPointerUp={handleEditorSvgPointerUp} onPointerCancel={handleEditorSvgPointerUp} dangerouslySetInnerHTML={{ __html: editorSvgPreviewSource }} /> : <img className="editor-uploaded-logo" src={editorImageUrl} alt="선택한 AI 생성 로고" style={editorSvgPreviewUrl ? { objectFit: 'contain' } : { objectFit: 'contain', transform: `scale(${editorScale / 100}) rotate(${editorRotation}deg)`, opacity: editorOpacity / 100 }} />}
              </div>
              <p id="editor-move-help" className="editor-move-hint">요소를 선택한 뒤 드래그하거나 방향키로 이동할 수 있어요.</p>
            </div>
          </section>

          <section className="logo-editor-panel" aria-labelledby="logo-editor-title">
            <h1 id="logo-editor-title" className="sr-only">로고 수정</h1>
            <div className="editor-control-section element-controls">
              <div className="editor-control-heading"><strong>{editTarget ? '선택한 요소 설정' : '요소를 선택해 주세요'}</strong><button type="button" aria-label="선택한 요소 설정 초기화" disabled={!editTarget} onClick={resetEditorControls}><RefreshCw aria-hidden="true" size={14} strokeWidth={2} />초기화</button></div>
              <label className="editor-slider-row"><span>크기</span><input disabled={!editTarget} type="range" min="70" max="140" value={editorScale} onChange={(event) => { const value = Number(event.target.value); setEditorScale(value); updateCurrentEditorDraft({ scale: value }); markEditorDirty() }} /></label>
              <label className="editor-slider-row"><span>회전</span><input disabled={!editTarget} type="range" min="-180" max="180" value={editorRotation} onChange={(event) => { const value = Number(event.target.value); setEditorRotation(value); updateCurrentEditorDraft({ rotation: value }); markEditorDirty() }} /></label>
              <label className="editor-slider-row"><span>투명도</span><input disabled={!editTarget} type="range" min="30" max="100" value={editorOpacity} onChange={(event) => { const value = Number(event.target.value); setEditorOpacity(value); updateCurrentEditorDraft({ opacity: value }); markEditorDirty() }} /></label>
              {renderEditorColorControl()}
            </div>
          </section>

          <div className="logo-editor-actions">
            <button className="logo-editor-apply" type="button" disabled={editorLoading || editorSaving || !editorSvgSource} onClick={() => void saveEditorChanges().then((saved) => { if (saved && !EDITOR_TEST_MODE) setMode('result') })}>{editorSaving ? '저장 중...' : '적용하기'}</button>
          </div>
          {editorLoading && <p className="project-error" role="status">SVG 로고를 불러오고 있어요.</p>}
          {editorError && <p className="project-error" role="alert">{editorError}</p>}
          <p className="logo-editor-note">· 로고의 형태나 배치를 변경하면 상표 이미지 유사도에 영향을 줄 수 있어요.</p>
        </section>
      </main>
    )
  }

  const openAssetDeleteConfirm = (item: MypageAssetItem) => {
    setAssetDeleteError('')
    setAssetDeleteTarget(item)
  }

  const closeAssetDeleteModal = () => {
    if (assetDeleteLoading) return
    setAssetDeleteTarget(null)
    setAssetDeleteError('')
  }

  const deleteMypageAsset = async () => {
    const target = assetDeleteTarget
    if (!target || assetDeleteLoading) return

    let assetMutationCommitted = false
    const markAssetMutationCommitted = () => {
      if (assetMutationCommitted) return
      assetMutationCommitted = true
      // A response captured before this mutation must never restore the old item.
      mypageAssetLoadEpochRef.current += 1
    }
    setAssetDeleteLoading(true)
    setAssetDeleteError('')
    try {
      const useMypageMock = MYPAGE_MOCK_MODE && !authRestoring && !loggedIn
      if (useMypageMock) {
        markAssetMutationCommitted()
        setMockDeletedAssetIds((current) => current.includes(target.id) ? current : [...current, target.id])
      } else if (target.brandKit) {
        if (!target.projectId || !target.candidateId) throw new Error('브랜드 키트의 연결 정보를 찾지 못했어요.')
        await projectsApi.deleteBrandKit(target.projectId, target.candidateId, target.brandKit.id)
        markAssetMutationCommitted()
        setBrandKitHistory((current) => current.filter((kit) => kit.id !== target.brandKit?.id))
        setBrandKit((current) => current?.id === target.brandKit?.id ? null : current)
      } else if (target.kind === 'logo' && target.projectId && target.candidateId) {
        await meApi.hideLogoFromMypage(target.candidateId)
        markAssetMutationCommitted()
        setHiddenMypageLogoCandidateIds((current) => current.includes(target.candidateId as string) ? current : [...current, target.candidateId as string])
        if (target.downloadId != null) {
          await meApi.deleteDownload(target.downloadId)
          setDownloadHistory((current) => current.filter((item) => item.downloadId !== target.downloadId))
          setMypageDownloadImageUrls((current) => {
            const next = { ...current }
            delete next[target.id]
            return next
          })
        }
        setMypageGeneratedLogoCandidates((current) => {
          const next = { ...current }
          delete next[target.candidateId as string]
          return next
        })
      } else if (target.downloadId != null) {
        await meApi.deleteDownload(target.downloadId)
        markAssetMutationCommitted()
        setDownloadHistory((current) => current.filter((item) => item.downloadId !== target.downloadId))
        setMypageDownloadImageUrls((current) => {
          const next = { ...current }
          delete next[target.id]
          return next
        })
      } else {
        throw new Error('삭제할 수 있는 저장 자산이 아니에요.')
      }
      setAssetDeleteTarget(null)
    } catch (error) {
      setAssetDeleteError(error instanceof Error ? error.message : '자산을 삭제하지 못했어요.')
    } finally {
      // Re-read every resource after a committed mutation. This also fills in
      // resources whose first request was still pending when deletion started.
      if (assetMutationCommitted) setMypageAssetRefreshVersion((current) => current + 1)
      setAssetDeleteLoading(false)
    }
  }

  const renderMypageScreen = () => {
    if (!MYPAGE_MOCK_MODE && !authRestoring && !loggedIn) {
      const goToLogin = () => { setLoginDestination('mypage'); setLoginReturnMode('home'); setMode('login') }
      return (
        <main className="mypage-screen" aria-labelledby="mypage-title">
          <header className="main-header">
            <a className="main-brand" href="#home" aria-label="GenMark AI 홈" onClick={() => setMode('home')}>
              <BrandLogo />
              <span><span className="brand-mark-accent">GenMark AI</span></span>
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
    const todayDateKey = getLocalDateKey()
    const displayUserName = useMypageMock ? '김명은' : authUser?.name?.trim() || '사용자'
    const displayEmail = useMypageMock ? '연결된 이메일 정보가 없어요. tkss1217@gmail.com' : authUser?.email?.trim() || '연결된 이메일 정보가 없어요.'
    const displayCompanyName = useMypageMock ? '육하원칙' : companyName.trim() || '아직 입력된 회사명이 없어요.'
    const displayCompanyMotto = useMypageMock ? '브랜드 프로젝트를 위한 회사 모토를 입력해보세요.' : companyMotto.trim() || '브랜드 프로젝트에서 회사 모토를 입력해보세요.'
    const mockAssetGroups: MypageAssetGroup[] = [
      {
        dateKey: '2026-08-18',
        label: '2026. 08. 18.',
        isToday: '2026-08-18' === todayDateKey,
        items: [
          { id: 'mock-asset-logo', kind: 'logo', title: '육하원칙 CI 로고', subtitle: '로고 선택 완료 · 오후 1:41', imageUrl: '/mypage/mock-completed-brand.png', projectId: 'mock-ci-project', candidateId: 'mock-ci-candidate', projectType: 'CI', dateKey: '2026-08-18' },
          { id: 'mock-asset-card', kind: 'business-card', title: '명함', subtitle: '육하원칙 브랜드킷 · 앞·뒷면', imageUrl: '/business-card-gallery/morvan.png', imageUrls: ['/business-card-gallery/morvan.png', '/business-card-gallery/eloris.png'], dateKey: '2026-08-18' },
          { id: 'mock-asset-thumbnail', kind: 'thumbnail', title: '제품 썸네일', subtitle: '육하원칙 브랜드킷 · 제품 이미지', imageUrl: '/mypage/mock-brand-kit/aurelis.png', dateKey: '2026-08-18' },
        ],
      },
      {
        dateKey: '2026-08-14',
        label: '2026. 08. 14.',
        items: [
          { id: 'mock-asset-noirel', kind: 'thumbnail', title: '제품 썸네일', subtitle: 'NOIRÉL 브랜드킷', imageUrl: '/mypage/mock-brand-kit/noirel.png', dateKey: '2026-08-14' },
          { id: 'mock-asset-citrea', kind: 'thumbnail', title: '제품 썸네일', subtitle: 'CITRÉA 브랜드킷', imageUrl: '/mypage/mock-brand-kit/citrea.png', dateKey: '2026-08-14' },
        ],
      },
    ]
    const downloadedCandidateIds = new Set(downloadHistory.map((item) => item.candidateId))
    const generatedLogoAssets: MypageAssetItem[] = Object.values(mypageGeneratedLogoCandidates)
      .filter((candidate) => candidate.storageKey && !hiddenMypageLogoCandidateIds.includes(candidate.id) && !downloadedCandidateIds.has(candidate.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((candidate) => {
        const projectLabel = candidate.projectType
        const imageUrl = getLogoCandidateImageUrl(candidate.storageKey)
        return {
          id: `generated-logo-${candidate.id}`,
          kind: 'logo',
          title: `${projectLabel} 로고`,
          subtitle: `${new Date(candidate.createdAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })} 생성`,
          imageUrl,
          imageUrls: [imageUrl],
          projectId: candidate.projectId,
          candidateId: candidate.id,
          projectType: candidate.projectType,
          dateKey: getLocalDateKey(candidate.createdAt),
        }
      })
    const actualAssetItems: MypageAssetItem[] = [
      ...downloadHistory.map((item) => {
        const dateKey = getLocalDateKey(item.downloadedAt)
        return {
          id: `download-${item.downloadId}`,
          kind: 'logo' as const,
          title: `${item.projectType} 로고`,
          subtitle: `${new Date(item.downloadedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })} 저장`,
          imageUrl: item.imageUrl,
          projectId: item.projectId,
          candidateId: item.candidateId,
          projectType: item.projectType,
          downloadId: item.downloadId,
          dateKey,
        }
      }),
      ...generatedLogoAssets,
      ...brandKitHistory.flatMap((kit): MypageAssetItem[] => {
        if (kit.status !== 'SUCCEEDED' || !kit.createdAt) return []
        const storageKeys = (kit.storageKeys?.length ? kit.storageKeys : kit.storageKey ? [kit.storageKey] : []).filter(Boolean)
        const dateKey = getLocalDateKey(kit.createdAt)
        const imageUrls = storageKeys.slice(0, kit.kitType === 'BUSINESS_CARD' ? 2 : 1).map(getLogoCandidateImageUrl)
        if (imageUrls.length === 0) return []
        if (kit.kitType === 'BUSINESS_CARD') {
          return [{
            id: `brand-kit-${kit.id}`,
            kind: 'business-card' as const,
            title: '명함',
            subtitle: `${new Date(kit.createdAt as string).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })} 생성 · 앞·뒷면`,
            imageUrl: imageUrls[0],
            imageUrls,
            brandKit: kit,
            projectId: kit.projectId,
            candidateId: kit.candidateId,
            projectType: kit.kitType === 'BUSINESS_CARD' ? 'CI' : 'BI',
            dateKey,
          }]
        }
        return [{
          id: `brand-kit-${kit.id}`,
          kind: 'thumbnail' as const,
          title: '제품 썸네일',
          subtitle: `${new Date(kit.createdAt as string).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })} 생성`,
          imageUrl: imageUrls[0],
          imageUrls,
          brandKit: kit,
          projectId: kit.projectId,
          candidateId: kit.candidateId,
          projectType: 'BI',
          dateKey,
        }]
      }),
    ]
    const actualAssetGroups = actualAssetItems.reduce<MypageAssetGroup[]>((groups, asset) => {
      const group = groups.find((entry) => entry.dateKey === asset.dateKey)
      if (group) group.items.push(asset)
      else groups.push({ dateKey: asset.dateKey, label: `${asset.dateKey.slice(0, 4)}. ${asset.dateKey.slice(5, 7)}. ${asset.dateKey.slice(8, 10)}.`, items: [asset] })
      return groups
    }, []).sort((a, b) => b.dateKey.localeCompare(a.dateKey)).map((group) => ({ ...group, isToday: group.dateKey === todayDateKey }))
    const assetGroups = useMypageMock
      ? mockAssetGroups
        .map((group) => ({ ...group, items: group.items.filter((item) => !mockDeletedAssetIds.includes(item.id)) }))
        .filter((group) => group.items.length > 0)
      : actualAssetGroups
    const assetKindLabel: Record<MypageAssetKind, string> = { logo: '로고', 'business-card': '명함', thumbnail: '썸네일' }
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
    const resolveMypageAssetImageUrls = (item: MypageAssetItem) => {
      const sourceUrls = item.imageUrls?.length ? item.imageUrls : [item.imageUrl]
      if (!useMypageMock && item.kind === 'logo' && !sourceUrls[0]?.startsWith('/uploads/') && !sourceUrls[0]?.startsWith('/mypage/')) {
        const protectedImageUrl = mypageDownloadImageUrls[item.id]
        return protectedImageUrl ? [protectedImageUrl] : []
      }
      return sourceUrls.filter(Boolean)
    }
    const downloadMypageLogoSvg = async (item: MypageAssetItem) => {
      if (item.kind !== 'logo' || !item.projectId || !item.candidateId) return false
      const candidate = mypageGeneratedLogoCandidates[item.candidateId]
        ?? await projectsApi.getCandidate(item.projectId, item.candidateId)
      if (!candidate.svgUrl) return false

      const svg = await projectsApi.getCandidateSvg(candidate.svgUrl)
      const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${item.title.replace(/[^\w가-힣-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'genmark-logo'}.svg`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
      return true
    }
    const downloadMypageAsset = async (item: MypageAssetItem) => {
      if (item.brandKit) {
        setProjectError('')
        await downloadBrandKitArchive(item.brandKit, (message) => setProjectError(message))
        return
      }
      try {
        if (await downloadMypageLogoSvg(item)) return
        const isPublicAsset = item.imageUrl.startsWith('/uploads/') || item.imageUrl.startsWith('/mypage/')
        if (isPublicAsset) {
          const link = document.createElement('a')
          link.href = item.imageUrl
          link.download = `genmark-${item.kind}-${item.id}.png`
          document.body.appendChild(link)
          link.click()
          link.remove()
          return
        }
        const blob = await downloadAuthenticatedFile(item.imageUrl)
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `genmark-${item.kind}-${item.id}.png`
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
          <div className="workspace-brand"><BrandLogo /><strong><span className="brand-mark-accent">GenMark AI</span></strong></div>
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

          <section className="mypage-section asset-library-section" aria-labelledby="asset-library-title">
            <div className="section-title-row asset-library-heading">
              <div><h2 id="asset-library-title">내 자산 목록</h2></div>
              <FolderCheck aria-hidden="true" size={27} strokeWidth={1.8} />
            </div>
            <div className="asset-date-list">
              {assetGroups.length > 0 ? assetGroups.map((group) => {
                const isOpen = openMypageAssetDate === group.dateKey
                return (
                  <div className={isOpen ? 'asset-date-group is-open' : 'asset-date-group'} key={group.dateKey}>
                    <button className="asset-date-toggle" type="button" aria-expanded={isOpen} aria-controls={`asset-items-${group.dateKey}`} onClick={() => setOpenMypageAssetDate(isOpen ? '' : group.dateKey)}>
                      <span><time dateTime={group.dateKey}>{group.label}</time>{group.isToday && <em>오늘</em>}</span>
                      <ChevronDown className="asset-date-chevron" aria-hidden="true" size={21} strokeWidth={1.8} />
                    </button>
                    {isOpen && (
                      <div className="asset-item-list" id={`asset-items-${group.dateKey}`}>
                        {group.items.map((item) => (
                          <article className={item.kind === 'business-card' ? 'asset-item asset-item-business-card' : 'asset-item'} key={item.id}>
                            {(() => {
                              const imageUrls = resolveMypageAssetImageUrls(item)
                              const imageUrl = imageUrls[0] ?? ''
                              const isComposite = imageUrls.length > 1
                              return (
                                isComposite && item.kind === 'business-card' ? (
                                  <div className="asset-item-business-card-faces" aria-label="명함 앞면과 뒷면 미리보기">
                                    {imageUrls.map((previewUrl, index) => (
                                      <button className="asset-item-business-card-face" type="button" key={`${previewUrl}-${index}`} aria-label={`명함 ${index === 0 ? '앞면' : '뒷면'} 크게 보기`} onClick={() => setBrandKitPreview({ imageUrls, label: item.title })}>
                                        <img src={previewUrl} alt={`명함 ${index === 0 ? '앞면' : '뒷면'} 미리보기`} onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.closest('.asset-item-business-card-face')?.classList.add('is-missing') }} />
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <div className={imageUrl ? `asset-item-thumb asset-item-thumb-${item.kind}` : `asset-item-thumb asset-item-thumb-${item.kind} is-missing`}>
                                    {imageUrl ? (
                                      <button className="asset-item-thumb-button" type="button" aria-label={`${item.title} 크게 보기`} onClick={() => setBrandKitPreview({ imageUrls, label: item.title })}>
                                        <img src={imageUrl} alt={`${item.title} 미리보기`} onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.closest('.asset-item-thumb')?.classList.add('is-missing') }} />
                                      </button>
                                    ) : <ImageIcon aria-hidden="true" size={22} strokeWidth={1.7} />}
                                  </div>
                                )
                              )
                            })()}
                            <div className="asset-item-copy">
                              <span className={`asset-kind asset-kind-${item.kind}`}>{assetKindLabel[item.kind]}</span>
                              <strong>{item.title}</strong>
                              <p>{item.subtitle}</p>
                              {item.kind === 'logo' ? (
                                <button className="asset-logo-use-button" type="button" onClick={() => openMypageLogoAction({ ...item, imageUrl: resolveMypageAssetImageUrls(item)[0] ?? item.imageUrl })}>
                                  <Sparkles aria-hidden="true" size={14} strokeWidth={2} />
                                  로고 활용하기
                                  <ChevronRight aria-hidden="true" size={14} strokeWidth={2} />
                                </button>
                              ) : null}
                            </div>
                            <div className="asset-item-actions">
                              <button className="asset-download-button" type="button" aria-label={`${item.title} 다운로드`} onClick={() => void downloadMypageAsset(item)}><Download aria-hidden="true" size={19} strokeWidth={1.9} /></button>
                              <button className="asset-delete-button" type="button" aria-label={`${item.title} 삭제`} onClick={() => openAssetDeleteConfirm(item)}><Trash2 aria-hidden="true" size={18} strokeWidth={1.9} /></button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }) : <div className="mypage-inline-empty"><FolderCheck size={22} strokeWidth={1.6} /><span>아직 저장된 자산이 없어요.</span></div>}
            </div>
          </section>

          {mypageAssetError && <p className="project-error mypage-project-error" role="alert">{mypageAssetError}</p>}
          {projectError && <p className="project-error mypage-project-error" role="alert">{projectError}</p>}
        </section>
      </main>
    )
  }

  const renderSurveyScreen = () => {
    return (
      <main className="survey-screen" aria-labelledby="survey-title">
        <header className="workspace-header">
          <button className="workspace-back" type="button" aria-label="마이페이지로 돌아가기" onClick={() => setMode('mypage')}><ChevronLeft aria-hidden="true" size={23} strokeWidth={1.8} /></button>
          <div className="workspace-brand"><BrandLogo /><strong><span className="brand-mark-accent">GenMark AI</span></strong></div>
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

  const renderFinalEditModal = () => {
    if (!finalEditModal) return null
    const title = finalEditModal === 'identity' ? '기본 정보를 수정하세요' : finalEditModal === 'values' ? '핵심 가치를 수정하세요' : finalEditModal === 'tone' ? '분위기를 수정하세요' : finalEditModal === 'color' ? '색상을 수정하세요' : finalEditModal === 'style' ? '로고 타입을 수정하세요' : '원하는 로고 모양을 수정하세요'
    return <div ref={activeModalRef} className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFinalEditModal(null) }}>
      <section className="credit-modal final-edit-modal" role="dialog" aria-modal="true" aria-labelledby="final-edit-title">
        <button className="modal-close" type="button" aria-label="수정 닫기" onClick={() => setFinalEditModal(null)}><X size={22} /></button>
        <h2 id="final-edit-title">{title}</h2>
        {finalEditModal === 'identity' && (brandKind === 'ci' ? <label>회사명<input autoFocus value={finalEditDraft.companyName} onChange={(event) => setFinalEditDraft((draft) => ({ ...draft, companyName: event.target.value }))} /></label> : <><label>브랜드명<input autoFocus value={finalEditDraft.brandName} onChange={(event) => setFinalEditDraft((draft) => ({ ...draft, brandName: event.target.value }))} /></label><label>주요 고객<select value={finalEditDraft.targetAge} onChange={(event) => setFinalEditDraft((draft) => ({ ...draft, targetAge: event.target.value }))}>{targetAgeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label></>)}
        {finalEditModal === 'values' && <label>{brandKind === 'ci' ? '회사 모토' : '핵심 가치'}<textarea autoFocus value={brandKind === 'ci' ? finalEditDraft.companyMotto : finalEditDraft.valuesText} onChange={(event) => setFinalEditDraft((draft) => brandKind === 'ci' ? { ...draft, companyMotto: event.target.value } : { ...draft, valuesText: event.target.value })} maxLength={300} /></label>}
        {finalEditModal === 'tone' && <div className="final-tone-editor">
          <div className="final-tone-mode-toggle" role="tablist" aria-label="분위기 입력 방식">
            <button
              type="button"
              role="tab"
              aria-selected={finalEditToneMode === 'recommended'}
              className={finalEditToneMode === 'recommended' ? 'active' : ''}
              onClick={() => {
                const tone = toneOptions.some((option) => option.id === finalEditDraft.tone)
                  ? finalEditDraft.tone as ToneOption
                  : toneSelection ?? toneOptions[0].id
                setFinalEditToneMode('recommended')
                setFinalEditDraft((draft) => ({ ...draft, tone, colors: [...getToneColors(tone)] }))
              }}
            >추천</button>
            <button
              type="button"
              role="tab"
              aria-selected={finalEditToneMode === 'direct'}
              className={finalEditToneMode === 'direct' ? 'active' : ''}
              onClick={() => {
                setFinalEditToneMode('direct')
                setFinalEditDraft((draft) => ({ ...draft, tone: toneMode === 'direct' ? directTone : '' }))
              }}
            >직접 입력</button>
          </div>
          {finalEditToneMode === 'recommended' ? (
            <label>분위기<select autoFocus value={finalEditDraft.tone} onChange={(event) => { const tone = event.target.value as ToneOption; setFinalEditDraft((draft) => ({ ...draft, tone, colors: [...getToneColors(tone)] })) }}>{toneOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          ) : (
            <label>분위기<input autoFocus type="text" value={finalEditDraft.tone} maxLength={100} placeholder="예: 차분하고 고급스러운, 대담하고 세련된" onChange={(event) => setFinalEditDraft((draft) => ({ ...draft, tone: event.target.value }))} /></label>
          )}
        </div>}
        {finalEditModal === 'color' && <div className="final-tone-color-field">
          <span>색상</span>
          <div className="final-edit-color-row">
            <label className="final-tone-color-control" aria-label="선택한 색상 수정">
              <span className="final-tone-color-swatch" style={{ background: finalEditDraft.colors[0] ?? '#9765e9' }} aria-hidden="true" />
              <span className="final-tone-color-edit"><Pencil aria-hidden="true" size={13} strokeWidth={2} /> Edit</span>
              <input
                type="color"
                value={finalEditDraft.colors[0] ?? '#9765e9'}
                aria-label="선택 색상"
                onChange={(event) => setFinalEditDraft((draft) => ({ ...draft, colors: [event.target.value] }))}
              />
            </label>
          </div>
        </div>}
        {finalEditModal === 'style' && <label>로고 타입<select autoFocus value={finalEditDraft.logoStyle} onChange={(event) => setFinalEditDraft((draft) => ({ ...draft, logoStyle: event.target.value as LogoStyle }))}>{logoStyleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
        {finalEditModal === 'shape' && <label>원하는 로고 모양<textarea autoFocus value={finalEditDraft.logoShape} onChange={(event) => setFinalEditDraft((draft) => ({ ...draft, logoShape: event.target.value }))} maxLength={100} /></label>}
        <div className="credit-modal-actions"><button className="gradient-button" type="button" disabled={finalEditModal === 'tone' && finalEditToneMode === 'direct' && !finalEditDraft.tone.trim()} onClick={saveFinalEditModal}>저장하기</button><button className="modal-secondary-button" type="button" onClick={() => setFinalEditModal(null)}>취소</button></div>
      </section>
    </div>
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
          <button className="gradient-button" type="button" onClick={openCreditSurvey}>설문 참여하기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
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
          {surveyRating === 1 && <div className="survey-followup" aria-live="polite"><div className="survey-followup-inner">
            <div className="modal-survey-block"><h3>어떤 부분이 더 좋아졌으면 하나요?</h3><div className="modal-improvement-grid">{surveyImprovementOptions.map((item) => { const selected = surveyImprovements.includes(item); return <button key={item} type="button" className={selected ? 'modal-improvement-option selected' : 'modal-improvement-option'} aria-pressed={selected} onClick={() => toggleSurveyImprovement(item)}>{item}</button> })}</div></div>
            <div className="modal-survey-block"><h3>추가 의견</h3><textarea value={surveyComment} onChange={(event) => setSurveyComment(event.target.value)} placeholder="어렵거나 이해되지 않았던 부분을 자유롭게 작성해주세요." maxLength={500} /></div>
          </div></div>}
          <button className="gradient-button modal-submit" type="submit">의견 보내고 크레딧 받기 <ChevronRight aria-hidden="true" size={20} strokeWidth={1.8} /></button>
        </form>
      </section>
    </div>
  )

  const closeBusinessCardModal = () => {
    if (brandKitCreatingRef.current) return
    setBusinessCardModalOpen(false)
    setBusinessCardTarget(null)
    setBusinessCardInfoErrors({})
    setBusinessCardSubmitError('')
  }

  const updateBusinessCardInfo = (field: keyof BusinessCardInfoInput, value: string) => {
    const nextValue = field === 'phone' ? formatBusinessPhone(value) : value
    setBusinessCardInfo((current) => ({ ...current, [field]: nextValue }))
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
      <section className="credit-modal business-card-modal" role="dialog" aria-modal="true" aria-labelledby="business-card-modal-title">
        <button className="modal-close" type="button" aria-label="명함 정보 입력 닫기" onClick={closeBusinessCardModal} disabled={brandKitCreating}><X aria-hidden="true" size={22} strokeWidth={1.8} /></button>
        <header className="business-card-modal-intro">
          <div className="business-card-modal-icon" aria-hidden="true"><CreditCard size={30} strokeWidth={1.7} /></div>
          <div>
            <h2 id="business-card-modal-title">명함에 들어갈 정보를 알려주세요</h2>
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
                disabled={brandKitCreating}
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
              <input maxLength={40} autoComplete="organization-title" value={businessCardInfo.title ?? ''} onChange={(event) => updateBusinessCardInfo('title', event.target.value)} placeholder="대표 / 디자이너" disabled={brandKitCreating} />
            </label>
            <label className="business-card-field business-card-field-wide">
              <span>회사명</span>
              <input maxLength={60} autoComplete="organization" value={businessCardInfo.company ?? ''} onChange={(event) => updateBusinessCardInfo('company', event.target.value)} placeholder="회사 또는 브랜드 이름" disabled={brandKitCreating} />
            </label>
            <label className="business-card-field">
              <span>전화번호</span>
              <input type="tel" inputMode="numeric" maxLength={13} autoComplete="tel" value={businessCardInfo.phone ?? ''} onChange={(event) => updateBusinessCardInfo('phone', event.target.value)} placeholder="010-1234-5678" disabled={brandKitCreating} />
            </label>
            <label className="business-card-field">
              <span>이메일</span>
              <input
                type="email"
                maxLength={80}
                autoComplete="email"
                disabled={brandKitCreating}
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
              <input maxLength={120} autoComplete="street-address" value={businessCardInfo.address ?? ''} onChange={(event) => updateBusinessCardInfo('address', event.target.value)} placeholder="명함에 표시할 주소" disabled={brandKitCreating} />
            </label>
          </div>
          <p className="business-card-form-note"><Info aria-hidden="true" size={16} strokeWidth={1.9} /> 비워 둔 선택 정보는 명함에 표시되지 않아요.</p>
          {businessCardSubmitError && <p className="business-card-submit-error" role="alert">{businessCardSubmitError}</p>}
          <div className="business-card-form-actions">
            <button className="modal-secondary-button" type="button" onClick={closeBusinessCardModal} disabled={brandKitCreating}>취소</button>
            <button className="gradient-button" type="submit" disabled={brandKitCreating} aria-busy={brandKitCreating}>{brandKitCreating ? '명함 만드는 중...' : '이 정보로 명함 만들기'} {!brandKitCreating && <ChevronRight aria-hidden="true" size={20} strokeWidth={1.9} />}</button>
          </div>
        </form>
      </section>
    </div>
  )

  const renderLoginScreen = () => (
    <main className="login-screen">
      <section className="login-content" aria-labelledby="login-title">
        <div className="login-hero-mark">
          <GenMarkLogo className="login-hero-logo" alt="GenMark AI" />
        </div>
        <h1 id="login-title">상상하던 내 브랜드,<br /><strong>지금 시작해 보세요</strong></h1>
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
      ) : mode === 'logo-intro' || mode === 'onboarding' || mode === 'industry' || mode === 'brand-details' || mode === 'company-details' || mode === 'hero' || mode === 'choice' || mode === 'tone' || mode === 'style' || mode === 'final' || mode === 'loading' || mode === 'trademark-loading' || mode === 'trademark-selection' || mode === 'trademark-result' || mode === 'result' || mode === 'brand-kit' || mode === 'edit' || mode === 'mypage' || mode === 'survey' ? null : (
        <header className="main-header">
          <a className="main-brand" href="#home" aria-label="GenMark AI 홈" onClick={() => setMode('home')}>
            <BrandLogo />
            <span><span className="brand-mark-accent">GenMark AI</span></span>
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

      {mode === 'login' ? renderLoginScreen() : mode === 'logo-intro' ? renderLogoCreationIntroScreen() : mode === 'onboarding' ? renderOnboardingScreen() : mode === 'industry' ? renderIndustrySelectionScreen() : mode === 'brand-details' ? renderBrandDetailsScreen() : mode === 'company-details' ? renderCompanyDetailsScreen() : mode === 'choice' ? renderChoiceScreen() : mode === 'tone' ? renderToneSelectionScreen() : mode === 'style' ? renderStyleSelectionScreen() : mode === 'final' ? renderFinalRequestScreen() : mode === 'loading' ? renderLoadingScreen() : mode === 'trademark-loading' ? renderTrademarkLoadingScreen() : mode === 'trademark-selection' ? renderTrademarkSelectionScreen() : mode === 'trademark-result' ? renderTrademarkResultScreenRedesign() : mode === 'result' ? renderLogoResultScreen() : mode === 'brand-kit' ? renderBrandKitSelectionScreen() : mode === 'edit' ? renderLogoEditScreen() : mode === 'mypage' ? renderMypageScreen() : mode === 'survey' ? renderSurveyScreen() : mode === 'hero' ? (
        renderAnimatedGalleryHeroScreen()
      ) : mode === 'home' ? (
        <main id="home" className="main-home">
          {renderFeaturedHero()}

          <section className="curation-section" aria-labelledby="curation-title">
            <div className="section-heading">
              <h2 id="curation-title">큐레이션 갤러리</h2>
            </div>
            <div className="filter-row" role="tablist" aria-label="로고 스타일 필터">
              {categories.map((category) => (
                <button key={category} type="button" className={activeCategory === category ? 'filter-button active' : 'filter-button'} onClick={() => setActiveCategory(category)}>
                  {category}
                </button>
              ))}
            </div>
            <div className="gallery-scroll-area">
              <button type="button" className="gallery-side-arrow prev" aria-label="이전 로고 묶음 보기" onClick={() => scrollGallery(-1)}><ChevronLeft aria-hidden="true" size={20} strokeWidth={2} /></button>
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
                      <div className={`gallery-visual ${item.tone}`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position }}>
                        <button type="button" className={liked ? 'favorite-button liked' : 'favorite-button'} aria-label={`${item.name} 좋아요 ${liked ? '취소' : '추가'}`} onClick={() => toggleLike(item.id)}>
                          <Heart aria-hidden="true" size={22} strokeWidth={1.8} fill={liked ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
              <button type="button" className="gallery-side-arrow next" aria-label="다음 로고 묶음 보기" onClick={() => scrollGallery(1)}><ChevronRight aria-hidden="true" size={20} strokeWidth={2} /></button>
            </div>
          </section>

          <section className="curation-section business-card-gallery-section" aria-labelledby="business-card-gallery-title">
            <div className="section-heading">
              <h2 id="business-card-gallery-title">명함 갤러리</h2>
            </div>
            <div className="gallery-scroll-area">
              <button type="button" className="gallery-side-arrow prev" aria-label="이전 명함 묶음 보기" onClick={() => scrollBusinessCardGallery(-1)}><ChevronLeft aria-hidden="true" size={20} strokeWidth={2} /></button>
              <div
                className="gallery-track"
                ref={businessCardGalleryRef}
                onPointerDown={handleBusinessCardGalleryPointerDown}
                onPointerMove={handleBusinessCardGalleryPointerMove}
                onPointerUp={handleBusinessCardGalleryPointerUp}
                onPointerCancel={handleBusinessCardGalleryPointerUp}
              >
                {businessCardGalleryItems.map((item) => {
                  return (
                    <article className="gallery-card" key={item.id}>
                      <div className={`gallery-visual business-card-gallery-visual ${item.tone}`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position }} />
                    </article>
                  )
                })}
              </div>
              <button type="button" className="gallery-side-arrow next" aria-label="다음 명함 묶음 보기" onClick={() => scrollBusinessCardGallery(1)}><ChevronRight aria-hidden="true" size={20} strokeWidth={2} /></button>
            </div>
          </section>

          <section className="curation-section product-gallery-section" aria-labelledby="product-gallery-title">
            <div className="section-heading">
              <h2 id="product-gallery-title">제품 썸네일 갤러리</h2>
            </div>
            <div className="gallery-scroll-area">
              <button type="button" className="gallery-side-arrow prev" aria-label="이전 제품 묶음 보기" onClick={() => scrollProductGallery(-1)}><ChevronLeft aria-hidden="true" size={20} strokeWidth={2} /></button>
              <div
                className="gallery-track"
                ref={productGalleryRef}
                onPointerDown={handleProductGalleryPointerDown}
                onPointerMove={handleProductGalleryPointerMove}
                onPointerUp={handleProductGalleryPointerUp}
                onPointerCancel={handleProductGalleryPointerUp}
              >
                {productGalleryItems.map((item) => {
                  return (
                    <article className="gallery-card" key={item.id}>
                      <div className={`gallery-visual product-gallery-visual ${item.tone}`} style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.position }} />
                    </article>
                  )
                })}
              </div>
              <button type="button" className="gallery-side-arrow next" aria-label="다음 제품 묶음 보기" onClick={() => scrollProductGallery(1)}><ChevronRight aria-hidden="true" size={20} strokeWidth={2} /></button>
            </div>
          </section>
        </main>
      ) : null}

      {!['loading', 'trademark-loading', 'hero', 'login', 'logo-intro'].includes(mode) && <nav className="bottom-nav" aria-label="주요 메뉴">
        <button className={mode === 'home' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setMode('home')}>
          <House className="nav-icon" aria-hidden="true" size={26} strokeWidth={1.8} /><span>홈</span>
        </button>
        <button className="nav-item nav-item-create" type="button" onClick={openLogoCreationIntro} disabled={authRestoring}>
          <Sparkles className="nav-icon" aria-hidden="true" size={26} strokeWidth={1.8} /><span>로고 생성</span>
        </button>
        <button className={mode === 'mypage' || mode === 'survey' ? 'nav-item active' : 'nav-item'} type="button" onClick={() => setMode('mypage')}>
          <UserRound className="nav-icon" aria-hidden="true" size={26} strokeWidth={1.8} /><span>마이페이지</span>
        </button>
      </nav>}

      {creditModal === 'credit' ? renderCreditModal() : creditModal === 'survey' ? renderCreditSurveyModal() : null}
      {finalEditModal && renderFinalEditModal()}
      {businessCardModalOpen && renderBusinessCardModal()}
      {resumePromptProject && renderResumePromptModal()}
      {brandKitPreview && renderBrandKitPreviewModal()}
      {mypageLogoAction && renderMypageLogoActionModal()}
      {assetDeleteTarget && renderAssetDeleteModal()}
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
