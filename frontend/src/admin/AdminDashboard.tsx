import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Download,
  FolderCheck,
  Heart,
  House,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  UserRound,
  UsersRound,
} from 'lucide-react'
import './admin-dashboard.css'

type DashboardSection = 'overview' | 'generation' | 'download' | 'signup' | 'requests' | 'members' | 'credits'

type AdminDashboardProps = {
  standalone?: boolean
}

const defaultAdminId = 'admin@genmark.ai'

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

const getDashboardSectionFromUrl = (): DashboardSection => {
  const section = new URLSearchParams(window.location.search).get('tab')
  if (section === 'overview' || section === 'home') return 'overview'
  if (section === 'generation' || section === 'generations' || section === 'logo-generation') return 'generation'
  if (section === 'download' || section === 'downloads') return 'download'
  if (section === 'signup' || section === 'signups' || section === 'join') return 'signup'
  if (section === 'requests' || section === 'improvement' || section === 'feedback') return 'requests'
  if (section === 'members' || section === 'member-list' || section === 'users') return 'members'
  if (section === 'credits' || section === 'credit' || section === 'credit-stats') return 'credits'
  return 'overview'
}

export default function AdminDashboard({ standalone = false }: AdminDashboardProps) {
  const [dashboardPeriod, setDashboardPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')
  const [dashboardCalendarMonth, setDashboardCalendarMonth] = useState(() => new Date())
  const [dashboardCustomStart, setDashboardCustomStart] = useState('')
  const [dashboardCustomEnd, setDashboardCustomEnd] = useState('')
  const [dashboardCalendarOpen, setDashboardCalendarOpen] = useState(false)
  const dashboardCalendarRef = useRef<HTMLDivElement | null>(null)
  const adminAccountMenuRef = useRef<HTMLDivElement | null>(null)
  const [dashboardSection, setDashboardSectionState] = useState<DashboardSection>(getDashboardSectionFromUrl)
  const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(true)
  const [isStatsMenuOpen, setIsStatsMenuOpen] = useState(true)
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const [adminId, setAdminId] = useState(getStoredAdminId)
  const [adminIdDraft, setAdminIdDraft] = useState(getStoredAdminId)
  const adminInitial = Array.from(adminId.trim())[0]?.toLocaleUpperCase() || 'A'

  const saveAdminId = () => {
    const nextAdminId = adminIdDraft.trim()
    if (!nextAdminId) return
    setAdminId(nextAdminId)
    storeAdminId(nextAdminId)
    setIsAdminMenuOpen(false)
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

  const renderDashboardScreen = () => {
    const periodLabels = { daily: '일일', weekly: '주간', monthly: '월간', custom: '사용자 지정' }
    const dashboardSectionLabels = { overview: '대시보드', generation: '생성통계', download: '다운로드 통계', signup: '가입 통계', requests: '개선 요청', members: '회원 목록', credits: '크레딧 통계' }
    const calendarDays = getCalendarDays(dashboardCalendarMonth)
    const calendarMonthLabel = `${dashboardCalendarMonth.getFullYear()}년 ${dashboardCalendarMonth.getMonth() + 1}월`
    const customRangeLabel = dashboardCustomStart && dashboardCustomEnd
      ? `${dashboardCustomStart.replace(/-/g, '.')} ~ ${dashboardCustomEnd.replace(/-/g, '.')}`
      : '날짜를 선택해주세요.'

    const handleDashboardPeriodChange = (period: keyof typeof periodLabels) => {
      setDashboardPeriod(period)
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
      weekly: { total: '2,186', completion: '97.1', avg: '1:57', active: '438', totalDelta: '+9.2%', completionDelta: '+2.5%', avgDelta: '-18초', activeDelta: '+7.8%', ci: '742', bi: '1,444', userTrend: [160, 190, 220, 260, 290, 315, 338, 360, 384, 410, 426, 438] },
      monthly: { total: '9,187', completion: '97.4', avg: '2:18', active: '1,248', totalDelta: '+12.8%', completionDelta: '+3.2%', avgDelta: '-18초', activeDelta: '+8.6%', ci: '3,124', bi: '6,063', userTrend: [280, 340, 400, 450, 470, 560, 670, 780, 870, 960, 1_180, 1_320] },
      custom: { total: '1,764', completion: '96.5', avg: '2:06', active: '312', totalDelta: '+7.1%', completionDelta: '+1.4%', avgDelta: '-12초', activeDelta: '+5.9%', ci: '598', bi: '1,166', userTrend: [112, 125, 148, 171, 184, 205, 219, 244, 268, 289, 303, 312] },
    } as const
    const selectedPeriodData = periodData[dashboardPeriod]
    const generationPeriodExtras = {
      daily: { purpose: [42, 24, 18, 11, 5], satisfaction: 84, likes: 1248, dislikes: 236, ciInputs: [38, 27, 21, 14], biInputs: [46, 28, 16, 10], ciCompletion: '98.1', biCompletion: '96.8' },
      weekly: { purpose: [39, 27, 19, 10, 5], satisfaction: 86, likes: 1810, dislikes: 295, ciInputs: [41, 25, 20, 14], biInputs: [43, 30, 17, 10], ciCompletion: '98.4', biCompletion: '97.1' },
      monthly: { purpose: [36, 29, 20, 10, 5], satisfaction: 89, likes: 7720, dislikes: 960, ciInputs: [43, 24, 19, 14], biInputs: [41, 31, 18, 10], ciCompletion: '98.8', biCompletion: '97.6' },
      custom: { purpose: [44, 23, 17, 10, 6], satisfaction: 83, likes: 1470, dislikes: 300, ciInputs: [36, 30, 20, 14], biInputs: [48, 26, 16, 10], ciCompletion: '97.9', biCompletion: '96.4' },
    } as const
    const selectedGenerationExtras = generationPeriodExtras[dashboardPeriod]
    const generationAnalysisByPeriod = { daily: 62, weekly: 65, monthly: 68, custom: 64 } as const
    const selectedGenerationAnalysis = generationAnalysisByPeriod[dashboardPeriod]
    const formatGenerationAnalysisCount = (percentage: number) => Math.round(Number(selectedPeriodData.total.replace(/,/g, '')) * percentage / 100).toLocaleString()
    const selectedPurposeStats = purposeStats.map((item, index) => ({ ...item, value: selectedGenerationExtras.purpose[index] }))
    const selectedCiInputs = ciInputs.map((item, index) => ({ ...item, value: selectedGenerationExtras.ciInputs[index] }))
    const selectedBiInputs = biInputs.map((item, index) => ({ ...item, value: selectedGenerationExtras.biInputs[index] }))
    const surveyRequests = [
      { id: 1, category: '로고 디자인', message: '생성된 로고 후보를 한 화면에서 비교하기 쉽도록 개선해주세요.', user: '김민지', time: '오늘 10:24' },
      { id: 2, category: '생성 속도', message: '로고 생성 중 현재 진행 단계를 더 자세히 보여주면 좋겠어요.', user: '이준호', time: '어제 16:08' },
      { id: 3, category: '상표 이미지 분석', message: '유사도 결과에 분석 기준과 참고 설명이 함께 나오면 좋겠습니다.', user: '박서연', time: '어제 11:42' },
      { id: 4, category: '제품 썸네일', message: '완성한 로고로 제품 썸네일까지 바로 만들어보고 싶어요.', user: '최지훈', time: '8월 4일' },
    ]
    const chartPoints = selectedPeriodData.userTrend.map((value, index, values) => {
      const x = 20 + (550 / (values.length - 1)) * index
      const y = 205 - (value / 1500) * 191
      return { x, y }
    })
    const chartPath = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
    const chartAreaPath = `${chartPath} L570 205 L20 205 Z`
    const signupPeriodData = {
      daily: { total: '12,684', newUsers: '1,248', completion: '82.4', started: '68.7', totalDelta: '+8.6%', newDelta: '이번 달', completionDelta: '+4.1%', startedDelta: '+6.2%', monthly: [520, 610, 700, 780, 744, 900, 1010, 1100, 1248, 1240, 1236, 1248], sources: [46, 34, 12, 8], funnel: [1248, 1029, 852, 684], dropoff: '17.2' },
      weekly: { total: '18,420', newUsers: '2,186', completion: '84.1', started: '71.5', totalDelta: '+10.2%', newDelta: '+7.4%', completionDelta: '+4.8%', startedDelta: '+7.1%', monthly: [148, 176, 204, 232, 220, 266, 294, 320, 356, 382, 410, 438], sources: [42, 37, 13, 8], funnel: [2186, 1810, 1528, 1268], dropoff: '15.9' },
      monthly: { total: '42,680', newUsers: '9,187', completion: '87.3', started: '75.8', totalDelta: '+14.6%', newDelta: '+12.8%', completionDelta: '+6.9%', startedDelta: '+9.4%', monthly: [280, 340, 400, 450, 470, 560, 670, 780, 870, 960, 1180, 1320], sources: [39, 41, 12, 8], funnel: [9187, 7720, 6860, 5984], dropoff: '11.2' },
      custom: { total: '6,742', newUsers: '1,764', completion: '83.6', started: '70.2', totalDelta: '+9.8%', newDelta: '+5.6%', completionDelta: '+4.7%', startedDelta: '+6.8%', monthly: [112, 125, 148, 171, 184, 205, 219, 244, 268, 289, 303, 312], sources: [48, 29, 15, 8], funnel: [1764, 1470, 1210, 920], dropoff: '16.7' },
    } as const
    const selectedSignupData = signupPeriodData[dashboardPeriod]
    const signupMonthlyValues = selectedSignupData.monthly
    const signupMonthlyMax = Math.max(...signupMonthlyValues)
    const signupAxisLabelsByPeriod = {
      daily: Array.from({ length: 12 }, (_, index) => `${index + 1}일`),
      weekly: Array.from({ length: 12 }, (_, index) => `${index + 1}주`),
      monthly: ['9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월'],
      custom: Array.from({ length: 12 }, (_, index) => `${index + 1}구간`),
    } as const
    const signupXAxisLabels = dashboardPeriod === 'custom' && dashboardCustomStart && dashboardCustomEnd
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
    const selectedDownloadData = downloadPeriodData[dashboardPeriod]
    const formatDownloadCount = (value: string | number) => Number(String(value).replace(/,/g, '')).toLocaleString()
    const downloadStyleCount = (total: string, percentage: number) => formatDownloadCount(Math.round(Number(total.replace(/,/g, '')) * percentage / 100))
    const creditPeriodData = {
      daily: { dailyUse: '184', totalUse: '3,842', dailyPayment: '420', totalPayment: '7,860', paymentAmount: '₩1,386,000', cumulativePaymentAmount: '₩12,680,000', refunds: '18', averageOrder: '12', useDelta: '+8.4%', totalUseDelta: '+12.6%', paymentDelta: '+5.1%', totalPaymentDelta: '+9.8%', paymentAmountDelta: '+6.8%', cumulativePaymentAmountDelta: '+11.4%', refundDelta: '-2.4%' },
      weekly: { dailyUse: '268', totalUse: '8,940', dailyPayment: '680', totalPayment: '14,860', paymentAmount: '₩3,960,000', cumulativePaymentAmount: '₩28,420,000', refunds: '31', averageOrder: '18', useDelta: '+10.1%', totalUseDelta: '+15.4%', paymentDelta: '+7.2%', totalPaymentDelta: '+11.6%', paymentAmountDelta: '+8.9%', cumulativePaymentAmountDelta: '+13.2%', refundDelta: '-3.1%' },
      monthly: { dailyUse: '412', totalUse: '18,420', dailyPayment: '1,260', totalPayment: '32,680', paymentAmount: '₩8,920,000', cumulativePaymentAmount: '₩72,800,000', refunds: '64', averageOrder: '26', useDelta: '+14.8%', totalUseDelta: '+19.2%', paymentDelta: '+10.4%', totalPaymentDelta: '+16.7%', paymentAmountDelta: '+14.1%', cumulativePaymentAmountDelta: '+18.6%', refundDelta: '-4.6%' },
      custom: { dailyUse: '236', totalUse: '6,480', dailyPayment: '540', totalPayment: '11,240', paymentAmount: '₩2,480,000', cumulativePaymentAmount: '₩18,960,000', refunds: '24', averageOrder: '16', useDelta: '+9.4%', totalUseDelta: '+13.1%', paymentDelta: '+6.6%', totalPaymentDelta: '+10.2%', paymentAmountDelta: '+7.5%', cumulativePaymentAmountDelta: '+12.1%', refundDelta: '-2.9%' },
    } as const
    const selectedCreditData = creditPeriodData[dashboardPeriod]

    return (
      <main className="admin-dashboard-screen">
        <aside className="admin-sidebar" aria-label="관리자 메뉴">
          <div className="admin-brand"><span className="admin-brand-mark"><Sparkles size={25} strokeWidth={1.8} /></span><strong>GenMark <em>AI</em></strong></div>
          <nav className="admin-menu">
            <button className={`admin-menu-item ${dashboardSection === 'overview' ? 'active' : ''}`} type="button" onClick={() => setDashboardSection('overview')}><House size={19} strokeWidth={1.8} /><span>대시보드</span></button>
            <div className="admin-menu-group"><button className={`admin-menu-item ${dashboardSection === 'members' ? 'active' : ''}`} type="button" aria-expanded={isMemberMenuOpen} onClick={() => setIsMemberMenuOpen((open) => !open)}><UsersRound size={19} strokeWidth={1.8} /><span>회원관리</span><ChevronDown className={isMemberMenuOpen ? 'menu-chevron-open' : ''} size={15} /></button>{isMemberMenuOpen && <div className="admin-submenu active-submenu"><button className={dashboardSection === 'members' ? 'active' : ''} type="button" onClick={() => setDashboardSection('members')}>회원목록</button><span>관리자</span></div>}</div>
            <div className="admin-menu-group"><button className={`admin-menu-item ${['signup', 'generation', 'download', 'credits'].includes(dashboardSection) ? 'active' : ''}`} type="button" aria-expanded={isStatsMenuOpen} onClick={() => setIsStatsMenuOpen((open) => !open)}><BarChart3 size={19} strokeWidth={1.8} /><span>통계</span><ChevronDown className={isStatsMenuOpen ? 'menu-chevron-open' : ''} size={15} /></button>{isStatsMenuOpen && <div className="admin-submenu active-submenu"><button className={dashboardSection === 'signup' ? 'active' : ''} type="button" onClick={() => setDashboardSection('signup')}>가입 통계</button><button className={dashboardSection === 'generation' ? 'active' : ''} type="button" onClick={() => setDashboardSection('generation')}>생성통계</button><button className={dashboardSection === 'download' ? 'active' : ''} type="button" onClick={() => setDashboardSection('download')}>다운로드 통계</button><button className={dashboardSection === 'credits' ? 'active' : ''} type="button" onClick={() => setDashboardSection('credits')}>크레딧 통계</button></div>}</div>
            <button className={`admin-menu-item ${dashboardSection === 'requests' ? 'active' : ''}`} type="button" onClick={() => setDashboardSection('requests')}><ThumbsUp size={19} strokeWidth={1.8} /><span>개선 요청</span></button>
          </nav>
        </aside>

        <section className="admin-dashboard-content">
          {dashboardSection !== 'requests' && <header className="admin-dashboard-header">
            <div><p className="admin-eyebrow">ADMIN · ANALYTICS</p><h1>GenMark AI {dashboardSectionLabels[dashboardSection]}</h1></div>
            <div className="admin-header-actions" ref={adminAccountMenuRef}>
              <button className="admin-account-trigger" type="button" aria-label="관리자 계정 메뉴" aria-expanded={isAdminMenuOpen} onClick={() => setIsAdminMenuOpen((open) => !open)}>
                <span className="admin-avatar">{adminInitial}</span>
                <ChevronDown className={isAdminMenuOpen ? 'menu-chevron-open' : ''} size={17} />
              </button>
              {isAdminMenuOpen && <div className="admin-account-menu" role="dialog" aria-label="관리자 아이디 수정">
                <p>관리자 아이디</p>
                <strong>{adminId}</strong>
                <label htmlFor="admin-id-input">아이디 수정</label>
                <input id="admin-id-input" type="text" value={adminIdDraft} onChange={(event) => setAdminIdDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveAdminId() }} />
                <button type="button" onClick={saveAdminId}>저장</button>
              </div>}
            </div>
          </header>}

          {(dashboardSection === 'generation' || dashboardSection === 'signup' || dashboardSection === 'download' || dashboardSection === 'credits') && <section className="admin-period-card">
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
          </section>}

          {dashboardSection === 'credits' && <section className="admin-credit-amount-section" aria-label="결제 금액 지표">
            <div className="admin-kpi-grid admin-credit-amount-grid">
              <article className="admin-kpi-card"><span className="admin-kpi-icon green"><b aria-hidden="true">₩</b></span><div><p>{periodLabels[dashboardPeriod]} 결제 금액</p><strong>{selectedCreditData.paymentAmount}</strong><span className="admin-positive">{selectedCreditData.paymentAmountDelta} <ArrowUpRight size={14} /></span></div></article>
              <article className="admin-kpi-card"><span className="admin-kpi-icon purple"><b aria-hidden="true">₩</b></span><div><p>{periodLabels[dashboardPeriod]} 누적 결제 금액</p><strong>{selectedCreditData.cumulativePaymentAmount}</strong><span className="admin-positive">{selectedCreditData.cumulativePaymentAmountDelta} <ArrowUpRight size={14} /></span></div></article>
              <article className="admin-kpi-card"><span className="admin-kpi-icon purple"><Sparkles size={19} /></span><div><p>{periodLabels[dashboardPeriod]} 사용량</p><strong>{selectedCreditData.dailyUse}<small>개</small></strong><span className="admin-positive">{selectedCreditData.useDelta} <ArrowUpRight size={14} /></span></div></article>
              <article className="admin-kpi-card"><span className="admin-kpi-icon blue"><CalendarDays size={19} /></span><div><p>{periodLabels[dashboardPeriod]} 누적 사용량</p><strong>{selectedCreditData.totalUse}<small>개</small></strong><span className="admin-positive">{selectedCreditData.totalUseDelta} <ArrowUpRight size={14} /></span></div></article>
              <article className="admin-kpi-card"><span className="admin-kpi-icon pink"><ClipboardCheck size={19} /></span><div><p>{periodLabels[dashboardPeriod]} 결제량</p><strong>{selectedCreditData.dailyPayment}<small>개</small></strong><span className="admin-positive">{selectedCreditData.paymentDelta} <ArrowUpRight size={14} /></span></div></article>
              <article className="admin-kpi-card"><span className="admin-kpi-icon orange"><Sparkles size={19} /></span><div><p>{periodLabels[dashboardPeriod]} 누적 결제량</p><strong>{selectedCreditData.totalPayment}<small>개</small></strong><span className="admin-positive">{selectedCreditData.totalPaymentDelta} <ArrowUpRight size={14} /></span></div></article>
              <article className="admin-kpi-card"><span className="admin-kpi-icon pink"><RefreshCw size={19} /></span><div><p>환불 건수</p><strong>{selectedCreditData.refunds}<small>건</small></strong><span className="admin-positive">{selectedCreditData.refundDelta} <ArrowUpRight size={14} /></span></div></article>
            </div>
          </section>}

          {dashboardSection === 'overview' ? <>
            <section className="admin-overview-chart-grid" aria-label="대시보드 핵심 지표"><article className="admin-card admin-overview-chart-card"><div className="admin-overview-chart-heading"><div><p>전체 가입자</p><strong>12,684<small>명</small></strong><span className="admin-positive">+8.6% <ArrowUpRight size={14} /></span></div><span className="admin-kpi-icon purple"><UsersRound size={19} /></span></div><div className="admin-mini-line-chart"><svg viewBox="0 0 300 92" role="img" aria-label="최근 12개월 가입자 추이"><defs><linearGradient id="overviewLineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8d70ed" stopOpacity=".24" /><stop offset="1" stopColor="#8d70ed" stopOpacity=".02" /></linearGradient></defs><path d="M4 76 L31 70 L58 65 L85 61 L112 62 L139 53 L166 44 L193 34 L220 28 L247 20 L274 11 L296 5 L296 87 L4 87 Z" fill="url(#overviewLineFill)" /><path d="M4 76 L31 70 L58 65 L85 61 L112 62 L139 53 L166 44 L193 34 L220 28 L247 20 L274 11 L296 5" fill="none" stroke="#8d70ed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg><div className="admin-mini-line-axis"><span>2025.09</span><span>2025.11</span><span>2026.01</span><span>2026.03</span><span>2026.05</span><span>2026.08</span></div><span>최근 12개월 추이</span></div></article><article className="admin-card admin-overview-chart-card"><div className="admin-overview-chart-heading"><div><p>월 로고 생성</p><strong>9,187<small>건</small></strong><span className="admin-positive">+12.8% <ArrowUpRight size={14} /></span></div><span className="admin-kpi-icon pink"><Sparkles size={19} /></span></div><div className="admin-mini-bars" aria-label="월별 로고 생성량"><i style={{ height: '38%' }} /><i style={{ height: '48%' }} /><i style={{ height: '44%' }} /><i style={{ height: '57%' }} /><i style={{ height: '52%' }} /><i style={{ height: '67%' }} /><i style={{ height: '63%' }} /><i style={{ height: '75%' }} /><i style={{ height: '72%' }} /><i style={{ height: '84%' }} /><i style={{ height: '79%' }} /><i style={{ height: '96%' }} /></div><div className="admin-mini-bars-axis"><span>2025.09</span><span>2025.10</span><span>2025.11</span><span>2025.12</span><span>2026.01</span><span>2026.02</span><span>2026.03</span><span>2026.04</span><span>2026.05</span><span>2026.06</span><span>2026.07</span><span>2026.08</span></div><span className="admin-overview-chart-caption">월별 생성량 · 최근 12개월</span></article><article className="admin-card admin-overview-chart-card"><div className="admin-overview-chart-heading"><div><p>전체 다운로드</p><strong>6,842<small>건</small></strong><span className="admin-positive">+14.2% <ArrowUpRight size={14} /></span></div><span className="admin-kpi-icon orange"><Download size={19} /></span></div><div className="admin-download-overview-graph"><div className="admin-overview-donut"><span>6,842<small>전체</small></span></div><div className="admin-overview-legend"><span><i className="ci" />CI <strong>31.1%</strong></span><span><i className="bi" />BI <strong>68.9%</strong></span></div></div></article><article className="admin-card admin-overview-chart-card"><div className="admin-overview-chart-heading"><div><p>월 크레딧 사용량</p><strong>3,842<small>개</small></strong><span className="admin-positive">+12.6% <ArrowUpRight size={14} /></span></div><span className="admin-kpi-icon blue"><ClipboardCheck size={19} /></span></div><div className="admin-credit-overview-graph"><div><span>사용량</span><i><b className="purple" style={{ width: '49%' }} /></i><strong>3,842</strong></div><div><span>결제량</span><i><b className="pink" style={{ width: '100%' }} /></i><strong>7,860</strong></div></div><span className="admin-overview-chart-caption">사용량 / 결제량 비교</span></article></section>
          </> : dashboardSection === 'members' ? <>
            <section className="admin-card admin-member-list-card"><div className="admin-card-heading"><div><h2>회원 목록</h2><p>현재 가입한 회원의 서비스 이용 현황입니다.</p></div><span className="admin-status-label">총 1명</span></div><div className="admin-member-table-wrap"><table className="admin-member-table"><thead><tr><th>아이디</th><th>가입일자</th><th>다운로드 횟수</th><th>크레딧 사용량</th><th>크레딧 결제일자</th><th>보유 크레딧</th></tr></thead><tbody><tr><td data-label="아이디"><div className="admin-member-identity"><span className="admin-member-avatar"><UserRound size={17} /></span><div><strong>minji.kim@example.com</strong><small>김민지</small></div></div></td><td data-label="가입일자">2026.08.05</td><td data-label="다운로드 횟수"><strong>3회</strong></td><td data-label="크레딧 사용량"><strong>8개</strong></td><td data-label="크레딧 결제일자">2026.08.05</td><td data-label="보유 크레딧"><strong>12개</strong></td></tr></tbody></table></div></section>
          </> : dashboardSection === 'generation' ? <>
          <section className="admin-kpi-grid admin-generation-kpi-grid" aria-label="생성 핵심 지표">
            <article className="admin-kpi-card"><span className="admin-kpi-icon purple"><Sparkles size={19} /></span><div><p>총 로고 생성</p><strong>{selectedPeriodData.total}<small>건</small></strong><span className="admin-positive">{selectedPeriodData.totalDelta} <ArrowUpRight size={14} /></span></div></article>
            <article className="admin-kpi-card"><span className="admin-kpi-icon pink"><ClipboardCheck size={19} /></span><div><p>생성 완료율</p><strong>{selectedPeriodData.completion}<small>%</small></strong><span className="admin-positive">{selectedPeriodData.completionDelta} <ArrowUpRight size={14} /></span></div></article>
            <article className="admin-kpi-card"><span className="admin-kpi-icon orange"><Clock3 size={19} /></span><div><p>평균 생성 시간</p><strong>{selectedPeriodData.avg}<small>분</small></strong><span className="admin-positive">{selectedPeriodData.avgDelta} <ArrowUpRight size={14} /></span></div></article>
          </section>

          <section className="admin-chart-grid">
             <article className="admin-card admin-purpose-card"><div className="admin-card-heading"><div><h2>계기 / 용도</h2><p>{periodLabels[dashboardPeriod]} 로고 생성을 시작한 목적</p></div><CircleHelp size={18} /></div><div className="admin-donut-layout"><div className="admin-donut" aria-label="계기 및 용도 통계 도넛 차트"><span>{selectedPeriodData.total}<small>전체 생성</small></span></div><div className="admin-legend">{selectedPurposeStats.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.value}%</strong></div>)}</div></div></article>
             <article className="admin-card admin-satisfaction-card"><div className="admin-card-heading"><div><h2>만족도 반응</h2><p>{periodLabels[dashboardPeriod]} 설문 응답 기준</p></div><CircleHelp size={18} /></div><div className="admin-satisfaction-body"><div className="admin-satisfaction-score"><Heart size={22} fill="currentColor" /><strong>{selectedGenerationExtras.satisfaction}<small>%</small></strong><span>좋아요 비율</span></div><div className="admin-horizontal-bars"><div><span>좋아요</span><i><b style={{ width: `${selectedGenerationExtras.satisfaction}%` }} /></i><strong>{selectedGenerationExtras.satisfaction}%</strong></div><div><span>싫어요</span><i><b className="negative" style={{ width: `${100 - selectedGenerationExtras.satisfaction}%` }} /></i><strong>{100 - selectedGenerationExtras.satisfaction}%</strong></div></div></div><div className="admin-response-counts"><span><i className="purple-dot" />좋아요 <strong>{selectedGenerationExtras.likes.toLocaleString()}건</strong></span><span><i className="pink-dot" />싫어요 <strong>{selectedGenerationExtras.dislikes.toLocaleString()}건</strong></span></div></article>
          </section>

          <section className="admin-chart-grid lower">
             <article className="admin-card admin-trend-card"><div className="admin-card-heading"><div><h2>월별 이용자 수</h2><p>{periodLabels[dashboardPeriod]} 기준 이용자 추이</p></div><span className="admin-chart-key"><i /> 이용자 수</span></div><div className="admin-line-chart"><div className="admin-y-axis"><span>1,500</span><span>1,200</span><span>900</span><span>600</span><span>300</span><span>0</span></div><svg viewBox="0 0 600 230" role="img" aria-label={`${periodLabels[dashboardPeriod]} 이용자 수 추이`}><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9473f1" stopOpacity=".24" /><stop offset="1" stopColor="#9473f1" stopOpacity=".02" /></linearGradient></defs><path d={chartAreaPath} fill="url(#trendFill)" /><path d={chartPath} fill="none" stroke="#8b69ed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{chartPoints.map((point) => <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="4.5" fill="#fff" stroke="#8b69ed" strokeWidth="3" />)}</svg><div className="admin-x-axis">{signupXAxisLabels.map((month) => <span key={month}>{month}</span>)}</div></div></article>
            <article className="admin-card admin-ci-bi-card"><div className="admin-card-heading"><div><h2>CI / BI 생성현황</h2><p>로고 형태별 생성 비중</p></div><CircleHelp size={18} /></div><div className="admin-column-chart"><div className="admin-column-grid"><span>7,000</span><span>5,000</span><span>3,000</span><span>1,000</span><span>0</span></div><div className="admin-columns"><div><strong>{selectedPeriodData.ci}건</strong><i className="ci" style={{ height: `${Math.min(88, (Number(selectedPeriodData.ci.replace(',', '')) / 7000) * 100)}%` }} /><span>CI</span></div><div><strong>{selectedPeriodData.bi}건</strong><i className="bi" style={{ height: `${Math.min(88, (Number(selectedPeriodData.bi.replace(',', '')) / 7000) * 100)}%` }} /><span>BI</span></div></div></div></article>
          </section>

           <section className="admin-input-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">USER INPUT INSIGHTS</p><h2>CI / BI별 입력 정보</h2></div><button type="button">상세 리포트 <ChevronRight size={16} /></button></div><div className="admin-input-grid"><article className="admin-card admin-input-card ci"><div className="admin-input-title"><span className="admin-type-badge">CI</span><div><h3>기업 로고 생성 정보</h3><p>{periodLabels[dashboardPeriod]} 기업 입력 정보를 분석했어요.</p></div><FolderCheck size={23} /></div><div className="admin-input-block"><div><span>기업이 추구하는 모토 키워드</span><strong>신뢰감 · 혁신 · 지속가능성</strong></div>{selectedCiInputs.map((item) => <div className="admin-progress-row" key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.value}%` }} /></i><strong>{item.value}%</strong></div>)}</div><footer>기업명 입력 완료율 <strong>{selectedGenerationExtras.ciCompletion}%</strong><span>총 {selectedPeriodData.ci}건</span></footer></article><article className="admin-card admin-input-card bi"><div className="admin-input-title"><span className="admin-type-badge">BI</span><div><h3>제품·브랜드 로고 생성 정보</h3><p>{periodLabels[dashboardPeriod]} 브랜드 입력 정보를 분석했어요.</p></div><Palette size={23} /></div><div className="admin-input-block"><div><span>가장 많이 선택한 핵심가치</span><strong>비건 · 저자극 · 클린뷰티</strong></div>{selectedBiInputs.map((item) => <div className="admin-progress-row" key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.value * 2}%` }} /></i><strong>{item.value}%</strong></div>)}</div><footer>브랜드명 입력 완료율 <strong>{selectedGenerationExtras.biCompletion}%</strong><span>총 {selectedPeriodData.bi}건</span></footer></article></div></section>

          <section className="admin-request-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">SURVEY REQUESTS</p><h2>Survey 추가 요청</h2></div><span className="admin-request-count">총 {surveyRequests.length}건</span></div><div className="admin-request-list">{surveyRequests.map((request) => <article className="admin-request-row" key={request.id}><span className="admin-request-number">{request.id}</span><div className="admin-request-copy"><div><strong>{request.category}</strong><span>{request.user} · {request.time}</span></div><p>{request.message}</p></div><button type="button" aria-label={`${request.category} 요청 보기`}><ChevronRight size={18} /></button></article>)}</div></section>
           <section className="admin-card admin-trademark-card"><div className="admin-card-heading"><div><h2>상표 이미지 분석 이용 여부</h2><p>{periodLabels[dashboardPeriod]} 생성 과정에서 상표 이미지 분석을 이용한 비율</p></div><span className="admin-status-label">생성 분석</span></div><div className="admin-trademark-overview"><div className="admin-trademark-highlight"><ShieldCheck size={24} strokeWidth={1.8} /><strong>{selectedGenerationAnalysis}<small>%</small></strong><span>분석 이용 비율</span></div><div className="admin-trademark-bars"><div><span>분석 이용</span><i><b style={{ width: `${selectedGenerationAnalysis}%` }} /></i><strong>{selectedGenerationAnalysis}%</strong></div><div><span>분석 없이</span><i><b className="pink" style={{ width: `${100 - selectedGenerationAnalysis}%` }} /></i><strong>{100 - selectedGenerationAnalysis}%</strong></div></div></div><div className="admin-trademark-legend"><span><i className="purple" />분석 이용 <strong>{formatGenerationAnalysisCount(selectedGenerationAnalysis)}건</strong></span><span><i className="pink" />분석 없이 <strong>{formatGenerationAnalysisCount(100 - selectedGenerationAnalysis)}건</strong></span></div><p className="admin-trademark-note">상표 이미지 분석을 활용한 생성 결과 비율을 확인할 수 있습니다.</p></section>
           </> : dashboardSection === 'download' ? <>
             <section className="admin-kpi-grid"><article className="admin-kpi-card"><span className="admin-kpi-icon purple"><Download size={19} /></span><div><p>전체 다운로드</p><strong>{selectedDownloadData.total}<small>건</small></strong><span className="admin-positive">{periodLabels[dashboardPeriod]} 기준 <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon pink"><Sparkles size={19} /></span><div><p>다운로드 전환율</p><strong>{selectedDownloadData.conversion}<small>%</small></strong><span className="admin-positive">기간별 집계 <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon orange"><FolderCheck size={19} /></span><div><p>CI 결과 다운로드</p><strong>{selectedDownloadData.ci}<small>건</small></strong><span className="admin-positive">{selectedDownloadData.ciShare}% <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon blue"><Palette size={19} /></span><div><p>BI 결과 다운로드</p><strong>{selectedDownloadData.bi}<small>건</small></strong><span className="admin-positive">{selectedDownloadData.biShare}% <ArrowUpRight size={14} /></span></div></article></section>
            <section className="admin-card admin-style-download-card"><div className="admin-card-heading"><div><h2>CI · BI 로고 스타일별 다운로드 비율</h2><p>{periodLabels[dashboardPeriod]} 다운로드 로고 결과물을 비교해보세요.</p></div><span className="admin-status-label">총 {selectedDownloadData.total}건</span></div><div className="admin-style-download-panels"><div className="admin-style-download-panel"><div className="admin-style-download-panel-heading"><strong>CI 로고</strong><span>{selectedDownloadData.ci}건</span></div><div className="admin-style-download-chart" aria-label="CI 로고 스타일별 다운로드 비율"><div className="admin-style-download-row"><div><span>콤비네이션</span><strong>{selectedDownloadData.ciStyles[0]}%</strong></div><i><b className="purple" style={{ width: `${selectedDownloadData.ciStyles[0]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.ci, selectedDownloadData.ciStyles[0])}건</small></div><div className="admin-style-download-row"><div><span>심볼마크</span><strong>{selectedDownloadData.ciStyles[1]}%</strong></div><i><b className="violet" style={{ width: `${selectedDownloadData.ciStyles[1]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.ci, selectedDownloadData.ciStyles[1])}건</small></div><div className="admin-style-download-row"><div><span>워드마크</span><strong>{selectedDownloadData.ciStyles[2]}%</strong></div><i><b className="pink" style={{ width: `${selectedDownloadData.ciStyles[2]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.ci, selectedDownloadData.ciStyles[2])}건</small></div><div className="admin-style-download-row"><div><span>레터마크</span><strong>{selectedDownloadData.ciStyles[3]}%</strong></div><i><b className="orange" style={{ width: `${selectedDownloadData.ciStyles[3]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.ci, selectedDownloadData.ciStyles[3])}건</small></div></div></div><div className="admin-style-download-panel"><div className="admin-style-download-panel-heading"><strong>BI 로고</strong><span>{selectedDownloadData.bi}건</span></div><div className="admin-style-download-chart" aria-label="BI 로고 스타일별 다운로드 비율"><div className="admin-style-download-row"><div><span>콤비네이션</span><strong>{selectedDownloadData.biStyles[0]}%</strong></div><i><b className="purple" style={{ width: `${selectedDownloadData.biStyles[0]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.bi, selectedDownloadData.biStyles[0])}건</small></div><div className="admin-style-download-row"><div><span>심볼마크</span><strong>{selectedDownloadData.biStyles[1]}%</strong></div><i><b className="violet" style={{ width: `${selectedDownloadData.biStyles[1]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.bi, selectedDownloadData.biStyles[1])}건</small></div><div className="admin-style-download-row"><div><span>워드마크</span><strong>{selectedDownloadData.biStyles[2]}%</strong></div><i><b className="pink" style={{ width: `${selectedDownloadData.biStyles[2]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.bi, selectedDownloadData.biStyles[2])}건</small></div><div className="admin-style-download-row"><div><span>레터마크</span><strong>{selectedDownloadData.biStyles[3]}%</strong></div><i><b className="orange" style={{ width: `${selectedDownloadData.biStyles[3]}%` }} /></i><small>{downloadStyleCount(selectedDownloadData.bi, selectedDownloadData.biStyles[3])}건</small></div></div></div></div></section>
            <section className="admin-chart-grid"><article className="admin-card"><div className="admin-card-heading"><div><h2>다운로드 파일 구성</h2><p>{periodLabels[dashboardPeriod]} 로고 결과물 구성</p></div><CircleHelp size={18} /></div><div className="admin-download-breakdown"><div className="admin-donut download-donut"><span>{selectedDownloadData.total}<small>전체 다운로드</small></span></div><div className="admin-legend"><div><i style={{ background: '#8d70ed' }} /><span>로고만 다운로드</span><strong>{selectedDownloadData.fileOnly}%</strong></div><div><i style={{ background: '#ed70ac' }} /><span>로고 + 입력정보</span><strong>{selectedDownloadData.fileWithInput}%</strong></div><p>로고 파일과 함께 생성에 사용한 핵심 정보를 제공한 다운로드 비율입니다.</p></div></div></article><article className="admin-card"><div className="admin-card-heading"><div><h2>좋은 결과로 이어진 입력 정보</h2><p>{periodLabels[dashboardPeriod]} 다운로드 전환율이 높은 조합</p></div><CircleHelp size={18} /></div><div className="admin-result-insights"><div><span className="admin-type-badge">CI</span><div><strong>신뢰감 · 혁신 · 명확한 모토</strong><p>다운로드 전환율 {selectedDownloadData.insightRates[0]}%</p></div></div><div><span className="admin-type-badge bi">BI</span><div><strong>비건 · 클린뷰티 · 콤비네이션</strong><p>다운로드 전환율 {selectedDownloadData.insightRates[1]}%</p></div></div><div><span className="admin-type-badge neutral">BI</span><div><strong>저자극 · 미니멀 · 심볼마크</strong><p>다운로드 전환율 {selectedDownloadData.insightRates[2]}%</p></div></div></div></article></section>
          </> : dashboardSection === 'credits' ? <>
             <section className="admin-kpi-grid admin-credit-kpi-grid"><article className="admin-kpi-card"><span className="admin-kpi-icon purple"><Sparkles size={19} /></span><div><p>{periodLabels[dashboardPeriod]} 사용량</p><strong>{selectedCreditData.dailyUse}<small>개</small></strong><span className="admin-positive">{selectedCreditData.useDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon blue"><CalendarDays size={19} /></span><div><p>{periodLabels[dashboardPeriod]} 누적 사용량</p><strong>{selectedCreditData.totalUse}<small>개</small></strong><span className="admin-positive">{selectedCreditData.totalUseDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon pink"><ClipboardCheck size={19} /></span><div><p>{periodLabels[dashboardPeriod]} 결제량</p><strong>{selectedCreditData.dailyPayment}<small>개</small></strong><span className="admin-positive">{selectedCreditData.paymentDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon orange"><Sparkles size={19} /></span><div><p>{periodLabels[dashboardPeriod]} 누적 결제량</p><strong>{selectedCreditData.totalPayment}<small>개</small></strong><span className="admin-positive">{selectedCreditData.totalPaymentDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon pink"><RefreshCw size={19} /></span><div><p>환불 건수</p><strong>{selectedCreditData.refunds}<small>건</small></strong><span className="admin-positive">{selectedCreditData.refundDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon blue"><UsersRound size={19} /></span><div><p>평균 주문량</p><strong>{selectedCreditData.averageOrder}<small>개</small></strong><span className="admin-positive">{periodLabels[dashboardPeriod]} 평균 <ArrowUpRight size={14} /></span></div></article></section>
             <section className="admin-card admin-credit-summary-card"><div className="admin-card-heading"><div><h2>크레딧 흐름 요약</h2><p>{periodLabels[dashboardPeriod]} 집계 기준 사용량과 결제량을 비교해보세요.</p></div><span className="admin-status-label">기간별 집계</span></div><div className="admin-credit-flow"><div><span>{periodLabels[dashboardPeriod]} 누적 결제량</span><strong>{selectedCreditData.totalPayment}개</strong></div><div><span>{periodLabels[dashboardPeriod]} 누적 사용량</span><strong>{selectedCreditData.totalUse}개</strong></div><div><span>환불 건수</span><strong>{selectedCreditData.refunds}건</strong></div></div><p className="admin-credit-note">결제량과 사용량은 선택한 기간의 크레딧 거래 이력 기준으로 집계됩니다.</p></section>
           <section className="admin-card admin-credit-flow-card"><div className="admin-card-heading"><div><h2>크레딧 통계 흐름</h2><p>{periodLabels[dashboardPeriod]} 결제부터 사용까지의 흐름을 확인해보세요.</p></div><span className="admin-status-label">기간별 집계</span></div><div className="admin-credit-flow-diagram"><div className="admin-credit-flow-step"><span>누적 결제 금액</span><strong>{selectedCreditData.cumulativePaymentAmount}</strong><small>결제된 금액</small></div><ArrowRight className="admin-credit-flow-arrow" size={18} /><div className="admin-credit-flow-step"><span>누적 결제 크레딧</span><strong>{selectedCreditData.totalPayment}개</strong><small>충전된 크레딧</small></div><ArrowRight className="admin-credit-flow-arrow" size={18} /><div className="admin-credit-flow-step"><span>누적 사용 크레딧</span><strong>{selectedCreditData.totalUse}개</strong><small>로고 생성에 사용</small></div><ArrowRight className="admin-credit-flow-arrow" size={18} /><div className="admin-credit-flow-step"><span>환불 건수</span><strong>{selectedCreditData.refunds}건</strong><small>환불 처리된 거래</small></div></div></section>
           </> : dashboardSection === 'signup' ? <>
             <section className="admin-kpi-grid"><article className="admin-kpi-card"><span className="admin-kpi-icon purple"><UsersRound size={19} /></span><div><p>전체 가입자</p><strong>{selectedSignupData.total}<small>명</small></strong><span className="admin-positive">{selectedSignupData.totalDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon pink"><ClipboardCheck size={19} /></span><div><p>신규 가입자</p><strong>{selectedSignupData.newUsers}<small>명</small></strong><span className="admin-positive">{selectedSignupData.newDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon orange"><Sparkles size={19} /></span><div><p>온보딩 완료율</p><strong>{selectedSignupData.completion}<small>%</small></strong><span className="admin-positive">{selectedSignupData.completionDelta} <ArrowUpRight size={14} /></span></div></article><article className="admin-kpi-card"><span className="admin-kpi-icon blue"><ArrowUpRight size={19} /></span><div><p>가입 후 생성 시작</p><strong>{selectedSignupData.started}<small>%</small></strong><span className="admin-positive">{selectedSignupData.startedDelta} <ArrowUpRight size={14} /></span></div></article></section>
             <section className="admin-chart-grid lower"><article className="admin-card admin-signup-trend"><div className="admin-card-heading"><div><h2>월별 가입자 수</h2><p>{periodLabels[dashboardPeriod]} 기준 신규 가입 추이</p></div><span className="admin-chart-key"><i /> 신규 가입자</span></div><div className="admin-signup-bars">{signupMonthlyValues.map((value, index) => <div key={index}><strong>{value.toLocaleString()}<small>명</small></strong><i style={{ height: `${Math.round((value / signupMonthlyMax) * 84)}%` }} /><span>{signupXAxisLabels[index]}</span></div>)}</div></article><article className="admin-card"><div className="admin-card-heading"><div><h2>가입 경로</h2><p>{periodLabels[dashboardPeriod]} 사용자 유입 비율</p></div><CircleHelp size={18} /></div><div className="admin-signup-sources"><div><span>카카오 로그인</span><i><b style={{ width: `${selectedSignupData.sources[0]}%` }} /></i><strong>{selectedSignupData.sources[0]}%</strong></div><div><span>Google 로그인</span><i><b style={{ width: `${selectedSignupData.sources[1]}%` }} /></i><strong>{selectedSignupData.sources[1]}%</strong></div><div><span>초대 링크</span><i><b style={{ width: `${selectedSignupData.sources[2]}%` }} /></i><strong>{selectedSignupData.sources[2]}%</strong></div><div><span>기타</span><i><b style={{ width: `${selectedSignupData.sources[3]}%` }} /></i><strong>{selectedSignupData.sources[3]}%</strong></div></div></article></section>
             <section className="admin-card admin-funnel-card"><div className="admin-card-heading"><div><h2>가입 후 첫 생성까지의 흐름</h2><p>{periodLabels[dashboardPeriod]} 온보딩 단계별 이탈을 확인해보세요.</p></div></div><div className="admin-funnel"><div><strong>{selectedSignupData.funnel[0].toLocaleString()}</strong><span>가입 완료</span></div><div><strong>{selectedSignupData.funnel[1].toLocaleString()}</strong><span>온보딩 시작</span></div><div><strong>{selectedSignupData.funnel[2].toLocaleString()}</strong><span>온보딩 완료</span></div><div><strong>{selectedSignupData.funnel[3].toLocaleString()}</strong><span>첫 로고 생성 시작</span></div></div><div className="admin-funnel-dropoff"><div><span>온보딩 이탈률</span><strong>{selectedSignupData.dropoff}%</strong></div><p>선택한 기간에 온보딩을 시작한 {selectedSignupData.funnel[1].toLocaleString()}명 중 일부가 완료 전에 이탈했어요.</p></div></section>
          </> : <>
            <section className="admin-request-section"><div className="admin-section-heading"><div><h2>개선 요청 타임라인</h2></div><span className="admin-request-count">총 {surveyRequests.length}건</span></div><div className="admin-request-list">{surveyRequests.map((request) => <article className="admin-request-row" key={request.id}><span className="admin-request-number">{request.id}</span><div className="admin-request-copy"><div><strong>{request.category}</strong><span>{request.user} · {request.time}</span></div><p>{request.message}</p></div><button type="button" aria-label={`${request.category} 요청 보기`}><ChevronRight size={18} /></button></article>)}</div></section>
          </>}
        </section>
      </main>
    )
  }


  return renderDashboardScreen()
}
