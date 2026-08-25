import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, BookOpen, CalendarDays,
  Check, ChevronDown, CircleDollarSign, ClipboardCheck, Gauge, LayoutDashboard,
  LineChart, Menu, Plus, Search, Settings, ShieldCheck, Sparkles, Target, Trash2,
  TrendingUp, WalletCards, X, ZoomIn, Moon, Sun, ExternalLink, RefreshCw, Clock3,
  Newspaper, Radio, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Camera,
  Maximize2, Minimize2, Pencil, Cloud, CloudOff, LoaderCircle, Database,
  BadgeCheck, LogOut, UserRound, Eye,
} from 'lucide-react';
import { useLocalState } from './hooks/useLocalState';
import { useAccountWorkspace } from './hooks/useAccountWorkspace';
import { useEconomicCalendar } from './hooks/useEconomicCalendar';

const INITIAL = {
  settings: { startingBalance: 0, maxDailyLoss: 0, maxTrades: 0, riskPerTrade: 0 },
  trades: [], positions: [], plans: [], sessions: [],
  routine: { checks: [false, false, false, false, false], bias: '', notes: '', complete: false, completedAt: null },
  pendingSession: null,
};
const INSTRUMENTS = {
  BTCUSD: { label: 'BTC / USD', name: 'Bitcoin / US Dollar', accent: 'orange' },
  XAUUSD: { label: 'XAU / USD', name: 'Gold Spot / US Dollar', accent: 'gold' },
};
const NAV = [
  ['dashboard', LayoutDashboard, 'Overview'], ['journal', BookOpen, 'Journal'],
  ['analytics', BarChart3, 'Analytics'],
  ['plans', Target, 'Playbooks'],
  ['settings', Settings, 'Risk control'],
];
const TITLES = {
  dashboard: ['Overview', ''],
  journal: ['Trading journal', ''], analytics: ['Performance analytics', ''],
  premarket: ['Pre-market routine', ''], plans: ['Strategy playbooks', ''],
  settings: ['Risk control', ''],
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
const FLOW_TYPES = ['Context', 'Trigger', 'Decision', 'Confirmation', 'Risk', 'Entry', 'Management', 'Exit', 'Review'];
const FLOW_SCOPES = ['HTF', 'MTF', 'STF'];
const STRATEGY_TIMEFRAMES = ['M1', 'M3', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

const money = (value, sign = true) => `${sign && value > 0 ? '+' : ''}${value < 0 ? '−' : ''}$${Math.abs(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plainMoney = value => Number.isFinite(value) ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const valueTone = value => Number(value) > 0 ? 'positive' : Number(value) < 0 ? 'negative' : 'neutral-value';
const metricTone = value => Number(value) > 0 ? 'gain' : Number(value) < 0 ? 'loss' : 'neutral';
const formatQuote = value => Number.isFinite(value) ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const uid = () => crypto.randomUUID();
const listFromText = value => value.split('\n').map(item => item.trim()).filter(Boolean);
const MAX_IMAGES = 8;
const MAX_IMAGE_STORE_SIZE = 1200000;
const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const isImageFile = file => Boolean(file && (file.type?.startsWith('image/') || IMAGE_FILE_PATTERN.test(file.name || '')));
const compressUpload = file => new Promise((resolve, reject) => {
  if (!isImageFile(file)) return reject(new Error(`${file.name || 'This file'} is not a supported image.`));
  if (file.size > 12000000) return reject(new Error(`${file.name} is larger than 12 MB.`));
  const reader = new FileReader();
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => reject(new Error(`Could not process ${file.name}.`));
    image.onload = () => {
      const scale = Math.min(1, 1100 / image.width, 760 / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#080a0e';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve({ id: uid(), name: file.name, url: canvas.toDataURL('image/jpeg', .68) });
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});
const toLocalDateTimeValue = (value = new Date()) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const USER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
const USER_TIME_ZONE_LABEL = USER_TIME_ZONE.replaceAll('_', ' ');
const updateStoredCheckinStatus = (id, status, accountId) => {
  try {
    const stored = JSON.parse(localStorage.getItem('northstar-elefin-checkins') || '[]');
    if (!Array.isArray(stored)) return;
    localStorage.setItem('northstar-elefin-checkins', JSON.stringify(stored.map(record => record.id === id && (!record.accountId || record.accountId === accountId) ? { ...record, status, statusUpdatedAt: new Date().toISOString() } : record)));
  } catch {
    // Session state in the main workspace remains the source of truth.
  }
};

function InstrumentMark({ symbol, size = 28 }) {
  if (symbol === 'BTCUSD') return <span className="market-mark bitcoin-mark" style={{ width: size, height: size }} aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" /><text x="16" y="21.1" textAnchor="middle">₿</text><path d="M10 8.2 22 23.8M10 23.8 22 8.2" /></svg></span>;
  if (symbol === 'XAUUSD') return <span className="market-mark gold-mark" style={{ width: size, height: size }} aria-hidden="true"><svg viewBox="0 0 32 32"><path className="gold-back" d="M16 3.6 28.4 16 16 28.4 3.6 16Z" /><path className="gold-top" d="M16 3.6 16 16 3.6 16Z" /><path className="gold-side" d="M28.4 16 16 28.4 16 16Z" /><path className="gold-glint" d="m16 8.2 7.8 7.8-2.1 2.1-5.7-5.7-5.7 5.7L8.2 16Z" /></svg></span>;
  return <span className="market-mark fallback-mark" style={{ width: size, height: size }} aria-hidden="true">{symbol?.slice(0, 1)}</span>;
}

function WorkspaceBootState({ status, error }) {
  const failed = status === 'error' || status === 'unauthorized';
  return <main className="welcome-screen">
    <div className="welcome-aurora" aria-hidden="true" />
    <section className="welcome-card welcome-experience workspace-boot">
      <header className="welcome-top">
        <span className="welcome-wordmark">EDGETRADER <i>OS</i></span>
        <div className={`welcome-status ${failed ? 'failed' : ''}`}><span /> {failed ? 'Connection required' : 'Securing workspace'}</div>
      </header>
      <div className="welcome-layout">
        <div className="welcome-copy">
          <p>CLOUDFLARE D1 WORKSPACE</p>
          <h1>{failed ? <>Connection<br /><em>required.</em></> : <>Preparing your<br /><em>workspace.</em></>}</h1>
          <span>{failed ? error : 'Verifying your Cloudflare Access identity and loading your private accounts, journal and playbooks.'}</span>
          {failed ? <button className="primary-button welcome-enter" onClick={() => window.location.reload()}><RefreshCw size={16} /> Try again</button> : <div className="welcome-loading-state"><LoaderCircle className="workspace-loader" size={18} /><span>Loading encrypted workspace</span></div>}
          <small className="welcome-identity">Your trading data remains private to your authenticated identity.</small>
        </div>
        <aside className={`welcome-account-panel welcome-boot-panel ${failed ? 'failed' : ''}`}>
          <header><span>CLOUDFLARE ACCESS</span>{failed ? <CloudOff size={17} /> : <Cloud size={17} />}</header>
          <div className="welcome-account-icon">{failed ? <CloudOff size={22} /> : <Cloud size={22} />}</div>
          <small>{failed ? 'SESSION NOT VERIFIED' : 'PRIVATE IDENTITY'}</small>
          <h2>{failed ? 'Unable to connect' : 'Identity verified'}</h2>
          <p>{failed ? 'Retry the secure connection to continue.' : 'Your account-specific data is being synchronized.'}</p>
          <div className="welcome-boot-progress" aria-hidden="true"><i /><i /><i /></div>
          <footer><ShieldCheck size={14} /><span>Encrypted connection</span><i /><span>D1 storage</span></footer>
        </aside>
      </div>
    </section>
  </main>;
}

function WelcomeScreen({ account, accountCount, identity, needsAccountSetup, onEnter, onSetup }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = identity?.name?.trim() || identity?.email?.split('@')[0] || 'Trader';
  return <main className="welcome-screen">
    <div className="welcome-aurora" aria-hidden="true" />
    <section className="welcome-card welcome-experience">
      <header className="welcome-top">
        <span className="welcome-wordmark">EDGETRADER <i>OS</i></span>
        <div className="welcome-status"><span /> D1 workspace synced</div>
      </header>
      <div className="welcome-layout">
        <div className="welcome-copy">
          <p>PRIVATE TRADING WORKSPACE</p>
          <h1>{greeting},<br /><em>{displayName}.</em></h1>
          <span>{needsAccountSetup ? 'Your secure workspace is ready. Create the first account that will hold your journal, playbooks and analytics.' : <>Everything for <b>{account.name}</b> is synced and ready for your next session.</>}</span>
          <div className="welcome-actions">
            <button className="primary-button welcome-enter" onClick={needsAccountSetup ? onSetup : onEnter}>{needsAccountSetup ? <><Plus size={17} /> Set up first account</> : <>Open workspace <ArrowUpRight size={17} /></>}</button>
            <small className="welcome-security"><ShieldCheck size={14} /> Cloudflare Access secured</small>
          </div>
          <small className="welcome-identity">Signed in as <b>{identity?.email || 'Cloudflare Access user'}</b></small>
        </div>
        <aside className="welcome-account-panel">
          <header><span>{needsAccountSetup ? 'SETUP REQUIRED' : 'ACTIVE WORKSPACE'}</span><Cloud size={17} /></header>
          <div className="welcome-account-icon"><WalletCards size={22} /></div>
          <small>{needsAccountSetup ? 'YOUR FIRST ACCOUNT' : 'READY TO CONTINUE'}</small>
          <h2>{needsAccountSetup ? 'Create a trading account' : account.name}</h2>
          <p>{needsAccountSetup ? 'Keep every trading account, risk profile and journal completely separate.' : `${account.broker} · ${account.type}`}</p>
          <div className="welcome-summary">
            <article><small>ACCOUNTS</small><b>{needsAccountSetup ? 0 : accountCount}</b><span>Independent workspaces</span></article>
            <article><small>DATA</small><b>D1</b><span>Cloud synchronized</span></article>
          </div>
          <footer><ShieldCheck size={14} /><span>Private by identity</span><i /><span>Encrypted</span></footer>
        </aside>
      </div>
    </section>
  </main>;
}

export default function App() {
  const workspace = useAccountWorkspace(INITIAL);
  const { accounts, activeAccount, data, setData, switchAccount, createAccount, deleteAccount, identity, isHydrated, syncStatus, syncError, storageError, needsAccountSetup, lastSyncedAt, syncNow } = workspace;
  const [page, setPage] = useState('dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [navCollapsed, setNavCollapsed] = useLocalState('northstar-nav-collapsed', false);
  const [tradeModal, setTradeModal] = useState(false);
  const [tradeDate, setTradeDate] = useState(null);
  const [planModal, setPlanModal] = useState(null);
  const [viewPlan, setViewPlan] = useState(null);
  const [accountModal, setAccountModal] = useState(false);
  const [viewTrade, setViewTrade] = useState(null);
  const [reviewTrade, setReviewTrade] = useState(null);
  const [noteTrade, setNoteTrade] = useState(null);
  const [elefinModal, setElefinModal] = useState(false);
  const [theme, setTheme] = useLocalState('northstar-theme', 'dark');
  const [workspaceEntered, setWorkspaceEntered] = useState(() => sessionStorage.getItem('northstar-workspace-entered') === 'true');
  const sessions = data.sessions || [];
  const activePlan = data.plans.find(plan => plan.active);
  const todayKey = localDateKey(new Date());
  const todayTrades = data.trades.filter(t => localDateKey(t.date) === todayKey);
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
    setTradeModal(false); setPlanModal(null); setViewPlan(null); setViewTrade(null); setReviewTrade(null); setNoteTrade(null); setElefinModal(false);
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

  if (!isHydrated) return <WorkspaceBootState status={syncStatus} error={syncError} />;
  if (!workspaceEntered || needsAccountSetup) return <><WelcomeScreen account={activeAccount} accountCount={accounts.length} identity={identity} needsAccountSetup={needsAccountSetup} onSetup={() => setAccountModal(true)} onEnter={() => { sessionStorage.setItem('northstar-workspace-entered', 'true'); setWorkspaceEntered(true); }} />{accountModal && <AccountModal required onClose={() => setAccountModal(false)} onSave={details => { createAccount(details); setAccountModal(false); }} />}</>;

  return <div className={`app-shell font-sans theme-${theme} ${navCollapsed ? 'nav-collapsed' : ''}`}>
    <button className="mobile-nav-toggle" onClick={toggleNavigation} aria-label="Open navigation"><Menu size={18} /></button>
    <Sidebar page={page} go={go} open={mobileNav} accounts={accounts} activeAccount={activeAccount} identity={identity} syncStatus={syncStatus} navCollapsed={navCollapsed} onToggleNavigation={toggleNavigation} onSwitchAccount={selectAccount} onAddAccount={() => setAccountModal(true)} onDeleteAccount={deleteAccount} />
    <main className="main-shell">
      <Topbar page={page} onNewTrade={() => openTrade()} theme={theme} onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} data={data} totalPnl={totalPnl} activeAccount={activeAccount} identity={identity} syncStatus={syncStatus} lastSyncedAt={lastSyncedAt} onSync={syncNow} />
      <div className="account-workspace" key={activeAccount.id}>
        {page === 'dashboard' && <Dashboard data={data} totalPnl={totalPnl} todayPnl={todayPnl} todayTrades={todayTrades} activePlan={activePlan} go={go} theme={theme} onCheckIn={() => setElefinModal(true)} onEditTrade={setReviewTrade} onAddNote={setNoteTrade} />}
        {page === 'journal' && <Journal trades={data.trades} sessions={sessions} onAdd={openTrade} onView={setViewTrade} onReview={setReviewTrade} onAddNote={setNoteTrade} onDelete={id => patch(next => next.trades = next.trades.filter(t => t.id !== id))} />}
        {page === 'analytics' && <Analytics trades={data.trades} sessions={sessions} theme={theme} />}
        {page === 'premarket' && <Premarket routine={data.routine} activePlan={activePlan} patch={patch} go={go} />}
        {page === 'plans' && <Plans plans={data.plans} trades={data.trades} patch={patch} onAdd={() => setPlanModal('new')} onView={setViewPlan} onEdit={setPlanModal} />}
        {page === 'settings' && <RiskSettings settings={data.settings} patch={patch} account={activeAccount} identity={identity} syncStatus={syncStatus} />}
      </div>
    </main>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    {tradeModal && <TradeModal plans={data.plans} initialDate={tradeDate} onClose={() => { setTradeModal(false); setTradeDate(null); }} onSave={trade => { addTrade(trade); setTradeModal(false); setTradeDate(null); }} />}
    {planModal && <PlanModal initialPlan={planModal === 'new' ? null : planModal} onClose={() => setPlanModal(null)} onSave={plan => { patch(next => { const index = next.plans.findIndex(item => item.id === plan.id); if (index >= 0) next.plans[index] = plan; else { if (!next.plans.length) plan.active = true; next.plans.push(plan); } }); setPlanModal(null); }} />}
    {viewPlan && <PlaybookViewModal plan={viewPlan} onClose={() => setViewPlan(null)} onEdit={() => { const selected = viewPlan; setViewPlan(null); setPlanModal(selected); }} />}
    {accountModal && <AccountModal onClose={() => setAccountModal(false)} onSave={details => { createAccount(details); setAccountModal(false); }} />}
    {viewTrade && <TradeViewModal trade={viewTrade} onClose={() => setViewTrade(null)} onEdit={() => { const selected = viewTrade; setViewTrade(null); setReviewTrade(selected); }} />}
    {reviewTrade && <ReviewModal trade={reviewTrade} plans={data.plans} onClose={() => setReviewTrade(null)} onSave={updates => { patch(next => Object.assign(next.trades.find(t => t.id === reviewTrade.id), updates)); setReviewTrade(null); }} />}
    {noteTrade && <TradeNoteModal trade={noteTrade} onClose={() => setNoteTrade(null)} onSave={note => { patch(next => { const trade = next.trades.find(item => item.id === noteTrade.id); if (trade) trade.note = [trade.note, note.trim()].filter(Boolean).join('\n\n'); }); setNoteTrade(null); }} />}
    <button type="button" className="elefin-hanger elefin-logo-button" onClick={() => setElefinModal(true)} aria-label="Open Elefin pre-trade check-in" title="Elefin pre-trade check-in" aria-haspopup="dialog" aria-expanded={elefinModal}>
      <span className="elefin-hanger-icon"><img src="/elefin-icon.png" alt="Elefin" /></span>
    </button>
    {elefinModal && <ElefinCheckIn accountId={activeAccount.id} onClose={() => setElefinModal(false)} onStart={stageSession} />}
    {pendingSession && <SessionStatusModal session={pendingSession} onAcknowledge={acknowledgeSession} onCancel={cancelSession} />}
    {storageError && <div className="storage-alert" role="alert"><ShieldCheck size={15} /><div><b>Browser storage is full</b><span>{storageError}</span></div></div>}
    {syncError && <div className="storage-alert cloud-sync-alert" role="alert"><CloudOff size={15} /><div><b>D1 sync paused</b><span>{syncError}</span></div></div>}
  </div>;
}

function Sidebar({ page, go, open, accounts, activeAccount, syncStatus, navCollapsed, onToggleNavigation, onSwitchAccount, onAddAccount, onDeleteAccount }) {
  const [accountMenu, setAccountMenu] = useState(false);
  const accountMenuRef = useRef(null);
  useEffect(() => {
    if (!accountMenu) return undefined;
    const close = event => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !accountMenuRef.current?.contains(event.target))) setAccountMenu(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [accountMenu]);
  return <aside className={`sidebar ${open ? 'open' : ''}`}>
    <div className="sidebar-brand-row"><div className="logo"><div>EdgeTrader</div></div><button className="sidebar-toggle" onClick={onToggleNavigation} aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'} title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}><Menu size={18} /></button></div>
    <nav>{NAV.map(([id, Icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => go(id)} title={label} aria-label={label}><Icon size={18} /><span>{label}</span>{page === id && <i />}</button>)}</nav>
    <div className="sidebar-spacer" />
    <div className={`system-chip sync-${syncStatus}`}><i /> {syncStatus === 'saving' ? 'Saving to D1…' : syncStatus === 'synced' ? 'D1 cloud synced' : 'Cloud sync paused'}</div>
    <div className="account-switcher" ref={accountMenuRef}>
      <button className="account-switcher-trigger" onClick={() => setAccountMenu(current => !current)} aria-expanded={accountMenu}>
        <span><WalletCards size={17} /></span><div><b>{activeAccount.name}</b><small>{activeAccount.broker} · {activeAccount.type}</small></div><ChevronDown size={15} />
      </button>
      {accountMenu && <div className="account-menu">
        <header><span>TRADING ACCOUNTS</span><b>{accounts.length}</b></header>
        <div>{accounts.map(account => <div className={`account-option ${account.id === activeAccount.id ? 'active' : ''}`} key={account.id}>
          <button onClick={() => { onSwitchAccount(account.id); setAccountMenu(false); }}><i>{account.id === activeAccount.id ? <Check size={12} /> : <WalletCards size={12} />}</i><span><b>{account.name}</b><small>{account.broker} · {plainMoney(Number(account.data.settings.startingBalance || 0))}</small></span></button>
          {accounts.length > 1 && <button className="account-delete" onClick={() => { if (window.confirm(`Delete ${account.name} and all saved data for it?`)) onDeleteAccount(account.id); }} aria-label={`Delete ${account.name}`}><Trash2 size={13} /></button>}
        </div>)}</div>
        <button className="account-add" onClick={() => { setAccountMenu(false); onAddAccount(); }}><Plus size={14} /> Create trading account</button>
      </div>}
    </div>
  </aside>;
}
function Topbar({ page, onNewTrade, theme, onTheme, data, totalPnl, activeAccount, identity, syncStatus, lastSyncedAt, onSync }) {
  const [title, eyebrow] = TITLES[page];
  const openPnl = 0;
  const balance = Number(data.settings.startingBalance || 0) + totalPnl;
  const equity = balance + openPnl;
  const syncTitle = syncStatus === 'saving' ? 'Syncing workspace to D1' : lastSyncedAt ? `D1 last synced at ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Sync workspace to D1';
  return <header className="topbar"><div className="topbar-title">{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1><span className="topbar-account"><WalletCards size={12} /> {activeAccount.name}</span></div><div className="top-actions"><button className={`d1-sync-button icon-only ${syncStatus}`} onClick={onSync} disabled={syncStatus === 'saving'} title={syncTitle} aria-label={syncTitle}><Cloud size={14} /><RefreshCw size={10} className={syncStatus === 'saving' ? 'spinning' : ''} /></button><div className="today"><CalendarDays size={15} />{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><button className="primary-button trade-button" onClick={onNewTrade} title="Log trade" aria-label="Log trade"><Plus size={19} /></button><HeaderUserMenu identity={identity} theme={theme} onTheme={onTheme} /></div><div className="account-strip" aria-label="Account status"><div><span>BALANCE</span><b className={valueTone(balance)}>{plainMoney(balance)}</b></div><div><span>OPEN P&amp;L</span><b className={valueTone(openPnl)}>{money(openPnl)}</b></div><div><span>EQUITY</span><b className={valueTone(equity)}>{plainMoney(equity)}</b></div></div></header>;
}

function HeaderUserMenu({ identity, theme, onTheme }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const initials = (identity?.name || identity?.email || 'ET').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !menuRef.current?.contains(event.target))) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const endSession = async () => {
    setOpen(false);
    sessionStorage.removeItem('northstar-workspace-entered');
    try {
      await Promise.race([
        fetch('/cdn-cgi/access/logout', { credentials: 'include', cache: 'no-store', redirect: 'manual' }),
        new Promise(resolve => window.setTimeout(resolve, 1400)),
      ]);
    } catch {
      // Local development does not expose a Cloudflare Access session.
    }
    window.location.reload();
  };
  return <div className="header-user-menu" ref={menuRef}><button type="button" className="header-user-trigger" onClick={() => setOpen(current => !current)} aria-expanded={open} aria-label="Open account menu"><span>{initials || 'ET'}</span><ChevronDown size={12} /></button>{open && <section className="header-profile-menu"><header><span>{initials || 'ET'}</span><div><small>EDGE TRADER PROFILE</small><b>{identity?.name || 'EdgeTrader user'}</b><p>{identity?.email || 'Cloudflare Access identity'}</p></div></header><button className="header-theme-option" type="button" onClick={onTheme}><span>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</span><div><b>Dark mode</b><small>{theme === 'dark' ? 'Enabled' : 'Disabled'}</small></div><i className={theme === 'dark' ? 'on' : ''}><u /></i></button><button className="profile-logout" type="button" onClick={endSession}><LogOut size={15} /> Log out of Cloudflare session</button></section>}</div>;
}
function Dashboard({ data, totalPnl, todayPnl, todayTrades, activePlan, go, theme, onCheckIn, onEditTrade, onAddNote }) {
  const wins = data.trades.filter(t => t.pnl > 0), losses = data.trades.filter(t => t.pnl < 0), winRate = data.trades.length ? wins.length / data.trades.length * 100 : null;
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0), grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const cards = [
    ['Net P&L', money(totalPnl), totalPnl >= 0 ? ArrowUpRight : ArrowDownRight, totalPnl >= 0 ? 'green' : 'red', `${data.trades.length} recorded trades`],
    ['Win rate', winRate === null ? '—' : `${winRate.toFixed(1)}%`, Gauge, 'violet', winRate === null ? 'Awaiting trades' : `${wins.length} wins · ${losses.length} losses`],
    ['Profit factor', grossLoss ? (grossWin / grossLoss).toFixed(2) : '—', Activity, 'blue', grossLoss ? 'Gross profit ÷ gross loss' : 'Awaiting closed losses'],
    ['Today', money(todayPnl), CircleDollarSign, todayPnl >= 0 ? 'green' : 'red', `${todayTrades.length} trades this session`],
  ];
  return <div className="page-stack">
    <section className="command-banner playbook-banner"><div className="command-side"><div><span>SELECTED PLAYBOOK</span><b>{activePlan?.name || 'None selected'}</b>{activePlan?.market && <small>{activePlan.market}</small>}</div><button onClick={() => go('plans')}>{activePlan ? 'View playbook' : 'Choose playbook'} <ArrowUpRight size={14} /></button></div></section>
    <div className="stats-grid">{cards.map(([label, value, Icon, tone, help]) => <article className="stat-card" key={label}><div><span>{label}</span><i className={tone}><Icon size={17} /></i></div><strong className={label === 'Win rate' || label === 'Profit factor' ? 'positive' : label.includes('P&L') || label === 'Today' ? (value.startsWith('+') ? 'positive' : value.startsWith('−') ? 'negative' : 'neutral-value') : ''}>{value}</strong><small>{help}</small></article>)}</div>
    <div className="dashboard-grid"><GuardrailPanel data={data} todayTrades={todayTrades} todayPnl={todayPnl} go={go} onCheckIn={onCheckIn} /><EquityPanel trades={data.trades} start={data.settings.startingBalance} theme={theme} /></div>
    <RecentTrades trades={data.trades.slice(0, 5)} go={go} onEdit={onEditTrade} onAddNote={onAddNote} />
  </div>;
}

