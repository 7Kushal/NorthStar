import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, CircleDollarSign, ClipboardCheck, Gauge, LayoutDashboard,
  LineChart, Menu, Plus, Search, Settings, ShieldCheck, Sparkles, Target, Trash2,
  TrendingUp, WalletCards, X, ZoomIn, Moon, Sun, ExternalLink, RefreshCw, Clock3,
  Newspaper, Radio, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Camera,
  Maximize2
} from 'lucide-react';
import { useLocalState } from './hooks/useLocalState';
import { useAccountWorkspace } from './hooks/useAccountWorkspace';
import { useAccessSession } from './hooks/useAccessSession';
import { useMarket } from './hooks/useMarket';
import { useEconomicCalendar } from './hooks/useEconomicCalendar';

const INITIAL = {
  settings: { startingBalance: 10000, maxDailyLoss: 500, maxTrades: 4, riskPerTrade: 100 },
  trades: [], positions: [], plans: [], sessions: [],
  routine: { checks: [false, false, false, false, false], bias: '', notes: '', complete: false, completedAt: null },
  pendingSession: null,
};
const INSTRUMENTS = {
  BTCUSD: { label: 'BTC / USD', name: 'Bitcoin / US Dollar', icon: '₿', accent: 'orange' },
  XAUUSD: { label: 'XAU / USD', name: 'Gold Spot / US Dollar', icon: '◆', accent: 'gold' },
};
const NAV = [
  ['dashboard', LayoutDashboard, 'Overview'], ['terminal', LineChart, 'Terminal'],
  ['journal', BookOpen, 'Journal'], ['analytics', BarChart3, 'Analytics'],
  ['calendar', CalendarDays, 'Economic calendar'], ['plans', Target, 'Playbooks'],
  ['settings', Settings, 'Settings'],
];
const TITLES = {
  dashboard: ['Overview', 'Command center'], terminal: ['Execution terminal', 'Live markets'],
  journal: ['Trading journal', 'Review & reflect'], analytics: ['Performance analytics', 'Find your edge'],
  calendar: ['Economic calendar', 'United States · live weekly events'],
  premarket: ['Pre-market routine', 'Prepare with intention'], plans: ['Strategy playbooks', 'Your execution system'],
  settings: ['Risk controls', 'Account configuration'],
};
const CHECKS = ['Review scheduled market events', 'Mark higher-timeframe levels', 'Set session risk limits', 'Confirm active strategy', 'Check mental state and intention'];
const ELEFIN_CHECKS = [
  'Is price in expansion, a pullback, or consolidation?',
  'Who is in control: buyers or sellers?',
  'Where are the obvious highs and lows?',
  'Where might price be drawing toward?',
  'Is the market continuing or preparing to shift?',
];
const ELEFIN_EMOTIONS = ['Calm', 'Focused', 'Confident', 'Hesitant', 'Anxious', 'FOMO'];
const ELEFIN_URL = 'https://my.elefin.com/dashboard';

