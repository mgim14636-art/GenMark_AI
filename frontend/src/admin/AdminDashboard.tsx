import { Fragment, ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  FolderCheck,
  Heart,
  House,
  ImageIcon,
  Palette,
  RefreshCw,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Upload,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import GenMarkLogo from '../components/ui/GenMarkLogo'
import { AuthError } from '../auth'
import {
  adminApi,
  type AdminAccount,
  type AdminAnalyticsResponse,
  type AdminMember,
  type AdminLogoMemberRecord,
  type AdminSimilarityCompareResult,
  type AdminSimilarityVectorRow,
  type AdminSurveyResponse,
} from '../lib/genmarkApi'
import './admin-dashboard.css'

type DashboardSection = 'overview' | 'generation' | 'download' | 'signup' | 'requests' | 'members' | 'admins' | 'credits' | 'ci-generations' | 'bi-generations' | 'similarity'

type AdminDashboardProps = {
  standalone?: boolean
}

const defaultAdminId = 'admin@genmark.ai'
const ADMIN_TOKEN_KEY = 'genmark-admin-access-token'
// Require a valid administrator session before rendering the dashboard.
const ADMIN_LOGIN_REQUIRED = true

type AdminMemberTableRow = AdminMember & {
  ciDownloads?: number
  biDownloads?: number
}

type AdminAccountRow = {
  id: string
  name: string
  createdAt: string
  lastAccessAt: string
}

const previewAdminMembers: AdminMemberTableRow[] = [
  { id: 1, email: 'tkss1217@gmail.com', name: '김명은', provider: 'GOOGLE', ciGenerations: 8, biGenerations: 5, downloadCount: 7, ciDownloads: 4, biDownloads: 3, creditBalance: 12, paidUser: true, createdAt: '2026-08-05T09:24:00', onboardingCompleted: true, onboardingUsage: ['online', 'social'], onboardingAudience: 'owner', onboardingCompletedAt: '2026-08-05T09:20:00' },
  { id: 2, email: 'minji.kim@example.com', name: '김민지', provider: 'KAKAO', ciGenerations: 6, biGenerations: 9, downloadCount: 8, ciDownloads: 3, biDownloads: 5, creditBalance: 18, paidUser: true, createdAt: '2026-08-08T14:10:00', onboardingCompleted: true, onboardingUsage: ['offline'], onboardingAudience: 'company', onboardingCompletedAt: '2026-08-08T14:05:00' },
  { id: 3, email: 'design.lee@example.com', name: '이서윤', provider: 'GOOGLE', ciGenerations: 3, biGenerations: 4, downloadCount: 3, ciDownloads: 2, biDownloads: 1, creditBalance: 7, paidUser: false, createdAt: '2026-08-11T11:42:00', onboardingCompleted: false, onboardingUsage: [], onboardingAudience: null, onboardingCompletedAt: null },
]

/** 온보딩(첫 방문 설문) 1단계 선택지. 실제 문구는 App.tsx의 onboardingOptions와 같다. */
const ONBOARDING_USAGE_LABELS: Record<string, string> = {
  online: '온라인 쇼핑몰',
  social: '인스타그램 · SNS',
  offline: '매장 · 명함 · 인쇄물',
}
/** 온보딩 2단계 선택지. 실제 문구는 App.tsx의 audienceOptions와 같다. */
const ONBOARDING_AUDIENCE_LABELS: Record<string, string> = {
  company: '회사 / 팀',
  owner: '자영업',
  hobby: '취미 / 창작',
  sidejob: '부업 & 투잡',
}

const previewAdminAccounts: AdminAccountRow[] = [
  { id: 'admin@genmark.ai', name: '김명은', createdAt: '2026.08.01', lastAccessAt: '2026.08.14 14:36' },
  { id: 'manager@genmark.ai', name: '서비스 관리자', createdAt: '2026.08.05', lastAccessAt: '2026.08.14 11:18' },
]

const formatAdminDate = (value: string) => {
  const datePart = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart.replace(/-/g, '.') : value
}

const getStoredAdminToken = () => {
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

const storeAdminToken = (token: string) => {
  try {
    if (token) window.localStorage.setItem(ADMIN_TOKEN_KEY, token)
    else window.localStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    // Some browsers disable localStorage for files opened directly from disk.
  }
}

const getStoredAdminId = () => {
  try {
    return window.localStorage.getItem('genmark-admin-id') || defaultAdminId
  } catch {
    return defaultAdminId
  }
}

const storeAdminId = (adminId: string) => {
  try {
    window.localStorage.setItem('genmark-admin-id', adminId)
  } catch {
    // Some browsers disable localStorage for files opened directly from disk.
  }
}

const getDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getCalendarDays = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const firstCell = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay())
  return Array.from({ length: 42 }, (_, index) => new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index))
}

type LogoAsset = {
  id: string
  projectId: string
  imageUrl: string
  name: string
  date: string
}

type LogoMemberRecord = {
  memberId: string
  memberName: string
  generatedLogos: LogoAsset[]
  downloadedLogos: LogoAsset[]
}

type LogoGenerationTrack = 'CI' | 'BI'

type LogoPanelState = {
  track: LogoGenerationTrack
  memberId: string
  type: 'generated' | 'downloaded'
} | null

/**
 * 꺾은선 차트를 그릴 때 쓰는 컨테이너의 실제 픽셀 폭을 잰다.
 *
 * viewBox를 고정값(예: 600)으로 두면 카드 폭과 비율이 안 맞을 때 SVG가 통째로
 * 축소되어 가운데로 몰린다(preserveAspectRatio 기본 동작). 그러면 SVG 안의 점과
 * 바깥 HTML로 그린 날짜 글자가 서로 어긋난다. 잰 폭을 그대로 viewBox 폭으로 쓰면
 * SVG 좌표 1이 화면 1px이 되어 축소가 아예 일어나지 않는다.
 */
const useMeasuredWidth = (fallbackWidth: number) => {
  const [width, setWidth] = useState(fallbackWidth)
  // 탭을 바꾸면 차트가 뒤늦게 생기므로 useRef 대신 콜백 ref를 쓴다.
  // useRef는 처음 붙을 때 알림이 없어서, 그때 화면에 없던 차트는 폭을 영영 못 잰다.
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!element) return
    const apply = (measured: number) => { if (measured > 0) setWidth(measured) }
    apply(element.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? 0))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, width] as const
}

/**
 * y축 눈금을 데이터 크기에 맞춰 정한다.
 *
 * 기본 단위: 100 미만이면 5, 100~999면 100, 1000 이상이면 자릿수에 맞춰 1000·10000…으로 올라간다.
 * 그 단위로 눈금이 6칸을 넘게 촘촘해지면 2·4·5…배로 키워서 읽기 좋은 개수로 맞춘다.
 * (예: 최대 2 → 0·5 / 최대 80 → 0·20·40·60·80 / 최대 150 → 0·100·200 / 최대 1248 → 0·1000·2000)
 */
const buildNiceAxis = (maxValue: number) => {
  const max = Math.max(1, Math.ceil(maxValue))
  const baseUnit = max < 100 ? 5 : Math.pow(10, Math.floor(Math.log10(max)))
  const step = [1, 2, 4, 5, 10, 20, 25, 50, 100]
    .map((multiplier) => baseUnit * multiplier)
    .find((candidate) => Math.ceil(max / candidate) <= 6) ?? baseUnit * 100
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top; value += step) ticks.push(value)
  return { top, ticks }
}

/**
 * 꺾은선 차트 두 개의 여백·높이(px). viewBox를 실제 픽셀 폭으로 쓰기 때문에
 * 여기 숫자는 전부 화면 픽셀과 1:1로 대응한다.
 * gutter = 왼쪽 y축 숫자 자리, labelY = 아래쪽 날짜 글자의 기준선.
 */
const MINI_CHART = { gutter: 34, padRight: 16, plotTop: 10, plotBottom: 112, labelY: 130, height: 138 } as const
const LINE_CHART = { gutter: 44, padRight: 16, plotTop: 10, plotBottom: 196, labelY: 217, height: 226 } as const

/**
 * "로고 생성 건수" 막대 차트(admin-mini-dual-bars)의 세로 픽셀 치수.
 * admin-dashboard.css의 .admin-mini-dual-bars(전체 136px)와
 * .admin-mini-dual-group > div(막대 영역 = 100% - 18px)에 맞춰져 있다 —
 * CSS 쪽 값을 바꾸면 여기도 같이 바꿔야 눈금선이 실제 막대와 어긋나지 않는다.
 */
const DUAL_BAR_LABEL_HEIGHT = 18
const DUAL_BAR_PLOT_HEIGHT = 118

/** 꺾은선 차트의 점 좌표를 계산한다. 점이 하나뿐이면 왼쪽 끝에 붙이지 않고 가운데 놓는다. */
const buildLinePoints = (
  values: readonly number[], labels: readonly string[],
  layout: { left: number; right: number; top: number; bottom: number; axisTop: number },
) => values.map((value, index) => {
  const span = layout.right - layout.left
  const x = values.length === 1
    ? layout.left + span / 2
    : layout.left + (span / (values.length - 1)) * index
  const y = layout.bottom - (value / layout.axisTop) * (layout.bottom - layout.top)
  return { x, y, value, label: labels[index] ?? '' }
})

const normalizeAdminSearchValue = (value: string) => value.trim().toLocaleLowerCase()

const matchesAdminMemberSearch = (query: string, ...identifiers: Array<string | undefined>) => {
  const normalizedQuery = normalizeAdminSearchValue(query)
  return !normalizedQuery || identifiers.some((identifier) => identifier && normalizeAdminSearchValue(identifier) === normalizedQuery)
}

const makeLogoAsset = (id: string, projectId: string, imageUrl: string, name: string, date: string): LogoAsset => ({
  id,
  projectId,
  imageUrl,
  name,
  date,
})

const ciGenerationMembers: LogoMemberRecord[] = [
  {
    memberId: 'tkss1217',
    memberName: '김명은',
    generatedLogos: [
      makeLogoAsset('ci-1', 'CI-240814-01', '/curation-gallery/novaire.png', 'Novaire Studio', '2026.08.14'),
      makeLogoAsset('ci-2', 'CI-240814-02', '/curation-gallery/aurelia-symbol.png', 'Aurelia Skincare', '2026.08.14'),
      makeLogoAsset('ci-3', 'CI-240813-03', '/curation-gallery/quendra.png', 'Quendra', '2026.08.13'),
    ],
    downloadedLogos: [
      makeLogoAsset('ci-d-1', 'CI-240814-01', '/curation-gallery/novaire.png', 'Novaire Studio', '2026.08.14'),
      makeLogoAsset('ci-d-2', 'CI-240813-03', '/curation-gallery/quendra.png', 'Quendra', '2026.08.13'),
    ],
  },
  {
    memberId: 'beauty_lab',
    memberName: '이서연',
    generatedLogos: [
      makeLogoAsset('ci-4', 'CI-240812-04', '/curation-gallery/solvane.png', 'Solvane', '2026.08.12'),
      makeLogoAsset('ci-5', 'CI-240812-05', '/curation-gallery/aerinde.png', 'Aurion', '2026.08.12'),
    ],
    downloadedLogos: [
      makeLogoAsset('ci-d-3', 'CI-240812-04', '/curation-gallery/solvane.png', 'Solvane', '2026.08.12'),
    ],
  },
  { memberId: 'atelier03', memberName: '박지훈', generatedLogos: [], downloadedLogos: [] },
  {
    memberId: 'minseo94',
    memberName: '최민서',
    generatedLogos: [
      makeLogoAsset('ci-6', 'CI-240811-06', '/hero-gallery/velora.png', 'Velora', '2026.08.11'),
    ],
    downloadedLogos: [
      makeLogoAsset('ci-d-4', 'CI-240811-06', '/hero-gallery/velora.png', 'Velora', '2026.08.11'),
    ],
  },
]

const biGenerationMembers: LogoMemberRecord[] = [
  {
    memberId: 'tkss1217',
    memberName: '김명은',
    generatedLogos: [
      makeLogoAsset('bi-1', 'BI-240814-01', '/curation-gallery/lysenne.png', 'Lavenor', '2026.08.14'),
      makeLogoAsset('bi-2', 'BI-240814-02', '/hero-gallery/velora.png', 'Velora', '2026.08.14'),
    ],
    downloadedLogos: [makeLogoAsset('bi-d-1', 'BI-240814-01', '/curation-gallery/lysenne.png', 'Lavenor', '2026.08.14')],
  },
  {
    memberId: 'studio_m',
    memberName: '정하윤',
    generatedLogos: [
      makeLogoAsset('bi-3', 'BI-240813-03', '/curation-gallery/rk-monogram.png', 'Morvan', '2026.08.13'),
      makeLogoAsset('bi-4', 'BI-240813-04', '/curation-gallery/gn-monogram.png', 'Eloris', '2026.08.13'),
      makeLogoAsset('bi-5', 'BI-240812-05', '/curation-gallery/unevia.png', 'Vitara', '2026.08.12'),
    ],
    downloadedLogos: [
      makeLogoAsset('bi-d-2', 'BI-240813-03', '/curation-gallery/rk-monogram.png', 'Morvan', '2026.08.13'),
      makeLogoAsset('bi-d-3', 'BI-240812-05', '/curation-gallery/unevia.png', 'Vitara', '2026.08.12'),
    ],
  },
  { memberId: 'brand_note', memberName: '오지아', generatedLogos: [], downloadedLogos: [] },
]

type AdminMemberIdSearchProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function AdminMemberIdSearch({ id, value, onChange, placeholder = '회원 아이디 입력' }: AdminMemberIdSearchProps) {
  const hasQuery = value.trim().length > 0

  return (
    <div className="admin-list-toolbar">
      <div className="admin-list-search">
        <label htmlFor={id}>회원 아이디 검색</label>
        <div className="admin-list-search-field">
          <Search size={16} aria-hidden="true" />
          <input id={id} type="search" inputMode="email" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label="회원 아이디 검색" />
          {hasQuery && <button className="admin-list-search-clear" type="button" aria-label="회원 아이디 검색어 지우기" onClick={() => onChange('')}><X size={15} aria-hidden="true" /></button>}
        </div>
      </div>
    </div>
  )
}