function EquityPanel({ trades, start, theme }) {
  const sorted = [...trades].filter(trade => Number.isFinite(new Date(trade.date).getTime())).sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = start;
  const firstTradeTime = sorted.length ? new Date(sorted[0].date).getTime() : Date.now();
  const points = [[firstTradeTime - 3600000, start], ...sorted.map(trade => [new Date(trade.date).getTime(), running += Number(trade.pnl) || 0])];
  const chartLine = theme === 'dark' ? '#292d38' : '#f0f1f5';
  const option = { animation: false, grid: { left: 8, right: 8, top: 18, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', triggerOn: 'mousemove', alwaysShowContent: false, hideDelay: 80, enterable: false, confine: true, valueFormatter: v => plainMoney(v) }, xAxis: { type: 'time', axisLabel: { color: '#84909c', fontSize: 12 }, axisLine: { lineStyle: { color: chartLine } }, splitLine: { show: false } }, yAxis: { type: 'value', scale: true, position: 'right', axisLabel: { color: '#84909c', fontSize: 12, formatter: v => Math.abs(v) >= 100000 ? `$${(v / 1000).toFixed(1)}k` : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }, splitLine: { lineStyle: { color: chartLine } } }, series: [{ type: 'line', data: trades.length ? points : [], showSymbol: true, symbolSize: 5, smooth: .28, lineStyle: { color: '#4d83b3', width: 2.4 }, itemStyle: { color: '#276eb0', borderColor: '#fff', borderWidth: 1.5 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#4d83b333' }, { offset: 1, color: '#4d83b300' }] } } }] };
  return <section className="surface equity-surface"><SectionTitle eyebrow="ACCOUNT GROWTH" title="Equity curve" action="All time" />{trades.length ? <ReactECharts option={option} style={{ height: 220 }} /> : <EmptyState icon={TrendingUp} title="Your equity curve starts here" text="Log your first completed trade to begin tracking account growth." />}</section>;
}

function GuardrailPanel({ data, todayTrades, todayPnl, go, onCheckIn }) {
  const today = localDateKey(new Date());
  const acknowledgedCheckIn = (data.sessions || []).find(session => (session.status === 'acknowledged' || session.acknowledgedAt) && localDateKey(session.acknowledgedAt || session.completedAt) === today);
  const preparationComplete = Boolean(acknowledgedCheckIn || data.routine.complete);
  const maxDailyLoss = Math.max(0, Number(data.settings.maxDailyLoss) || 0);
  const lossUsed = Math.max(0, -todayPnl);
  const lossPercent = maxDailyLoss ? Math.min(100, lossUsed / maxDailyLoss * 100) : 0;
  const maxTrades = Math.max(0, Number(data.settings.maxTrades) || 0);
  const tradePercent = maxTrades ? Math.min(100, todayTrades.length / maxTrades * 100) : 0;
  const items = [
    ['Daily loss', maxDailyLoss ? `${plainMoney(Math.max(0, maxDailyLoss + Math.min(0, todayPnl)))} remaining` : 'Set a daily loss limit', !maxDailyLoss || todayPnl <= -maxDailyLoss],
    ['Trade limit', maxTrades ? `${todayTrades.length} of ${maxTrades} used` : 'Set a daily trade limit', !maxTrades || todayTrades.length >= maxTrades],
    ['Session check-in', acknowledgedCheckIn ? 'Elefin check-in acknowledged' : preparationComplete ? 'Legacy routine completed' : 'Check-in required', !preparationComplete],
    ['Active plan', data.plans.some(p => p.active) ? data.plans.find(p => p.active).name : 'No playbook selected', !data.plans.some(p => p.active)],
  ];
  const ready = items.filter(([, , warning]) => !warning).length;
  return <section className="surface guard-surface"><header className="control-header"><div><p>RISK ENGINE</p><h2>Live controls</h2></div><button onClick={() => go('settings')}>Edit limits <ArrowUpRight size={13} /></button></header><div className="control-readiness"><span><i /> SYSTEM STATUS</span><b>{ready}/{items.length} ready</b></div><div className="risk-usage"><article><div><span>Daily loss</span><b>{plainMoney(lossUsed)} / {maxDailyLoss ? plainMoney(maxDailyLoss) : 'Not set'}</b></div><i><u className={lossPercent >= 80 ? 'danger' : ''} style={{ width: `${lossPercent}%` }} /></i><small>{maxDailyLoss ? `${Math.round(lossPercent)}% used` : 'Configure limit'}</small></article><article><div><span>Trade limit</span><b>{todayTrades.length} / {maxTrades || 'Not set'}</b></div><i><u className={tradePercent >= 80 ? 'danger' : ''} style={{ width: `${tradePercent}%` }} /></i><small>{maxTrades ? `${Math.round(tradePercent)}% used` : 'Configure limit'}</small></article></div><div className="guard-list">{items.map(([name, detail, warning]) => <div className={warning ? 'warning' : 'ready'} key={name}><span>{warning ? '!' : <Check size={12} />}</span><div><b>{name}</b><small>{detail}</small></div>{name === 'Session check-in' && !acknowledgedCheckIn ? <button className="guard-action" onClick={onCheckIn}>Check in</button> : <em>{warning ? 'Review' : 'Ready'}</em>}</div>)}</div></section>;
}

function RecentTrades({ trades, go, onEdit, onAddNote }) {
  return <section className="surface recent"><SectionTitle eyebrow="RECENT ACTIVITY" title="Execution log" action="Open journal" onAction={() => go('journal')} />{trades.length ? <TradeTable trades={trades} onEdit={onEdit} onAddNote={onAddNote} /> : <EmptyState icon={BookOpen} title="No journal entries yet" text="Open the journal and select a calendar date to record your first trade." />}</section>;
}

function Terminal({ symbol, setSymbol, timeframe, setTimeframe, market, theme }) {
  return <div className="terminal-page terminal-chart-only">
    <section className="market-workspace surface">
      <div className="instrument-bar"><div className="instrument-tabs">{Object.entries(INSTRUMENTS).map(([key, meta]) => <button key={key} className={symbol === key ? 'active' : ''} onClick={() => setSymbol(key)}><InstrumentMark symbol={key} size={36} /><span><b>{meta.label}</b><small>{meta.name}</small></span></button>)}</div><FeedStatus market={market} /></div>
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

function Journal({ trades, sessions, onAdd, onView, onReview, onAddNote, onDelete }) {
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const filtered = trades.filter(t => `${t.symbol} ${t.setup} ${t.emotion}`.toLowerCase().includes(query.toLowerCase()));
  const now = new Date();
  const monthTrades = trades.filter(trade => { const date = new Date(trade.date); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); });
  const monthPnl = monthTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const monthState = monthPnl > 0 ? 'Profit' : monthPnl < 0 ? 'Loss' : 'Flat';
  const addFromDay = date => { setSelectedDate(null); onAdd(date); };
  return <div className="page-stack journal-workspace"><section className={`command-banner playbook-banner journal-month-banner ${monthState.toLowerCase()}`}><div className="command-side"><div><span>THIS MONTH · {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</span><b>{money(monthPnl)}</b><small>{monthTrades.length} completed trade{monthTrades.length === 1 ? '' : 's'}</small></div><em className="month-state">{monthState}</em></div></section><div className="journal-grid"><JournalCalendar trades={trades} sessions={sessions} month={month} setMonth={setMonth} onSelect={setSelectedDate} /><JournalInsight trades={trades} /></div><section className="surface journal-list"><div className="section-toolbar"><SectionTitle eyebrow="Trade archive" title={`${trades.length} journal entries`} /><div className="search-box"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search setup, market or emotion" /></div></div>{filtered.length ? <div className="table-scroll"><table><thead><tr><th>Instrument</th><th>Date</th><th>Setup</th><th>Side</th><th>Lots</th><th>Grade</th><th>Evidence</th><th>Net result</th><th>Actions</th></tr></thead><tbody>{filtered.map(t => { const reviewed = Boolean(t.note || t.management || t.mistakes || t.images?.length); return <tr key={t.id}><td><Instrument symbol={t.symbol} /></td><td>{new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</td><td><div className="setup-cell"><b>{t.setup || '—'}</b><small>{t.management || t.note || 'Review not added'}</small></div></td><td className={t.side === 'buy' ? 'positive' : 'negative'}>{t.side === 'buy' ? 'Long' : 'Short'}</td><td>{t.lotSize == null || t.lotSize === '' || !Number.isFinite(Number(t.lotSize)) ? '—' : Number(t.lotSize).toLocaleString()}</td><td><span className="grade">{t.grade || '—'}</span></td><td>{t.images?.length ? <span className="evidence-count"><Camera size={12} /> {t.images.length}</span> : <span className="no-evidence">—</span>}</td><td className={t.pnl >= 0 ? 'positive' : 'negative'}><b>{money(t.pnl)}</b></td><td className="row-actions"><button className="view-trade-action" onClick={() => onView(t)} title="View journal entry"><Eye size={12} /> View</button><button className="review-action" onClick={() => onReview(t)}><ClipboardCheck size={12} /> {reviewed ? 'Edit review' : 'Add review'}</button><button className="edit-trade-action" onClick={() => onReview(t)} title="Edit saved trade" aria-label="Edit saved trade"><Pencil size={13} /></button><button className="note-trade-action" onClick={() => onAddNote(t)} title="Append note" aria-label="Append note"><Plus size={13} /></button><button className="icon-danger" onClick={() => onDelete(t.id)} title="Delete trade" aria-label="Delete trade"><Trash2 size={14} /></button></td></tr>; })}</tbody></table></div> : <EmptyState icon={BookOpen} title="No matching journal entries" text={trades.length ? 'Change your search to see more trades.' : 'Your journal is empty. Click a calendar date to add your first real trade.'} />}</section>{selectedDate && <JournalDayPanel date={selectedDate} trades={trades} sessions={sessions} onClose={() => setSelectedDate(null)} onAdd={addFromDay} onView={onView} onReview={onReview} onAddNote={onAddNote} onDelete={onDelete} />}</div>;
}

function JournalCalendar({ trades, sessions, month, setMonth, onSelect }) {
  const year = month.getFullYear(), m = month.getMonth(), first = (new Date(year, m, 1).getDay() + 6) % 7, count = new Date(year, m + 1, 0).getDate();
  const byDay = {}; trades.forEach(t => { const d = new Date(t.date); if (d.getFullYear() === year && d.getMonth() === m) { const day = d.getDate(); byDay[day] ||= { pnl: 0, count: 0 }; byDay[day].pnl += t.pnl; byDay[day].count++; } });
  const sessionsByDay = {}; sessions.forEach(session => { const d = new Date(session.acknowledgedAt || session.completedAt); if (d.getFullYear() === year && d.getMonth() === m) sessionsByDay[d.getDate()] = (sessionsByDay[d.getDate()] || 0) + 1; });
  return <section className="surface calendar-card"><div className="calendar-head"><div><p>MONTHLY PERFORMANCE</p><h2>{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h2><small>Click any date to open its complete trading memory</small></div><div><button onClick={() => setMonth(new Date(year, m - 1, 1))} aria-label="Previous month">←</button><button onClick={() => setMonth(new Date(year, m + 1, 1))} aria-label="Next month">→</button></div></div><div className="week-labels">{['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar-days">{Array.from({ length: first + count }, (_, i) => { const day = i - first + 1, result = byDay[day], sessionCount = sessionsByDay[day] || 0, today = new Date(), isCurrentDay = today.getFullYear() === year && today.getMonth() === m && today.getDate() === day; return day < 1 ? <div className="calendar-blank" key={i} /> : <button type="button" key={i} className={`calendar-day ${result ? (result.pnl >= 0 ? 'win-day' : 'loss-day') : ''} ${sessionCount ? 'has-session' : ''} ${isCurrentDay ? 'today-date' : ''}`} onClick={() => onSelect(new Date(year, m, day, 12))} aria-label={`Open trading memory for ${month.toLocaleString('en-US', { month: 'long' })} ${day}, ${year}`}><span>{day}</span>{isCurrentDay && <u className="today-marker">TODAY</u>}<i><ChevronRight size={13} /></i>{sessionCount > 0 && <mark><ShieldCheck size={10} />{sessionCount}</mark>}{result ? <><b>{money(result.pnl)}</b><small>{result.count} trade{result.count !== 1 && 's'}</small></> : <em>View day</em>}</button>; })}</div></section>;
}

function JournalDayPanel({ date, trades, sessions, onClose, onAdd, onView, onReview, onAddNote, onDelete }) {
  const key = localDateKey(date);
  const dayTrades = trades.filter(trade => localDateKey(trade.date) === key).sort((a, b) => b.date.localeCompare(a.date));
  const daySessions = sessions.filter(session => localDateKey(session.acknowledgedAt || session.completedAt) === key).sort((a, b) => (b.acknowledgedAt || b.completedAt).localeCompare(a.acknowledgedAt || a.completedAt));
  const pnl = dayTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const wins = dayTrades.filter(trade => trade.pnl > 0).length;
  const addTrade = () => { const now = new Date(); onAdd(new Date(date.getFullYear(), date.getMonth(), date.getDate(), now.getHours(), now.getMinutes())); };
  const deleteTrade = trade => {
    if (window.confirm(`Delete ${INSTRUMENTS[trade.symbol]?.label || trade.symbol} · ${trade.setup || 'trade'} from this day? This cannot be undone.`)) onDelete(trade.id);
  };
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const close = event => event.key === 'Escape' && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);
  return <div className="day-panel-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><aside className="journal-day-panel" role="dialog" aria-modal="true" aria-label={`Trading memory for ${date.toLocaleDateString()}`}><header><div><p>TRADING MEMORY</p><h2>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2><span>{date.getFullYear()}</span></div><div className="day-panel-header-actions"><button type="button" className="secondary-button" onClick={onClose}>Close</button><button type="button" className="primary-button" onClick={addTrade}><Plus size={15} /> Add trade</button></div></header><div className="day-summary"><article><span>NET P&amp;L</span><b className={pnl >= 0 ? 'positive' : 'negative'}>{dayTrades.length ? money(pnl) : '—'}</b></article><article><span>TRADES</span><b>{dayTrades.length}</b></article><article><span>WIN RATE</span><b>{dayTrades.length ? `${(wins / dayTrades.length * 100).toFixed(0)}%` : '—'}</b></article><article><span>CHECK-INS</span><b>{daySessions.length}</b></article></div><div className="day-panel-scroll"><section className="day-memory-section"><div className="day-section-title"><div><p>PRE-CHECK MEMORY</p><h3>Trading sessions</h3></div><span>{daySessions.length}</span></div>{daySessions.length ? daySessions.map(session => <article className="saved-session-card" key={session.id}><div className="saved-session-head"><div><span className="status-dot" /> <b>Acknowledged session</b><small>{new Date(session.acknowledgedAt || session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div><mark>{session.emotion}</mark></div><div className="saved-checks">{session.answers.map((answer, index) => <div key={`${session.id}-${index}`}><span className={answer.result}><i>{answer.result === 'green' ? <Check size={11} /> : <X size={11} />}</i><b>Q{index + 1}</b></span><div><strong>{answer.question}</strong><small>{answer.note || 'No context note added.'}</small></div></div>)}</div></article>) : <div className="day-empty"><ClipboardCheck size={19} /><div><b>No acknowledged pre-check</b><span>Complete and acknowledge an Elefin check-in to attach it here.</span></div></div>}</section><section className="day-memory-section"><div className="day-section-title"><div><p>EXECUTION RESULTS</p><h3>Journal trades</h3></div><span>{dayTrades.length}</span></div>{dayTrades.length ? <div className="day-trade-list">{dayTrades.map(trade => <article key={trade.id}><Instrument symbol={trade.symbol} /><div className="day-trade-details"><b>Setup · {trade.setup || 'None'}</b><small>{trade.side === 'buy' ? 'Long' : 'Short'} · Open {trade.entry == null || trade.entry === '' || !Number.isFinite(Number(trade.entry)) ? '—' : formatQuote(Number(trade.entry))} · Close {trade.exit == null || trade.exit === '' || !Number.isFinite(Number(trade.exit)) ? '—' : formatQuote(Number(trade.exit))} · {trade.lotSize == null || trade.lotSize === '' || !Number.isFinite(Number(trade.lotSize)) ? '—' : trade.lotSize} lots</small></div><strong className={trade.pnl >= 0 ? 'positive' : 'negative'}>{money(trade.pnl)}</strong><div className="day-trade-actions"><button className="day-view-action" onClick={() => { onClose(); onView(trade); }}><Eye size={12} /> View</button><button className="day-review-action" onClick={() => { onClose(); onReview(trade); }}><ClipboardCheck size={12} /> {trade.note || trade.management ? 'Review' : 'Add review'}</button><button className="day-edit-action" onClick={() => { onClose(); onReview(trade); }}><Pencil size={12} /> Edit</button><button className="day-note-action" onClick={() => { onClose(); onAddNote(trade); }}><Plus size={12} /> Note</button><button className="day-delete-action" onClick={() => deleteTrade(trade)} title="Delete this trade" aria-label={`Delete ${trade.setup || 'trade'}`}><Trash2 size={13} /></button></div></article>)}</div> : <div className="day-empty"><BookOpen size={19} /><div><b>No trades logged</b><span>Add a real journal trade for this date to update the summary and analytics.</span></div></div>}</section></div></aside></div>;
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
  const profitFactor = grossLoss ? grossWin / grossLoss : null;
  const metrics = [
    ['Net P&L', money(equity), metricTone(equity)],
    ['Profit factor', profitFactor === null ? '—' : profitFactor.toFixed(2), profitFactor === null ? 'neutral' : profitFactor >= 1 ? 'gain' : 'loss'],
    ['Expectancy', expectancy === null ? '—' : money(expectancy), expectancy === null ? 'neutral' : metricTone(expectancy)],
    ['Avg. winner', wins.length ? money(grossWin / wins.length) : '—', wins.length ? 'gain' : 'neutral'],
    ['Max drawdown', trades.length ? `−${plainMoney(maxDrawdown)}` : '—', trades.length && maxDrawdown > 0 ? 'loss' : 'neutral'],
  ];
  const bySetup = trades.reduce((map, t) => { const key = t.setup || 'Unlabelled'; map[key] ||= { value: 0, count: 0 }; map[key].value += t.pnl; map[key].count++; return map; }, {});
  const byEmotion = trades.reduce((map, t) => { const key = t.emotion || 'Unlabelled'; map[key] ||= { value: 0, count: 0 }; map[key].value += t.pnl; map[key].count++; return map; }, {});
  return <div className="page-stack"><div className="page-intro"><div><p>PERFORMANCE INTELLIGENCE</p><h2>Know exactly where your edge lives.</h2><span>Journal trades and acknowledged pre-checks update these insights automatically.</span></div></div><div className="analytics-metrics">{metrics.map(([label, value, tone]) => <article className={`surface analytics-metric ${tone}`} key={label}><span>{label}</span><b>{value}</b></article>)}</div><PerformanceCharts trades={trades} theme={theme} /><SessionAnalytics sessions={sessions} trades={trades} theme={theme} /><div className="analytics-grid"><Breakdown title="Performance by setup" eyebrow="PLAYBOOK" data={bySetup} theme={theme} /><Breakdown title="Performance by emotion" eyebrow="PSYCHOLOGY" data={byEmotion} theme={theme} /><PlanImpact trades={trades} /><DayPerformance trades={trades} /></div></div>;
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
  const tooltip = { triggerOn: 'mousemove', alwaysShowContent: false, hideDelay: 80, enterable: false, confine: true, backgroundColor: theme === 'dark' ? '#07101d' : '#fff', borderColor: theme === 'dark' ? '#1d3857' : '#dce5f2', textStyle: { color: ink, fontSize: 15 } };
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
  const plannedAverage = avg(planned), offPlanAverage = avg(offPlan);
  return <section className="surface breakdown-card"><SectionTitle eyebrow="DISCIPLINE" title="Plan impact" /><div className="impact-grid"><div><span>Plan followed</span><b className={plannedAverage === null ? 'neutral-value' : valueTone(plannedAverage)}>{plannedAverage === null ? '—' : money(plannedAverage)}</b><small>average · {planned.length} trades</small></div><div className="off-plan"><span>Off-plan</span><b className={offPlanAverage === null ? 'neutral-value' : valueTone(offPlanAverage)}>{offPlanAverage === null ? '—' : money(offPlanAverage)}</b><small>average · {offPlan.length} trades</small></div></div></section>;
}

function DayPerformance({ trades }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) + weekOffset * 7);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
  const weekTrades = trades.filter(trade => { const date = new Date(trade.date); return date >= weekStart && date < weekEnd; });
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], values = days.map((_, index) => weekTrades.filter(t => (new Date(t.date).getDay() + 6) % 7 === index).reduce((s, t) => s + t.pnl, 0));
  const max = Math.max(1, ...values.map(Math.abs));
  const rangeEnd = new Date(weekEnd); rangeEnd.setDate(rangeEnd.getDate() - 1);
  const range = `${weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${rangeEnd.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  return <section className="surface breakdown-card weekday-card"><div className="weekday-head"><SectionTitle eyebrow="TIMING" title="Weekday rhythm" /><div className="week-nav"><button type="button" onClick={() => setWeekOffset(offset => offset - 1)} aria-label="Previous week"><ChevronLeft size={15} /></button><span>{range}</span><button type="button" onClick={() => setWeekOffset(offset => Math.min(0, offset + 1))} disabled={weekOffset >= 0} aria-label="Next week"><ChevronRight size={15} /></button></div></div><div className="day-bars">{days.map((day, i) => <div key={day}><span className={valueTone(values[i])}>{money(values[i])}</span><i className={values[i] < 0 ? 'red' : ''} style={{ height: `${Math.max(4, Math.abs(values[i]) / max * 125)}px` }} /><b>{day}</b></div>)}</div></section>;
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

function Plans({ plans, trades = [], patch, onAdd, onView, onEdit }) {
  const strategyUsage = plans.map(plan => ({ plan, count: trades.filter(trade => trade.playbookId === plan.id || trade.playbookName === plan.name || trade.setup === plan.name).length })).sort((a, b) => b.count - a.count);
  const mostUsed = strategyUsage[0]?.count ? strategyUsage[0] : null;
  return <div className="page-stack"><div className="plans-summary-row"><section className="command-banner playbook-banner strategy-usage-banner"><div className="command-side"><div><span>MOST USED STRATEGY</span><b>{mostUsed?.plan.name || 'No strategy data yet'}</b><small>{mostUsed ? mostUsed.plan.market || 'All connected markets' : 'Use a saved playbook on a journal trade to rank it'}</small></div><em className="strategy-use-count">{mostUsed?.count || 0}<small> trades</small></em></div></section><button className="primary-button plans-new-flow" onClick={onAdd}><Plus size={16} /> New flow</button></div>{plans.length ? <div className="plan-grid">{plans.map(plan => {
    const flow = plan.flow?.length ? plan.flow : (plan.rules || []).map((text, index) => ({ id: `${plan.id}-${index}`, type: index === 0 ? 'Trigger' : index === (plan.rules || []).length - 1 ? 'Entry' : 'Confirmation', text }));
    const tradeCount = trades.filter(trade => trade.playbookId === plan.id || trade.playbookName === plan.name || trade.setup === plan.name).length;
    return <article className={`surface plan-card ${plan.active ? 'active' : ''}`} key={plan.id}><div className="plan-top"><span>{plan.active ? '● ACTIVE PLAYBOOK' : 'TRADE PLAYBOOK'}</span><div className="plan-top-meta"><span className="plan-trade-count"><b>{tradeCount}</b> {tradeCount === 1 ? 'trade' : 'trades'}</span><Target size={18} /></div></div><h2>{plan.name}</h2><p>{plan.market || 'All connected markets'}</p>{plan.timeframeLocked && plan.timeframe ? <span className="plan-timeframe-badge">{plan.timeframe} strategy</span> : null}{plan.images?.length ? <div className="plan-image-strip">{plan.images.slice(0, 3).map((image, index) => <figure key={image.id || index}><img src={image.url} alt={`${plan.name} example ${index + 1}`} />{index === 2 && plan.images.length > 3 && <span>+{plan.images.length - 3}</span>}</figure>)}</div> : null}{plan.entryModel && <div className="plan-thesis"><small>ENTRY MODEL</small><b>{plan.entryModel}</b></div>}<div className="plan-rule-counts"><span><b>{plan.entryCriteria?.length || 0}</b> entry criteria</span><span><b>{plan.managementRules?.length || 0}</b> management rules</span><span><b>{plan.exitCriteria?.length || 0}</b> exits</span></div>{flow.length ? <PlaybookFlow steps={flow} compact /> : null}<footer><button onClick={() => patch(next => next.plans.forEach(p => p.active = p.id === plan.id))}>{plan.active ? 'Currently active' : 'Set active'}</button><button className="plan-view-button" onClick={() => onView(plan)}><Eye size={13} /> View</button><button className="plan-edit-button" onClick={() => onEdit(plan)}><Pencil size={13} /> Edit</button><button className="icon-danger" onClick={() => patch(next => next.plans = next.plans.filter(p => p.id !== plan.id))}><Trash2 size={14} /></button></footer></article>;
  })}</div> : <EmptyState large icon={Target} title="Build your first trading flow" text="Use the New flow button above to map context, confirmation, execution and review." />}</div>;
}

function PlaybookFlow({ steps, compact = false }) {
  return <div className={`playbook-flow ${compact ? 'compact' : ''}`}>{steps.map((step, index) => <React.Fragment key={step.id || `${step.type}-${index}`}><div className={`flow-node type-${String(step.type || 'step').toLowerCase()}`}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{[step.scope, step.type || 'Step'].filter(Boolean).join(' · ')}</small><b>{step.text?.trim() || 'Define this step'}</b></div></div>{index < steps.length - 1 && <div className="flow-connector"><i /><ChevronDown size={13} /></div>}</React.Fragment>)}</div>;
}

function PlaybookViewModal({ plan, onClose, onEdit }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const sections = [
    ['Entry criteria', plan.entryCriteria || []],
    ['Management rules', plan.managementRules || []],
    ['Exit criteria', plan.exitCriteria || []],
  ];
  useEffect(() => {
    if (!selectedImage) return undefined;
    const closeOnEscape = event => event.key === 'Escape' && setSelectedImage(null);
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedImage]);
  return <><Modal drawer panelClassName="playbook-view-drawer" onClose={onClose} eyebrow={plan.active ? 'ACTIVE PLAYBOOK' : 'TRADE PLAYBOOK'} title={plan.name}>
    <div className="playbook-view-content">
      <section className="playbook-view-summary">
        <div><small>Market focus</small><b>{plan.market || 'All connected markets'}</b></div>
        <div><small>Timeframe</small><b>{plan.timeframeLocked && plan.timeframe ? plan.timeframe : 'Any timeframe'}</b></div>
        <span className={plan.active ? 'active' : ''}>{plan.active ? 'Currently active' : 'Inactive'}</span>
      </section>
      <section className="playbook-view-section"><header>Entry model</header><p>{plan.entryModel || 'No entry model recorded.'}</p></section>
      <div className="playbook-view-rules">{sections.map(([title, rules]) => <section className="playbook-view-section" key={title}><header><span>{title}</span><b>{rules.length}</b></header>{rules.length ? <ol>{rules.map((rule, index) => <li key={`${title}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{rule}</p></li>)}</ol> : <p className="playbook-view-empty-copy">None recorded.</p>}</section>)}</div>
      <section className="playbook-view-section">
        <header><span>Screenshots</span><b>{plan.images?.length || 0}</b></header>
        {plan.images?.length ? <div className="playbook-view-images">{plan.images.map((image, index) => <button type="button" key={image.id || index} onClick={() => setSelectedImage({ ...image, index })} aria-label={`Open ${image.name || `screenshot ${index + 1}`} fullscreen`}><span className="playbook-image-frame"><img src={image.url} alt={image.name || `${plan.name} screenshot ${index + 1}`} /><i><Maximize2 size={15} /></i></span><span>{image.name || `Screenshot ${index + 1}`}</span></button>)}</div> : <div className="playbook-view-empty"><Camera size={18} /> No screenshots attached</div>}
      </section>
      <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Close</button><button type="button" className="primary-button" onClick={onEdit}><Pencil size={14} /> Edit playbook</button></div>
    </div>
  </Modal>{selectedImage && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Fullscreen playbook screenshot" onMouseDown={event => event.target === event.currentTarget && setSelectedImage(null)}><header><div><small>PLAYBOOK SCREENSHOT</small><b>{selectedImage.name || `Screenshot ${selectedImage.index + 1}`}</b></div><div><a href={selectedImage.url} target="_blank" rel="noreferrer" title="Open original in new tab"><ExternalLink size={17} /></a><button type="button" onClick={() => setSelectedImage(null)} aria-label="Close fullscreen screenshot"><X size={20} /></button></div></header><div className="image-lightbox-stage"><img src={selectedImage.url} alt={selectedImage.name || `${plan.name} fullscreen screenshot`} /></div></div>}</>;
}