const money = (value, sign = true) => `${sign && value > 0 ? '+' : ''}${value < 0 ? '−' : ''}$${Math.abs(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plainMoney = value => Number.isFinite(value) ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const formatQuote = value => Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const uid = () => crypto.randomUUID();
const toLocalDateTimeValue = (value = new Date()) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const updateStoredCheckinStatus = (id, status, accountId) => {
  try {
    const stored = JSON.parse(localStorage.getItem('northstar-elefin-checkins') || '[]');
    if (!Array.isArray(stored)) return;
    localStorage.setItem('northstar-elefin-checkins', JSON.stringify(stored.map(record => record.id === id && (!record.accountId || record.accountId === accountId) ? { ...record, status, statusUpdatedAt: new Date().toISOString() } : record)));
  } catch {
    // Session state in the main workspace remains the source of truth.
  }
};

function AccessLoading() {
  return <main className="access-screen"><div className="access-card"><div className="access-brand"><Sparkles size={19} /></div><p>SECURE WORKSPACE</p><h1>Confirming your session</h1><span>NorthStar is checking your Cloudflare Access identity.</span><RefreshCw className="spinning" size={20} /></div></main>;
}

function AccessRequired() {
  return <main className="access-screen"><div className="access-card"><div className="access-brand"><ShieldCheck size={20} /></div><p>PRIVATE ACCESS</p><h1>Sign in to NorthStar</h1><span>This workspace accepts only members of your Cloudflare account. Public application sign-up and third-party login methods are disabled.</span><button className="primary-button" onClick={() => window.location.reload()}>Continue with Cloudflare <ArrowUpRight size={16} /></button><small>If this screen remains after refresh, enable Access on the Worker and restrict the Cloudflare identity provider to account members.</small></div></main>;
}

export default function App() {
  const workspace = useAccountWorkspace(INITIAL);
  const { accounts, activeAccount, data, setData, switchAccount, createAccount, deleteAccount } = workspace;
  const identity = useAccessSession();
  const [page, setPage] = useState('dashboard');
  const [symbol, setSymbol] = useState('BTCUSD');
  const [timeframe, setTimeframe] = useState('M5');
  const [mobileNav, setMobileNav] = useState(false);
  const [navCollapsed, setNavCollapsed] = useLocalState('northstar-nav-collapsed', false);
  const [tradeModal, setTradeModal] = useState(false);
  const [tradeDate, setTradeDate] = useState(null);
  const [planModal, setPlanModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [reviewTrade, setReviewTrade] = useState(null);
  const [elefinModal, setElefinModal] = useState(false);
  const [theme, setTheme] = useLocalState('northstar-theme', 'dark');
  const market = useMarket(symbol, timeframe, page === 'terminal');
  const sessions = data.sessions || [];
  const activePlan = data.plans.find(plan => plan.active);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayTrades = data.trades.filter(t => t.date.slice(0, 10) === todayKey);
  const todayPnl = todayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalPnl = data.trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const pendingSession = data.pendingSession || null;

  const patch = fn => setData(current => {
    const next = typeof structuredClone === 'function' ? structuredClone(current) : JSON.parse(JSON.stringify(current));
    fn(next); return next;
  });
  const go = target => { setPage(target); setMobileNav(false); };
  const addTrade = trade => patch(next => next.trades.unshift({ ...trade, id: uid() }));
  const openTrade = date => { setTradeDate(date || null); setTradeModal(true); };
  const stageSession = record => { setElefinModal(false); patch(next => { next.pendingSession = { ...record, accountId: activeAccount.id, status: 'pending' }; }); };
  const acknowledgeSession = () => {
    if (!pendingSession) return;
    const acknowledged = { ...pendingSession, status: 'acknowledged', acknowledgedAt: new Date().toISOString() };
    patch(next => { next.sessions ||= []; if (!next.sessions.some(session => session.id === acknowledged.id)) next.sessions.unshift(acknowledged); next.pendingSession = null; });
    updateStoredCheckinStatus(acknowledged.id, 'acknowledged', activeAccount.id);
  };
  const cancelSession = () => {
    if (pendingSession) updateStoredCheckinStatus(pendingSession.id, 'cancelled', activeAccount.id);
    patch(next => { next.pendingSession = null; });
  };
  const selectAccount = id => {
    switchAccount(id);
    setTradeModal(false); setPlanModal(false); setReviewTrade(null); setElefinModal(false);
  };
  const toggleNavigation = () => {
    if (window.matchMedia('(max-width: 820px)').matches) {
      setNavCollapsed(false);
      setMobileNav(current => !current);
    } else {
      setMobileNav(false);
      setNavCollapsed(current => !current);
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  if (identity.loading) return <AccessLoading />;
  if (!identity.authenticated) return <AccessRequired />;

  return <div className={`app-shell theme-${theme} ${navCollapsed ? 'nav-collapsed' : ''}`}>
    <Sidebar page={page} go={go} open={mobileNav} accounts={accounts} activeAccount={activeAccount} onSwitchAccount={selectAccount} onAddAccount={() => setAccountModal(true)} onDeleteAccount={deleteAccount} identity={identity} />
    <main className="main-shell">
      <Topbar page={page} onMenu={toggleNavigation} onNewTrade={() => openTrade()} theme={theme} onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} navCollapsed={navCollapsed} data={data} totalPnl={totalPnl} todayPnl={todayPnl} market={market} symbol={symbol} activeAccount={activeAccount} />
      <div className="account-workspace" key={activeAccount.id}>
        {page === 'dashboard' && <Dashboard data={data} totalPnl={totalPnl} todayPnl={todayPnl} todayTrades={todayTrades} activePlan={activePlan} go={go} theme={theme} />}
        {page === 'terminal' && <Terminal symbol={symbol} setSymbol={setSymbol} timeframe={timeframe} setTimeframe={setTimeframe} market={market} theme={theme} />}
        {page === 'journal' && <Journal trades={data.trades} sessions={sessions} onAdd={openTrade} onReview={setReviewTrade} onDelete={id => patch(next => next.trades = next.trades.filter(t => t.id !== id))} />}
        {page === 'analytics' && <Analytics trades={data.trades} sessions={sessions} theme={theme} />}
        {page === 'calendar' && <EconomicCalendar />}
        {page === 'premarket' && <Premarket routine={data.routine} activePlan={activePlan} patch={patch} go={go} />}
        {page === 'plans' && <Plans plans={data.plans} patch={patch} onAdd={() => setPlanModal(true)} />}
        {page === 'settings' && <RiskSettings settings={data.settings} patch={patch} account={activeAccount} />}
      </div>
    </main>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    {tradeModal && <TradeModal plans={data.plans} initialDate={tradeDate} onClose={() => { setTradeModal(false); setTradeDate(null); }} onSave={trade => { addTrade(trade); setTradeModal(false); setTradeDate(null); }} />}
    {planModal && <PlanModal onClose={() => setPlanModal(false)} onSave={plan => { patch(next => { if (!next.plans.length) plan.active = true; next.plans.push(plan); }); setPlanModal(false); }} />}
    {accountModal && <AccountModal onClose={() => setAccountModal(false)} onSave={details => { createAccount(details); setAccountModal(false); }} />}
    {reviewTrade && <ReviewModal trade={reviewTrade} onClose={() => setReviewTrade(null)} onSave={updates => { patch(next => Object.assign(next.trades.find(t => t.id === reviewTrade.id), updates)); setReviewTrade(null); }} />}
    <button type="button" className="elefin-hanger" onClick={() => setElefinModal(true)} aria-haspopup="dialog" aria-expanded={elefinModal}>
      <span className="elefin-hanger-icon"><Sparkles size={18} /></span>
      <span><small>{sessions.length ? `${sessions.length} CHECK-IN${sessions.length === 1 ? '' : 'S'} SAVED` : 'PRE-TRADE GATE'}</small><b>Lets Go To Elefin</b></span>
      <ExternalLink size={17} />
    </button>
    {elefinModal && <ElefinCheckIn accountId={activeAccount.id} onClose={() => setElefinModal(false)} onStart={stageSession} />}
    {pendingSession && <SessionStatusModal session={pendingSession} onAcknowledge={acknowledgeSession} onCancel={cancelSession} />}
  </div>;
}

function Sidebar({ page, go, open, accounts, activeAccount, onSwitchAccount, onAddAccount, onDeleteAccount, identity }) {
  const [accountMenu, setAccountMenu] = useState(false);
  const initials = (identity.name || identity.email || 'NS').split(/[\s@]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <aside className={`sidebar ${open ? 'open' : ''}`}>
    <div className="logo"><span><Sparkles size={17} /></span><div>northstar<small>TRADING INTELLIGENCE</small></div></div>
    <div className="nav-label">Workspace</div>
    <nav>{NAV.map(([id, Icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)} title={label} aria-label={label}><Icon size={18} /><span>{label}</span>{page === id && <i />}</button>)}</nav>
    <div className="sidebar-spacer" />
    <div className="system-chip"><i /> All systems operational</div>
    <div className="account-switcher">
      <button className="account-switcher-trigger" onClick={() => setAccountMenu(current => !current)} aria-expanded={accountMenu}>
        <span><WalletCards size={17} /></span><div><b>{activeAccount.name}</b><small>{activeAccount.broker} · {activeAccount.type}</small></div><ChevronDown size={15} />
      </button>
      {accountMenu && <div className="account-menu">
        <header><span>TRADING ACCOUNTS</span><b>{accounts.length}</b></header>
        <div>{accounts.map(account => <div className={`account-option ${account.id === activeAccount.id ? 'active' : ''}`} key={account.id}>
          <button onClick={() => { onSwitchAccount(account.id); setAccountMenu(false); }}><i>{account.id === activeAccount.id ? <Check size={12} /> : <WalletCards size={12} />}</i><span><b>{account.name}</b><small>{account.broker} · {plainMoney(Number(account.data.settings.startingBalance || 0))}</small></span></button>
          {accounts.length > 1 && <button className="account-delete" onClick={() => { if (window.confirm(`Delete ${account.name} and all locally stored data for it?`)) onDeleteAccount(account.id); }} aria-label={`Delete ${account.name}`}><Trash2 size={13} /></button>}
        </div>)}</div>
        <button className="account-add" onClick={() => { setAccountMenu(false); onAddAccount(); }}><Plus size={14} /> Create trading account</button>
      </div>}
    </div>
    <div className="user-card"><span>{initials}</span><div><b>{identity.name || 'Signed in'}</b><small>{identity.local ? 'Local development' : identity.email}</small></div>{!identity.local && <a href="/cdn-cgi/access/logout" aria-label="Sign out" title="Sign out"><ExternalLink size={14} /></a>}</div>
  </aside>;
}

function Topbar({ page, onMenu, onNewTrade, theme, onTheme, navCollapsed, data, totalPnl, todayPnl, market, symbol, activeAccount }) {
  const [title, eyebrow] = TITLES[page];
  const openPositions = (data.positions || []).filter(position => (position.status || 'open') === 'open');
  const hasUnpricedPosition = openPositions.some(position => position.symbol !== symbol) || (openPositions.length > 0 && !Number.isFinite(market.price));
  const openPnl = hasUnpricedPosition ? null : openPositions.reduce((sum, position) => {
    const direction = position.side === 'buy' ? 1 : -1;
    return sum + (market.price - Number(position.entry)) * Number(position.size || 0) * direction;
  }, 0);
  const balance = Number(data.settings.startingBalance || 0) + totalPnl;
  const equity = openPnl === null ? null : balance + openPnl;
  const lossUsage = Math.max(0, -todayPnl) / Math.max(1, Number(data.settings.maxDailyLoss || 1));
  const marginHealth = lossUsage >= 1 ? 'Critical' : lossUsage >= .6 ? 'Caution' : 'Healthy';
  return <header className="topbar"><button className="menu-button" onClick={onMenu} aria-label={navCollapsed ? 'Open navigation' : 'Toggle navigation'} title={navCollapsed ? 'Open navigation' : 'Toggle navigation'}><Menu size={20} /></button><div className="topbar-title"><p>{eyebrow}</p><h1>{title}</h1><span className="topbar-account"><WalletCards size={12} /> {activeAccount.name}</span></div><div className="account-strip" aria-label="Account status"><div><span>BALANCE</span><b>{plainMoney(balance)}</b></div><div><span>OPEN P&amp;L</span><b className={openPnl === null ? '' : openPnl >= 0 ? 'positive' : 'negative'}>{openPnl === null ? '—' : money(openPnl)}</b></div><div><span>EQUITY</span><b>{equity === null ? '—' : plainMoney(equity)}</b></div><div><span>MARGIN HEALTH</span><b className={`health-${marginHealth.toLowerCase()}`}>{marginHealth}</b></div></div><div className="top-actions"><div className="today"><CalendarDays size={15} />{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><button className="round-button theme-toggle" onClick={onTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><button className="round-button"><Bell size={18} /><i /></button><button className="primary-button" onClick={onNewTrade}><Plus size={16} /> Log trade</button></div></header>;
}

function Dashboard({ data, totalPnl, todayPnl, todayTrades, activePlan, go, theme }) {
  const wins = data.trades.filter(t => t.pnl > 0), losses = data.trades.filter(t => t.pnl < 0), winRate = data.trades.length ? wins.length / data.trades.length * 100 : null;
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0), grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const cards = [
    ['Net P&L', money(totalPnl), totalPnl >= 0 ? ArrowUpRight : ArrowDownRight, totalPnl >= 0 ? 'green' : 'red', `${data.trades.length} recorded trades`],
    ['Win rate', winRate === null ? '—' : `${winRate.toFixed(1)}%`, Gauge, 'violet', winRate === null ? 'Awaiting trades' : `${wins.length} wins · ${losses.length} losses`],
    ['Profit factor', grossLoss ? (grossWin / grossLoss).toFixed(2) : '—', Activity, 'blue', grossLoss ? 'Gross profit ÷ gross loss' : 'Awaiting closed losses'],
    ['Today', money(todayPnl), CircleDollarSign, todayPnl >= 0 ? 'green' : 'red', `${todayTrades.length} trades this session`],
  ];
  return <div className="page-stack">
    <section className="command-banner"><div><div className="live-badge"><span /> Session controls active</div><h2>Trade the process.<br /><em>Let results follow.</em></h2><p>Your workspace connects preparation, execution and review in one disciplined loop.</p></div><div className="command-side"><div><span>ACTIVE PLAYBOOK</span><b>{activePlan?.name || 'None selected'}</b><small>{activePlan ? activePlan.market : 'Create a playbook before your next session'}</small></div><button onClick={() => go(activePlan ? 'premarket' : 'plans')}>{activePlan ? 'Start pre-market' : 'Create playbook'} <ArrowUpRight size={15} /></button></div></section>
    <div className="stats-grid">{cards.map(([label, value, Icon, tone, help]) => <article className="stat-card" key={label}><div><span>{label}</span><i className={tone}><Icon size={17} /></i></div><strong className={label.includes('P&L') || label === 'Today' ? (value.includes('−') ? 'negative' : 'positive') : ''}>{value}</strong><small>{help}</small></article>)}</div>
    <div className="dashboard-grid"><EquityPanel trades={data.trades} start={data.settings.startingBalance} theme={theme} /><GuardrailPanel data={data} todayTrades={todayTrades} todayPnl={todayPnl} go={go} /></div>
    <RecentTrades trades={data.trades.slice(0, 5)} go={go} />
  </div>;
}

function EquityPanel({ trades, start, theme }) {
  const sorted = [...trades].filter(trade => Number.isFinite(new Date(trade.date).getTime())).sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = start;
  const firstTradeTime = sorted.length ? new Date(sorted[0].date).getTime() : Date.now();
  const points = [[firstTradeTime - 3600000, start], ...sorted.map(trade => [new Date(trade.date).getTime(), running += Number(trade.pnl) || 0])];
  const chartLine = theme === 'dark' ? '#292d38' : '#f0f1f5';
  const option = { animation: false, grid: { left: 12, right: 12, top: 24, bottom: 12, containLabel: true }, tooltip: { trigger: 'axis', triggerOn: 'mousemove|click', alwaysShowContent: true, hideDelay: 60000, enterable: true, confine: true, valueFormatter: v => plainMoney(v) }, xAxis: { type: 'time', axisLabel: { color: '#8e91a0', fontSize: 13 }, axisLine: { lineStyle: { color: chartLine } }, splitLine: { show: false } }, yAxis: { type: 'value', scale: true, position: 'right', axisLabel: { color: '#8e91a0', formatter: v => `$${(v / 1000).toFixed(1)}k` }, splitLine: { lineStyle: { color: chartLine } } }, series: [{ type: 'line', data: trades.length ? points : [], showSymbol: false, smooth: .3, lineStyle: { color: '#1677ff', width: 3 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#1677ff3d' }, { offset: 1, color: '#1677ff00' }] } } }] };
  return <section className="surface equity-surface"><SectionTitle eyebrow="ACCOUNT GROWTH" title="Equity curve" action="All time" />{trades.length ? <ReactECharts option={option} style={{ height: 280 }} /> : <EmptyState icon={TrendingUp} title="Your equity curve starts here" text="Log your first completed trade to begin tracking account growth." />}</section>;
}

function GuardrailPanel({ data, todayTrades, todayPnl, go }) {
  const today = localDateKey(new Date());
  const acknowledgedCheckIn = (data.sessions || []).find(session => (session.status === 'acknowledged' || session.acknowledgedAt) && localDateKey(session.acknowledgedAt || session.completedAt) === today);
  const preparationComplete = Boolean(acknowledgedCheckIn || data.routine.complete);
  const items = [
    ['Daily loss', `${plainMoney(Math.max(0, data.settings.maxDailyLoss + Math.min(0, todayPnl)))} remaining`, todayPnl <= -data.settings.maxDailyLoss],
    ['Trade limit', `${todayTrades.length} of ${data.settings.maxTrades} used`, todayTrades.length >= data.settings.maxTrades],
    ['Session check-in', acknowledgedCheckIn ? 'Elefin check-in acknowledged' : preparationComplete ? 'Legacy routine completed' : 'Check-in required', !preparationComplete],
    ['Active plan', data.plans.some(p => p.active) ? data.plans.find(p => p.active).name : 'No playbook selected', !data.plans.some(p => p.active)],
  ];
  return <section className="surface guard-surface"><SectionTitle eyebrow="LIVE CONTROLS" title="Guardrails" action="Configure" onAction={() => go('settings')} /><div className="guard-list">{items.map(([name, detail, warning]) => <div key={name}><span className={warning ? 'warn' : ''}>{warning ? '!' : <Check size={13} />}</span><div><b>{name}</b><small>{detail}</small></div><em className={warning ? 'warn' : ''}>{warning ? 'Action needed' : 'Active'}</em></div>)}</div></section>;
}

function RecentTrades({ trades, go }) {
  return <section className="surface recent"><SectionTitle eyebrow="RECENT ACTIVITY" title="Execution log" action="Open journal" onAction={() => go('journal')} />{trades.length ? <TradeTable trades={trades} /> : <EmptyState icon={BookOpen} title="No journal entries yet" text="Record a trade manually or close a position from the terminal." />}</section>;
}

function Terminal({ symbol, setSymbol, timeframe, setTimeframe, market, theme }) {
  return <div className="terminal-page terminal-chart-only">
    <section className="market-workspace surface">
      <div className="instrument-bar"><div className="instrument-tabs">{Object.entries(INSTRUMENTS).map(([key, meta]) => <button key={key} className={symbol === key ? 'active' : ''} onClick={() => setSymbol(key)}><i className={meta.accent}>{meta.icon}</i><span><b>{meta.label}</b><small>{meta.name}</small></span></button>)}</div><FeedStatus market={market} /></div>
      <MarketChart symbol={symbol} timeframe={timeframe} setTimeframe={setTimeframe} market={market} theme={theme} />
    </section>
  </div>;
}

function MarketChart({ symbol, timeframe, setTimeframe, market, theme }) {
  const chartRef = useRef(null);
  const stageRef = useRef(null);
  const [chartType, setChartType] = useState('candles');
  const [indicator, setIndicator] = useState(false);
  const [focusCandle, setFocusCandle] = useState(null);
  useEffect(() => setFocusCandle(null), [symbol, timeframe]);
  const activeCandle = focusCandle || market.data.at(-1);
  const option = useMemo(() => {
    const gridLine = theme === 'dark' ? '#292d38' : '#eff0f4';
    const axisLine = theme === 'dark' ? '#343844' : '#e7e8ed';
    const labels = market.data.map(c => new Date(c.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }));
    const start = market.data.length > 80 ? 100 - (80 / market.data.length * 100) : 0;
    const close = market.data.map(c => c.close);
    const dataLow = market.data.length ? Math.min(...market.data.map(c => c.low)) : 0;
    const dataHigh = market.data.length ? Math.max(...market.data.map(c => c.high)) : 1;
    const pricePadding = Math.max((dataHigh - dataLow) * .08, (market.price || 1) * .0015);
    const sma = close.map((_, index) => index < 19 ? null : close.slice(index - 19, index + 1).reduce((sum, value) => sum + value, 0) / 20);
    const up = '#16c784', down = '#ff5967';
    const mainSeries = chartType === 'candles' ? { name: symbol, type: 'candlestick', data: market.data.map(c => [c.open, c.close, c.low, c.high]), itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down } } : { name: symbol, type: 'line', data: close, showSymbol: false, lineStyle: { color: '#2f86ff', width: 2 }, areaStyle: { color: '#2f86ff12' } };
    mainSeries.markLine = market.price ? { symbol: 'none', silent: true, lineStyle: { color: '#2f86ff', type: 'dashed', width: 1 }, label: { show: true, position: 'end', formatter: formatQuote(market.price), color: '#fff', backgroundColor: '#0969ff', padding: [5, 8], borderRadius: 2 }, data: [{ yAxis: market.price }] } : undefined;
    return { animation: false, backgroundColor: 'transparent', axisPointer: { link: [{ xAxisIndex: [0, 1] }], lineStyle: { color: '#8d9098', type: 'dashed' }, label: { backgroundColor: '#4a4e57' } }, tooltip: { trigger: 'axis', triggerOn: 'mousemove|click', alwaysShowContent: true, hideDelay: 60000, enterable: true, confine: true, axisPointer: { type: 'cross' }, showContent: true, backgroundColor: theme === 'dark' ? '#07101d' : '#fff', borderColor: theme === 'dark' ? '#1d3857' : '#dce5f2', textStyle: { color: theme === 'dark' ? '#f7faff' : '#070b14', fontSize: 13 } }, grid: [{ left: 12, right: 72, top: 20, height: '66%', containLabel: true }, { left: 12, right: 72, top: '76%', height: '14%', containLabel: true }], xAxis: [{ type: 'category', data: labels, boundaryGap: true, axisLine: { lineStyle: { color: axisLine } }, axisLabel: { show: false }, splitLine: { show: true, lineStyle: { color: gridLine } }, min: 'dataMin', max: 'dataMax' }, { type: 'category', gridIndex: 1, data: labels, boundaryGap: true, axisLine: { lineStyle: { color: axisLine } }, axisLabel: { color: '#8d9098', fontSize: 13, hideOverlap: true }, splitLine: { show: true, lineStyle: { color: gridLine } }, min: 'dataMin', max: 'dataMax' }], yAxis: [{ type: 'value', scale: true, min: dataLow - pricePadding, max: dataHigh + pricePadding, position: 'right', axisLabel: { color: '#8d9098', fontSize: 13, formatter: value => value.toFixed(symbol === 'XAUUSD' ? 2 : 0) }, axisLine: { show: true, lineStyle: { color: axisLine } }, splitLine: { lineStyle: { color: gridLine } } }, { type: 'value', gridIndex: 1, scale: true, show: false, splitLine: { show: false } }], dataZoom: [{ type: 'inside', xAxisIndex: [0, 1], start, end: 100, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true }], series: [mainSeries, ...(indicator ? [{ name: 'SMA 20', type: 'line', data: sma, showSymbol: false, smooth: true, lineStyle: { width: 1.5, color: '#d6a847' }, connectNulls: true }] : []), { name: market.volumeLabel, type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: market.data.map(c => ({ value: c.volume, itemStyle: { color: c.close >= c.open ? '#16c78444' : '#ff596744' } })), barWidth: '62%' }] };
  }, [market, symbol, theme, chartType, indicator]);
  const changeView = (mode) => { const chart = chartRef.current?.getEchartsInstance(), zoom = chart?.getOption()?.dataZoom?.[0]; if (!chart || !zoom) return; let start = Number(zoom.start), end = Number(zoom.end), span = end - start; if (mode === 'in') span = Math.max(8, span * .72); if (mode === 'out') span = Math.min(100, span * 1.35); const center = (start + end) / 2; if (mode === 'left') { start -= span * .2; end -= span * .2; } else if (mode === 'right') { start += span * .2; end += span * .2; } else { start = center - span / 2; end = center + span / 2; } if (start < 0) { end -= start; start = 0; } if (end > 100) { start -= end - 100; end = 100; } chart.dispatchAction({ type: 'dataZoom', start: Math.max(0, start), end: Math.min(100, end) }); };
  const reset = () => chartRef.current?.getEchartsInstance().dispatchAction({ type: 'dataZoom', start: market.data.length > 80 ? 100 - (80 / market.data.length * 100) : 0, end: 100 });
  const saveChart = () => { const url = chartRef.current?.getEchartsInstance().getDataURL({ pixelRatio: 2, backgroundColor: theme === 'dark' ? '#111318' : '#fff' }); if (!url) return; const link = document.createElement('a'); link.href = url; link.download = `${symbol}-${timeframe}.png`; link.click(); };
  const chartEvents = { mouseover: params => Number.isInteger(params.dataIndex) && setFocusCandle(market.data[params.dataIndex]), globalout: () => setFocusCandle(null) };
  return <div className="pro-chart" ref={stageRef}><div className="chart-commandbar"><div className="timeframes">{['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map(frame => <button className={timeframe === frame ? 'active' : ''} key={frame} onClick={() => setTimeframe(frame)}>{frame}</button>)}</div><div className="chart-actions"><button className={indicator ? 'active' : ''} onClick={() => setIndicator(!indicator)}><Activity size={16} /> Indicators</button><div className="chart-type"><button className={chartType === 'candles' ? 'active' : ''} onClick={() => setChartType('candles')}><BarChart3 size={16} /></button><button className={chartType === 'line' ? 'active' : ''} onClick={() => setChartType('line')}><LineChart size={16} /></button></div><button onClick={() => stageRef.current?.requestFullscreen?.()} title="Full screen"><Maximize2 size={16} /></button><button onClick={saveChart} title="Save chart"><Camera size={16} /></button></div></div><div className="ohlc-readout">{activeCandle ? <><span>O <b>{formatQuote(activeCandle.open)}</b></span><span>H <b>{formatQuote(activeCandle.high)}</b></span><span>L <b>{formatQuote(activeCandle.low)}</b></span><span>C <b>{formatQuote(activeCandle.close)}</b></span><strong className={activeCandle.close >= activeCandle.open ? 'positive' : 'negative'}>{activeCandle.open ? `${((activeCandle.close - activeCandle.open) / activeCandle.open * 100).toFixed(2)}%` : '—'}</strong><small>{market.volumeLabel}</small></> : <span>Waiting for a verified candle…</span>}</div><div className="chart-canvas">{market.data.length ? <ReactECharts ref={chartRef} option={option} notMerge onEvents={chartEvents} style={{ height: '100%' }} /> : <div className="chart-empty"><Activity size={28} /><b>{market.status === 'error' ? 'Market feed unavailable' : 'Building the first real candle'}</b><span>{market.error || 'The chart will appear after a verified market observation.'}</span></div>}<div className="chart-navigator"><button onClick={() => changeView('left')}><ChevronLeft size={17} /></button><button onClick={() => changeView('out')}><ZoomOut size={17} /></button><button onClick={reset}><RotateCcw size={17} /></button><button onClick={() => changeView('in')}><ZoomIn size={17} /></button><button onClick={() => changeView('right')}><ChevronRight size={17} /></button></div></div></div>;
}

function FeedStatus({ market }) { return <div className={`feed-status ${market.status}`}><i />{market.status === 'live' ? `Live · ${market.source}` : market.status === 'delayed' ? `Delayed · ${market.source}` : market.status === 'error' ? 'Feed unavailable' : 'Connecting'}</div>; }

function Journal({ trades, sessions, onAdd, onReview, onDelete }) {
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const filtered = trades.filter(t => `${t.symbol} ${t.setup} ${t.emotion}`.toLowerCase().includes(query.toLowerCase()));
  const addFromDay = date => { setSelectedDate(null); onAdd(date); };
  return <div className="page-stack"><div className="page-intro"><div><p>PRIVATE JOURNAL</p><h2>Every trade tells you something.</h2><span>Capture execution, emotion and lessons while context is fresh.</span></div></div><div className="journal-grid"><JournalCalendar trades={trades} sessions={sessions} month={month} setMonth={setMonth} onSelect={setSelectedDate} /><JournalInsight trades={trades} /></div><section className="surface journal-list"><div className="section-toolbar"><SectionTitle eyebrow="TRADE HISTORY" title={`${trades.length} journal entries`} /><div className="search-box"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search trades" /></div></div>{filtered.length ? <div className="table-scroll"><table><thead><tr><th>Instrument</th><th>Date</th><th>Setup</th><th>Side</th><th>Grade</th><th>Net result</th><th></th></tr></thead><tbody>{filtered.map(t => <tr key={t.id}><td><Instrument symbol={t.symbol} /></td><td>{new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</td><td>{t.setup || '—'}</td><td className={t.side === 'buy' ? 'positive' : 'negative'}>{t.side === 'buy' ? 'Long' : 'Short'}</td><td><span className="grade">{t.grade || '—'}</span></td><td className={t.pnl >= 0 ? 'positive' : 'negative'}><b>{money(t.pnl)}</b></td><td className="row-actions"><button onClick={() => onReview(t)}>Review</button><button className="icon-danger" onClick={() => onDelete(t.id)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div> : <EmptyState icon={BookOpen} title="No matching journal entries" text={trades.length ? 'Change your search to see more trades.' : 'Your journal is empty. Click a calendar date to add your first real trade.'} />}</section>{selectedDate && <JournalDayPanel date={selectedDate} trades={trades} sessions={sessions} onClose={() => setSelectedDate(null)} onAdd={addFromDay} />}</div>;
}

function JournalCalendar({ trades, sessions, month, setMonth, onSelect }) {
  const year = month.getFullYear(), m = month.getMonth(), first = (new Date(year, m, 1).getDay() + 6) % 7, count = new Date(year, m + 1, 0).getDate();
  const byDay = {}; trades.forEach(t => { const d = new Date(t.date); if (d.getFullYear() === year && d.getMonth() === m) { const day = d.getDate(); byDay[day] ||= { pnl: 0, count: 0 }; byDay[day].pnl += t.pnl; byDay[day].count++; } });
  const sessionsByDay = {}; sessions.forEach(session => { const d = new Date(session.acknowledgedAt || session.completedAt); if (d.getFullYear() === year && d.getMonth() === m) sessionsByDay[d.getDate()] = (sessionsByDay[d.getDate()] || 0) + 1; });
  return <section className="surface calendar-card"><div className="calendar-head"><div><p>MONTHLY PERFORMANCE</p><h2>{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h2><small>Click any date to open its complete trading memory</small></div><div><button onClick={() => setMonth(new Date(year, m - 1, 1))} aria-label="Previous month">←</button><button onClick={() => setMonth(new Date(year, m + 1, 1))} aria-label="Next month">→</button></div></div><div className="week-labels">{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar-days">{Array.from({ length: first + count }, (_, i) => { const day = i - first + 1, result = byDay[day], sessionCount = sessionsByDay[day] || 0, today = new Date(), isCurrentDay = today.getFullYear() === year && today.getMonth() === m && today.getDate() === day; return day < 1 ? <div className="calendar-blank" key={i} /> : <button type="button" key={i} className={`calendar-day ${result ? (result.pnl >= 0 ? 'win-day' : 'loss-day') : ''} ${sessionCount ? 'has-session' : ''} ${isCurrentDay ? 'today-date' : ''}`} onClick={() => onSelect(new Date(year, m, day, 12))} aria-label={`Open trading memory for ${month.toLocaleString('en-US', { month: 'long' })} ${day}, ${year}`}><span>{day}</span>{isCurrentDay && <u className="today-marker">TODAY</u>}<i><ChevronRight size={13} /></i>{sessionCount > 0 && <mark><ShieldCheck size={10} />{sessionCount}</mark>}{result ? <><b>{money(result.pnl)}</b><small>{result.count} trade{result.count !== 1 && 's'}</small></> : <em>View day</em>}</button>; })}</div></section>;
}

function JournalDayPanel({ date, trades, sessions, onClose, onAdd }) {
  const key = localDateKey(date);
  const dayTrades = trades.filter(trade => localDateKey(trade.date) === key).sort((a, b) => b.date.localeCompare(a.date));
  const daySessions = sessions.filter(session => localDateKey(session.acknowledgedAt || session.completedAt) === key).sort((a, b) => (b.acknowledgedAt || b.completedAt).localeCompare(a.acknowledgedAt || a.completedAt));
  const pnl = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const wins = dayTrades.filter(trade => trade.pnl > 0).length;
  const addTrade = () => { const now = new Date(); onAdd(new Date(date.getFullYear(), date.getMonth(), date.getDate(), now.getHours(), now.getMinutes())); };
  useEffect(() => { const close = event => event.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);
  return <div className="day-panel-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside className="journal-day-panel" role="dialog" aria-modal="true" aria-label={`Trading memory for ${date.toLocaleDateString()}`}><header><div><p>TRADING MEMORY</p><h2>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2><span>{date.getFullYear()}</span></div><button onClick={onClose} aria-label="Close day details"><X size={18} /></button></header><div className="day-summary"><article><span>NET P&amp;L</span><b className={pnl >= 0 ? 'positive' : 'negative'}>{dayTrades.length ? money(pnl) : '—'}</b></article><article><span>TRADES</span><b>{dayTrades.length}</b></article><article><span>WIN RATE</span><b>{dayTrades.length ? `${(wins / dayTrades.length * 100).toFixed(0)}%` : '—'}</b></article><article><span>CHECK-INS</span><b>{daySessions.length}</b></article></div><div className="day-panel-scroll"><section className="day-memory-section"><div className="day-section-title"><div><p>PRE-CHECK MEMORY</p><h3>Trading sessions</h3></div><span>{daySessions.length}</span></div>{daySessions.length ? daySessions.map(session => <article className="saved-session-card" key={session.id}><div className="saved-session-head"><div><span className="status-dot" /> <b>Acknowledged session</b><small>{new Date(session.acknowledgedAt || session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div><mark>{session.emotion}</mark></div><div className="saved-checks">{session.answers.map((answer, index) => <div key={`${session.id}-${index}`}><span className={answer.result}><i>{answer.result === 'green' ? <Check size={11} /> : <X size={11} />}</i><b>Q{index + 1}</b></span><div><strong>{answer.question}</strong><small>{answer.note || 'No context note added.'}</small></div></div>)}</div></article>) : <div className="day-empty"><ClipboardCheck size={19} /><div><b>No acknowledged pre-check</b><span>Complete and acknowledge an Elefin check-in to attach it here.</span></div></div>}</section><section className="day-memory-section"><div className="day-section-title"><div><p>EXECUTION RESULTS</p><h3>Journal trades</h3></div><span>{dayTrades.length}</span></div>{dayTrades.length ? <div className="day-trade-list">{dayTrades.map(trade => <article key={trade.id}><Instrument symbol={trade.symbol} /><div><b>{trade.setup || 'Unlabelled setup'}</b><small>{trade.side === 'buy' ? 'Long' : 'Short'} · {trade.emotion || 'No emotion'} · Grade {trade.grade || '—'}</small></div><strong className={trade.pnl >= 0 ? 'positive' : 'negative'}>{money(trade.pnl)}</strong></article>)}</div> : <div className="day-empty"><BookOpen size={19} /><div><b>No trades logged</b><span>Add a real journal trade for this date to update the summary and analytics.</span></div></div>}</section></div><footer><button type="button" className="secondary-button" onClick={onClose}>Close</button><button type="button" className="primary-button" onClick={addTrade}><Plus size={15} /> Add trade for this date</button></footer></aside></div>;
}

function JournalInsight({ trades }) {
  const followed = trades.filter(t => t.plan), adherence = trades.length ? followed.length / trades.length * 100 : null;
  const setups = trades.reduce((map, t) => { map[t.setup || 'Unlabelled'] = (map[t.setup || 'Unlabelled'] || 0) + t.pnl; return map; }, {});
  const best = Object.entries(setups).sort((a, b) => b[1] - a[1])[0];
  return <section className="surface insight-card"><div className="insight-icon"><Sparkles size={19} /></div><p>WEEKLY INTELLIGENCE</p><h2>{trades.length ? (adherence >= 80 ? 'Your process is holding.' : 'Protect the process.') : 'Insights begin with data.'}</h2><span>{trades.length ? 'Your review updates automatically as the journal grows. Use it to separate execution quality from outcome.' : 'Log completed trades to reveal patterns across setups, discipline and results.'}</span><div className="insight-metrics"><div><small>PLAN ADHERENCE</small><b>{adherence === null ? '—' : `${adherence.toFixed(0)}%`}</b></div><div><small>BEST SETUP</small><b>{best?.[0] || '—'}</b></div></div></section>;
}

function Analytics({ trades, sessions, theme }) {
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0), grossWin = wins.reduce((s, t) => s + t.pnl, 0), grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const expectancy = trades.length ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : null;
  let equity = 0, peak = 0, maxDrawdown = 0; [...trades].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => { equity += t.pnl; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity); });
  const metrics = [['Net P&L', money(equity)], ['Profit factor', grossLoss ? (grossWin / grossLoss).toFixed(2) : '—'], ['Expectancy', expectancy === null ? '—' : money(expectancy)], ['Avg. winner', wins.length ? money(grossWin / wins.length) : '—'], ['Max drawdown', trades.length ? `−${plainMoney(maxDrawdown)}` : '—']];
  const bySetup = trades.reduce((map, t) => { const key = t.setup || 'Unlabelled'; map[key] ||= { value: 0, count: 0 }; map[key].value += t.pnl; map[key].count++; return map; }, {});
  const byEmotion = trades.reduce((map, t) => { const key = t.emotion || 'Unlabelled'; map[key] ||= { value: 0, count: 0 }; map[key].value += t.pnl; map[key].count++; return map; }, {});
  return <div className="page-stack"><div className="page-intro"><div><p>PERFORMANCE INTELLIGENCE</p><h2>Know exactly where your edge lives.</h2><span>Journal trades and acknowledged pre-checks update these insights automatically.</span></div></div><div className="analytics-metrics">{metrics.map(([label, value]) => <article className="surface" key={label}><span>{label}</span><b>{value}</b></article>)}</div><PerformanceCharts trades={trades} theme={theme} /><SessionAnalytics sessions={sessions} trades={trades} theme={theme} /><div className="analytics-grid"><Breakdown title="Performance by setup" eyebrow="PLAYBOOK" data={bySetup} theme={theme} /><Breakdown title="Performance by emotion" eyebrow="PSYCHOLOGY" data={byEmotion} theme={theme} /><PlanImpact trades={trades} /><DayPerformance trades={trades} /></div></div>;
}

function PerformanceCharts({ trades, theme }) {
  const ordered = [...trades].filter(trade => Number.isFinite(new Date(trade.date).getTime())).sort((a, b) => new Date(a.date) - new Date(b.date));
  let cumulative = 0;
  const equity = ordered.map(trade => ({ date: new Date(trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: cumulative += Number(trade.pnl) || 0 }));
  const outcomes = [
    { name: 'Wins', value: ordered.filter(trade => trade.pnl > 0).length, itemStyle: { color: '#20c997' } },
    { name: 'Losses', value: ordered.filter(trade => trade.pnl < 0).length, itemStyle: { color: '#ef6673' } },
    { name: 'Breakeven', value: ordered.filter(trade => Number(trade.pnl) === 0).length, itemStyle: { color: '#607086' } },
  ].filter(item => item.value);
  const daily = ordered.reduce((map, trade) => {
    const key = localDateKey(trade.date);
    map[key] ||= { pnl: 0, trades: 0 };
    map[key].pnl += Number(trade.pnl) || 0;
    map[key].trades++;
    return map;
  }, {});
  const activity = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  const ink = theme === 'dark' ? '#dce7f5' : '#263448';
  const muted = theme === 'dark' ? '#748096' : '#8b95a6';
  const gridLine = theme === 'dark' ? '#17273b' : '#e7edf5';
  const tooltip = { triggerOn: 'mousemove|click', alwaysShowContent: true, hideDelay: 60000, enterable: true, confine: true, backgroundColor: theme === 'dark' ? '#07101d' : '#fff', borderColor: theme === 'dark' ? '#1d3857' : '#dce5f2', textStyle: { color: ink, fontSize: 13 } };
  const equityOption = { animation: false, tooltip: { ...tooltip, trigger: 'axis', valueFormatter: value => money(value) }, grid: { left: 16, right: 16, top: 24, bottom: 28, containLabel: true }, xAxis: { type: 'category', boundaryGap: false, data: equity.map(point => point.date), axisLabel: { color: muted, fontSize: 12, hideOverlap: true }, axisLine: { lineStyle: { color: gridLine } } }, yAxis: { type: 'value', scale: true, axisLabel: { color: muted, fontSize: 12, formatter: value => `$${value}` }, splitLine: { lineStyle: { color: gridLine } } }, series: [{ name: 'Net P&L', type: 'line', data: equity.map(point => point.value), showSymbol: equity.length < 15, symbolSize: 7, smooth: .22, lineStyle: { color: '#2f86ff', width: 3 }, itemStyle: { color: '#2f86ff' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#2f86ff55' }, { offset: 1, color: '#2f86ff00' }] } }, markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: muted, opacity: .4 }, data: [{ yAxis: 0 }] } }] };
  const outcomeOption = { animation: false, tooltip: { ...tooltip, trigger: 'item', formatter: '{b}: {c} ({d}%)' }, legend: { bottom: 0, textStyle: { color: muted, fontSize: 12 } }, series: [{ type: 'pie', radius: ['55%', '76%'], center: ['50%', '44%'], avoidLabelOverlap: true, label: { color: ink, fontSize: 13, formatter: '{c}' }, labelLine: { lineStyle: { color: muted } }, data: outcomes }] };
  const activityOption = { animation: false, tooltip: { ...tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => { const index = params[0]?.dataIndex || 0, [date, value] = activity[index] || []; return `${date || ''}<br/>${value?.trades || 0} trade${value?.trades === 1 ? '' : 's'} · ${money(value?.pnl || 0)}`; } }, grid: { left: 12, right: 12, top: 22, bottom: 30, containLabel: true }, xAxis: { type: 'category', data: activity.map(([date]) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })), axisLabel: { color: muted, fontSize: 12, hideOverlap: true }, axisLine: { lineStyle: { color: gridLine } }, axisTick: { show: false } }, yAxis: { type: 'value', scale: true, axisLabel: { color: muted, fontSize: 12 }, splitLine: { lineStyle: { color: gridLine } } }, series: [{ type: 'bar', barMaxWidth: 28, data: activity.map(([, value]) => ({ value: value.pnl, itemStyle: { color: value.pnl >= 0 ? '#20c997' : '#ef6673', borderRadius: value.pnl >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })) }] };
  return <section className="analytics-chart-suite"><article className="surface analytics-chart-card equity-analytics-chart"><SectionTitle eyebrow="GROWTH" title="Cumulative net P&L" />{ordered.length ? <ReactECharts option={equityOption} notMerge style={{ height: 290 }} /> : <EmptyState small icon={TrendingUp} title="No equity data yet" text="Completed journal trades populate this chart." />}</article><article className="surface analytics-chart-card"><SectionTitle eyebrow="OUTCOMES" title="Win / loss distribution" />{outcomes.length ? <ReactECharts option={outcomeOption} notMerge style={{ height: 290 }} /> : <EmptyState small icon={Gauge} title="No outcomes yet" text="Record completed trades to see the distribution." />}</article><article className="surface analytics-chart-card activity-analytics-chart"><SectionTitle eyebrow="TRADING ACTIVITY" title="Daily result rhythm" />{activity.length ? <ReactECharts option={activityOption} notMerge style={{ height: 270 }} /> : <EmptyState small icon={BarChart3} title="No daily activity yet" text="Results appear here by journal date." />}</article></section>;
}

function SessionAnalytics({ sessions, trades, theme }) {
  const decisionProfile = ELEFIN_CHECKS.map((question, index) => ({
    question,
    green: sessions.filter(session => session.answers?.[index]?.result === 'green').length,
    red: sessions.filter(session => session.answers?.[index]?.result === 'red').length,
  }));
  const totalDecisions = decisionProfile.reduce((sum, item) => sum + item.green + item.red, 0);
  const greenRate = totalDecisions ? decisionProfile.reduce((sum, item) => sum + item.green, 0) / totalDecisions * 100 : null;
  const emotionProfile = sessions.reduce((map, session) => {
    const key = session.emotion || 'Unlabelled';
    map[key] ||= { count: 0, pnl: 0, tradeCount: 0 };
    map[key].count++;
    const date = localDateKey(session.acknowledgedAt || session.completedAt);
    const matched = trades.filter(trade => localDateKey(trade.date) === date);
    map[key].pnl += matched.reduce((sum, trade) => sum + trade.pnl, 0);
    map[key].tradeCount += matched.length;
    return map;
  }, {});
  const topEmotion = Object.entries(emotionProfile).sort((a, b) => b[1].count - a[1].count)[0];
  const checkedDates = new Set(sessions.map(session => localDateKey(session.acknowledgedAt || session.completedAt)));
  const checkedTrades = trades.filter(trade => checkedDates.has(localDateKey(trade.date)));
  const checkedPnl = checkedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const option = {
    animation: false,
    color: ['#20c997', '#ef6673'],
    tooltip: { trigger: 'axis', triggerOn: 'mousemove|click', alwaysShowContent: true, hideDelay: 60000, enterable: true, confine: true, axisPointer: { type: 'shadow' }, backgroundColor: theme === 'dark' ? '#07101d' : '#fff', borderColor: theme === 'dark' ? '#1d3857' : '#dce5f2', textStyle: { color: theme === 'dark' ? '#f7faff' : '#070b14', fontSize: 13 } },
    legend: { top: 2, right: 4, textStyle: { color: theme === 'dark' ? '#93a1b5' : '#647084', fontSize: 12 } },
    grid: { left: 30, right: 12, top: 44, bottom: 32 },
    xAxis: { type: 'category', data: decisionProfile.map((_, index) => `Q${index + 1}`), axisTick: { show: false }, axisLine: { lineStyle: { color: theme === 'dark' ? '#20344e' : '#dce5f2' } }, axisLabel: { color: theme === 'dark' ? '#93a1b5' : '#647084', fontSize: 12 } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: theme === 'dark' ? '#748096' : '#8b95a6', fontSize: 12 }, splitLine: { lineStyle: { color: theme === 'dark' ? '#17273b' : '#e7edf5' } } },
    series: [{ name: 'Green', type: 'bar', data: decisionProfile.map(item => item.green), barMaxWidth: 24, itemStyle: { borderRadius: [5, 5, 0, 0] } }, { name: 'Red', type: 'bar', data: decisionProfile.map(item => item.red), barMaxWidth: 24, itemStyle: { borderRadius: [5, 5, 0, 0] } }],
  };
  return <section className="surface session-analytics"><div className="session-analytics-head"><SectionTitle eyebrow="PRE-CHECK INTELLIGENCE" title="Decision quality and session outcomes" /><span>{sessions.length} acknowledged session{sessions.length === 1 ? '' : 's'}</span></div>{sessions.length ? <><div className="session-kpis"><article><span>GREEN DECISIONS</span><b>{greenRate === null ? '—' : `${greenRate.toFixed(0)}%`}</b><small>Across all saved checks</small></article><article><span>PRIMARY EMOTION</span><b>{topEmotion?.[0] || '—'}</b><small>{topEmotion ? `${topEmotion[1].count} session${topEmotion[1].count === 1 ? '' : 's'}` : 'No emotion data'}</small></article><article><span>CHECKED-IN TRADES</span><b>{checkedTrades.length}</b><small>Matched by calendar date</small></article><article><span>CHECKED-IN P&amp;L</span><b className={checkedPnl >= 0 ? 'positive' : 'negative'}>{checkedTrades.length ? money(checkedPnl) : '—'}</b><small>Updates with future trades</small></article></div><div className="session-chart-grid"><div className="check-chart"><ReactECharts option={option} notMerge style={{ height: 280 }} /><div className="question-key">{decisionProfile.map((item, index) => <span key={item.question}><b>Q{index + 1}</b>{item.question}</span>)}</div></div><div className="emotion-outcomes"><p>EMOTION → RESULT</p><h3>Same-day performance</h3>{Object.entries(emotionProfile).sort((a, b) => b[1].count - a[1].count).map(([emotion, result]) => <div key={emotion}><span><b>{emotion}</b><small>{result.count} check-in{result.count === 1 ? '' : 's'} · {result.tradeCount} trades</small></span><strong className={result.pnl >= 0 ? 'positive' : 'negative'}>{result.tradeCount ? money(result.pnl) : 'Awaiting trades'}</strong></div>)}</div></div></> : <EmptyState icon={ClipboardCheck} title="No acknowledged check-ins yet" text="Complete the Elefin pre-check and acknowledge the trading session to begin decision analytics." />}</section>;
}

function Breakdown({ title, eyebrow, data, theme }) {
  const items = Object.entries(data).sort((a, b) => a[1].value - b[1].value);
  const ink = theme === 'dark' ? '#dce7f5' : '#263448', muted = theme === 'dark' ? '#8b9ab0' : '#748096', gridLine = theme === 'dark' ? '#17273b' : '#e7edf5';
  const option = { animation: false, tooltip: { trigger: 'axis', triggerOn: 'mousemove|click', alwaysShowContent: true, hideDelay: 60000, enterable: true, confine: true, axisPointer: { type: 'shadow' }, backgroundColor: theme === 'dark' ? '#07101d' : '#fff', borderColor: theme === 'dark' ? '#1d3857' : '#dce5f2', textStyle: { color: ink, fontSize: 13 }, formatter: params => { const item = items[params[0]?.dataIndex || 0]; return item ? `<b>${item[0]}</b><br/>${item[1].count} trade${item[1].count === 1 ? '' : 's'} · ${money(item[1].value)}` : ''; } }, grid: { left: 12, right: 36, top: 18, bottom: 20, containLabel: true }, xAxis: { type: 'value', axisLabel: { color: muted, fontSize: 12, formatter: value => `$${value}` }, axisLine: { lineStyle: { color: gridLine } }, splitLine: { lineStyle: { color: gridLine } } }, yAxis: { type: 'category', data: items.map(([name]) => name), axisLabel: { color: ink, fontSize: 13, width: 115, overflow: 'truncate' }, axisLine: { show: false }, axisTick: { show: false } }, series: [{ type: 'bar', barMaxWidth: 26, data: items.map(([, result]) => ({ value: result.value, itemStyle: { color: result.value >= 0 ? '#20c997' : '#ef6673', borderRadius: result.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] }, label: { show: true, position: 'inside', color: '#fff', fontSize: 12, formatter: money(result.value) } })), markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: muted, opacity: .45 }, data: [{ xAxis: 0 }] } }] };
  return <section className="surface breakdown-card breakdown-chart-card"><SectionTitle eyebrow={eyebrow} title={title} />{items.length ? <ReactECharts option={option} notMerge style={{ height: Math.max(230, items.length * 48) }} /> : <EmptyState small icon={BarChart3} title="No data yet" text="Journal trades to populate this analysis." />}</section>;
}

function PlanImpact({ trades }) {
  const planned = trades.filter(t => t.plan), offPlan = trades.filter(t => !t.plan), avg = list => list.length ? list.reduce((s, t) => s + t.pnl, 0) / list.length : null;
  return <section className="surface breakdown-card"><SectionTitle eyebrow="DISCIPLINE" title="Plan impact" /><div className="impact-grid"><div><span>Plan followed</span><b className="positive">{avg(planned) === null ? '—' : money(avg(planned))}</b><small>average · {planned.length} trades</small></div><div className="off-plan"><span>Off-plan</span><b className="negative">{avg(offPlan) === null ? '—' : money(avg(offPlan))}</b><small>average · {offPlan.length} trades</small></div></div></section>;
}

function DayPerformance({ trades }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], values = days.map((_, index) => trades.filter(t => (new Date(t.date).getDay() + 6) % 7 === index).reduce((s, t) => s + t.pnl, 0)); const max = Math.max(1, ...values.map(Math.abs));
  return <section className="surface breakdown-card"><SectionTitle eyebrow="TIMING" title="Weekday rhythm" /><div className="day-bars">{days.map((day, i) => <div key={day}><span>{money(values[i])}</span><i className={values[i] < 0 ? 'red' : ''} style={{ height: `${Math.max(4, Math.abs(values[i]) / max * 125)}px` }} /><b>{day}</b></div>)}</div></section>;
}

function EconomicCalendar() {
  const calendar = useEconomicCalendar();
  const [impact, setImpact] = useState('All');
  const [scope, setScope] = useState('week');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const upcoming = calendar.events.filter(event => new Date(event.date).getTime() >= now);
  const visible = calendar.events.filter(event => {
    const matchesImpact = impact === 'All' || event.impact === impact;
    const matchesScope = scope === 'week' || new Date(event.date).getTime() >= now;
    return matchesImpact && matchesScope;
  });
  const grouped = visible.reduce((days, event) => {
    const key = localDateKey(event.date);
    (days[key] ||= []).push(event);
    return days;
  }, {});
  const next = upcoming[0];
  const highImpact = calendar.events.filter(event => event.impact === 'High').length;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <div className="page-stack economic-page">
    <section className="calendar-hero">
      <div className="calendar-hero-copy"><div className="live-badge"><span /> Forex Factory weekly export</div><h2>Macro intelligence,<br /><em>without the noise.</em></h2><p>Verified United States events, translated automatically into your local timezone.</p></div>
      <div className="next-event-panel"><div className="next-label"><Radio size={13} /> {next ? 'NEXT USD EVENT' : 'WEEKLY SESSION COMPLETE'}</div>{next ? <><strong>{next.title}</strong><span>{relativeTime(new Date(next.date), now)}</span><div><ImpactPill impact={next.impact} /><time>{formatEventTime(next.date)}</time></div></> : <><strong>No more events in this export</strong><span>Open the live next-week calendar below.</span></>}</div>
    </section>
    <div className="calendar-stats"><article className="metal-stat"><span>USD EVENTS</span><strong>{calendar.events.length || '—'}</strong><small>This weekly export</small></article><article className="metal-stat"><span>HIGH IMPACT</span><strong>{calendar.events.length ? highImpact : '—'}</strong><small>Volatility watchlist</small></article><article className="metal-stat"><span>NEXT RELEASE</span><strong>{next ? relativeTime(new Date(next.date), now, true) : '—'}</strong><small>{next?.title || 'No upcoming release'}</small></article><article className="metal-stat feed-stat"><span>DATA STATUS</span><strong className={calendar.status}><i />{calendar.status === 'live' ? 'Live' : calendar.status === 'stale' ? 'Cached' : calendar.status === 'error' ? 'Offline' : 'Syncing'}</strong><small>{calendar.updatedAt ? `Updated ${new Date(calendar.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting to source'}</small></article></div>
    <section className="surface events-surface">
      <div className="events-toolbar"><div><p>UNITED STATES · USD</p><h2>Economic events</h2><span>Times displayed in {timeZone.replaceAll('_', ' ')}</span></div><div className="calendar-controls"><div className="segmented"><button className={scope === 'week' ? 'active' : ''} onClick={() => setScope('week')}>Full week</button><button className={scope === 'upcoming' ? 'active' : ''} onClick={() => setScope('upcoming')}>Upcoming</button></div><a className="next-week-feed" href="https://www.forexfactory.com/calendar?week=next" target="_blank" rel="noreferrer">Next week <ExternalLink size={13} /></a><button className="refresh-feed" onClick={calendar.refresh} disabled={calendar.status === 'loading'}><RefreshCw size={14} className={calendar.status === 'loading' ? 'spinning' : ''} /> Refresh</button></div></div>
      <div className="impact-filters">{['All', 'High', 'Medium', 'Low'].map(level => <button key={level} className={impact === level ? 'active' : ''} onClick={() => setImpact(level)}>{level !== 'All' && <i className={level.toLowerCase()} />}{level} {level === 'All' ? 'impact' : ''}</button>)}</div>
      {calendar.error && <div className="calendar-warning"><ShieldCheck size={15} /><div><b>Live refresh unavailable</b><span>{calendar.error}{calendar.events.length ? ' · Showing the last verified feed.' : ''}</span></div></div>}
      {calendar.status === 'loading' && !calendar.events.length ? <div className="calendar-loading"><RefreshCw size={24} className="spinning" /><b>Syncing the economic calendar</b><span>Requesting this week's USD events from Forex Factory.</span></div> : Object.keys(grouped).length ? <div className="event-groups">{Object.entries(grouped).map(([day, events]) => <div className="event-day" key={day}><div className="event-date"><span>{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span><strong>{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong><small>{isToday(day) ? 'TODAY' : ''}</small></div><div className="event-list">{events.map(event => <article className={`event-row ${new Date(event.date).getTime() < now ? 'passed' : ''}`} key={event.id}><div className="event-time"><Clock3 size={14} /><time>{formatEventTime(event.date)}</time></div><ImpactPill impact={event.impact} /><div className="event-name"><b>{event.title}</b><span>USD · United States</span></div><div className="event-value"><span>FORECAST</span><b>{event.forecast || '—'}</b></div><div className="event-value"><span>PREVIOUS</span><b>{event.previous || '—'}</b></div><a href="https://www.forexfactory.com/calendar" target="_blank" rel="noreferrer" aria-label="Open on Forex Factory"><ExternalLink size={15} /></a></article>)}</div></div>)}</div> : <div className="calendar-loading"><Newspaper size={24} /><b>No matching USD events</b><span>{scope === 'upcoming' ? 'There are no more matching events in the current weekly export.' : 'Try another impact filter.'}</span></div>}
      <footer className="calendar-source"><span>Source: Forex Factory current-week JSON export · Next week opens the authoritative live calendar.</span><a href="https://www.forexfactory.com/calendar" target="_blank" rel="noreferrer">Open source calendar <ExternalLink size={13} /></a></footer>
    </section>
  </div>;
}

function ImpactPill({ impact }) { return <span className={`impact-pill ${impact.toLowerCase().replace(/\s/g, '-')}`}><i />{impact}</span>; }
function formatEventTime(date) { return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function localDateKey(value) { const date = new Date(value), pad = number => String(number).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function isToday(day) { return day === localDateKey(new Date()); }
function relativeTime(date, now, compact = false) {
  const minutes = Math.round((date.getTime() - now) / 60000);
  if (minutes < 0) return 'Released';
  if (minutes < 60) return compact ? `${minutes}m` : `In ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60), remaining = minutes % 60;
  if (hours < 24) return compact ? `${hours}h ${remaining}m` : `In ${hours}h ${remaining}m`;
  const days = Math.floor(hours / 24);
  return compact ? `${days}d ${hours % 24}h` : `In ${days} day${days === 1 ? '' : 's'}`;
}

function Premarket({ routine, activePlan, patch, go }) {
  const toggle = index => patch(next => { next.routine.checks[index] = !next.routine.checks[index]; next.routine.complete = false; });
  const update = changes => patch(next => { Object.assign(next.routine, changes); next.routine.complete = false; });
  const ready = routine.checks.every(Boolean) && routine.bias && activePlan;
  const complete = () => ready && patch(next => { next.routine.complete = true; next.routine.completedAt = new Date().toISOString(); });
  return <div className="premarket-layout"><section className="surface routine-card"><div className="routine-header"><div><p>SESSION CHECKLIST</p><h2>Preparation creates permission.</h2><span>Execution unlocks when your process is complete.</span></div><div className={`progress-ring ${routine.complete ? 'done' : ''}`}><b>{routine.checks.filter(Boolean).length}</b><small>/ 5</small></div></div><div className="check-list">{CHECKS.map((label, index) => <button key={label} className={routine.checks[index] ? 'checked' : ''} onClick={() => toggle(index)}><i>{routine.checks[index] && <Check size={15} />}</i><span>{label}</span><em>{routine.checks[index] ? 'Complete' : 'Mark done'}</em></button>)}</div><div className="routine-fields"><Field label="Session bias"><select value={routine.bias} onChange={e => update({ bias: e.target.value })}><option value="">Select a directional bias</option><option>Bullish</option><option>Bearish</option><option>Neutral / wait</option></select></Field><Field label="Key levels and market context"><textarea value={routine.notes} onChange={e => update({ notes: e.target.value })} placeholder="Important levels, scheduled events, invalidation conditions…" /></Field></div><button className="primary-button complete-button" disabled={!ready} onClick={complete}>{routine.complete ? <><Check size={16} /> Routine completed</> : <>Complete pre-market <ArrowUpRight size={16} /></>}</button></section><aside className="premarket-aside"><section className="surface active-plan-card"><p>ACTIVE PLAYBOOK</p>{activePlan ? <><div className="plan-symbol"><Target size={20} /></div><h2>{activePlan.name}</h2><span>{activePlan.market || 'All connected markets'}</span><ul>{activePlan.rules.slice(0, 4).map(rule => <li key={rule}><Check size={13} />{rule}</li>)}</ul></> : <><div className="plan-symbol muted"><Target size={20} /></div><h2>No active playbook</h2><span>Create and select a strategy to complete preparation.</span><button onClick={() => go('plans')}>Create playbook <ArrowUpRight size={14} /></button></>}</section><section className={`session-state ${routine.complete ? 'ready' : ''}`}><ShieldCheck size={20} /><div><b>{routine.complete ? 'Session unlocked' : 'Execution locked'}</b><span>{routine.complete ? 'Your preparation is saved.' : 'Finish the checklist to enable orders.'}</span></div></section></aside></div>;
}

function Plans({ plans, patch, onAdd }) {
  return <div className="page-stack"><div className="page-intro"><div><p>STRATEGY LIBRARY</p><h2>Turn your edge into a repeatable system.</h2><span>Keep entry criteria visible before and during execution.</span></div><button className="primary-button" onClick={onAdd}><Plus size={16} /> New playbook</button></div>{plans.length ? <div className="plan-grid">{plans.map(plan => <article className={`surface plan-card ${plan.active ? 'active' : ''}`} key={plan.id}><div className="plan-top"><span>{plan.active ? '● ACTIVE PLAYBOOK' : 'PLAYBOOK'}</span><Target size={18} /></div><h2>{plan.name}</h2><p>{plan.market || 'All connected markets'}</p><ul>{plan.rules.map(rule => <li key={rule}><Check size={13} />{rule}</li>)}</ul><footer><button onClick={() => patch(next => next.plans.forEach(p => p.active = p.id === plan.id))}>{plan.active ? 'Currently active' : 'Set active'}</button><button className="icon-danger" onClick={() => patch(next => next.plans = next.plans.filter(p => p.id !== plan.id))}><Trash2 size={14} /></button></footer></article>)}</div> : <EmptyState large icon={Target} title="Build your first playbook" text="Define your setup, market and entry criteria. Nothing is pre-filled or fabricated." action="Create playbook" onAction={onAdd} />}</div>;
}

function RiskSettings({ settings, patch, account }) {
  const [form, setForm] = useState(settings), save = e => { e.preventDefault(); patch(next => next.settings = { ...form }); };
  return <div className="settings-layout"><section className="surface settings-copy"><div className="settings-icon"><ShieldCheck size={22} /></div><p>RISK GOVERNANCE · {account.name}</p><h2>Rules that protect you before the click.</h2><span>These controls apply only to {account.name}. Switching accounts loads that account's own limits, journal and analytics.</span><div className="settings-note"><Sparkles size={16} /><div><b>Discipline by design</b><small>Guardrails are most useful when decided before the session.</small></div></div></section><form className="surface settings-form" onSubmit={save}><SectionTitle eyebrow="ACCOUNT LIMITS" title={`${account.name} controls`} /><div className="settings-grid"><Field label="Starting account balance"><NumberField value={form.startingBalance} onChange={value => setForm({ ...form, startingBalance: value })} prefix="$" /></Field><Field label="Maximum daily loss"><NumberField value={form.maxDailyLoss} onChange={value => setForm({ ...form, maxDailyLoss: value })} prefix="$" /></Field><Field label="Maximum trades per day"><NumberField value={form.maxTrades} onChange={value => setForm({ ...form, maxTrades: value })} /></Field><Field label="Default risk per trade"><NumberField value={form.riskPerTrade} onChange={value => setForm({ ...form, riskPerTrade: value })} prefix="$" /></Field></div><button className="primary-button save-settings">Save controls</button></form></div>;
}

function TradeModal({ plans, initialDate, onClose, onSave }) {
  const [form, setForm] = useState({ symbol: 'BTCUSD', side: 'buy', setup: '', entry: '', exit: '', pnl: '', fees: 0, emotion: 'Focused', grade: 'A', note: '', plan: Boolean(plans.find(p => p.active)), date: toLocalDateTimeValue(initialDate || new Date()) });
  const [error, setError] = useState('');
  const submit = e => { e.preventDefault(); if (!form.setup.trim() || form.pnl === '') return setError('Setup and net P&L are required.'); const pnl = Number(form.pnl), fees = Number(form.fees || 0); if (!Number.isFinite(pnl)) return setError('Enter a valid P&L.'); onSave({ ...form, pnl: pnl - fees, fees, entry: form.entry === '' ? null : Number(form.entry), exit: form.exit === '' ? null : Number(form.exit), date: new Date(form.date).toISOString() }); };
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <Modal onClose={onClose} eyebrow="NEW JOURNAL ENTRY" title={initialDate ? `Add trade · ${new Date(initialDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Record a completed trade'}><form onSubmit={submit}><div className="modal-grid"><Field label="Instrument"><select value={form.symbol} onChange={e => field('symbol', e.target.value)}><option value="BTCUSD">BTC / USD</option><option value="XAUUSD">XAU / USD</option><option value="EURUSD">EUR / USD</option><option value="NAS100">NAS100</option></select></Field><Field label="Direction"><select value={form.side} onChange={e => field('side', e.target.value)}><option value="buy">Long / Buy</option><option value="sell">Short / Sell</option></select></Field><Field label="Setup name"><input value={form.setup} onChange={e => field('setup', e.target.value)} placeholder="Your setup or playbook" /></Field><Field label="Trade time"><input type="datetime-local" value={form.date} onChange={e => field('date', e.target.value)} /></Field><Field label="Entry price"><input type="number" step="any" value={form.entry} onChange={e => field('entry', e.target.value)} placeholder="Optional" /></Field><Field label="Exit price"><input type="number" step="any" value={form.exit} onChange={e => field('exit', e.target.value)} placeholder="Optional" /></Field><Field label="Gross P&L"><NumberField value={form.pnl} onChange={value => field('pnl', value)} prefix="$" /></Field><Field label="Fees"><NumberField value={form.fees} onChange={value => field('fees', value)} prefix="$" /></Field><Field label="Emotion"><select value={form.emotion} onChange={e => field('emotion', e.target.value)}><option>Focused</option><option>Confident</option><option>Anxious</option><option>FOMO</option><option>Frustrated</option></select></Field><Field label="Execution grade"><select value={form.grade} onChange={e => field('grade', e.target.value)}><option>A+</option><option>A</option><option>B</option><option>C</option><option>D</option><option>F</option></select></Field></div><label className="check-control"><input type="checkbox" checked={form.plan} onChange={e => field('plan', e.target.checked)} /><span><Check size={13} /></span>I followed my active playbook</label><Field label="Post-trade reflection"><textarea value={form.note} onChange={e => field('note', e.target.value)} placeholder="What worked? What did you feel? What will you repeat or change?" /></Field>{error && <div className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Save to journal</button></div></form></Modal>;
}

function PlanModal({ onClose, onSave }) {
  const [name, setName] = useState(''), [market, setMarket] = useState(''), [rules, setRules] = useState(''), [error, setError] = useState('');
  const submit = e => { e.preventDefault(); const list = rules.split('\n').map(x => x.trim()).filter(Boolean); if (!name.trim() || !list.length) return setError('Add a playbook name and at least one rule.'); onSave({ id: uid(), name: name.trim(), market: market.trim(), rules: list, active: false }); };
  return <Modal onClose={onClose} eyebrow="NEW PLAYBOOK" title="Define your execution edge"><form onSubmit={submit}><Field label="Playbook name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. London liquidity sweep" autoFocus /></Field><Field label="Market focus"><input value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. XAUUSD · London session" /></Field><Field label="Entry checklist"><textarea value={rules} onChange={e => setRules(e.target.value)} placeholder={'One rule per line\nWait for liquidity sweep\nConfirm displacement\nEnter on retracement'} /></Field>{error && <div className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Create playbook</button></div></form></Modal>;
}

function AccountModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', broker: '', type: 'Personal', startingBalance: 10000 });
  const [error, setError] = useState('');
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = event => {
    event.preventDefault();
    if (!form.name.trim()) return setError('Enter an account name.');
    if (!Number.isFinite(Number(form.startingBalance)) || Number(form.startingBalance) < 0) return setError('Enter a valid starting balance.');
    onSave({ ...form, startingBalance: Number(form.startingBalance) });
  };
  return <Modal onClose={onClose} eyebrow="NEW TRADING ACCOUNT" title="Create an isolated workspace"><form onSubmit={submit}><div className="account-modal-intro"><WalletCards size={19} /><div><b>Independent performance memory</b><span>Trades, check-ins, playbooks, risk rules and analytics stay separated from every other account.</span></div></div><div className="modal-grid"><Field label="Account name"><input value={form.name} onChange={event => field('name', event.target.value)} placeholder="e.g. Personal live" autoFocus /></Field><Field label="Account type"><select value={form.type} onChange={event => field('type', event.target.value)}><option>Personal</option><option>Prop firm</option><option>Demo</option><option>Evaluation</option></select></Field><Field label="Broker / platform"><input value={form.broker} onChange={event => field('broker', event.target.value)} placeholder="e.g. Elefin" /></Field><Field label="Starting balance"><NumberField value={form.startingBalance} onChange={value => field('startingBalance', value)} prefix="$" /></Field></div>{error && <div className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button"><Plus size={15} /> Create account</button></div></form></Modal>;
}

function ReviewModal({ trade, onClose, onSave }) {
  const [note, setNote] = useState(trade.note || ''), [emotion, setEmotion] = useState(trade.emotion || 'Focused'), [grade, setGrade] = useState(trade.grade || 'A');
  return <Modal onClose={onClose} eyebrow="TRADE REVIEW" title={`${trade.symbol} · ${trade.setup}`}><div className="review-metrics"><div><span>Net result</span><b className={trade.pnl >= 0 ? 'positive' : 'negative'}>{money(trade.pnl)}</b></div><div><span>Direction</span><b>{trade.side === 'buy' ? 'Long' : 'Short'}</b></div><div><span>Entry → Exit</span><b>{trade.entry ?? '—'} → {trade.exit ?? '—'}</b></div><div><span>Playbook</span><b>{trade.plan ? 'Followed' : 'Off-plan'}</b></div></div><div className="modal-grid"><Field label="Emotion"><select value={emotion} onChange={e => setEmotion(e.target.value)}><option>Focused</option><option>Confident</option><option>Anxious</option><option>FOMO</option><option>Frustrated</option></select></Field><Field label="Execution grade"><select value={grade} onChange={e => setGrade(e.target.value)}><option>A+</option><option>A</option><option>B</option><option>C</option><option>D</option><option>F</option></select></Field></div><Field label="Reflection"><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add your post-trade reflection…" /></Field><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={() => onSave({ note, emotion, grade })}>Save review</button></div></Modal>;
}

function ElefinCheckIn({ accountId, onClose, onStart }) {
  const [answers, setAnswers] = useState(() => Array(ELEFIN_CHECKS.length).fill(null));
  const [notes, setNotes] = useState(() => Array(ELEFIN_CHECKS.length).fill(''));
  const [emotion, setEmotion] = useState('');
  const completed = answers.filter(Boolean).length;
  const allAnswered = completed === ELEFIN_CHECKS.length;
  const ready = allAnswered && Boolean(emotion);
  const redCount = answers.filter(answer => answer === 'red').length;

  useEffect(() => {
    const closeOnEscape = event => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const choose = (index, value) => setAnswers(current => current.map((answer, itemIndex) => itemIndex === index ? value : answer));
  const addContext = (index, value) => setNotes(current => current.map((note, itemIndex) => itemIndex === index ? value : note));
  const proceed = () => {
    if (!ready) return;
    const record = {
      id: uid(),
      accountId,
      completedAt: new Date().toISOString(),
      destination: ELEFIN_URL,
      status: 'pending',
      emotion,
      answers: ELEFIN_CHECKS.map((question, index) => ({ question, result: answers[index], note: notes[index].trim() })),
    };
    try {
      const stored = JSON.parse(localStorage.getItem('northstar-elefin-checkins') || '[]');
      const history = Array.isArray(stored) ? stored : [];
      localStorage.setItem('northstar-elefin-checkins', JSON.stringify([record, ...history].slice(0, 50)));
    } catch {
      // A disabled or full local store should never block an intentional hand-off.
    }
    window.open(ELEFIN_URL, '_blank', 'noopener,noreferrer');
    onStart(record);
  };

  return <Modal onClose={onClose} eyebrow="ELEFIN PRE-CHECK" title="Fill the Pre Check In form">
    <div className="elefin-checkin">
      <div className="elefin-intro">
        <span className="elefin-intro-icon"><ShieldCheck size={21} /></span>
        <div><b>Validate the market before execution</b><small>Choose green or red, then capture the context behind each decision.</small></div>
        <strong>{completed}<small> / {ELEFIN_CHECKS.length}</small></strong>
      </div>
      <div className="elefin-progress" aria-label={`${completed} of ${ELEFIN_CHECKS.length} checks answered`}><i style={{ width: `${completed / ELEFIN_CHECKS.length * 100}%` }} /></div>
      <div className="precheck-list">
        {ELEFIN_CHECKS.map((question, index) => <article className={`precheck-row ${answers[index] ? 'answered' : ''}`} key={question}>
          <div className="precheck-question"><span>{String(index + 1).padStart(2, '0')}</span><b>{question}</b></div>
          <div className="precheck-decisions" role="group" aria-label={`Decision for: ${question}`}>
            <button type="button" className={`decision-button green ${answers[index] === 'green' ? 'active' : ''}`} onClick={() => choose(index, 'green')} aria-pressed={answers[index] === 'green'} aria-label="Mark green"><Check size={17} /><span>Green</span></button>
            <button type="button" className={`decision-button red ${answers[index] === 'red' ? 'active' : ''}`} onClick={() => choose(index, 'red')} aria-pressed={answers[index] === 'red'} aria-label="Mark red"><X size={17} /><span>Red</span></button>
          </div>
          <label className="precheck-note"><span>Market context</span><textarea value={notes[index]} onChange={event => addContext(index, event.target.value)} placeholder="Add your observation, level, or reasoning…" rows="2" /></label>
        </article>)}
      </div>
      <section className="emotion-check"><div><span><Activity size={17} /></span><div><b>Emotion status</b><small>Record your state before you move into execution.</small></div></div><div className="emotion-options" role="radiogroup" aria-label="Emotion status">{ELEFIN_EMOTIONS.map(option => <button type="button" role="radio" aria-checked={emotion === option} className={emotion === option ? 'active' : ''} onClick={() => setEmotion(option)} key={option}>{option}</button>)}</div></section>
      <div className={`precheck-summary ${ready ? (redCount ? 'caution' : 'ready') : ''}`} aria-live="polite">
        <span>{ready ? (redCount ? <ShieldCheck size={17} /> : <Check size={17} />) : <Sparkles size={17} />}</span>
        <div><b>{!allAnswered ? `${ELEFIN_CHECKS.length - completed} decision${ELEFIN_CHECKS.length - completed === 1 ? '' : 's'} remaining` : !emotion ? 'Choose your emotion status' : redCount ? `${redCount} red decision${redCount === 1 ? '' : 's'} noted` : 'Pre-check complete'}</b><small>{ready ? `Emotion: ${emotion} · Your check will be saved before opening Elefin.` : 'Complete the market decisions and emotion check to continue.'}</small></div>
      </div>
      <div className="elefin-footer">
        <button type="button" className="secondary-button" onClick={onClose}>Not now</button>
        <button type="button" className="primary-button elefin-done" disabled={!ready} onClick={proceed}><span>Done checking in</span><ExternalLink size={16} /></button>
      </div>
    </div>
  </Modal>;
}

function SessionStatusModal({ session, onAcknowledge, onCancel }) {
  const greenCount = session.answers.filter(answer => answer.result === 'green').length;
  return <Modal onClose={onCancel} eyebrow="TRADING SESSION" title="You are now in a trading session">
    <div className="session-confirmation">
      <div className="session-live-orbit"><span /><Radio size={26} /></div>
      <h3>Elefin opened in a new tab</h3>
      <p>Acknowledge this session to attach your pre-check to today’s journal calendar and include it in your analytics.</p>
      <div className="session-confirm-metrics"><div><span>CHECK STATUS</span><b>{greenCount} green · {session.answers.length - greenCount} red</b></div><div><span>EMOTION</span><b>{session.emotion}</b></div><div><span>STARTED</span><b>{new Date(session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></div></div>
      <div className="session-confirm-note"><ShieldCheck size={17} /><span>Your notes and decisions are saved. Acknowledging makes this session part of Northstar’s permanent calendar memory.</span></div>
      <div className="session-confirm-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel session</button><button type="button" className="primary-button" onClick={onAcknowledge}><Check size={16} /> Acknowledge session</button></div>
    </div>
  </Modal>;
}

function Modal({ children, onClose, eyebrow, title }) { return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="modal-panel" role="dialog" aria-modal="true"><div className="modal-heading"><div><p>{eyebrow}</p><h2>{title}</h2></div><button onClick={onClose}><X size={18} /></button></div>{children}</section></div>; }
function Field({ label, children }) { return <label className="field-label"><span>{label}</span>{children}</label>; }
function NumberField({ value, onChange, suffix, prefix }) { return <div className="number-field">{prefix && <span>{prefix}</span>}<input type="number" step="any" value={value} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))} />{suffix && <small>{suffix}</small>}</div>; }
function Instrument({ symbol }) { const item = INSTRUMENTS[symbol] || { icon: symbol?.slice(0, 1), label: symbol, accent: 'violet' }; return <span className="instrument"><i className={item.accent}>{item.icon}</i><b>{item.label}</b></span>; }
function SectionTitle({ eyebrow, title, action, onAction }) { return <div className="section-title"><div><p>{eyebrow}</p><h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<ArrowUpRight size={13} /></button>}</div>; }
function EmptyState({ icon: Icon, title, text, action, onAction, small, large }) { return <div className={`empty-state ${small ? 'small' : ''} ${large ? 'large' : ''}`}><div><Icon size={large ? 26 : 21} /></div><b>{title}</b><span>{text}</span>{action && <button className="primary-button" onClick={onAction}>{action}</button>}</div>; }
function TradeTable({ trades }) { return <div className="table-scroll"><table><thead><tr><th>Instrument</th><th>Setup</th><th>Direction</th><th>Date</th><th>Net result</th></tr></thead><tbody>{trades.map(t => <tr key={t.id}><td><Instrument symbol={t.symbol} /></td><td>{t.setup || '—'}</td><td className={t.side === 'buy' ? 'positive' : 'negative'}>{t.side === 'buy' ? 'Long' : 'Short'}</td><td>{new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td><td className={t.pnl >= 0 ? 'positive' : 'negative'}><b>{money(t.pnl)}</b></td></tr>)}</tbody></table></div>; }