type LogoGenerationListProps = {
  track: LogoGenerationTrack
  members: LogoMemberRecord[]
  openPanel: LogoPanelState
  setOpenPanel: (panel: LogoPanelState) => void
  adminToken: string
  vectorizedCandidateIds: Set<string>
  onVectorize: (candidateId: string) => Promise<void>
}

function AdminLogoThumb({ logo, memberName, track, adminToken }: { logo: LogoAsset; memberName: string; track: LogoGenerationTrack; adminToken: string }) {
  const [imageSrc, setImageSrc] = useState(adminToken ? '' : logo.imageUrl)

  useEffect(() => {
    if (!adminToken) {
      setImageSrc(logo.imageUrl)
      return
    }

    let active = true
    let objectUrl = ''
    void adminApi.candidateImage(adminToken, logo.id)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setImageSrc(objectUrl)
      })
      .catch(() => {
        if (active) setImageSrc('')
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [adminToken, logo.id, logo.imageUrl])

  return imageSrc
    ? <img src={imageSrc} alt={`${memberName} ${track} ${logo.name} 로고`} loading="lazy" />
    : <div className="admin-logo-thumb-placeholder" aria-label="로고 이미지 불러오는 중" />
}

function AdminLogoGenerationList({ track, members, openPanel, setOpenPanel, adminToken, vectorizedCandidateIds, onVectorize }: LogoGenerationListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [vectorizingId, setVectorizingId] = useState('')
  const handleVectorize = async (candidateId: string) => {
    setVectorizingId(candidateId)
    try {
      await onVectorize(candidateId)
    } finally {
      setVectorizingId('')
    }
  }
  const getLogos = (member: LogoMemberRecord, type: 'generated' | 'downloaded') => type === 'generated' ? member.generatedLogos : member.downloadedLogos
  const filteredMembers = members.filter((member) => matchesAdminMemberSearch(searchQuery, member.memberId))

  return (
    <section className="admin-record-page" aria-labelledby={`${track.toLowerCase()}-generation-title`}>
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">LOGO GENERATION</p>
          <h2 id={`${track.toLowerCase()}-generation-title`}>{track} 생성 목록</h2>
          <p className="admin-generation-description">회원별 {track} 로고 생성·다운로드 기록을 확인합니다.</p>
        </div>
        <AdminMemberIdSearch id={`${track.toLowerCase()}-member-search`} value={searchQuery} onChange={setSearchQuery} />
      </div>
      <div className="admin-table-shell">
        <table className="admin-logo-table">
          <caption className="admin-sr-only">{track} 회원별 로고 생성 및 다운로드 목록</caption>
          <thead>
            <tr><th scope="col">No.</th><th scope="col">회원 아이디</th><th scope="col">회원 이름</th><th scope="col">생성 로고</th><th scope="col">다운로드 로고</th></tr>
          </thead>
          <tbody>
            {filteredMembers.length === 0 ? <tr><td colSpan={5} className="admin-empty-table-state">입력한 회원 아이디와 일치하는 회원이 없습니다.</td></tr> : filteredMembers.map((member, index) => {
              const isOpen = openPanel?.track === track && openPanel?.memberId === member.memberId
              const activeType = isOpen ? openPanel.type : null
              const activeLogos = activeType ? getLogos(member, activeType) : []
              const panelId = `${track.toLowerCase()}-logos-${member.memberId}`
              const togglePanel = (type: 'generated' | 'downloaded') => {
                setOpenPanel(isOpen && activeType === type ? null : { track, memberId: member.memberId, type })
              }

              return (
                <Fragment key={member.memberId}>
                  <tr className={`admin-logo-member-row ${isOpen ? 'is-open' : ''}`}>
                    <td data-label="No.">{index + 1}</td>
                    <td data-label="회원 아이디"><code>{member.memberId}</code></td>
                    <td data-label="회원 이름"><strong>{member.memberName}</strong></td>
                    <td data-label="생성 로고">
                      <button className="admin-logo-record-button" type="button" disabled={member.generatedLogos.length === 0} aria-expanded={isOpen && activeType === 'generated'} aria-controls={panelId} onClick={() => togglePanel('generated')}>
                        <FolderCheck size={16} aria-hidden="true" /><span>{member.generatedLogos.length ? `생성 로고 ${member.generatedLogos.length}개` : '생성 기록 없음'}</span><ChevronDown size={15} aria-hidden="true" />
                      </button>
                    </td>
                    <td data-label="다운로드 로고">
                      <button className="admin-logo-record-button download" type="button" disabled={member.downloadedLogos.length === 0} aria-expanded={isOpen && activeType === 'downloaded'} aria-controls={panelId} onClick={() => togglePanel('downloaded')}>
                        <Download size={16} aria-hidden="true" /><span>{member.downloadedLogos.length ? `다운로드 ${member.downloadedLogos.length}개` : '다운로드 기록 없음'}</span><ChevronDown size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                  <tr className={`admin-logo-accordion-row ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
                    <td colSpan={5}>
                      <div id={panelId} className={`admin-logo-accordion ${isOpen ? 'is-open' : ''}`}>
                        <div className="admin-logo-accordion-inner" role="region" aria-label={`${member.memberName} ${activeType === 'downloaded' ? '다운로드' : '생성'} 로고 상세`}>
                          <div className="admin-logo-accordion-heading"><strong>{activeType === 'downloaded' ? '다운로드한 로고' : '생성한 로고'}</strong><span>{activeLogos.length}개</span></div>
                          <div className="admin-logo-thumb-grid">
                            {activeLogos.map((logo) => {
                              const isVectorized = vectorizedCandidateIds.has(logo.id)
                              const isVectorizing = vectorizingId === logo.id
                              return (
                                <article className="admin-logo-thumb-card" key={logo.id}>
                                  <AdminLogoThumb logo={logo} memberName={member.memberName} track={track} adminToken={adminToken} />
                                  <div>
                                    <strong>{logo.name}</strong>
                                    <span>프로젝트 {logo.projectId}</span>
                                    <small>{logo.date}</small>
                                    {activeType === 'generated' && (
                                      <button className={isVectorized ? 'admin-vectorize-button is-done' : 'admin-vectorize-button'} type="button" disabled={isVectorized || isVectorizing} onClick={() => void handleVectorize(logo.id)}>
                                        <ScanSearch size={13} aria-hidden="true" />
                                        <span>{isVectorized ? '벡터화 완료' : isVectorizing ? '벡터화 중…' : '벡터화'}</span>
                                      </button>
                                    )}
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const SIMILARITY_RISK_LABELS: Record<string, string> = { SAFE: '낮은 유사도', MODERATE: '확인이 필요해요', CAUTION: '유사도가 높아요' }

function AdminSimilarityTestPanel({ vectors, adminToken, standalone }: { vectors: AdminSimilarityVectorRow[]; adminToken: string; standalone: boolean }) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [comparisonFile, setComparisonFile] = useState<File | null>(null)
  const [comparisonPreviewUrl, setComparisonPreviewUrl] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')
  const [compareResult, setCompareResult] = useState<AdminSimilarityCompareResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedVector = vectors.find((vector) => vector.id === selectedId) ?? null

  useEffect(() => () => { if (comparisonPreviewUrl) URL.revokeObjectURL(comparisonPreviewUrl) }, [comparisonPreviewUrl])

  const selectVector = (id: number) => {
    setSelectedId(id)
    setCompareResult(null)
    setCompareError('')
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (comparisonPreviewUrl) URL.revokeObjectURL(comparisonPreviewUrl)
    setComparisonFile(file)
    setComparisonPreviewUrl(file ? URL.createObjectURL(file) : '')
    setCompareResult(null)
    setCompareError('')
  }

  const readFileAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('이미지를 읽지 못했어요.'))
    reader.readAsDataURL(file)
  })

  const runCompare = async () => {
    if (!selectedVector || !comparisonFile) return
    setCompareLoading(true)
    setCompareError('')
    try {
      if (standalone) {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
        setCompareResult({ similarity: 41, riskLevel: 'MODERATE', disclaimer: '본 분석은 로고 이미지의 시각적 유사성을 보여주는 참고 자료이며, 상표 등록 가능 여부나 법적 침해 여부를 판단하지 않습니다.', note: '원형 배치와 곡선 중심의 실루엣에서 일부 비슷한 요소를 발견했어요.' })
        return
      }
      const imageBase64 = await readFileAsBase64(comparisonFile)
      const result = await adminApi.compareSimilarity(adminToken, selectedVector.id, imageBase64)
      setCompareResult(result)
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : '유사도를 확인하지 못했어요.')
    } finally {
      setCompareLoading(false)
    }
  }

  const scoreTone = compareResult ? (compareResult.similarity >= 60 ? 'caution' : compareResult.similarity >= 30 ? 'moderate' : 'safe') : ''
  const toThumbAsset = (vector: AdminSimilarityVectorRow) => ({ id: vector.candidateId, projectId: vector.projectId, imageUrl: vector.imageUrl, name: vector.name, date: vector.vectorizedAt })

  return (
    <section className="admin-record-page" aria-labelledby="similarity-test-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">SIMILARITY TEST</p>
          <h2 id="similarity-test-title">유사도 관리 및 테스트</h2>
        </div>
      </div>

      <div className="admin-similarity-layout">
        <div className="admin-similarity-vector-list" role="list" aria-label="벡터화된 자체 생성 로고 목록">
          {vectors.length === 0 ? (
            <p className="admin-empty-table-state">아직 벡터화된 로고가 없어요. 생성 목록에서 "벡터화" 버튼을 먼저 눌러주세요.</p>
          ) : vectors.map((vector) => (
            <button key={vector.id} type="button" role="listitem" className={vector.id === selectedId ? 'admin-similarity-vector-card is-selected' : 'admin-similarity-vector-card'} onClick={() => selectVector(vector.id)}>
              <span className="admin-similarity-vector-thumb"><AdminLogoThumb logo={toThumbAsset(vector)} memberName={vector.name} track={vector.projectType} adminToken={adminToken} /></span>
              <span className="admin-similarity-vector-copy"><strong>{vector.name}</strong><small>{vector.projectType} · {vector.vectorizedAt}</small></span>
            </button>
          ))}
        </div>

        <div className="admin-similarity-compare-board">
          {!selectedVector ? (
            <p className="admin-empty-table-state">왼쪽 목록에서 비교할 로고를 먼저 선택해주세요.</p>
          ) : (
            <>
              <div className="admin-similarity-compare-panels">
                <figure className="admin-similarity-compare-panel">
                  <figcaption>벡터 로고</figcaption>
                  <div className="admin-similarity-compare-image"><AdminLogoThumb logo={toThumbAsset(selectedVector)} memberName={selectedVector.name} track={selectedVector.projectType} adminToken={adminToken} /></div>
                </figure>
                <div className="admin-similarity-compare-versus" aria-hidden="true"><ArrowLeftRight size={18} strokeWidth={1.8} /></div>
                <figure className="admin-similarity-compare-panel">
                  <figcaption>비교 로고</figcaption>
                  <button type="button" className="admin-similarity-upload-slot" onClick={() => fileInputRef.current?.click()}>
                    {comparisonPreviewUrl ? <img src={comparisonPreviewUrl} alt="비교할 이미지 미리보기" /> : <><Upload size={22} aria-hidden="true" /><span>내 PC에서 사진 넣기</span></>}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
                </figure>
              </div>

              <button className="admin-similarity-run-button" type="button" disabled={!comparisonFile || compareLoading} onClick={() => void runCompare()}>
                <ScanSearch size={17} aria-hidden="true" />
                <span>{compareLoading ? '확인하는 중…' : '유사도 확인'}</span>
              </button>

              {compareError && <p className="project-error" role="alert">{compareError}</p>}

              {compareResult && (
                <article className={`admin-similarity-result ${scoreTone}`}>
                  <div className="admin-similarity-result-heading"><BarChart3 size={18} strokeWidth={1.8} aria-hidden="true" /><span>유사도 점수</span></div>
                  <strong>{compareResult.similarity}<small>점</small></strong>
                  <span className="admin-similarity-result-status">{SIMILARITY_RISK_LABELS[compareResult.riskLevel] ?? compareResult.riskLevel}</span>
                  {compareResult.note && <p className="admin-similarity-result-note">{compareResult.note}</p>}
                  <p className="admin-similarity-result-disclaimer">{compareResult.disclaimer}</p>
                </article>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function AdminSurveyResponseTable({ responses }: { responses: AdminSurveyResponse[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const filteredResponses = responses.filter((response) => matchesAdminMemberSearch(searchQuery, response.memberEmail ?? '', response.memberName ?? '', String(response.memberId)))

  return (
    <section className="admin-record-page" aria-labelledby="survey-response-title">
      <div className="admin-section-heading"><div><p className="admin-eyebrow">USER FEEDBACK</p><h2 id="survey-response-title">개선 요청</h2><p>실제 설문 응답에서 선택한 개선 항목을 확인해요.</p></div><AdminMemberIdSearch id="survey-member-search" value={searchQuery} onChange={setSearchQuery} /></div>
      <div className="admin-table-shell">
        <table className="admin-survey-response-table">
          <caption className="admin-sr-only">개선 요청 설문 응답 목록</caption>
          <thead><tr><th scope="col">No.</th><th scope="col">회원</th><th scope="col">만족도</th><th scope="col">개선 항목</th><th scope="col">코멘트</th><th scope="col">응답일</th></tr></thead>
          <tbody>{filteredResponses.length === 0 ? <tr><td colSpan={6} className="admin-empty-table-state">저장된 설문 응답이 없습니다.</td></tr> : filteredResponses.map((response, index) => <tr key={response.memberId}><td data-label="No.">{index + 1}</td><td data-label="회원"><code>{response.memberEmail ?? `회원 ${response.memberId}`}</code>{response.memberName && <small className="admin-survey-member-name">{response.memberName}</small>}</td><td data-label="만족도"><span className={`admin-request-tag ${response.rating === 5 ? '' : 'other'}`}>{response.rating === 5 ? '좋아요' : response.rating === 1 ? '싫어요' : '미응답'}</span></td><td data-label="개선 항목"><span className="admin-request-other-text">{response.improvements.length ? response.improvements.join(' · ') : '선택 없음'}</span></td><td data-label="코멘트"><span className="admin-request-other-text">{response.comment || '—'}</span></td><td data-label="응답일">{response.completedAt ? formatAdminDate(response.completedAt) : '—'}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

const getDashboardSectionFromUrl = (): DashboardSection => {
  const section = new URLSearchParams(window.location.search).get('tab')
  if (section === 'overview' || section === 'home') return 'overview'
  if (section === 'ci-generations' || section === 'ci-generation') return 'ci-generations'
  if (section === 'bi-generations' || section === 'bi-generation') return 'bi-generations'
  if (section === 'generation' || section === 'generations' || section === 'logo-generation' || section === 'download' || section === 'downloads' || section === 'signup' || section === 'signups' || section === 'join' || section === 'credits' || section === 'credit' || section === 'credit-stats') return 'overview'
  if (section === 'requests' || section === 'improvement' || section === 'feedback') return 'requests'
  if (section === 'similarity' || section === 'similarity-test' || section === 'similarity-vectors') return 'similarity'
  if (section === 'members' || section === 'member-list' || section === 'users') return 'members'
  if (section === 'admins' || section === 'admin-list' || section === 'administrators') return 'admins'
  return 'overview'
}

export default function AdminDashboard({ standalone = false }: AdminDashboardProps) {
  const [dashboardPeriod, setDashboardPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly')
  const [dashboardCalendarMonth, setDashboardCalendarMonth] = useState(() => new Date())
  const [dashboardCustomStart, setDashboardCustomStart] = useState('')
  const [dashboardCustomEnd, setDashboardCustomEnd] = useState('')
  const [dashboardCalendarOpen, setDashboardCalendarOpen] = useState(false)
  const dashboardCalendarRef = useRef<HTMLDivElement | null>(null)
  const adminAccountMenuRef = useRef<HTMLDivElement | null>(null)
  // 꺾은선 차트는 잰 폭을 그대로 viewBox 폭으로 써서 SVG 좌표와 화면 픽셀을 1:1로 맞춘다.
  const [overviewChartRef, overviewChartWidth] = useMeasuredWidth(600)
  const [generationChartRef, generationChartWidth] = useMeasuredWidth(600)
  const [dashboardSection, setDashboardSectionState] = useState<DashboardSection>(getDashboardSectionFromUrl)
  const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(true)
  const [isStatsMenuOpen, setIsStatsMenuOpen] = useState(true)
  const [openLogoPanel, setOpenLogoPanel] = useState<LogoPanelState>(null)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [openOnboardingMemberId, setOpenOnboardingMemberId] = useState<number | null>(null)
  const [hoveredOverviewSignupPoint, setHoveredOverviewSignupPoint] = useState<number | null>(null)
  const [hoveredGenerationUserPoint, setHoveredGenerationUserPoint] = useState<number | null>(null)
  const [adminId, setAdminId] = useState(getStoredAdminId)
  const [adminToken, setAdminToken] = useState(getStoredAdminToken)
  const [adminLoginId, setAdminLoginId] = useState(getStoredAdminId)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminLoginError, setAdminLoginError] = useState('')
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalyticsResponse | null>(null)
  const [adminMemberData, setAdminMemberData] = useState<AdminMember[]>([])
  const [adminMemberDownloadCounts, setAdminMemberDownloadCounts] = useState<Record<number, { ci: number; bi: number }>>({})
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([])
  const [adminCiGenerationMembers, setAdminCiGenerationMembers] = useState<AdminLogoMemberRecord[]>([])
  const [adminBiGenerationMembers, setAdminBiGenerationMembers] = useState<AdminLogoMemberRecord[]>([])
  const [adminSurveyResponses, setAdminSurveyResponses] = useState<AdminSurveyResponse[]>([])
  const [adminSimilarityVectors, setAdminSimilarityVectors] = useState<AdminSimilarityVectorRow[]>([])
  const adminInitial = Array.from(adminId.trim())[0]?.toLocaleUpperCase() || 'A'

  const logoutAdmin = () => {
    setIsAdminMenuOpen(false)
    setAdminToken('')
    storeAdminToken('')
    setAdminPassword('')
  }

  const vectorizedCandidateIds = new Set(adminSimilarityVectors.map((vector) => vector.candidateId))

  const handleVectorizeLogo = async (candidateId: string) => {
    if (standalone) {
      const mock = [...ciGenerationMembers, ...biGenerationMembers]
        .flatMap((member) => member.generatedLogos)
        .find((logo) => logo.id === candidateId)
      if (!mock) return
      setAdminSimilarityVectors((current) => current.some((vector) => vector.candidateId === candidateId) ? current : [
        { id: Date.now(), candidateId, projectId: mock.projectId, projectType: candidateId.startsWith('bi-') ? 'BI' : 'CI', name: mock.name, imageUrl: mock.imageUrl, vectorizedAt: '2026.08.25' },
        ...current,
      ])
      return
    }
    const row = await adminApi.vectorizeLogo(adminToken, candidateId)
    setAdminSimilarityVectors((current) => [row, ...current.filter((vector) => vector.candidateId !== candidateId)])
  }

  const setDashboardSection = (nextSection: DashboardSection) => {
    setDashboardSectionState(nextSection)
    if (standalone) return

    const url = new URL(window.location.href)
    url.pathname = '/admin/'
    url.searchParams.set('view', 'dashboard')
    url.searchParams.set('tab', nextSection)
    window.history.pushState({ view: 'dashboard', tab: nextSection }, '', `${url.pathname}${url.search}${url.hash}`)
  }

  useEffect(() => {
    if (standalone) return

    const url = new URL(window.location.href)
    let shouldReplace = false

    if (url.pathname !== '/admin/') {
      url.pathname = '/admin/'
      shouldReplace = true
    }
    if (url.searchParams.get('view') !== 'dashboard') {
      url.searchParams.set('view', 'dashboard')
      shouldReplace = true
    }
    if (!url.searchParams.has('tab')) {
      url.searchParams.set('tab', getDashboardSectionFromUrl())
      shouldReplace = true
    }

    if (shouldReplace) {
      window.history.replaceState(
        { view: 'dashboard', tab: getDashboardSectionFromUrl() },
        '',
        `${url.pathname}${url.search}${url.hash}`,
      )
    }

    const handlePopState = () => setDashboardSectionState(getDashboardSectionFromUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [standalone])

  useEffect(() => {
    const handleCalendarOutsidePointerDown = (event: globalThis.PointerEvent) => {
      if (!dashboardCalendarOpen) return
      const target = event.target
      if (target instanceof Node && !dashboardCalendarRef.current?.contains(target)) {
        setDashboardCalendarOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleCalendarOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', handleCalendarOutsidePointerDown)
  }, [dashboardCalendarOpen])

  useEffect(() => {
    if (!isAdminMenuOpen) return

    const handleAdminMenuOutsidePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !adminAccountMenuRef.current?.contains(target)) {
        setIsAdminMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleAdminMenuOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', handleAdminMenuOutsidePointerDown)
  }, [isAdminMenuOpen])

  useEffect(() => {
    if (standalone || !adminToken) return

    let cancelled = false

    const loadMembers = async () => {
      const members = await adminApi.members(adminToken)
      if (cancelled) return
      setAdminMemberData(members)

      const entries = await Promise.all(members.map(async (member) => {
        const [ciDownloads, biDownloads] = await Promise.all([
          adminApi.memberDownloads(adminToken, member.id, 'CI'),
          adminApi.memberDownloads(adminToken, member.id, 'BI'),
        ])
        return [member.id, { ci: ciDownloads.length, bi: biDownloads.length }] as const
      }))
       if (!cancelled) setAdminMemberDownloadCounts(Object.fromEntries(entries))
    }

    void Promise.allSettled([
      loadMembers(),
      adminApi.admins(adminToken).then((accounts) => { if (!cancelled) setAdminAccounts(accounts) }),
      adminApi.generationRecords(adminToken, 'CI').then((records) => { if (!cancelled) setAdminCiGenerationMembers(records) }),
      adminApi.generationRecords(adminToken, 'BI').then((records) => { if (!cancelled) setAdminBiGenerationMembers(records) }),
      adminApi.surveyResponses(adminToken).then((responses) => { if (!cancelled) setAdminSurveyResponses(responses) }),
      adminApi.similarityVectors(adminToken).then((vectors) => { if (!cancelled) setAdminSimilarityVectors(vectors) }),
    ]).then((results) => {
      if (results.some((result) => result.status === 'rejected' && result.reason instanceof AuthError && result.reason.status === 401)) {
        setAdminToken('')
        storeAdminToken('')
        setAdminLoginError('관리자 세션이 만료되었습니다. 다시 로그인해주세요.')
      }
    })
    return () => { cancelled = true }
  }, [adminToken, standalone])

  useEffect(() => {
    if (standalone || !adminToken) return
    if (dashboardPeriod === 'custom' && (!dashboardCustomStart || !dashboardCustomEnd)) return

    let cancelled = false
    void adminApi.analytics(adminToken, dashboardPeriod, dashboardCustomStart || undefined, dashboardCustomEnd || undefined)
      .then((analytics) => {
        if (!cancelled) setAdminAnalytics(analytics)
      })
      .catch((error) => {
        if (error instanceof AuthError && error.status === 401) {
          setAdminToken('')
          storeAdminToken('')
          setAdminLoginError('관리자 세션이 만료되었습니다. 다시 로그인해주세요.')
        }
      })
    return () => { cancelled = true }
  }, [adminToken, dashboardCustomEnd, dashboardCustomStart, dashboardPeriod, standalone])

  const submitAdminLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (adminLoginLoading) return
    setAdminLoginLoading(true)
    setAdminLoginError('')
    void adminApi.login(adminLoginId.trim(), adminPassword)
      .then((result) => {
        setAdminToken(result.accessToken)
        storeAdminToken(result.accessToken)
        setAdminId(result.loginId)
        storeAdminId(result.loginId)
        setAdminPassword('')
        // 로그인 전 URL에 다른 탭(?tab=members 등)이 남아 있으면 dashboardSection이
        // 그 값으로 초기화돼 있을 수 있다 — 로그인 성공 시에는 항상 대시보드(개요)로,
        // 기간도 항상 주간으로 되돌려서 로그인 직후 화면을 일관되게 만든다.
        setDashboardSection('overview')
        setDashboardPeriod('weekly')
      })
      .catch((error) => {
        setAdminLoginError(error instanceof AuthError && error.code === 'ADMIN_LOGIN_FAILED' ? '아이디 또는 비밀번호를 확인해주세요.' : error instanceof Error ? error.message : '관리자 로그인에 실패했어요.')
      })
      .finally(() => setAdminLoginLoading(false))
  }

  const renderAdminLoginScreen = () => (
    <main className="admin-login-screen">
      <form className="admin-login-card" onSubmit={submitAdminLogin}>
        <div className="admin-brand"><GenMarkLogo className="admin-brand-mark" /><strong>GenMark <em>AI</em></strong></div>
        <h1>관리자 로그인</h1>
        <p>관리자 계정으로 대시보드에 접근하세요.</p>
        <label htmlFor="admin-login-id">아이디</label>
        <input id="admin-login-id" value={adminLoginId} onChange={(event) => setAdminLoginId(event.target.value)} autoComplete="username" />
        <label htmlFor="admin-login-password">비밀번호</label>
        <input id="admin-login-password" type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} autoComplete="current-password" />
        {adminLoginError && <p className="admin-login-error" role="alert">{adminLoginError}</p>}
        <button type="submit" disabled={adminLoginLoading}>{adminLoginLoading ? '로그인 중…' : '로그인'}</button>
      </form>
    </main>
  )

  const renderDashboardScreen = () => {
    const periodLabels = { daily: '일일', weekly: '주간', monthly: '월간', custom: '사용자 지정' }
    const generationXAxisLabelsByPeriod = {
      daily: Array.from({ length: 12 }, (_, index) => `${index + 1}일`),
      weekly: ['8/1', '8/2', '8/3', '8/4', '8/5', '8/6', '8/7'],
      monthly: ['9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월'],
      custom: Array.from({ length: 12 }, (_, index) => `${index + 1}구간`),
    } as const
    const generationXAxisLabels = adminAnalytics
      ? adminAnalytics.signup.trend.map((point) => point.label)
      : generationXAxisLabelsByPeriod[dashboardPeriod]
    const dashboardSectionLabels: Record<DashboardSection, string> = { overview: '대시보드', generation: '', download: '', signup: '', requests: '개선 요청', members: '회원 목록', admins: '관리자 목록', credits: '', 'ci-generations': 'CI 생성 목록', 'bi-generations': 'BI 생성 목록', similarity: '유사도 관리 및 테스트' }
    const calendarDays = getCalendarDays(dashboardCalendarMonth)
    const calendarMonthLabel = `${dashboardCalendarMonth.getFullYear()}년 ${dashboardCalendarMonth.getMonth() + 1}월`
    const customRangeLabel = dashboardCustomStart && dashboardCustomEnd
      ? `${dashboardCustomStart.replace(/-/g, '.')} ~ ${dashboardCustomEnd.replace(/-/g, '.')}`
      : '날짜를 선택해주세요.'

    const handleDashboardPeriodChange = (period: keyof typeof periodLabels) => {
      setDashboardPeriod(period)
      setHoveredOverviewSignupPoint(null)
      setHoveredGenerationUserPoint(null)
      setDashboardCalendarOpen(period === 'custom')
    }

    const handleDashboardDateSelect = (date: Date) => {
      const dateKey = getDateKey(date)
      if (!dashboardCustomStart || dashboardCustomEnd) {
        setDashboardCustomStart(dateKey)
        setDashboardCustomEnd('')
        return
      }

      if (dateKey < dashboardCustomStart) {
        setDashboardCustomStart(dateKey)
        setDashboardCustomEnd(dashboardCustomStart)
      } else {
        setDashboardCustomEnd(dateKey)
      }
    }

    const purposeStats = [
      { label: '신규 창업', value: 42, color: '#8d70ed' },
      { label: '리브랜딩', value: 24, color: '#ed70ac' },
      { label: '온라인 판매', value: 18, color: '#f6b56d' },
      { label: 'SNS 채널', value: 11, color: '#8fc8f4' },
      { label: '기타', value: 5, color: '#d8dbe2' },
    ]
    const ciInputs = [
      { label: '신뢰감', value: 38 },
      { label: '혁신', value: 27 },
      { label: '지속가능성', value: 21 },
      { label: '성장', value: 14 },
    ]
    const biInputs = [
      { label: '스킨케어', value: 46 },
      { label: '클린뷰티', value: 28 },
      { label: '메이크업', value: 16 },
      { label: '바디케어', value: 10 },
    ]
    const periodData = {
      daily: { total: '324', completion: '96.8', avg: '1:42', active: '128', totalDelta: '+6.4%', completionDelta: '+1.8%', avgDelta: '-24초', activeDelta: '+4.5%', ci: '116', bi: '208', userTrend: [30, 42, 55, 68, 74, 82, 96, 102, 110, 118, 125, 128] },
      weekly: { total: '2,186', completion: '97.1', avg: '1:57', active: '438', totalDelta: '+9.2%', completionDelta: '+2.5%', avgDelta: '-18초', activeDelta: '+7.8%', ci: '742', bi: '1,444', userTrend: [268, 294, 310, 356, 342, 304, 312] },
      monthly: { total: '9,187', completion: '97.4', avg: '2:18', active: '1,248', totalDelta: '+12.8%', completionDelta: '+3.2%', avgDelta: '-18초', activeDelta: '+8.6%', ci: '3,124', bi: '6,063', userTrend: [280, 340, 400, 450, 470, 560, 670, 780, 870, 960, 1_180, 1_320] },
      custom: { total: '1,764', completion: '96.5', avg: '2:06', active: '312', totalDelta: '+7.1%', completionDelta: '+1.4%', avgDelta: '-12초', activeDelta: '+5.9%', ci: '598', bi: '1,166', userTrend: [112, 125, 148, 171, 184, 205, 219, 244, 268, 289, 303, 312] },
    } as const
    const emptyPeriodData = {
      total: '0', completion: '0', avg: '—', active: '0', totalDelta: '실데이터', completionDelta: '', avgDelta: '', activeDelta: '', ci: '0', bi: '0', userTrend: [] as number[],
    }
    const selectedPeriodData = adminAnalytics
      ? {
          total: adminAnalytics.generation.total.toLocaleString(),
          completion: adminAnalytics.generation.succeeded + adminAnalytics.generation.failed > 0
            ? (adminAnalytics.generation.succeeded / (adminAnalytics.generation.succeeded + adminAnalytics.generation.failed) * 100).toFixed(1)
            : '0',
          avg: '—',
          active: adminAnalytics.signup.startedGenerationMembers.toLocaleString(),
          totalDelta: '실데이터', completionDelta: '', avgDelta: '', activeDelta: '',
          ci: adminAnalytics.generation.ci.toLocaleString(), bi: adminAnalytics.generation.bi.toLocaleString(),
          userTrend: adminAnalytics.signup.trend.map((point) => point.value),
        }
      : standalone ? periodData[dashboardPeriod] : emptyPeriodData
    const generationPeriodExtras = {
      daily: { purpose: [42, 24, 18, 11, 5], satisfaction: 84, likes: 1248, dislikes: 236, ciInputs: [38, 27, 21, 14], biInputs: [46, 28, 16, 10], ciCompletion: '98.1', biCompletion: '96.8' },
      weekly: { purpose: [39, 27, 19, 10, 5], satisfaction: 86, likes: 1810, dislikes: 295, ciInputs: [41, 25, 20, 14], biInputs: [43, 30, 17, 10], ciCompletion: '98.4', biCompletion: '97.1' },
      monthly: { purpose: [36, 29, 20, 10, 5], satisfaction: 89, likes: 7720, dislikes: 960, ciInputs: [43, 24, 19, 14], biInputs: [41, 31, 18, 10], ciCompletion: '98.8', biCompletion: '97.6' },
      custom: { purpose: [44, 23, 17, 10, 6], satisfaction: 83, likes: 1470, dislikes: 300, ciInputs: [36, 30, 20, 14], biInputs: [48, 26, 16, 10], ciCompletion: '97.9', biCompletion: '96.4' },
    } as const
    const livePurposeStats = adminAnalytics?.generation.purpose ?? []
    const liveCiInputs = adminAnalytics?.generation.ciInputs ?? []
    const liveBiInputs = adminAnalytics?.generation.biInputs ?? []
    const toPercentageStats = (items: Array<{ label: string; value: number }>, colors: string[]) => {
      const total = items.reduce((sum, item) => sum + item.value, 0)
      return items.map((item, index) => ({ label: item.label, value: total ? Math.round(item.value * 100 / total) : 0, color: colors[index] ?? '#d8dbe2' }))
    }
    const selectedGenerationExtras = adminAnalytics
      ? {
          purpose: toPercentageStats(livePurposeStats, ['#8d70ed', '#ed70ac', '#f6b56d', '#8fc8f4', '#d8dbe2']).map((item) => item.value),
          satisfaction: adminAnalytics.generation.satisfactionPercent,
          likes: adminAnalytics.generation.likes,
          dislikes: adminAnalytics.generation.dislikes,
          ciInputs: toPercentageStats(liveCiInputs, ['#8d70ed', '#ed70ac', '#f6b56d', '#8fc8f4']).map((item) => item.value),
          biInputs: toPercentageStats(liveBiInputs, ['#8d70ed', '#ed70ac', '#f6b56d', '#8fc8f4']).map((item) => item.value),
          ciCompletion: '—', biCompletion: '—',
        }
      : standalone ? generationPeriodExtras[dashboardPeriod] : { purpose: [], satisfaction: 0, likes: 0, dislikes: 0, ciInputs: [], biInputs: [], ciCompletion: '—', biCompletion: '—' }
    const generationAnalysisByPeriod = { daily: 62, weekly: 65, monthly: 68, custom: 64 } as const
    const selectedGenerationAnalysis = adminAnalytics?.generation.trademarkUsagePercent ?? (standalone ? generationAnalysisByPeriod[dashboardPeriod] : 0)
    const formatGenerationAnalysisCount = (percentage: number) => Math.round(Number(selectedPeriodData.total.replace(/,/g, '')) * percentage / 100).toLocaleString()
    const selectedPurposeStats = adminAnalytics
      ? toPercentageStats(livePurposeStats, ['#8d70ed', '#ed70ac', '#f6b56d', '#8fc8f4', '#d8dbe2'])
      : purposeStats.map((item, index) => ({ ...item, value: selectedGenerationExtras.purpose[index] ?? 0 }))
    const selectedCiInputs = adminAnalytics
      ? toPercentageStats(liveCiInputs, ['#8d70ed', '#ed70ac', '#f6b56d', '#8fc8f4'])
      : ciInputs.map((item, index) => ({ ...item, value: selectedGenerationExtras.ciInputs[index] ?? 0 }))
    const selectedBiInputs = adminAnalytics
      ? toPercentageStats(liveBiInputs, ['#8d70ed', '#ed70ac', '#f6b56d', '#8fc8f4'])
      : biInputs.map((item, index) => ({ ...item, value: selectedGenerationExtras.biInputs[index] ?? 0 }))
    const surveyRequests = [
      { id: 1, category: '로고 디자인', message: '생성된 로고 후보를 한 화면에서 비교하기 쉽도록 개선해주세요.', user: '김민지', time: '오늘 10:24' },
      { id: 2, category: '생성 속도', message: '로고 생성 중 현재 진행 단계를 더 자세히 보여주면 좋겠어요.', user: '이준호', time: '어제 16:08' },
      { id: 3, category: '상표 이미지 분석', message: '유사도 결과에 분석 기준과 참고 설명이 함께 나오면 좋겠습니다.', user: '박서연', time: '어제 11:42' },
      { id: 4, category: '제품 썸네일', message: '완성한 로고로 제품 썸네일까지 바로 만들어보고 싶어요.', user: '최지훈', time: '8월 4일' },
    ]
    const generationUserAxis = buildNiceAxis(Math.max(0, ...selectedPeriodData.userTrend))
    const chartPoints = buildLinePoints(selectedPeriodData.userTrend, generationXAxisLabels, {
      left: LINE_CHART.gutter, right: generationChartWidth - LINE_CHART.padRight,
      top: LINE_CHART.plotTop, bottom: LINE_CHART.plotBottom, axisTop: generationUserAxis.top,
    })
    const chartPath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
    const chartAreaPath = chartPoints.length
      ? `${chartPath} L${chartPoints[chartPoints.length - 1].x} ${LINE_CHART.plotBottom} L${chartPoints[0].x} ${LINE_CHART.plotBottom} Z`
      : ''
    const signupPeriodData = {
      daily: { total: '12,684', newUsers: '1,248', completion: '82.4', started: '68.7', totalDelta: '+8.6%', newDelta: '이번 달', completionDelta: '+4.1%', startedDelta: '+6.2%', monthly: [520, 610, 700, 780, 744, 900, 1010, 1100, 1248, 1240, 1236, 1248], sources: [46, 34, 12, 8], funnel: [1248, 1029, 852, 684], dropoff: '17.2' },
      weekly: { total: '18,420', newUsers: '2,186', completion: '84.1', started: '71.5', totalDelta: '+10.2%', newDelta: '+7.4%', completionDelta: '+4.8%', startedDelta: '+7.1%', monthly: [148, 176, 204, 232, 220, 266, 294, 320, 356, 382, 410, 438], sources: [42, 37, 13, 8], funnel: [2186, 1810, 1528, 1268], dropoff: '15.9' },
      monthly: { total: '42,680', newUsers: '9,187', completion: '87.3', started: '75.8', totalDelta: '+14.6%', newDelta: '+12.8%', completionDelta: '+6.9%', startedDelta: '+9.4%', monthly: [280, 340, 400, 450, 470, 560, 670, 780, 870, 960, 1180, 1320], sources: [39, 41, 12, 8], funnel: [9187, 7720, 6860, 5984], dropoff: '11.2' },
      custom: { total: '6,742', newUsers: '1,764', completion: '83.6', started: '70.2', totalDelta: '+9.8%', newDelta: '+5.6%', completionDelta: '+4.7%', startedDelta: '+6.8%', monthly: [112, 125, 148, 171, 184, 205, 219, 244, 268, 289, 303, 312], sources: [48, 29, 15, 8], funnel: [1764, 1470, 1210, 920], dropoff: '16.7' },
    } as const
    const providerCount = (label: string) => adminAnalytics?.signup.providerCounts.find((item) => item.label === label)?.value ?? 0
    const signupSourceTotal = adminAnalytics?.signup.providerCounts.reduce((sum, item) => sum + item.value, 0) ?? 0
    const selectedSignupData = adminAnalytics
      ? {
          total: adminAnalytics.signup.totalMembers.toLocaleString(),
          newUsers: adminAnalytics.signup.newMembers.toLocaleString(),
          completion: '—',
          started: adminAnalytics.signup.newMembers ? (adminAnalytics.signup.startedGenerationMembers / adminAnalytics.signup.newMembers * 100).toFixed(1) : '0',
          totalDelta: '실데이터', newDelta: '실데이터', completionDelta: '', startedDelta: '',
          monthly: adminAnalytics.signup.trend.map((point) => point.value),
          sources: [
            signupSourceTotal ? Math.round(providerCount('카카오 로그인') * 100 / signupSourceTotal) : 0,
            signupSourceTotal ? Math.round(providerCount('Google 로그인') * 100 / signupSourceTotal) : 0,
            0,
            signupSourceTotal ? Math.round(providerCount('기타') * 100 / signupSourceTotal) : 0,
          ],
          funnel: adminAnalytics.signup.funnel.map((item) => item.value),
          dropoff: adminAnalytics.signup.newMembers ? ((1 - adminAnalytics.signup.startedGenerationMembers / adminAnalytics.signup.newMembers) * 100).toFixed(1) : '0',
        }
      : standalone ? signupPeriodData[dashboardPeriod] : { total: '0', newUsers: '0', completion: '—', started: '0', totalDelta: '실데이터', newDelta: '실데이터', completionDelta: '', startedDelta: '', monthly: [], sources: [0, 0, 0, 0], funnel: [0, 0, 0, 0], dropoff: '0' }
    const signupSourceStats = adminAnalytics
      ? adminAnalytics.signup.providerCounts.map((item) => ({ label: item.label, value: signupSourceTotal ? Math.round(item.value * 100 / signupSourceTotal) : 0 }))
      : [{ label: '카카오 로그인', value: selectedSignupData.sources[0] }, { label: 'Google 로그인', value: selectedSignupData.sources[1] }, { label: '기타', value: selectedSignupData.sources[3] }]
    const signupMonthlyValues = selectedSignupData.monthly
    const signupMonthlyMax = Math.max(1, ...signupMonthlyValues)
    const signupAxisLabelsByPeriod = {
      daily: Array.from({ length: 12 }, (_, index) => `${index + 1}일`),
      weekly: Array.from({ length: 12 }, (_, index) => `${index + 1}주`),
      monthly: ['9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월'],
      custom: Array.from({ length: 12 }, (_, index) => `${index + 1}구간`),
    } as const
    const signupXAxisLabels = adminAnalytics
      ? adminAnalytics.signup.trend.map((point) => point.label)
      : dashboardPeriod === 'custom' && dashboardCustomStart && dashboardCustomEnd
      ? Array.from({ length: 12 }, (_, index) => {
        const start = new Date(`${dashboardCustomStart}T00:00:00`)
        const end = new Date(`${dashboardCustomEnd}T00:00:00`)
        const step = (end.getTime() - start.getTime()) / 11
        const date = new Date(start.getTime() + step * index)
        return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`
      })
      : signupAxisLabelsByPeriod[dashboardPeriod]
    const downloadPeriodData = {
      daily: { total: '6,842', conversion: '74.5', ci: '2,126', bi: '4,716', ciShare: '31.1', biShare: '68.9', ciStyles: [38, 29, 19, 14], biStyles: [32, 27, 22, 19], fileOnly: 58, fileWithInput: 42, analysis: 62, insightRates: ['81.4', '78.9', '74.2'] },
      weekly: { total: '13,420', conversion: '76.2', ci: '4,170', bi: '9,250', ciShare: '31.1', biShare: '68.9', ciStyles: [35, 31, 20, 14], biStyles: [30, 29, 23, 18], fileOnly: 55, fileWithInput: 45, analysis: 65, insightRates: ['82.1', '80.3', '76.8'] },
      monthly: { total: '38,960', conversion: '78.4', ci: '12,122', bi: '26,838', ciShare: '31.1', biShare: '68.9', ciStyles: [33, 32, 21, 14], biStyles: [28, 30, 24, 18], fileOnly: 52, fileWithInput: 48, analysis: 68, insightRates: ['84.6', '82.7', '79.4'] },
      custom: { total: '8,120', conversion: '75.8', ci: '2,487', bi: '5,633', ciShare: '30.6', biShare: '69.4', ciStyles: [37, 28, 21, 14], biStyles: [34, 26, 22, 18], fileOnly: 57, fileWithInput: 43, analysis: 64, insightRates: ['80.8', '77.6', '73.5'] },
    } as const
    const stylePercent = (items: Array<{ label: string; value: number }>, label: string) => items.find((item) => item.label === label)?.value ?? 0
    const liveCiStyles = adminAnalytics?.downloads.ciStyles ?? []
    const liveBiStyles = adminAnalytics?.downloads.biStyles ?? []
    const selectedDownloadData = adminAnalytics
      ? {
          total: adminAnalytics.downloads.total.toLocaleString(), conversion: '실데이터',
          ci: adminAnalytics.downloads.ci.toLocaleString(), bi: adminAnalytics.downloads.bi.toLocaleString(),
          ciShare: adminAnalytics.downloads.total ? (adminAnalytics.downloads.ci / adminAnalytics.downloads.total * 100).toFixed(1) : '0',
          biShare: adminAnalytics.downloads.total ? (adminAnalytics.downloads.bi / adminAnalytics.downloads.total * 100).toFixed(1) : '0',
          ciStyles: ['콤비네이션', '심볼마크', '워드마크', '레터마크'].map((label) => stylePercent(liveCiStyles, label)),
          biStyles: ['콤비네이션', '심볼마크', '워드마크', '레터마크'].map((label) => stylePercent(liveBiStyles, label)),
          fileOnly: 0, fileWithInput: 0, analysis: 0, insightRates: ['—', '—', '—'],
        }
      : standalone ? downloadPeriodData[dashboardPeriod] : { total: '0', conversion: '실데이터', ci: '0', bi: '0', ciShare: '0', biShare: '0', ciStyles: [0, 0, 0, 0], biStyles: [0, 0, 0, 0], fileOnly: 0, fileWithInput: 0, analysis: 0, insightRates: ['—', '—', '—'] }
    // 도넛 그래프 색 비율을 실데이터(ciShare)에서 직접 계산한다 — 예전에는 CSS에
    // 31.1%/68.9%로 고정된 목업 그라데이션을 그대로 썼어서, 실제로는 CI 100%인데도
    // 화면에는 항상 같은 비율의 원이 나왔다.
    const downloadDonutTotal = Number(String(selectedDownloadData.total).replace(/,/g, '')) || 0
    const downloadDonutGradient = downloadDonutTotal === 0
      ? '#f3edf4'
      : `conic-gradient(#ed9d5c 0 ${selectedDownloadData.ciShare}%, #8d70ed ${selectedDownloadData.ciShare}% 100%)`
    const formatDownloadCount = (value: string | number) => Number(String(value).replace(/,/g, '')).toLocaleString()
    const downloadStyleCount = (total: string, percentage: number) => formatDownloadCount(Math.round(Number(total.replace(/,/g, '')) * percentage / 100))
    const overviewSignupTrendByPeriod = {
      daily: { labels: ['00시', '02시', '04시', '06시', '08시', '10시', '12시', '14시', '16시', '18시', '20시', '22시'], values: [34, 42, 51, 64, 78, 92, 106, 118, 132, 146, 157, 168] },
      weekly: { labels: ['8/1', '8/2', '8/3', '8/4', '8/5', '8/6', '8/7'], values: [268, 294, 310, 356, 342, 304, 312] },
      monthly: { labels: ['9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월'], values: [520, 610, 700, 780, 744, 900, 1010, 1100, 1248, 1240, 1236, 1248] },
      custom: { labels: ['1일', '3일', '5일', '7일', '9일', '11일', '13일', '15일'], values: [112, 125, 148, 171, 184, 205, 219, 244] },
    } as const
    const overviewSignupTrend = adminAnalytics
      ? { labels: adminAnalytics.signup.trend.map((point) => point.label), values: adminAnalytics.signup.trend.map((point) => point.value) }
      : standalone ? overviewSignupTrendByPeriod[dashboardPeriod] : { labels: [], values: [] }
    const overviewSignupAxis = buildNiceAxis(Math.max(0, ...overviewSignupTrend.values))
    const overviewSignupLayout = {
      left: MINI_CHART.gutter, right: overviewChartWidth - MINI_CHART.padRight,
      top: MINI_CHART.plotTop, bottom: MINI_CHART.plotBottom, axisTop: overviewSignupAxis.top,
    }
    const overviewSignupChartPoints = buildLinePoints(overviewSignupTrend.values, overviewSignupTrend.labels, overviewSignupLayout)
    const overviewSignupChartPath = overviewSignupChartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
    const overviewSignupAreaPath = overviewSignupChartPoints.length
      ? `${overviewSignupChartPath} L${overviewSignupChartPoints[overviewSignupChartPoints.length - 1].x} ${MINI_CHART.plotBottom} L${overviewSignupChartPoints[0].x} ${MINI_CHART.plotBottom} Z`
      : ''
    const logoGenerationTrendByPeriod = {
      daily: { labels: ['00시', '04시', '08시', '12시', '16시', '20시'], ci: [14, 18, 22, 27, 31, 36], bi: [24, 31, 38, 44, 53, 62] },
      weekly: { labels: ['8/1', '8/2', '8/3', '8/4', '8/5', '8/6', '8/7'], ci: [92, 106, 98, 120, 126, 110, 90], bi: [168, 186, 176, 204, 218, 190, 162] },
      monthly: { labels: ['9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월'], ci: [280, 340, 400, 450, 470, 560, 670, 780, 870, 960, 1180, 1320].map((value) => Math.round(value * .34)), bi: [280, 340, 400, 450, 470, 560, 670, 780, 870, 960, 1180, 1320].map((value) => Math.round(value * .66)) },
      custom: { labels: ['1일', '3일', '5일', '7일', '9일', '11일', '13일', '15일'], ci: [38, 42, 47, 52, 58, 62, 66, 72], bi: [74, 83, 92, 104, 116, 127, 139, 150] },
    } as const
    const logoGenerationTrend = adminAnalytics
      ? { labels: adminAnalytics.generation.trend.map((point) => point.label), ci: adminAnalytics.generation.trend.map((point) => point.ci), bi: adminAnalytics.generation.trend.map((point) => point.bi) }
      : standalone ? logoGenerationTrendByPeriod[dashboardPeriod] : { labels: [], ci: [], bi: [] }
    const logoGenerationAxis = buildNiceAxis(Math.max(0, ...logoGenerationTrend.ci, ...logoGenerationTrend.bi))
    // 0건은 색칠된 막대 대신 회색 점선을 바닥에 붙여, "값이 아주 작다"와
    // "아예 0이다"를 한눈에 구분할 수 있게 한다.
    const renderDualBarSegment = (kind: 'ci' | 'bi', kindLabel: string, label: string, value: number) => value > 0
      ? <i key={kind} className={kind} style={{ height: `${Math.max(3, (value / logoGenerationAxis.top) * 100)}%` }} title={`${label} ${kindLabel} ${value.toLocaleString()}건`} aria-label={`${label} ${kindLabel} ${value.toLocaleString()}건`} tabIndex={0} />
      : <i key={kind} className={`${kind} zero`} title={`${label} ${kindLabel} 0건`} aria-label={`${label} ${kindLabel} 0건`} tabIndex={0} />

    // 설문 개선 항목·온보딩 작성 현황은 "누적 전체" 통계다 — 가입자 수 헤더 총량과
    // 같은 성격이라, 기간(일일/주간/월간/사용자 지정) 필터가 바뀌어도 그대로 둔다.
    // adminAnalytics.survey/signup.onboarding*는 기간별로 다시 집계된 값이라 여기
    // 쓰지 않고, 기간과 무관하게 한 번만 불러오는 전체 목록(adminSurveyResponses,
    // allAdminMembers)에서 직접 세어 쓴다.
    // 생성/가입일자 최신순(내림차순). 파싱 실패한 값은 0으로 취급해 맨 뒤로 보낸다.
    const byCreatedAtDesc = (a: { createdAt: string }, b: { createdAt: string }) =>
      (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)

    const allAdminMembers: AdminMemberTableRow[] = standalone ? previewAdminMembers : adminMemberData
    // filter()가 새 배열을 반환하므로 sort()가 원본(adminMemberData 등)을 건드리지 않는다.
    const displayedAdminMembers = allAdminMembers
      .filter((member) => matchesAdminMemberSearch(memberSearchQuery, member.email))
      .sort(byCreatedAtDesc)

    // 온보딩(첫 방문 설문) 1단계 "어디에 사용할 예정인가요?" 응답 분포.
    // member.onboardingUsage/onboardingAudience에는 화면 문구가 아니라 제출 당시의
    // 원시 코드(online/social/offline, company/owner/hobby/sidejob)가 그대로 들어있다
    // (AdminMemberRow 주석 참고) — AdminAnalyticsService의 매핑과 똑같이 코드→한글로 바꿔서 센다.
    const onboardingUsageOptions = [
      { code: 'online', label: '온라인 판매' },
      { code: 'social', label: 'SNS' },
      { code: 'offline', label: '오프라인' },
    ] as const
    const onboardingUsagePreview = [{ label: '온라인 판매', value: 812 }, { label: 'SNS', value: 640 }, { label: '오프라인', value: 288 }]
    const selectedOnboardingUsageStats = !standalone
      ? onboardingUsageOptions.map(({ code, label }) => ({ label, value: allAdminMembers.filter((member) => member.onboardingUsage.includes(code)).length }))
      : onboardingUsagePreview
    const onboardingUsageMax = Math.max(1, ...selectedOnboardingUsageStats.map(({ value }) => value))

    // 온보딩 2단계 "어떤 계기로 방문하게 되셨나요?" 응답 분포.
    const onboardingAudienceOptions = [
      { code: 'company', label: '회사 / 팀' },
      { code: 'owner', label: '자영업' },
      { code: 'hobby', label: '취미 / 창작' },
      { code: 'sidejob', label: '부업 & 투잡' },
    ] as const
    const onboardingAudiencePreview = [{ label: '회사 / 팀', value: 504 }, { label: '자영업', value: 688 }, { label: '취미 / 창작', value: 326 }, { label: '부업 & 투잡', value: 222 }]
    const selectedOnboardingAudienceStats = !standalone
      ? onboardingAudienceOptions.map(({ code, label }) => ({ label, value: allAdminMembers.filter((member) => member.onboardingAudience === code).length }))
      : onboardingAudiencePreview
    const onboardingAudienceMax = Math.max(1, ...selectedOnboardingAudienceStats.map(({ value }) => value))

    const surveyImprovementCategories = [
      '로고 생성 시간이 오래 걸려서 불편함',
      '원하는 느낌/스타일의 로고가 잘 안 나옴',
      '로고 수정이 어렵거나 마음대로 안 됨',
      '브랜드 키트·명함 만들기 기능이 아쉬움',
      '유사 상표 확인 결과를 얼마나 믿어야 할지 모르겠음',
      '기타 사항',
    ] as const
    const surveyImprovementPreview = [4920, 4310, 3460, 2360, 1640, 380]
    const selectedSurveyImprovementStats = !standalone
      ? surveyImprovementCategories.map((label) => ({
          label,
          value: adminSurveyResponses.filter((response) => response.improvements.includes(label)).length,
        }))
      : surveyImprovementCategories.map((label, index) => ({ label, value: surveyImprovementPreview[index] }))
    const surveyImprovementMax = Math.max(1, ...selectedSurveyImprovementStats.map(({ value }) => value))
    const surveyImprovementTotal = selectedSurveyImprovementStats.reduce((total, { value }) => total + value, 0)
    const surveyLikeCount = adminSurveyResponses.filter((response) => response.rating === 5).length
    const surveyDislikeCount = adminSurveyResponses.filter((response) => response.rating === 1).length
    // 온보딩 작성률은 기간과 무관하게 "지금 이 순간" 기준 누적 값이다 — 가입자 수 카드의
    // 총 회원 수와 같은 성격(추이 그래프만 기간별, 헤더 총량은 전체 누적)이라 맞춰뒀다.
    const onboardingCompletedCount = allAdminMembers.filter((member) => member.onboardingCompleted).length
    const onboardingTotalCount = allAdminMembers.length
    const onboardingCompletionRate = onboardingTotalCount ? Math.round(onboardingCompletedCount / onboardingTotalCount * 100) : 0
    const displayedAdminAccounts = (standalone
      ? previewAdminAccounts
      : adminAccounts.map((account) => ({ id: account.loginId, name: account.name, createdAt: account.createdAt, lastAccessAt: account.lastAccessAt ? account.lastAccessAt.replace('T', ' ') : '기록 없음' }))
    ).slice().sort(byCreatedAtDesc)

    return (
      <main className="admin-dashboard-screen">
        <aside className="admin-sidebar" aria-label="관리자 메뉴">
          <div className="admin-brand"><span className="admin-brand-mark"><Sparkles size={25} strokeWidth={1.8} /></span><strong>GenMark <em>AI</em></strong></div>
          <nav className="admin-menu">
            <button className={`admin-menu-item ${dashboardSection === 'overview' ? 'active' : ''}`} type="button" onClick={() => setDashboardSection('overview')}><House size={19} strokeWidth={1.8} /><span>대시보드</span></button>
            <div className="admin-menu-group"><button className={`admin-menu-item ${['members', 'admins'].includes(dashboardSection) ? 'active' : ''}`} type="button" aria-expanded={isMemberMenuOpen} onClick={() => setIsMemberMenuOpen((open) => !open)}><UsersRound size={19} strokeWidth={1.8} /><span>회원관리</span><ChevronDown className={isMemberMenuOpen ? 'menu-chevron-open' : ''} size={15} /></button>{isMemberMenuOpen && <div className="admin-submenu active-submenu"><button className={dashboardSection === 'members' ? 'active' : ''} type="button" onClick={() => setDashboardSection('members')}>회원목록</button><button className={dashboardSection === 'admins' ? 'active' : ''} type="button" onClick={() => setDashboardSection('admins')}>관리자 목록</button></div>}</div>
            <div className="admin-menu-group"><button className={`admin-menu-item ${['ci-generations', 'bi-generations'].includes(dashboardSection) ? 'active' : ''}`} type="button" aria-expanded={isStatsMenuOpen} onClick={() => setIsStatsMenuOpen((open) => !open)}><BarChart3 size={19} strokeWidth={1.8} /><span>로고 생성 목록</span><ChevronDown className={isStatsMenuOpen ? 'menu-chevron-open' : ''} size={15} /></button>{isStatsMenuOpen && <div className="admin-submenu active-submenu"><button className={dashboardSection === 'ci-generations' ? 'active' : ''} type="button" onClick={() => setDashboardSection('ci-generations')}>CI 생성 목록</button><button className={dashboardSection === 'bi-generations' ? 'active' : ''} type="button" onClick={() => setDashboardSection('bi-generations')}>BI 생성 목록</button></div>}</div>
            <button className={`admin-menu-item ${dashboardSection === 'requests' ? 'active' : ''}`} type="button" onClick={() => setDashboardSection('requests')}><ThumbsUp size={19} strokeWidth={1.8} /><span>개선 요청</span></button>
            <button className={`admin-menu-item ${dashboardSection === 'similarity' ? 'active' : ''}`} type="button" onClick={() => setDashboardSection('similarity')}><ScanSearch size={19} strokeWidth={1.8} /><span>유사도 관리 및 테스트</span></button>
          </nav>
        </aside>

        <section className="admin-dashboard-content">
          {/* 화면에는 안 보이고 인쇄할 때만 나오는 표지 — 인쇄물의 첫 페이지를
              통째로 차지하고, 그 다음부터 실제 내용(요약표 등)이 이어진다. */}
          <div className="admin-print-cover-page">
            <h1 className="admin-print-cover-title">GenMark AI 보고서</h1>
            <p className="admin-print-cover-meta">{dashboardSection === 'overview' ? `${periodLabels[dashboardPeriod]} 기준 ` : ''}{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 출력</p>
          </div>

          <header className="admin-dashboard-header">
             <div><h1>GenMark AI {dashboardSectionLabels[dashboardSection]}</h1></div>
            <div className="admin-header-actions" ref={adminAccountMenuRef}>
              <button className="admin-account-trigger" type="button" aria-label="관리자 계정 메뉴" aria-expanded={isAdminMenuOpen} onClick={() => setIsAdminMenuOpen((open) => !open)}>
                <span className="admin-avatar">{adminInitial}</span>
                <span className="admin-account-id">{adminId}</span>
                <ChevronDown className={isAdminMenuOpen ? 'menu-chevron-open' : ''} size={17} />
              </button>
              {isAdminMenuOpen && <div className="admin-account-menu" role="dialog" aria-label="관리자 메뉴">
                <p>관리자 아이디</p>
                <strong>{adminId}</strong>
                <button type="button" className="admin-logout-button" onClick={logoutAdmin}>로그아웃</button>
              </div>}
            </div>
          </header>

          {dashboardSection === 'overview' && <section className="admin-period-card">
            <div className="admin-period-picker" ref={dashboardCalendarRef}>
              <div className="admin-period-tabs" role="tablist" aria-label="통계 기간">
                {(Object.keys(periodLabels) as Array<keyof typeof periodLabels>).map((period) => <button key={period} className={dashboardPeriod === period ? 'active' : ''} type="button" role="tab" aria-selected={dashboardPeriod === period} onClick={() => handleDashboardPeriodChange(period)}>{periodLabels[period]}{period === 'custom' && <CalendarDays size={12} />}</button>)}
              </div>
              {dashboardCalendarOpen && (
                <div className="admin-calendar-popover" role="dialog" aria-label="사용자 지정 기간 선택">
                  <div className="admin-calendar-header"><button type="button" aria-label="이전 달" onClick={() => setDashboardCalendarMonth(new Date(dashboardCalendarMonth.getFullYear(), dashboardCalendarMonth.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><strong>{calendarMonthLabel}</strong><button type="button" aria-label="다음 달" onClick={() => setDashboardCalendarMonth(new Date(dashboardCalendarMonth.getFullYear(), dashboardCalendarMonth.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div>
                  <div className="admin-calendar-weekdays">{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}</div>
                  <div className="admin-calendar-grid">
                    {calendarDays.map((date) => {
                      const dateKey = getDateKey(date)
                      const isCurrentMonth = date.getMonth() === dashboardCalendarMonth.getMonth()
                      const isStart = dateKey === dashboardCustomStart
                      const isEnd = dateKey === dashboardCustomEnd
                      const isBetween = Boolean(dashboardCustomStart && dashboardCustomEnd && dateKey > dashboardCustomStart && dateKey < dashboardCustomEnd)
                      return <button key={dateKey} type="button" className={`${isCurrentMonth ? '' : 'muted'} ${isStart ? 'range-start' : ''} ${isEnd ? 'range-end' : ''} ${isBetween ? 'in-range' : ''}`} onClick={() => handleDashboardDateSelect(date)}>{date.getDate()}</button>
                    })}
                  </div>
                  <div className="admin-calendar-selection"><span>{customRangeLabel}</span><button type="button" disabled={!dashboardCustomStart || !dashboardCustomEnd} onClick={() => setDashboardCalendarOpen(false)}>적용</button></div>
                </div>
              )}
            </div>
            <button className="admin-report-print-button" type="button" onClick={() => window.print()}>
              <FileText size={15} aria-hidden="true" /><span>보고서 PDF로 저장</span>
            </button>
          </section>}

          {/* 화면에는 안 보이고 인쇄할 때만 나오는 핵심 지표 요약표 — 카드
              5개를 대시보드 위젯 그대로 찍는 대신, 항목마다 한 행씩
              깔끔한 표로 정리해 실무 보고서처럼 보이게 한다. */}
          {dashboardSection === 'overview' && <table className="admin-print-summary-table">
            <caption>핵심 지표 요약</caption>
            <thead><tr><th scope="col">지표</th><th scope="col">값</th><th scope="col">비고</th></tr></thead>
            <tbody>
              <tr><th scope="row">가입자 수</th><td>{selectedSignupData.total}명</td><td>{selectedSignupData.totalDelta}</td></tr>
              <tr><th scope="row">로고 생성 건수</th><td>{selectedPeriodData.total}건</td><td>CI {selectedPeriodData.ci}건 · BI {selectedPeriodData.bi}건</td></tr>
              <tr><th scope="row">다운로드 건수</th><td>{selectedDownloadData.total}건</td><td>CI {selectedDownloadData.ciShare}% · BI {selectedDownloadData.biShare}%</td></tr>
              <tr><th scope="row">온보딩 작성 현황</th><td>{onboardingCompletedCount}명 (작성률 {onboardingCompletionRate}%)</td><td>전체 회원 {onboardingTotalCount}명 중 작성</td></tr>
              <tr><th scope="row">설문 개선 항목</th><td>{surveyImprovementTotal.toLocaleString()}건</td><td>전체 응답 기준</td></tr>
            </tbody>
          </table>}

          {dashboardSection === 'overview' ? <>
            <section className="admin-overview-chart-grid" aria-label="대시보드 핵심 지표">
              <article className="admin-card admin-overview-chart-card">
                <div className="admin-overview-chart-heading">
                  <div><p>가입자 수</p><strong>{selectedSignupData.total}<small>명</small></strong><span className="admin-positive">{selectedSignupData.totalDelta} <ArrowUpRight size={14} /></span></div>
                </div>
                <div className="admin-mini-line-chart" ref={overviewChartRef}>
                  <svg width="100%" height={MINI_CHART.height} viewBox={`0 0 ${overviewChartWidth} ${MINI_CHART.height}`} role="img" aria-label={periodLabels[dashboardPeriod] + ' 가입자 수 추이'}>
                    <defs><linearGradient id="overviewLineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8d70ed" stopOpacity=".24" /><stop offset="1" stopColor="#8d70ed" stopOpacity=".02" /></linearGradient></defs>
                    {overviewSignupAxis.ticks.map((tick) => {
                      const y = MINI_CHART.plotBottom - (tick / overviewSignupAxis.top) * (MINI_CHART.plotBottom - MINI_CHART.plotTop)
                      return <g key={tick}>
                        <line x1={MINI_CHART.gutter} y1={y} x2={overviewChartWidth - MINI_CHART.padRight} y2={y} stroke="#eef0f5" strokeWidth="1" />
                        <text x={MINI_CHART.gutter - 8} y={y + 3} textAnchor="end" fill="#8b93a5" fontSize="9">{tick.toLocaleString()}</text>
                      </g>
                    })}
                    <path d={overviewSignupAreaPath} fill="url(#overviewLineFill)" />
                    <path d={overviewSignupChartPath} fill="none" stroke="#8d70ed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {overviewSignupChartPoints.map((point) => <text key={'label-' + point.label} x={point.x} y={MINI_CHART.labelY} textAnchor="middle" fill="#8b93a5" fontSize="9">{point.label}</text>)}
                    {overviewSignupChartPoints.map((point, index) => <g key={point.label + point.value} role="button" tabIndex={0} aria-label={point.label + ' 가입자 ' + point.value.toLocaleString() + '명'} onMouseEnter={() => setHoveredOverviewSignupPoint(index)} onMouseLeave={() => setHoveredOverviewSignupPoint(null)} onFocus={() => setHoveredOverviewSignupPoint(index)} onBlur={() => setHoveredOverviewSignupPoint(null)}><circle cx={point.x} cy={point.y} r={hoveredOverviewSignupPoint === index ? 8 : 4.5} fill="#fff" stroke="#8d70ed" strokeWidth={hoveredOverviewSignupPoint === index ? 4 : 3} />{hoveredOverviewSignupPoint === index && <g className="admin-chart-tooltip" pointerEvents="none"><rect x={Math.min(Math.max(point.x - 48, 0), Math.max(overviewChartWidth - 96, 0))} y={Math.max(point.y - 52, 4)} width="96" height="39" rx="9" fill="#202945" /><text x={Math.min(Math.max(point.x, 48), Math.max(overviewChartWidth - 48, 48))} y={Math.max(point.y - 34, 22)} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">{point.label}</text><text x={Math.min(Math.max(point.x, 48), Math.max(overviewChartWidth - 48, 48))} y={Math.max(point.y - 18, 38)} textAnchor="middle" fill="#dcd5ff" fontSize="10">{point.value.toLocaleString()}명 가입</text></g>}</g>)}
                  </svg>
                </div>
              </article>

              <article className="admin-card admin-overview-chart-card">
                <div className="admin-overview-chart-heading">
                  <div><p>로고 생성 건수</p><strong>{selectedPeriodData.total}<small>건</small></strong><span className="admin-positive">{selectedPeriodData.totalDelta} <ArrowUpRight size={14} /></span></div>
                </div>
                <div className="admin-mini-dual-plot">
                  {logoGenerationAxis.ticks.map((tick) => (
                    <div key={tick} className="admin-mini-dual-gridline" style={{ bottom: `${DUAL_BAR_LABEL_HEIGHT + (tick / logoGenerationAxis.top) * DUAL_BAR_PLOT_HEIGHT}px` }}>
                      <span>{tick.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="admin-mini-dual-bars" aria-label={periodLabels[dashboardPeriod] + ' CI BI 로고 생성량'}>{logoGenerationTrend.labels.map((label, index) => <div className="admin-mini-dual-group" key={label}><div>{renderDualBarSegment('ci', 'CI', label, logoGenerationTrend.ci[index])}{renderDualBarSegment('bi', 'BI', label, logoGenerationTrend.bi[index])}</div><span>{label}</span></div>)}</div>
                </div>
                <div className="admin-mini-dual-legend"><span><i className="ci" />CI</span><span><i className="bi" />BI</span></div>
              </article>

              <article className="admin-card admin-overview-chart-card">
                <div className="admin-overview-chart-heading">
                  <div><p>다운로드 건수</p><strong>{selectedDownloadData.total}<small>건</small></strong><span className="admin-positive">{selectedDownloadData.conversion === '실데이터' ? 'CI·BI 실데이터' : `${selectedDownloadData.conversion}% 전환`} <ArrowUpRight size={14} /></span></div>
                </div>
                <div className="admin-download-overview-graph"><div className="admin-overview-donut" style={{ background: downloadDonutGradient }}><span>{selectedDownloadData.total}<small>전체</small></span></div><div className="admin-overview-legend"><span><i className="ci" />CI <strong>{selectedDownloadData.ciShare}%</strong></span><span><i className="bi" />BI <strong>{selectedDownloadData.biShare}%</strong></span></div></div>
              </article>

              <article className="admin-card admin-overview-chart-card admin-survey-overview-card" aria-labelledby="admin-survey-overview-title">
                <div className="admin-overview-chart-heading">
                  <div><p id="admin-survey-overview-title">설문 개선 항목</p><strong>{surveyImprovementTotal.toLocaleString()}<small>건</small></strong><span className="admin-positive">전체 응답</span></div>
                  <p className="admin-survey-rating-summary"><span className="like"><ThumbsUp size={14} strokeWidth={2} aria-hidden="true" />좋아요 {surveyLikeCount}건</span><span className="dislike"><ThumbsDown size={14} strokeWidth={2} aria-hidden="true" />싫어요 {surveyDislikeCount}건</span></p>
                </div>
                <div className="admin-survey-improvement-bars" role="list" aria-label="설문 개선 항목별 응답 통계">
                  {selectedSurveyImprovementStats.map(({ label, value }) => <div className="admin-survey-improvement-row" key={label} role="listitem" aria-label={label + ' ' + value.toLocaleString() + '건'}><div><span>{label}</span><strong>{value.toLocaleString()}건</strong></div><i aria-hidden="true"><b style={{ width: `${surveyImprovementMax ? value / surveyImprovementMax * 100 : 0}%` }} /></i></div>)}
                </div>
              </article>

              <article className="admin-card admin-overview-chart-card" aria-labelledby="admin-onboarding-overview-title">
                <div className="admin-overview-chart-heading">
                  <div><p id="admin-onboarding-overview-title">온보딩 작성 현황</p><strong>{onboardingCompletedCount.toLocaleString()}<small>명</small></strong></div>
                </div>
                <div className="admin-onboarding-overview-body">
                  <p className="admin-onboarding-overview-subheading">어디에 사용할 예정인가요?</p>
                  <div className="admin-survey-improvement-bars" role="list" aria-label="온보딩 사용처별 응답 통계">
                    {selectedOnboardingUsageStats.map(({ label, value }) => <div className="admin-survey-improvement-row" key={label} role="listitem" aria-label={label + ' ' + value.toLocaleString() + '건'}><div><span>{label}</span><strong>{value.toLocaleString()}건</strong></div><i aria-hidden="true"><b style={{ width: `${onboardingUsageMax ? value / onboardingUsageMax * 100 : 0}%` }} /></i></div>)}
                  </div>
                  <p className="admin-onboarding-overview-subheading">어떤 계기로 방문하게 되셨나요?</p>
                  <div className="admin-survey-improvement-bars" role="list" aria-label="온보딩 방문 계기별 응답 통계">
                    {selectedOnboardingAudienceStats.map(({ label, value }) => <div className="admin-survey-improvement-row" key={label} role="listitem" aria-label={label + ' ' + value.toLocaleString() + '건'}><div><span>{label}</span><strong>{value.toLocaleString()}건</strong></div><i aria-hidden="true"><b style={{ width: `${onboardingAudienceMax ? value / onboardingAudienceMax * 100 : 0}%` }} /></i></div>)}
                  </div>
                </div>
              </article>
            </section>
          </> : dashboardSection === 'members' ? <>
            <section className="admin-card admin-member-list-card" aria-labelledby="admin-member-list-title">
              <div className="admin-card-heading admin-member-list-heading"><div><h2 id="admin-member-list-title">회원 목록</h2><p>회원별 생성·다운로드 현황과 잔여 크레딧을 확인합니다.</p></div><AdminMemberIdSearch id="admin-member-search" value={memberSearchQuery} onChange={setMemberSearchQuery} placeholder="회원 아이디(이메일) 입력" /></div>
              <div className="admin-member-table-wrap" role="region" tabIndex={0} aria-label="회원 목록 표, 좌우로 스크롤할 수 있습니다">
                <table className="admin-member-table admin-member-usage-table">
                  <caption className="admin-sr-only">회원별 가입 경로, 로고 생성, 다운로드 및 잔여 크레딧 목록</caption>
                  <thead><tr><th scope="col">No.</th><th scope="col">아이디(이메일)</th><th scope="col">가입 경로</th><th scope="col">이름</th><th scope="col">온보딩</th><th scope="col">가입일자</th><th scope="col">CI 생성 건수</th><th scope="col">BI 생성 건수</th><th scope="col">CI 다운로드 건수</th><th scope="col">BI 다운로드 건수</th><th scope="col">잔여 크레딧</th></tr></thead>
                  <tbody>{displayedAdminMembers.length === 0 ? <tr><td colSpan={11} className="admin-empty-table-state">입력한 회원 아이디와 일치하는 회원이 없습니다.</td></tr> : displayedAdminMembers.map((member, index) => {
                    const downloadCounts = adminMemberDownloadCounts[member.id]
                    const ciDownloads = downloadCounts?.ci ?? member.ciDownloads
                    const biDownloads = downloadCounts?.bi ?? member.biDownloads
                    const isOnboardingOpen = openOnboardingMemberId === member.id
                    const onboardingPanelId = `admin-onboarding-${member.id}`
                    return <Fragment key={member.id}>
                    <tr className={isOnboardingOpen ? 'admin-logo-member-row is-open' : 'admin-logo-member-row'}>
                       <td data-label="No." className="admin-index-cell">{index + 1}</td>
                       <td data-label="아이디(이메일)" className="admin-member-email"><strong title={member.email}>{member.email}</strong></td>
                       <td data-label="가입 경로">{member.provider?.toLowerCase() === 'kakao' ? '카카오' : member.provider?.toLowerCase() === 'google' ? 'Google' : member.provider || '기타'}</td>
                       <td data-label="이름"><div className="admin-member-identity"><span className="admin-member-avatar"><UserRound size={17} /></span><strong>{member.name || '이름 미등록'}</strong></div></td>
                       <td data-label="온보딩">
                         <button
                           className="admin-logo-record-button admin-onboarding-toggle"
                           type="button"
                           disabled={!member.onboardingCompleted}
                           aria-expanded={isOnboardingOpen}
                           aria-controls={onboardingPanelId}
                           onClick={() => setOpenOnboardingMemberId(isOnboardingOpen ? null : member.id)}
                         >
                           {member.onboardingCompleted ? <ClipboardCheck size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                           <span>{member.onboardingCompleted ? '작성완료' : '미작성'}</span>
                           {member.onboardingCompleted && <ChevronDown size={15} aria-hidden="true" />}
                         </button>
                       </td>
                      <td data-label="가입일자">{formatAdminDate(member.createdAt)}</td>
                      <td data-label="CI 생성 건수" className="admin-count-cell"><strong>{member.ciGenerations.toLocaleString()}</strong><small>건</small></td>
                      <td data-label="BI 생성 건수" className="admin-count-cell"><strong>{member.biGenerations.toLocaleString()}</strong><small>건</small></td>
                      <td data-label="CI 다운로드 건수" className="admin-count-cell"><strong>{ciDownloads === undefined ? '—' : ciDownloads.toLocaleString()}</strong>{ciDownloads !== undefined && <small>건</small>}</td>
                      <td data-label="BI 다운로드 건수" className="admin-count-cell"><strong>{biDownloads === undefined ? '—' : biDownloads.toLocaleString()}</strong>{biDownloads !== undefined && <small>건</small>}</td>
                      <td data-label="잔여 크레딧" className="admin-credit-cell"><strong>{member.creditBalance.toLocaleString()}</strong><small>개</small></td>
                    </tr>
                    <tr className={isOnboardingOpen ? 'admin-logo-accordion-row is-open' : 'admin-logo-accordion-row'} aria-hidden={!isOnboardingOpen}>
                      <td colSpan={11}>
                        <div id={onboardingPanelId} className={isOnboardingOpen ? 'admin-logo-accordion is-open' : 'admin-logo-accordion'}>
                          <div className="admin-logo-accordion-inner" role="region" aria-label={`${member.name || '회원'} 온보딩 응답`}>
                            <div className="admin-logo-accordion-heading">
                              <strong>온보딩 응답</strong>
                              <span>{member.onboardingCompletedAt ? `${formatAdminDate(member.onboardingCompletedAt)} 작성` : ''}</span>
                            </div>
                            <div className="admin-onboarding-answer-group">
                              <p className="admin-onboarding-answer-label">로고를 어디에 사용할 예정인가요? (복수 선택)</p>
                              <ul className="admin-onboarding-answer-list">
                                {Object.entries(ONBOARDING_USAGE_LABELS).map(([key, label]) => {
                                  const checked = member.onboardingUsage.includes(key)
                                  return <li key={key} className={checked ? 'checked' : ''}>{checked ? <ClipboardCheck size={14} aria-hidden="true" /> : <span className="admin-onboarding-answer-dot" aria-hidden="true" />}{label}</li>
                                })}
                              </ul>
                            </div>
                            <div className="admin-onboarding-answer-group">
                              <p className="admin-onboarding-answer-label">어떤 계기로 방문하게 되셨나요?</p>
                              <ul className="admin-onboarding-answer-list">
                                {Object.entries(ONBOARDING_AUDIENCE_LABELS).map(([key, label]) => {
                                  const checked = member.onboardingAudience === key
                                  return <li key={key} className={checked ? 'checked' : ''}>{checked ? <ClipboardCheck size={14} aria-hidden="true" /> : <span className="admin-onboarding-answer-dot" aria-hidden="true" />}{label}</li>
                                })}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    </Fragment>
                  })}</tbody>
                </table>
              </div>
            </section>
           </> : dashboardSection === 'admins' ? <>
             <section className="admin-card admin-member-list-card" aria-labelledby="admin-account-list-title">
              <div className="admin-card-heading"><div><h2 id="admin-account-list-title">관리자 목록</h2><p>관리자 계정의 생성일과 최근 접속 기록을 확인합니다.</p></div><span className="admin-status-label">총 {displayedAdminAccounts.length.toLocaleString()}명</span></div>
              <div className="admin-member-table-wrap" role="region" tabIndex={0} aria-label="관리자 목록 표">
                <table className="admin-member-table admin-account-table">
                  <caption className="admin-sr-only">관리자 계정 생성일과 마지막 접속 기록 목록</caption>
                  <thead><tr><th scope="col">No.</th><th scope="col">관리자 아이디</th><th scope="col">이름</th><th scope="col">생성 날짜</th><th scope="col">마지막 접속 시간</th></tr></thead>
                  <tbody>{displayedAdminAccounts.map((account, index) => <tr key={account.id}>
                    <td data-label="No." className="admin-index-cell">{index + 1}</td>
                    <td data-label="관리자 아이디" className="admin-member-email"><strong title={account.id}>{account.id}</strong></td>
                    <td data-label="이름"><div className="admin-member-identity"><span className="admin-member-avatar admin-avatar-neutral"><ShieldCheck size={17} /></span><strong>{account.name}</strong></div></td>
                    <td data-label="생성 날짜">{formatAdminDate(account.createdAt)}</td>
                    <td data-label="마지막 접속 시간"><span className="admin-last-access"><Clock3 size={15} />{account.lastAccessAt}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>
           </> : dashboardSection === 'ci-generations' ? <AdminLogoGenerationList track="CI" members={standalone ? ciGenerationMembers : adminCiGenerationMembers} openPanel={openLogoPanel} setOpenPanel={setOpenLogoPanel} adminToken={standalone ? '' : adminToken} vectorizedCandidateIds={vectorizedCandidateIds} onVectorize={handleVectorizeLogo} />
           : dashboardSection === 'bi-generations' ? <AdminLogoGenerationList track="BI" members={standalone ? biGenerationMembers : adminBiGenerationMembers} openPanel={openLogoPanel} setOpenPanel={setOpenLogoPanel} adminToken={standalone ? '' : adminToken} vectorizedCandidateIds={vectorizedCandidateIds} onVectorize={handleVectorizeLogo} />
           : dashboardSection === 'requests' ? <AdminSurveyResponseTable responses={standalone ? [] : adminSurveyResponses} />
           : dashboardSection === 'similarity' ? <AdminSimilarityTestPanel vectors={adminSimilarityVectors} adminToken={standalone ? '' : adminToken} standalone={standalone} />
          : dashboardSection === 'generation' ? <>
          <section className="admin-kpi-grid admin-generation-kpi-grid admin-generation-single-kpi-grid" aria-label="생성 핵심 지표">
            <article className="admin-kpi-card"><span className="admin-kpi-icon purple"><Sparkles size={19} /></span><div><p>총 로고 생성</p><strong>{selectedPeriodData.total}<small>건</small></strong><span className="admin-positive">{selectedPeriodData.totalDelta} <ArrowUpRight size={14} /></span></div></article>
          </section>

          <section className="admin-chart-grid">
             <article className="admin-card admin-purpose-card"><div className="admin-card-heading"><div><h2>계기 / 용도</h2><p>{periodLabels[dashboardPeriod]} 로고 생성을 시작한 목적</p></div><CircleHelp size={18} /></div><div className="admin-donut-layout"><div className="admin-donut" aria-label="계기 및 용도 통계 도넛 차트"><span>{selectedPeriodData.total}<small>전체 생성</small></span></div><div className="admin-legend">{selectedPurposeStats.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value}%</strong></div>)}</div></div></article>
             <article className="admin-card admin-satisfaction-card"><div className="admin-card-heading"><div><h2>만족도 반응</h2><p>{periodLabels[dashboardPeriod]} 설문 응답 기준</p></div><CircleHelp size={18} /></div><div className="admin-satisfaction-body"><div className="admin-satisfaction-score"><Heart size={22} fill="currentColor" /><strong>{selectedGenerationExtras.satisfaction}<small>%</small></strong><span>좋아요 비율</span></div><div className="admin-horizontal-bars"><div><span>좋아요</span><i><b style={{ width: `${selectedGenerationExtras.satisfaction}%` }} /></i><strong>{selectedGenerationExtras.satisfaction}%</strong></div><div><span>싫어요</span><i><b className="negative" style={{ width: `${100 - selectedGenerationExtras.satisfaction}%` }} /></i><strong>{100 - selectedGenerationExtras.satisfaction}%</strong></div></div></div><div className="admin-response-counts"><span><i className="purple-dot" />좋아요 <strong>{selectedGenerationExtras.likes.toLocaleString()}건</strong></span><span><i className="pink-dot" />싫어요 <strong>{selectedGenerationExtras.dislikes.toLocaleString()}건</strong></span></div></article>
          </section>

          <section className="admin-chart-grid lower">
             <article className="admin-card admin-trend-card"><div className="admin-card-heading"><div><h2>이용자 수</h2><p>{periodLabels[dashboardPeriod]} 기준 이용자 추이</p></div><span className="admin-chart-key"><i /> 이용자 수</span></div><div className="admin-line-chart" ref={generationChartRef}><svg width="100%" height={LINE_CHART.height} viewBox={`0 0 ${generationChartWidth} ${LINE_CHART.height}`} role="img" aria-label={`${periodLabels[dashboardPeriod]} 이용자 수 추이`}><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9473f1" stopOpacity=".24" /><stop offset="1" stopColor="#9473f1" stopOpacity=".02" /></linearGradient></defs>{generationUserAxis.ticks.map((tick) => { const y = LINE_CHART.plotBottom - (tick / generationUserAxis.top) * (LINE_CHART.plotBottom - LINE_CHART.plotTop); return <g key={tick}><line x1={LINE_CHART.gutter} y1={y} x2={generationChartWidth - LINE_CHART.padRight} y2={y} stroke="#e9eaf1" strokeWidth="1" /><text x={LINE_CHART.gutter - 9} y={y + 3} textAnchor="end" fill="#7e879b" fontSize="10">{tick.toLocaleString()}</text></g> })}<path d={chartAreaPath} fill="url(#trendFill)" /><path d={chartPath} fill="none" stroke="#8b69ed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{chartPoints.map((point) => <text key={`label-${point.label}`} x={point.x} y={LINE_CHART.labelY} textAnchor="middle" fill="#7e879b" fontSize="10">{point.label}</text>)}{chartPoints.map((point, index) => <g key={`${point.x}-${point.y}`} role="button" tabIndex={0} aria-label={point.label + ' 이용자 ' + point.value.toLocaleString() + '명'} onMouseEnter={() => setHoveredGenerationUserPoint(index)} onMouseLeave={() => setHoveredGenerationUserPoint(null)} onFocus={() => setHoveredGenerationUserPoint(index)} onBlur={() => setHoveredGenerationUserPoint(null)}><circle cx={point.x} cy={point.y} r={hoveredGenerationUserPoint === index ? 8 : 4.5} fill="#fff" stroke="#8b69ed" strokeWidth={hoveredGenerationUserPoint === index ? 4 : 3} />{hoveredGenerationUserPoint === index && <g className="admin-chart-tooltip" pointerEvents="none"><rect x={Math.min(Math.max(point.x - 48, 0), Math.max(generationChartWidth - 96, 0))} y={Math.max(point.y - 52, 4)} width="96" height="39" rx="9" fill="#202945" /><text x={Math.min(Math.max(point.x, 48), Math.max(generationChartWidth - 48, 48))} y={Math.max(point.y - 34, 22)} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">{point.label}</text><text x={Math.min(Math.max(point.x, 48), Math.max(generationChartWidth - 48, 48))} y={Math.max(point.y - 18, 38)} textAnchor="middle" fill="#dcd5ff" fontSize="10">{point.value.toLocaleString()}명</text></g>}</g>)}</svg></div></article>
            <article className="admin-card admin-ci-bi-card"><div className="admin-card-heading"><div><h2>CI / BI 생성현황</h2><p>로고 형태별 생성 비중</p></div><CircleHelp size={18} /></div><div className="admin-column-chart"><div className="admin-column-grid"><span>7,000</span><span>5,000</span><span>3,000</span><span>1,000</span><span>0</span></div><div className="admin-columns"><div><strong>{selectedPeriodData.ci}건</strong><i className="ci" style={{ height: `${Math.min(88, (Number(selectedPeriodData.ci.replace(',', '')) / 7000) * 100)}%` }} /><span>CI</span></div><div><strong>{selectedPeriodData.bi}건</strong><i className="bi" style={{ height: `${Math.min(88, (Number(selectedPeriodData.bi.replace(',', '')) / 7000) * 100)}%` }} /><span>BI</span></div></div></div></article>
          </section>


           <section className="admin-card admin-trademark-card"><div className="admin-card-heading"><div><h2>상표 이미지 분석 이용 여부</h2><p>{periodLabels[dashboardPeriod]} 생성 과정에서 상표 이미지 분석을 이용한 비율</p></div><span className="admin-status-label">생성 분석</span></div><div className="admin-trademark-overview"><div className="admin-trademark-highlight"><ShieldCheck size={24} strokeWidth={1.8} /><strong>{selectedGenerationAnalysis}<small>%</small></strong><span>분석 이용 비율</span></div><div className="admin-trademark-bars"><div><span>분석 이용</span><i><b style={{ width: `${selectedGenerationAnalysis}%` }} /></i><strong>{selectedGenerationAnalysis}%</strong></div><div><span>분석 없이</span><i><b className="pink" style={{ width: `${100 - selectedGenerationAnalysis}%` }} /></i><strong>{100 - selectedGenerationAnalysis}%</strong></div></div></div><div className="admin-trademark-legend"><span><i className="purple" />분석 이용 <strong>{formatGenerationAnalysisCount(selectedGenerationAnalysis)}건</strong></span><span><i className="pink" />분석 없이 <strong>{formatGenerationAnalysisCount(100 - selectedGenerationAnalysis)}건</strong></span></div><p className="admin-trademark-note">상표 이미지 분석을 활용한 생성 결과 비율을 확인할 수 있습니다.</p></section>
           </> : dashboardSection === 'download' ? <>
             <section className="admin-kpi-grid admin-download-kpi-grid"><article className="admin-kpi-card"><span className="admin-kpi-icon purple"><Download size={19} /></span><div><p>전체 다운로드</p><strong>{selectedDownloadData.total}<small>건</small></strong><span className="admin-positive">{periodLabels[dashboardPeriod]} 기준 <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon orange"><FolderCheck size={19} /></span><div><p>CI 결과 다운로드</p><strong>{selectedDownloadData.ci}<small>건</small></strong><span className="admin-positive">{selectedDownloadData.ciShare}% <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon blue"><Palette size={19} /></span><div><p>BI 결과 다운로드</p><strong>{selectedDownloadData.bi}<small>건</small></strong><span className="admin-positive">{selectedDownloadData.biShare}% <ArrowUpRight size={14} /></span></div></article></section>
            <section className="admin-card admin-style-download-card"><div className="admin-card-heading"><div><h2>CI · BI 로고 스타일별 다운로드 비율</h2><p>{periodLabels[dashboardPeriod]} 다운로드 로고 결과물을 비교해보세요.</p></div><span className="admin-status-label">총 {selectedDownloadData.total}건</span></div><div className="admin-style-download-panels"><div className="admin-style-download-panel"><div className="admin-style-download-panel-heading"><strong>CI 로고</strong><span>{selectedDownloadData.ci}건</span></div><div className="admin-style-download-chart" aria-label="CI 로고 스타일별 다운로드 비율"><div className="admin-style-download-row"><div><span>콤비네이션</span><strong>{selectedDownloadData.ciStyles[0]}%</strong></div><i><b className="purple" style={{ width: `${selectedDownloadData.ciStyles[0]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.ci, selectedDownloadData.ciStyles[0])}건</small></div><div className="admin-style-download-row"><div><span>심볼마크</span><strong>{selectedDownloadData.ciStyles[1]}%</strong></div><i><b className="violet" style={{ width: `${selectedDownloadData.ciStyles[1]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.ci, selectedDownloadData.ciStyles[1])}건</small></div><div className="admin-style-download-row"><div><span>워드마크</span><strong>{selectedDownloadData.ciStyles[2]}%</strong></div><i><b className="pink" style={{ width: `${selectedDownloadData.ciStyles[2]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.ci, selectedDownloadData.ciStyles[2])}건</small></div><div className="admin-style-download-row"><div><span>레터마크</span><strong>{selectedDownloadData.ciStyles[3]}%</strong></div><i><b className="orange" style={{ width: `${selectedDownloadData.ciStyles[3]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.ci, selectedDownloadData.ciStyles[3])}건</small></div></div></div><div className="admin-style-download-panel"><div className="admin-style-download-panel-heading"><strong>BI 로고</strong><span>{selectedDownloadData.bi}건</span></div><div className="admin-style-download-chart" aria-label="BI 로고 스타일별 다운로드 비율"><div className="admin-style-download-row"><div><span>콤비네이션</span><strong>{selectedDownloadData.biStyles[0]}%</strong></div><i><b className="purple" style={{ width: `${selectedDownloadData.biStyles[0]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.bi, selectedDownloadData.biStyles[0])}건</small></div><div className="admin-style-download-row"><div><span>심볼마크</span><strong>{selectedDownloadData.biStyles[1]}%</strong></div><i><b className="violet" style={{ width: `${selectedDownloadData.biStyles[1]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.bi, selectedDownloadData.biStyles[1])}건</small></div><div className="admin-style-download-row"><div><span>워드마크</span><strong>{selectedDownloadData.biStyles[2]}%</strong></div><i><b className="pink" style={{ width: `${selectedDownloadData.biStyles[2]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.bi, selectedDownloadData.biStyles[2])}건</small></div><div className="admin-style-download-row"><div><span>레터마크</span><strong>{selectedDownloadData.biStyles[3]}%</strong></div><i><b className="orange" style={{ width: `${selectedDownloadData.biStyles[3]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.bi, selectedDownloadData.biStyles[3])}건</small></div></div></div></div></section>
            <section className="admin-chart-grid"><article className="admin-card"><div className="admin-card-heading"><div><h2>다운로드 파일 구성</h2><p>{periodLabels[dashboardPeriod]} 로고 결과물 구성</p></div><CircleHelp size={18} /></div><div className="admin-download-breakdown"><div className="admin-donut download-donut"><span>{selectedDownloadData.total}<small>전체 다운로드</small></span></div><div className="admin-legend"><div><i style={{ background: '#8d70ed' }} /><span>로고만 다운로드</span><strong>{selectedDownloadData.fileOnly}%</strong></div><div><i style={{ background: '#ed70ac' }} /><span>로고 + 입력정보</span><strong>{selectedDownloadData.fileWithInput}%</strong></div><p>로고 파일과 함께 생성에 사용한 핵심 정보를 제공한 다운로드 비율입니다.</p></div></div></article><article className="admin-card"><div className="admin-card-heading"><div><h2>좋은 결과로 이어진 입력 정보</h2><p>{periodLabels[dashboardPeriod]} 다운로드 전환율이 높은 조합</p></div><CircleHelp size={18} /></div><div className="admin-result-insights"><div><span className="admin-type-badge">CI</span><div><strong>신뢰감 · 혁신 · 명확한 모토</strong><p>다운로드 전환율 {selectedDownloadData.insightRates[0]}%</p></div></div><div><span className="admin-type-badge bi">BI</span><div><strong>비건 · 클린뷰티 · 콤비네이션</strong><p>다운로드 전환율 {selectedDownloadData.insightRates[1]}%</p></div></div><div><span className="admin-type-badge neutral">BI</span><div><strong>저자극 · 미니멀 · 심볼마크</strong><p>다운로드 전환율 {selectedDownloadData.insightRates[2]}%</p></div></div></div></article></section>
           </> : dashboardSection === 'signup' ? <>
             <section className="admin-kpi-grid admin-signup-kpi-grid"><article className="admin-kpi-card"><span className="admin-kpi-icon purple"><UsersRound size={19} /></span><div><p>전체 가입자</p><strong>{selectedSignupData.total}<small>명</small></strong><span className="admin-positive">{selectedSignupData.totalDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon pink"><ClipboardCheck size={19} /></span><div><p>신규 가입자</p><strong>{selectedSignupData.newUsers}<small>명</small></strong><span className="admin-positive">{selectedSignupData.newDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon blue"><ArrowUpRight size={19} /></span><div><p>가입 후 생성 시작</p><strong>{selectedSignupData.started}<small>%</small></strong><span className="admin-positive">{selectedSignupData.startedDelta} <ArrowUpRight size={14} /></span></div></article></section>
             <section className="admin-chart-grid lower"><article className="admin-card admin-signup-trend"><div className="admin-card-heading"><div><h2>월별 가입자 수</h2><p>{periodLabels[dashboardPeriod]} 기준 신규 가입 추이</p></div><span className="admin-chart-key"><i /> 신규 가입자</span></div><div className="admin-signup-bars">{signupMonthlyValues.map((value, index) => <div key={index}><strong>{value.toLocaleString()}<small>명</small></strong><i style={{ height: `${Math.round((value / signupMonthlyMax) * 84)}%` }} /><span>{signupXAxisLabels[index]}</span></div>)}</div></article><article className="admin-card"><div className="admin-card-heading"><div><h2>가입 경로</h2><p>{periodLabels[dashboardPeriod]} 사용자 유입 비율</p></div><CircleHelp size={18} /></div><div className="admin-signup-sources">{signupSourceStats.map((source) => <div key={source.label}><span>{source.label}</span><i><b style={{ width: `${source.value}%` }} /></i><strong>{source.value}%</strong></div>)}</div></article></section>
             <section className="admin-card admin-funnel-card"><div className="admin-card-heading"><div><h2>가입 후 첫 생성까지의 흐름</h2><p>{periodLabels[dashboardPeriod]} 온보딩 단계별 이탈을 확인해보세요.</p></div></div><div className="admin-funnel"><div><strong>{selectedSignupData.funnel[0].toLocaleString()}</strong><span>가입 완료</span></div><div><strong>{selectedSignupData.funnel[1].toLocaleString()}</strong><span>온보딩 시작</span></div><div><strong>{selectedSignupData.funnel[2].toLocaleString()}</strong><span>온보딩 완료</span></div><div><strong>{selectedSignupData.funnel[3].toLocaleString()}</strong><span>첫 로고 생성 시작</span></div></div><div className="admin-funnel-dropoff"><div><span>온보딩 이탈률</span><strong>{selectedSignupData.dropoff}%</strong></div><p>선택한 기간에 온보딩을 시작한 {selectedSignupData.funnel[1].toLocaleString()}명 중 일부가 완료 전에 이탈했어요.</p></div></section>
          </> : <>
            <section className="admin-request-section"><div className="admin-section-heading"><div><h2>개선 요청 타임라인</h2></div><span className="admin-request-count">총 {surveyRequests.length}건</span></div><div className="admin-request-list">{surveyRequests.map((request) => <article className="admin-request-row" key={request.id}><span className="admin-request-number">{request.id}</span><div className="admin-request-copy"><div><strong>{request.category}</strong><span>{request.user} · {request.time}</span></div><p>{request.message}</p></div><button type="button" aria-label={`${request.category} 요청 보기`}><ChevronRight size={18} /></button></article>)}</div></section>
          </>}
        </section>
      </main>
    )
  }


  return standalone || !ADMIN_LOGIN_REQUIRED || adminToken ? renderDashboardScreen() : renderAdminLoginScreen()
}