function RiskSettings({ settings, patch, account, identity, syncStatus }) {
  const [form, setForm] = useState(settings), save = e => { e.preventDefault(); patch(next => next.settings = { ...form }); };
  return <div className="settings-layout risk-control-layout">
    <form className="surface settings-form risk-control-form" onSubmit={save}>
      <SectionTitle eyebrow="ACCOUNT LIMITS" title={`${account.name} controls`} />
      <div className="settings-grid">
        <Field label="Starting account balance"><NumberField value={form.startingBalance} onChange={value => setForm({ ...form, startingBalance: value })} prefix="$" /></Field>
        <Field label="Maximum daily loss"><NumberField value={form.maxDailyLoss} onChange={value => setForm({ ...form, maxDailyLoss: value })} prefix="$" /></Field>
        <Field label="Maximum trades per day"><NumberField value={form.maxTrades} onChange={value => setForm({ ...form, maxTrades: value })} /></Field>
        <Field label="Default risk per trade"><NumberField value={form.riskPerTrade} onChange={value => setForm({ ...form, riskPerTrade: value })} prefix="$" /></Field>
      </div>
      <button className="primary-button save-settings">Save controls</button>
    </form>
    <aside className="risk-control-aside">
      <section className="risk-control-preview">
        <header><span><ShieldCheck size={18} /></span><div><small>LIVE LIMITS</small><h2>{account.name}</h2></div></header>
        <div className="risk-preview-list"><div><span>Starting balance</span><b>{plainMoney(Number(form.startingBalance) || 0)}</b></div><div><span>Daily loss ceiling</span><b>{plainMoney(Number(form.maxDailyLoss) || 0)}</b></div><div><span>Trades per day</span><b>{Number(form.maxTrades) || 0}</b></div><div><span>Risk per trade</span><b>{plainMoney(Number(form.riskPerTrade) || 0)}</b></div></div>
      </section>
      <section className="surface access-settings"><div><span><Database size={17} /></span><div><p>CLOUDFLARE D1</p><h3>{syncStatus === 'saving' ? 'Saving cloud workspace…' : 'Cloud workspace connected'}</h3><small>{identity?.email || 'Cloudflare Access user'} · Every account, journal entry, plan and session is isolated to this identity.</small></div></div></section>
    </aside>
  </div>;
}

function TradeModal({ plans = [], initialDate, onClose, onSave }) {
  const defaultPlan = plans.find(plan => plan.active) || null;
  const [form, setForm] = useState({ symbol: 'XAUUSD', side: 'buy', setup: 'None', lotSize: '', entry: '', exit: '', pnl: '', fees: 0, emotion: 'Focused', exitEmotion: 'Focused', grade: 'A', management: '', mistakes: '', note: '', images: [], plan: Boolean(defaultPlan), playbookId: defaultPlan?.id || '', playbookName: defaultPlan?.name || '', date: toLocalDateTimeValue(initialDate || new Date()) });
  const [customSetup, setCustomSetup] = useState(false);
  const [error, setError] = useState('');
  const submit = e => {
    e.preventDefault();
    if (!form.setup.trim() || form.pnl === '') return setError('Choose a setup and enter the net P&L.');
    const pnl = Number(form.pnl), fees = Number(form.fees || 0);
    const entry = form.entry === '' ? null : Number(form.entry), exit = form.exit === '' ? null : Number(form.exit), lotSize = form.lotSize === '' ? null : Number(form.lotSize);
    if (!Number.isFinite(pnl) || !Number.isFinite(fees) || (entry !== null && !Number.isFinite(entry)) || (exit !== null && !Number.isFinite(exit)) || (lotSize !== null && (!Number.isFinite(lotSize) || lotSize <= 0))) return setError('Check the P&L, fees, prices and lot size.');
    const selectedPlaybook = plans.find(plan => plan.id === form.playbookId);
    onSave({ ...form, plan: Boolean(selectedPlaybook), playbookId: selectedPlaybook?.id || null, playbookName: selectedPlaybook?.name || '', pnl: pnl - fees, fees, entry, exit, lotSize, date: new Date(form.date).toISOString(), timeZone: USER_TIME_ZONE });
  };
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const selectSetup = value => {
    const addingCustom = value === '__custom__';
    const selectedPlaybook = plans.find(plan => plan.name === value);
    setCustomSetup(addingCustom);
    setForm(current => ({
      ...current,
      setup: addingCustom ? '' : value,
      plan: Boolean(selectedPlaybook),
      playbookId: selectedPlaybook?.id || '',
      playbookName: selectedPlaybook?.name || '',
    }));
  };
  const selectFollowedPlaybook = playbookId => {
    const selected = plans.find(plan => plan.id === playbookId);
    setForm(current => ({ ...current, plan: Boolean(selected), playbookId: selected?.id || '', playbookName: selected?.name || '' }));
  };
  return <Modal drawer onClose={onClose} eyebrow="New journal entry" title={initialDate ? `Add trade · ${new Date(initialDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Record a completed trade'}><form className="journal-entry-form" onSubmit={submit}><section className="journal-form-section"><header><span>01</span><div><small>TRADE DETAILS</small><b>Execution facts</b></div></header><div className="modal-grid"><Field label="Instrument"><select value={form.symbol} onChange={e => field('symbol', e.target.value)}><option value="BTCUSD">BTC / USD</option><option value="XAUUSD">XAU / USD</option><option value="EURUSD">EUR / USD</option><option value="NAS100">NAS100</option></select></Field><Field label="Direction"><select value={form.side} onChange={e => field('side', e.target.value)}><option value="buy">Long / Buy</option><option value="sell">Short / Sell</option></select></Field><Field label="Setup name"><select value={customSetup ? '__custom__' : form.setup} onChange={e => selectSetup(e.target.value)}><option value="None">None used</option>{plans.length ? <optgroup label="Saved playbooks">{plans.map(plan => <option key={plan.id} value={plan.name}>{plan.name}{plan.active ? ' · Active' : ''}</option>)}</optgroup> : <option disabled>No saved playbooks in this account</option>}<option value="__custom__">+ Add custom setup…</option></select>{plans.length > 0 && <div className="setup-playbook-quicklist" aria-label="Saved playbooks">{plans.map(plan => <button type="button" key={plan.id} className={form.playbookId === plan.id ? 'active' : ''} onClick={() => selectSetup(plan.name)}><Target size={11} />{plan.name}{plan.active ? <small>Active</small> : null}</button>)}</div>}{customSetup && <input className="custom-setup-input" value={form.setup} onChange={e => field('setup', e.target.value)} placeholder="Enter setup name" autoFocus />}</Field><Field label={`Trade time · ${USER_TIME_ZONE_LABEL}`}><input type="datetime-local" value={form.date} onChange={e => field('date', e.target.value)} /></Field><Field label="Lot size"><DecimalInput value={form.lotSize} onChange={value => field('lotSize', value)} placeholder="e.g. 0.10" /></Field><Field label="Open price"><DecimalInput value={form.entry} onChange={value => field('entry', value)} placeholder="Optional" /></Field><Field label="Close price"><DecimalInput value={form.exit} onChange={value => field('exit', value)} placeholder="Optional" /></Field><Field label="Gross P&L"><NumberField value={form.pnl} onChange={value => field('pnl', value)} prefix="$" /></Field><Field label="Fees"><NumberField value={form.fees} onChange={value => field('fees', value)} prefix="$" /></Field></div></section><section className="journal-form-section"><header><span>02</span><div><small>PROCESS REVIEW</small><b>Management and psychology</b></div></header><div className="modal-grid"><Field label="Entry emotion"><select value={form.emotion} onChange={e => field('emotion', e.target.value)}><option>Focused</option><option>Confident</option><option>Anxious</option><option>FOMO</option><option>Frustrated</option></select></Field><Field label="Exit emotion"><select value={form.exitEmotion} onChange={e => field('exitEmotion', e.target.value)}><option>Focused</option><option>Confident</option><option>Relieved</option><option>Disappointed</option><option>Frustrated</option></select></Field><Field label="Trade management"><input value={form.management} onChange={e => field('management', e.target.value)} placeholder="e.g. Partial at 1R, stop to BE" /></Field><Field label="Mistakes / rule breaks"><input value={form.mistakes} onChange={e => field('mistakes', e.target.value)} placeholder="Optional" /></Field><Field label="Execution grade"><select value={form.grade} onChange={e => field('grade', e.target.value)}><option>A+</option><option>A</option><option>B</option><option>C</option><option>D</option><option>F</option></select></Field><Field label="Playbook followed"><select value={form.playbookId} onChange={e => selectFollowedPlaybook(e.target.value)}><option value="">Off-plan / no playbook followed</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}{plan.active ? ' · Active' : ''}</option>)}</select></Field></div><Field label="Additional notes"><textarea value={form.note} onChange={e => field('note', e.target.value)} placeholder="What worked? What did you feel? What will you repeat or change?" /></Field></section><ImageUploader images={form.images} onChange={images => field('images', images)} title="Chart evidence" help="Add MTF, HTF, LTF, entry and exit screenshots." />{error && <div className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Save complete review</button></div></form></Modal>;
}

function LegacyPlanModal({ initialPlan, onClose, onSave }) {
  const makeStep = (type = 'Confirmation', scope = 'STF') => ({ id: uid(), type, scope, text: '' });
  const originalFlow = initialPlan?.flow || [];
  const existingEvidence = initialPlan?.timeframeImages || {};
  const initialEvidence = FLOW_SCOPES.reduce((result, scope) => {
    result[scope] = Array.isArray(existingEvidence[scope]) ? existingEvidence[scope] : Object.entries(existingEvidence).filter(([key, value]) => key.startsWith(`${scope}:`) && Array.isArray(value)).flatMap(([, value]) => value);
    return result;
  }, {});
  const [name, setName] = useState(initialPlan?.name || ''), [market, setMarket] = useState(initialPlan?.market || ''), [entryModel, setEntryModel] = useState(initialPlan?.entryModel || ''), [entryCriteria, setEntryCriteria] = useState((initialPlan?.entryCriteria || []).join('\n')), [managementRules, setManagementRules] = useState((initialPlan?.managementRules || []).join('\n')), [exitCriteria, setExitCriteria] = useState((initialPlan?.exitCriteria || []).join('\n')), [images, setImages] = useState(initialPlan?.images || []), [steps, setSteps] = useState(() => originalFlow.length ? originalFlow.map((step, index) => { const { timeframe, ...savedStep } = step; return { ...savedStep, scope: step.scope || (index === 0 ? 'HTF' : index === originalFlow.length - 1 ? 'STF' : 'MTF') }; }) : [makeStep('Context', 'HTF'), makeStep('Trigger', 'MTF'), makeStep('Entry', 'STF')]), [flowScope, setFlowScope] = useState('HTF'), [error, setError] = useState('');
  const [timeframeImages, setTimeframeImages] = useState(initialEvidence);
  const visibleSteps = steps.filter(step => step.scope === flowScope);
  const updateStep = (id, changes) => setSteps(current => current.map(step => step.id === id ? { ...step, ...changes } : step));
  const moveStep = (id, direction) => setSteps(current => {
    const visibleIds = current.filter(step => step.scope === flowScope).map(step => step.id);
    const visibleIndex = visibleIds.indexOf(id), targetId = visibleIds[visibleIndex + direction];
    if (!targetId) return current;
    const index = current.findIndex(step => step.id === id), target = current.findIndex(step => step.id === targetId), next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const moveScopeStep = (scope, id, direction) => setSteps(current => {
    const scopeIds = current.filter(step => step.scope === scope).map(step => step.id);
    const scopeIndex = scopeIds.indexOf(id), targetId = scopeIds[scopeIndex + direction];
    if (!targetId) return current;
    const index = current.findIndex(step => step.id === id), target = current.findIndex(step => step.id === targetId), next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const removeStep = id => setSteps(current => current.length === 1 ? current : current.filter(step => step.id !== id));
  const submit = e => {
    e.preventDefault();
    const flow = steps.map(step => ({ ...step, text: step.text.trim() })).filter(step => step.text);
    const entries = listFromText(entryCriteria), management = listFromText(managementRules), exits = listFromText(exitCriteria);
    if (!name.trim() || !entryModel.trim() || !entries.length || !flow.length) return setError('Add a playbook name, entry model, entry criteria and at least one flow node.');
    onSave({ ...initialPlan, id: initialPlan?.id || uid(), name: name.trim(), market: market.trim(), entryModel: entryModel.trim(), entryCriteria: entries, managementRules: management, exitCriteria: exits, images, timeframeImages, flow, timeframes: undefined, rules: flow.map(step => step.text), active: initialPlan?.active || false });
  };
  return <Modal drawer onClose={onClose} eyebrow={initialPlan ? 'Edit trade playbook' : 'New trade playbook'} title={initialPlan ? `Refine ${initialPlan.name}` : 'Define the full execution model'}><form className="playbook-flow-form" onSubmit={submit}><div className="flow-meta"><Field label="Playbook name"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. London liquidity sweep" autoFocus /></Field><Field label="Market focus"><input value={market} onChange={e => setMarket(e.target.value)} placeholder="e.g. XAUUSD · London session" /></Field></div><section className="playbook-definition"><header><div><p>PLAYBOOK DEFINITION</p><h3>What must be true before, during and after entry</h3></div></header><div className="plan-definition-grid"><Field label="Entry model"><textarea value={entryModel} onChange={e => setEntryModel(e.target.value)} placeholder="Describe the market context, setup and trigger in plain language." /></Field><Field label="Entry criteria · one per line"><textarea value={entryCriteria} onChange={e => setEntryCriteria(e.target.value)} placeholder={'HTF bias aligned\nLiquidity sweep confirmed\n5m displacement closes'} /></Field><Field label="Trade management rules · one per line"><textarea value={managementRules} onChange={e => setManagementRules(e.target.value)} placeholder={'Partial 50% at 1R\nMove stop to break-even after 1R\nNo add-ons after first target'} /></Field><Field label="Exit criteria · one per line"><textarea value={exitCriteria} onChange={e => setExitCriteria(e.target.value)} placeholder={'Target opposing liquidity\nExit if structure invalidates\nClose before session end'} /></Field></div><ImageUploader images={images} onChange={setImages} title="Setup and entry examples" help="Upload every chart example needed to recognize and execute this playbook." /></section><section className="flow-filterbar"><div className="flow-link-map">{FLOW_SCOPES.map((scope, index) => <React.Fragment key={scope}><button type="button" className={flowScope === scope ? 'active' : ''} onClick={() => setFlowScope(scope)}><b>{scope}</b><small>{(timeframeImages[scope] || []).length} screenshot{(timeframeImages[scope] || []).length === 1 ? '' : 's'}</small></button>{index < FLOW_SCOPES.length - 1 && <ChevronRight size={14} />}</React.Fragment>)}</div><em>{visibleSteps.length} visible node{visibleSteps.length === 1 ? '' : 's'}</em></section><div className="flow-evidence-row">{FLOW_SCOPES.map(scope => <section className={`flow-timeframe-evidence ${flowScope === scope ? 'active' : ''}`} key={scope}><button type="button" className="flow-evidence-heading" onClick={() => setFlowScope(scope)}><span><b>{scope}</b><small>{steps.filter(step => step.scope === scope).length} flow node{steps.filter(step => step.scope === scope).length === 1 ? '' : 's'}</small></span><ChevronRight size={14} /></button><ImageUploader images={timeframeImages[scope] || []} onChange={nextImages => setTimeframeImages(current => ({ ...current, [scope]: nextImages }))} title={`${scope} chart`} help={`Add ${scope} structure evidence.`} /></section>)}</div><div className="flow-steps-row">{FLOW_SCOPES.map(scope => { const scopeSteps = steps.filter(step => step.scope === scope); return <section className="flow-layer-steps" key={scope}><header><div><p>{scope} STEPS</p><h3>{scope} execution path</h3></div><button type="button" onClick={() => setSteps(current => [...current, makeStep('Confirmation', scope)])}><Plus size={12} /> Add step</button></header><div className="flow-layer-step-list">{scopeSteps.length ? scopeSteps.map((step, index) => <div className="flow-layer-step" key={step.id}><span>{String(index + 1).padStart(2, '0')}</span><select value={step.type} onChange={e => updateStep(step.id, { type: e.target.value })}>{FLOW_TYPES.map(type => <option key={type}>{type}</option>)}</select><input value={step.text} onChange={e => updateStep(step.id, { text: e.target.value })} placeholder={`Add ${scope} condition or action`} /><div><button type="button" disabled={index === 0} onClick={() => moveScopeStep(scope, step.id, -1)} aria-label={`Move ${scope} step up`}>↑</button><button type="button" disabled={index === scopeSteps.length - 1} onClick={() => moveScopeStep(scope, step.id, 1)} aria-label={`Move ${scope} step down`}>↓</button><button type="button" disabled={steps.length === 1} onClick={() => removeStep(step.id)} aria-label={`Delete ${scope} step`}><Trash2 size={12} /></button></div></div>) : <div className="flow-filter-empty layer-empty"><Target size={16} /><b>No {scope} steps</b><span>Add the first condition for this layer.</span></div>}</div></section>; })}</div><div className="flow-builder-layout"><section className="flow-editor"><header><div><p>{flowScope}</p><h3>Build the execution sequence</h3></div><button type="button" onClick={() => setSteps(current => [...current, makeStep('Confirmation', flowScope)])}><Plus size={13} /> Add node</button></header><div className="flow-step-editor-list">{visibleSteps.length ? visibleSteps.map((step, index) => <div className="flow-step-editor" key={step.id}><span>{String(index + 1).padStart(2, '0')}</span><select value={step.type} onChange={e => updateStep(step.id, { type: e.target.value })}>{FLOW_TYPES.map(type => <option key={type}>{type}</option>)}</select><select value={step.scope} onChange={e => updateStep(step.id, { scope: e.target.value })}>{FLOW_SCOPES.map(scope => <option key={scope}>{scope}</option>)}</select><input value={step.text} onChange={e => updateStep(step.id, { text: e.target.value })} placeholder="Describe the condition or action" /><div><button type="button" disabled={index === 0} onClick={() => moveStep(step.id, -1)} aria-label="Move node up">↑</button><button type="button" disabled={index === visibleSteps.length - 1} onClick={() => moveStep(step.id, 1)} aria-label="Move node down">↓</button><button type="button" disabled={steps.length === 1} onClick={() => removeStep(step.id)} aria-label="Delete node"><Trash2 size={12} /></button></div></div>) : <div className="flow-filter-empty"><Target size={18} /><b>No {flowScope} nodes yet</b><span>Add a node to build this structure layer.</span></div>}</div></section><section className="flow-preview"><header><div><p>LIVE GRAPH</p><h3>{flowScope}</h3></div><span>{visibleSteps.length} node{visibleSteps.length === 1 ? '' : 's'}</span></header>{visibleSteps.length ? <PlaybookFlow steps={visibleSteps} /> : <div className="flow-filter-empty compact"><Target size={18} /><span>Nothing to display for this layer.</span></div>}</section></div>{error && <div className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">{initialPlan ? 'Save strategy changes' : 'Save complete playbook'}</button></div></form></Modal>;
}

function PlanModal({ initialPlan, onClose, onSave }) {
  const legacyEvidence = Object.values(initialPlan?.timeframeImages || {})
    .filter(Array.isArray)
    .flat();
  const initialImages = [...(initialPlan?.images || []), ...legacyEvidence]
    .filter(Boolean)
    .filter((image, index, all) => all.findIndex(candidate => (candidate.id || candidate.url) === (image.id || image.url)) === index)
    .slice(0, MAX_IMAGES);
  const [name, setName] = useState(initialPlan?.name || '');
  const [market, setMarket] = useState(initialPlan?.market || '');
  const [timeframe, setTimeframe] = useState(initialPlan?.timeframeLocked === false ? '' : initialPlan?.timeframe || '');
  const [entryModel, setEntryModel] = useState(initialPlan?.entryModel || '');
  const [entryCriteria, setEntryCriteria] = useState((initialPlan?.entryCriteria || []).join('\n'));
  const [managementRules, setManagementRules] = useState((initialPlan?.managementRules || []).join('\n'));
  const [exitCriteria, setExitCriteria] = useState((initialPlan?.exitCriteria || []).join('\n'));
  const [images, setImages] = useState(initialImages);
  const [error, setError] = useState('');
  const submit = event => {
    event.preventDefault();
    const entries = listFromText(entryCriteria);
    const management = listFromText(managementRules);
    const exits = listFromText(exitCriteria);
    if (!name.trim() || !entryModel.trim() || !entries.length) {
      setError('Add a playbook name, entry model and at least one entry criterion.');
      return;
    }
    onSave({
      ...initialPlan,
      id: initialPlan?.id || uid(),
      name: name.trim(),
      market: market.trim(),
      entryModel: entryModel.trim(),
      entryCriteria: entries,
      managementRules: management,
      exitCriteria: exits,
      timeframe: timeframe || null,
      timeframeLocked: Boolean(timeframe),
      images,
      timeframeImages: initialPlan?.timeframeImages,
      flow: initialPlan?.flow || [],
      timeframes: undefined,
      rules: initialPlan?.rules || [],
      active: initialPlan?.active || false,
    });
  };

  return <Modal drawer expandable panelClassName="playbook-drawer" onClose={onClose} title={initialPlan ? 'Edit playbook' : 'New playbook'}>
    <form className="playbook-flow-form" onSubmit={submit}>
      <div className="playbook-form-scroll"><div className="flow-meta">
        <Field label="Playbook name"><input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. London liquidity sweep" autoFocus /></Field>
        <Field label="Market focus"><input value={market} onChange={event => setMarket(event.target.value)} placeholder="e.g. XAUUSD · London session" /></Field>
        <Field label="Strategy timeframe">
          <select value={timeframe} onChange={event => setTimeframe(event.target.value)}>
            <option value="">Any timeframe</option>
            {STRATEGY_TIMEFRAMES.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <small className={`timeframe-lock-note ${timeframe ? 'locked' : ''}`}>{timeframe ? `Locked to ${timeframe}` : 'Use across all timeframes'}</small>
        </Field>
      </div>
      <section className="playbook-definition simple-playbook-section">
        <header><h3>Playbook definition</h3></header>
        <div className="plan-definition-grid">
          <Field label="Entry model"><textarea value={entryModel} onChange={event => setEntryModel(event.target.value)} placeholder="Describe the market context, setup and trigger in plain language." /></Field>
          <Field label="Entry criteria"><textarea value={entryCriteria} onChange={event => setEntryCriteria(event.target.value)} placeholder="One criterion per line" /></Field>
          <Field label="Management rules"><textarea value={managementRules} onChange={event => setManagementRules(event.target.value)} placeholder="One rule per line" /></Field>
          <Field label="Exit criteria"><textarea value={exitCriteria} onChange={event => setExitCriteria(event.target.value)} placeholder="One condition per line" /></Field>
        </div>
      </section>
      <ImageUploader compact images={images} onChange={setImages} title="Strategy screenshot" />
      {error && <div className="form-error">{error}</div>}
      </div>
      <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">{initialPlan ? 'Save strategy changes' : 'Save complete playbook'}</button></div>
    </form>
  </Modal>;
}

function AccountModal({ onClose, onSave, required = false }) {
  const [form, setForm] = useState({ name: '', broker: '', type: 'Personal', startingBalance: 0 });
  const [error, setError] = useState('');
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = event => {
    event.preventDefault();
    if (!form.name.trim()) return setError('Enter an account name.');
    if (!Number.isFinite(Number(form.startingBalance)) || Number(form.startingBalance) < 0) return setError('Enter a valid starting balance.');
    onSave({ ...form, startingBalance: Number(form.startingBalance) });
  };
  return <Modal onClose={onClose} dismissible={!required} eyebrow={required ? 'FIRST ACCOUNT SETUP' : 'NEW TRADING ACCOUNT'} title={required ? 'Build your first trading workspace' : 'Create an isolated workspace'}><form onSubmit={submit}><div className="account-modal-intro"><WalletCards size={19} /><div><b>{required ? 'Your private workspace needs an account' : 'Independent performance memory'}</b><span>Trades, check-ins, playbooks, risk rules and analytics stay separated from every other account.</span></div></div><div className="modal-grid"><Field label="Account name"><input value={form.name} onChange={event => field('name', event.target.value)} placeholder="e.g. Personal live" autoFocus /></Field><Field label="Account type"><select value={form.type} onChange={event => field('type', event.target.value)}><option>Personal</option><option>Prop firm</option><option>Demo</option><option>Evaluation</option></select></Field><Field label="Broker / platform"><input value={form.broker} onChange={event => field('broker', event.target.value)} placeholder="e.g. Elefin" /></Field><Field label="Starting balance"><NumberField value={form.startingBalance} onChange={value => field('startingBalance', value)} prefix="$" /></Field></div>{error && <div className="form-error">{error}</div>}<div className="modal-footer">{!required && <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>}<button className="primary-button"><Plus size={15} /> {required ? 'Create first account' : 'Create account'}</button></div></form></Modal>;
}

function ReviewModal({ trade, plans = [], onClose, onSave }) {
  const [form, setForm] = useState({ ...trade, symbol: trade.symbol || 'XAUUSD', side: trade.side || 'buy', setup: trade.setup || '', lotSize: trade.lotSize ?? '', entry: trade.entry ?? '', exit: trade.exit ?? '', pnl: trade.pnl ?? '', fees: trade.fees || 0, emotion: trade.emotion || 'Focused', exitEmotion: trade.exitEmotion || 'Focused', grade: trade.grade || 'A', management: trade.management || '', mistakes: trade.mistakes || '', note: trade.note || '', images: trade.images || [], plan: Boolean(trade.plan), date: toLocalDateTimeValue(trade.date || new Date()) });
  const [customSetup, setCustomSetup] = useState(() => Boolean(trade.setup && trade.setup !== 'None' && !plans.some(plan => plan.name === trade.setup)));
  const [error, setError] = useState('');
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const selectSetup = value => {
    const addingCustom = value === '__custom__';
    const selectedPlaybook = plans.find(plan => plan.name === value);
    setCustomSetup(addingCustom);
    setForm(current => ({ ...current, setup: addingCustom ? '' : value, plan: Boolean(selectedPlaybook), playbookId: selectedPlaybook?.id || '', playbookName: selectedPlaybook?.name || '' }));
  };
  const selectFollowedPlaybook = playbookId => {
    const selectedPlaybook = plans.find(plan => plan.id === playbookId);
    setForm(current => ({ ...current, plan: Boolean(selectedPlaybook), playbookId: selectedPlaybook?.id || '', playbookName: selectedPlaybook?.name || '', setup: selectedPlaybook?.name || current.setup }));
    if (selectedPlaybook) setCustomSetup(false);
  };
  const submit = event => {
    event.preventDefault();
    if (!form.setup.trim() || form.pnl === '') return setError('Setup and net P&L are required.');
    const pnl = Number(form.pnl), fees = Number(form.fees || 0), date = new Date(form.date);
    const entry = form.entry === '' ? null : Number(form.entry), exit = form.exit === '' ? null : Number(form.exit), lotSize = form.lotSize === '' ? null : Number(form.lotSize);
    if (!Number.isFinite(pnl) || !Number.isFinite(fees) || !Number.isFinite(date.getTime()) || (entry !== null && !Number.isFinite(entry)) || (exit !== null && !Number.isFinite(exit)) || (lotSize !== null && (!Number.isFinite(lotSize) || lotSize <= 0))) return setError('Check the P&L, fees, prices, lot size and trade time.');
    onSave({ ...form, pnl, fees, entry, exit, lotSize, date: date.toISOString(), timeZone: USER_TIME_ZONE });
  };
  const entryLabel = form.entry !== '' && Number.isFinite(Number(form.entry)) ? formatQuote(Number(form.entry)) : 'Not recorded';
  const exitLabel = form.exit !== '' && Number.isFinite(Number(form.exit)) ? formatQuote(Number(form.exit)) : 'Not recorded';
  const setupLabel = form.setup.trim() || 'Not specified';
  return <Modal onClose={onClose} eyebrow={`${INSTRUMENTS[form.symbol]?.label || form.symbol} · Edit saved trade`} title={`Setup: ${setupLabel}`}>
    <form className="journal-entry-form" onSubmit={submit}>
      <div className="review-metrics">
        <div><span>Net result</span><b className={Number(form.pnl) >= 0 ? 'positive' : 'negative'}>{money(Number(form.pnl) || 0)}</b></div>
        <div><span>Direction</span><b>{form.side === 'buy' ? 'Long' : 'Short'}</b></div>
        <div><span>Open → Close</span><b>{entryLabel} → {exitLabel}</b></div>
        <div><span>Lots</span><b>{form.lotSize || '—'}</b></div>
      </div>
      <section className="journal-form-section">
        <header><span>01</span><div><small>TRADE DETAILS</small><b>Edit execution facts</b></div></header>
        <div className="modal-grid">
          <Field label="Instrument"><select value={form.symbol} onChange={event => field('symbol', event.target.value)}><option value="XAUUSD">XAU / USD</option><option value="BTCUSD">BTC / USD</option><option value="EURUSD">EUR / USD</option><option value="NAS100">NAS100</option></select></Field>
          <Field label="Direction"><select value={form.side} onChange={event => field('side', event.target.value)}><option value="buy">Long / Buy</option><option value="sell">Short / Sell</option></select></Field>
          <Field label="Setup name">
            <select value={customSetup ? '__custom__' : (form.setup || 'None')} onChange={event => selectSetup(event.target.value)}>
              <option value="None">None used</option>
              {plans.length ? <optgroup label="Saved playbooks">{plans.map(plan => <option key={plan.id} value={plan.name}>{plan.name}{plan.active ? ' · Active' : ''}</option>)}</optgroup> : <option disabled>No saved playbooks in this account</option>}
              <option value="__custom__">+ Add custom setup…</option>
            </select>
            {plans.length > 0 && <div className="setup-playbook-quicklist" aria-label="Saved playbooks">{plans.map(plan => <button type="button" key={plan.id} className={form.playbookId === plan.id ? 'active' : ''} onClick={() => selectSetup(plan.name)}><Target size={11} />{plan.name}{plan.active ? <small>Active</small> : null}</button>)}</div>}
            {customSetup && <input className="custom-setup-input" value={form.setup} onChange={event => field('setup', event.target.value)} placeholder="Enter setup name" autoFocus />}
          </Field>
          <Field label={`Trade time · ${USER_TIME_ZONE_LABEL}`}><input type="datetime-local" value={form.date} onChange={event => field('date', event.target.value)} /></Field>
          <Field label="Lot size"><DecimalInput value={form.lotSize} onChange={value => field('lotSize', value)} placeholder="e.g. 0.10" /></Field>
          <Field label="Open price"><DecimalInput value={form.entry} onChange={value => field('entry', value)} placeholder="Optional" /></Field>
          <Field label="Close price"><DecimalInput value={form.exit} onChange={value => field('exit', value)} placeholder="Optional" /></Field>
          <Field label="Net P&L"><NumberField value={form.pnl} onChange={value => field('pnl', value)} prefix="$" /></Field>
          <Field label="Fees"><NumberField value={form.fees} onChange={value => field('fees', value)} prefix="$" /></Field>
        </div>
      </section>
      <section className="journal-form-section">
        <header><span>02</span><div><small>PROCESS REVIEW</small><b>Edit management and psychology</b></div></header>
        <div className="modal-grid">
          <Field label="Entry emotion"><select value={form.emotion} onChange={event => field('emotion', event.target.value)}><option>Focused</option><option>Confident</option><option>Anxious</option><option>FOMO</option><option>Frustrated</option></select></Field>
          <Field label="Exit emotion"><select value={form.exitEmotion} onChange={event => field('exitEmotion', event.target.value)}><option>Focused</option><option>Confident</option><option>Relieved</option><option>Disappointed</option><option>Frustrated</option></select></Field>
          <Field label="Trade management"><input value={form.management} onChange={event => field('management', event.target.value)} placeholder="Partials, stop movement, scaling…" /></Field>
          <Field label="Mistakes / rule breaks"><input value={form.mistakes} onChange={event => field('mistakes', event.target.value)} placeholder="What deviated from the plan?" /></Field>
          <Field label="Execution grade"><select value={form.grade} onChange={event => field('grade', event.target.value)}><option>A+</option><option>A</option><option>B</option><option>C</option><option>D</option><option>F</option></select></Field>
          <Field label="Playbook followed"><select value={form.playbookId || ''} onChange={event => selectFollowedPlaybook(event.target.value)}><option value="">Off-plan / no playbook followed</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}{plan.active ? ' · Active' : ''}</option>)}</select></Field>
        </div>
        <Field label="Additional notes"><textarea value={form.note} onChange={event => field('note', event.target.value)} placeholder="What worked? What failed? What will you repeat next time?" /></Field>
      </section>
      <ImageUploader images={form.images} onChange={images => field('images', images)} title="Trade charts" help="Attach multiple MTF, HTF, LTF, entry and exit screenshots." />
      {error && <div className="form-error">{error}</div>}
      <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button"><Pencil size={14} /> Save trade changes</button></div>
    </form>
  </Modal>;
}

function ElefinCheckIn({ accountId, onClose, onStart }) {
  const [answers, setAnswers] = useState(() => Array(ELEFIN_CHECKS.length).fill(null));
  const [notes, setNotes] = useState(() => Array(ELEFIN_CHECKS.length).fill(''));
  const [emotion, setEmotion] = useState('');
  const completed = ELEFIN_CHECKS.filter((_, index) => answers[index] && notes[index].trim()).length;
  const allAnswered = answers.every(Boolean);
  const allContextAdded = notes.every(note => note.trim());
  const ready = allAnswered && allContextAdded && Boolean(emotion);
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
        <span className="elefin-intro-icon"><img src="/elefin-icon.png" alt="" /></span>
        <div><b>Validate the market before execution</b><small>Every decision and its written market context are required.</small></div>
        <strong>{completed}<small> / {ELEFIN_CHECKS.length}</small></strong>
      </div>
      <div className="elefin-progress" aria-label={`${completed} of ${ELEFIN_CHECKS.length} checks answered`}><i style={{ width: `${completed / ELEFIN_CHECKS.length * 100}%` }} /></div>
      <div className="precheck-list">
        {ELEFIN_CHECKS.map((question, index) => <article className={`precheck-row ${answers[index] ? 'answered' : ''} ${answers[index] && notes[index].trim() ? 'complete' : ''}`} key={question}>
          <div className="precheck-question"><span>{String(index + 1).padStart(2, '0')}</span><b>{question}</b></div>
          <div className="precheck-decisions" role="group" aria-label={`Decision for: ${question}`}>
            <button type="button" className={`decision-button green ${answers[index] === 'green' ? 'active' : ''}`} onClick={() => choose(index, 'green')} aria-pressed={answers[index] === 'green'} aria-label="Confirm condition" title="Confirm"><Check size={18} /></button>
            <button type="button" className={`decision-button red ${answers[index] === 'red' ? 'active' : ''}`} onClick={() => choose(index, 'red')} aria-pressed={answers[index] === 'red'} aria-label="Reject condition" title="Reject"><X size={18} /></button>
          </div>
          <label className="precheck-note"><span>Market context · required</span><textarea value={notes[index]} onChange={event => addContext(index, event.target.value)} placeholder="Add your observation, level, or reasoning…" rows="2" required /></label>
        </article>)}
      </div>
      <section className="emotion-check"><div><span><Activity size={17} /></span><div><b>Emotion status</b><small>Record your state before you move into execution.</small></div></div><div className="emotion-options" role="radiogroup" aria-label="Emotion status">{ELEFIN_EMOTIONS.map(option => <button type="button" role="radio" aria-checked={emotion === option} className={emotion === option ? 'active' : ''} onClick={() => setEmotion(option)} key={option}>{option}</button>)}</div></section>
      <div className={`precheck-summary ${ready ? (redCount ? 'caution' : 'ready') : ''}`} aria-live="polite">
        <span>{ready ? (redCount ? <ShieldCheck size={17} /> : <Check size={17} />) : <Sparkles size={17} />}</span>
        <div><b>{!allAnswered ? 'Complete every decision' : !allContextAdded ? 'Add context to every step' : !emotion ? 'Choose your emotion status' : redCount ? `${redCount} caution flag${redCount === 1 ? '' : 's'} noted` : 'Pre-check complete'}</b><small>{ready ? `Emotion: ${emotion} · Your check will be saved before opening Elefin.` : `${ELEFIN_CHECKS.length - completed} required step${ELEFIN_CHECKS.length - completed === 1 ? '' : 's'} remaining.`}</small></div>
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
      <div className="session-confirm-note"><ShieldCheck size={17} /><span>Your notes and decisions are saved. Acknowledging makes this session part of EdgeTrader’s permanent calendar memory.</span></div>
      <div className="session-confirm-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel session</button><button type="button" className="primary-button" onClick={onAcknowledge}><Check size={16} /> Acknowledge session</button></div>
    </div>
  </Modal>;
}

function ImageUploader({ images = [], onChange, title, help, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef(null);
  const disabled = busy || images.length >= MAX_IMAGES;
  const processFiles = async rawFiles => {
    const incoming = Array.from(rawFiles || []).filter(Boolean);
    const files = incoming.filter(isImageFile);
    if (!files.length) return setError('Drop a JPG, PNG, WebP, or another supported image file.');
    if (images.length + files.length > MAX_IMAGES) return setError(`You can keep up to ${MAX_IMAGES} screenshots in this record.`);
    setBusy(true); setError('');
    try {
      const additions = [];
      for (const file of files) additions.push(await compressUpload(file));
      const next = [...images, ...additions];
      const totalSize = next.reduce((sum, image) => sum + image.url.length, 0);
      if (totalSize > MAX_IMAGE_STORE_SIZE) throw new Error('These compressed screenshots exceed the 1.2 MB record limit. Remove one or upload smaller images.');
      onChange(next);
    } catch (uploadError) {
      setError(uploadError.message || 'Could not add these screenshots.');
    } finally {
      setBusy(false);
    }
  };
  const addImages = event => {
    processFiles(event.target.files);
    event.target.value = '';
  };
  const pasteImages = event => {
    const files = Array.from(event.clipboardData?.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(isImageFile);
    if (files.length) { event.preventDefault(); processFiles(files); }
  };
  const enterDropZone = event => {
    event.preventDefault(); event.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const leaveDropZone = event => {
    event.preventDefault(); event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const dropImages = event => {
    event.preventDefault(); event.stopPropagation();
    dragDepth.current = 0; setDragging(false);
    if (disabled) return;
    const files = event.dataTransfer?.files?.length ? event.dataTransfer.files : Array.from(event.dataTransfer?.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
    processFiles(files);
  };
  const openPicker = () => !disabled && fileInputRef.current?.click();
  return <section className={`image-uploader ${compact ? 'compact-image-uploader' : ''} ${dragging ? 'dragging' : ''}`} onPaste={pasteImages} onDragEnter={enterDropZone} onDragOver={event => { event.preventDefault(); event.stopPropagation(); if (!disabled) event.dataTransfer.dropEffect = 'copy'; }} onDragLeave={leaveDropZone} onDrop={dropImages}><header>{compact ? <h3>{title}</h3> : <div><small>VISUAL EVIDENCE</small><h3>{title}</h3><p>{help}</p></div>}<button type="button" className="image-picker-button" onClick={openPicker} disabled={disabled}><Camera size={14} />{busy ? 'Processing…' : compact ? 'Add screenshot' : 'Add screenshots'}</button><input ref={fileInputRef} className="image-file-input" type="file" accept="image/*" multiple onChange={addImages} disabled={disabled} /></header>{!compact && <div className="image-drop-zone" role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} onClick={openPicker} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && !disabled) { event.preventDefault(); openPicker(); } }}><Camera size={19} /><span>{dragging ? 'Release to add screenshots' : 'Drag and drop screenshots here'}</span><small>{images.length ? 'Add more files, click to browse, or focus here and paste' : 'Click to browse, or focus here and paste from your clipboard'}</small></div>}{images.length ? <div className="image-preview-grid">{images.map((image, index) => <figure key={image.id || index}><img src={image.url} alt={`${title} ${index + 1}`} /><figcaption><span>{image.name || `Screenshot ${index + 1}`}</span><button type="button" onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${image.name || `screenshot ${index + 1}`}`}><X size={12} /></button></figcaption></figure>)}</div> : null}{error && <div className="form-error">{error}</div>}{!compact && <footer>{images.length}/{MAX_IMAGES} images · compressed before D1 sync</footer>}</section>;
}

function TradeViewModal({ trade, onClose, onEdit }) {
  const facts = [
    ['Direction', trade.side === 'buy' ? 'Long / Buy' : 'Short / Sell'],
    ['Setup', trade.setup || 'None used'],
    ['Open price', trade.entry === '' || trade.entry == null ? '—' : formatQuote(Number(trade.entry))],
    ['Close price', trade.exit === '' || trade.exit == null ? '—' : formatQuote(Number(trade.exit))],
    ['Lot size', trade.lotSize === '' || trade.lotSize == null ? '—' : Number(trade.lotSize).toLocaleString()],
    ['Fees', plainMoney(Number(trade.fees) || 0)],
    ['Grade', trade.grade || '—'],
    ['Playbook', trade.playbookName || (trade.plan ? trade.setup : 'Off-plan')],
  ];
  return <Modal drawer panelClassName="trade-view-drawer" onClose={onClose} eyebrow="JOURNAL ENTRY" title={`${INSTRUMENTS[trade.symbol]?.label || trade.symbol} · ${trade.setup || 'None used'}`}>
    <div className="trade-view-content">
      <section className="trade-view-hero">
        <div><Instrument symbol={trade.symbol} /><span>{new Date(trade.date).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</span></div>
        <strong className={Number(trade.pnl) >= 0 ? 'positive' : 'negative'}>{money(Number(trade.pnl) || 0)}</strong>
      </section>
      <section className="trade-view-section">
        <header><span>Execution facts</span></header>
        <div className="trade-view-facts">{facts.map(([label, value]) => <article key={label}><small>{label}</small><b>{value}</b></article>)}</div>
      </section>
      <section className="trade-view-section">
        <header><span>Process review</span></header>
        <div className="trade-view-notes">
          <article><small>Entry emotion</small><b>{trade.emotion || '—'}</b></article>
          <article><small>Exit emotion</small><b>{trade.exitEmotion || '—'}</b></article>
          <article><small>Trade management</small><p>{trade.management || 'No management notes recorded.'}</p></article>
          <article><small>Mistakes / rule breaks</small><p>{trade.mistakes || 'None recorded.'}</p></article>
          <article><small>Additional notes</small><p>{trade.note || 'No additional notes recorded.'}</p></article>
        </div>
      </section>
      <section className="trade-view-section">
        <header><span>Screenshots</span><b>{trade.images?.length || 0}</b></header>
        {trade.images?.length ? <div className="trade-view-images">{trade.images.map((image, index) => <a key={image.id || index} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={image.name || `Trade screenshot ${index + 1}`} /><span>{image.name || `Screenshot ${index + 1}`}</span></a>)}</div> : <div className="trade-view-empty"><Camera size={18} /> No screenshots attached</div>}
      </section>
      <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Close</button><button type="button" className="primary-button" onClick={onEdit}><Pencil size={14} /> Edit journal entry</button></div>
    </div>
  </Modal>;
}

function TradeNoteModal({ trade, onClose, onSave }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const submit = event => {
    event.preventDefault();
    if (!note.trim()) return setError('Write a note before saving.');
    onSave(note.trim());
  };
  return <Modal onClose={onClose} eyebrow="JOURNAL NOTE" title={`Add note · ${INSTRUMENTS[trade.symbol]?.label || trade.symbol}`}><form className="trade-note-form" onSubmit={submit}><div className="trade-note-context"><Instrument symbol={trade.symbol} /><span>{trade.setup || 'None'} · {new Date(trade.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></div><Field label="Additional note"><textarea value={note} onChange={event => { setNote(event.target.value); setError(''); }} placeholder="Add an observation, lesson, or execution detail…" autoFocus /></Field><small>This note will be appended to the trade’s Additional Notes without replacing anything already saved.</small>{error && <div className="form-error">{error}</div>}<div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button"><Plus size={14} /> Append note</button></div></form></Modal>;
}

function Modal({ children, onClose, eyebrow, title, dismissible = true, drawer = false, fullScreen = false, expandable = false, panelClassName = '' }) {
  const [expanded, setExpanded] = useState(false);
  const isFullScreen = fullScreen || expanded;
  const isDrawer = drawer && !isFullScreen;
  return <div className={`modal-backdrop ${isDrawer ? 'modal-drawer-backdrop' : ''} ${isFullScreen ? 'modal-fullscreen-backdrop' : ''}`} onMouseDown={e => dismissible && e.target === e.currentTarget && onClose()}><section className={`modal-panel ${isDrawer ? 'modal-drawer' : ''} ${isFullScreen ? 'modal-fullscreen' : ''} ${panelClassName}`.trim()} role="dialog" aria-modal="true"><div className="modal-heading"><div><p>{eyebrow}</p><h2>{title}</h2></div><div className="modal-heading-actions">{expandable && <button type="button" onClick={() => setExpanded(current => !current)} aria-label={isFullScreen ? 'Return to side view' : 'Open full view'} title={isFullScreen ? 'Return to side view' : 'Open full view'}>{isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>}{dismissible && <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>}</div></div>{children}</section></div>;
}
function Field({ label, children }) { return <label className="field-label"><span>{label}</span>{children}</label>; }
function NumberField({ value, onChange, suffix, prefix }) { return <div className="number-field">{prefix && <span>{prefix}</span>}<input type="text" inputMode="decimal" value={value} onChange={event => { const next = event.target.value; if (/^-?\d*\.?\d*$/.test(next)) onChange(next); }} />{suffix && <small>{suffix}</small>}</div>; }
function DecimalInput({ value, onChange, placeholder }) { return <input className="decimal-input" type="text" inputMode="decimal" value={value} onChange={event => { const next = event.target.value; if (/^-?\d*\.?\d*$/.test(next)) onChange(next); }} placeholder={placeholder} />; }
function Instrument({ symbol }) { const item = INSTRUMENTS[symbol] || { label: symbol, accent: 'violet' }; return <span className="instrument"><InstrumentMark symbol={symbol} size={26} /><b>{item.label}</b></span>; }
function SectionTitle({ eyebrow, title, action, onAction }) { return <div className="section-title"><div><p>{eyebrow}</p><h2>{title}</h2></div>{action && <button onClick={onAction}>{action}<ArrowUpRight size={13} /></button>}</div>; }
function EmptyState({ icon: Icon, title, text, action, onAction, small, large }) { return <div className={`empty-state ${small ? 'small' : ''} ${large ? 'large' : ''}`}><div><Icon size={large ? 26 : 21} /></div><b>{title}</b><span>{text}</span>{action && <button className="primary-button" onClick={onAction}>{action}</button>}</div>; }
function TradeTable({ trades, onEdit, onAddNote }) { return <div className="table-scroll"><table className="execution-table"><thead><tr><th>Instrument</th><th>Setup</th><th>Open</th><th>Close</th><th>Lots</th><th>Direction</th><th>Date</th><th>Net result</th><th>Actions</th></tr></thead><tbody>{trades.map(t => <tr key={t.id}><td><Instrument symbol={t.symbol} /></td><td>{t.setup || '—'}</td><td>{t.entry == null || t.entry === '' || !Number.isFinite(Number(t.entry)) ? '—' : formatQuote(Number(t.entry))}</td><td>{t.exit == null || t.exit === '' || !Number.isFinite(Number(t.exit)) ? '—' : formatQuote(Number(t.exit))}</td><td>{t.lotSize == null || t.lotSize === '' || !Number.isFinite(Number(t.lotSize)) ? '—' : Number(t.lotSize).toLocaleString()}</td><td className={t.side === 'buy' ? 'positive' : 'negative'}>{t.side === 'buy' ? 'Long' : 'Short'}</td><td>{new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td><td className={t.pnl >= 0 ? 'positive' : 'negative'}><b>{money(t.pnl)}</b></td><td><div className="execution-actions"><button type="button" onClick={() => onEdit?.(t)}><Pencil size={12} /> Edit</button><button type="button" onClick={() => onAddNote?.(t)}><Plus size={12} /> Note</button></div></td></tr>)}</tbody></table></div>; }
