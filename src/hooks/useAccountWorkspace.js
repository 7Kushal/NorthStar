import { useEffect, useMemo, useRef, useState } from 'react';

const LEGACY_STORE_KEY = 'northstar-account-workspace-v1';
const LEGACY_DATA_KEY = 'northstar-react-v1';
const LEGACY_PENDING_KEY = 'northstar-pending-elefin-session';
const LEGACY_CLAIM_KEY = 'edgetrader-d1-migration-owner';
const CACHE_PREFIX = 'edgetrader-workspace-cache-v1:';

const clone = value => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function readJson(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeData(value, initialData) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...clone(initialData),
    ...source,
    settings: { ...clone(initialData.settings), ...(source.settings || {}) },
    trades: Array.isArray(source.trades) ? source.trades : [],
    positions: Array.isArray(source.positions) ? source.positions : [],
    plans: Array.isArray(source.plans) ? source.plans : [],
    sessions: Array.isArray(source.sessions) ? source.sessions : [],
    routine: { ...clone(initialData.routine), ...(source.routine || {}) },
    pendingSession: source.pendingSession || null,
  };
}

function createInitialStore(initialData) {
  const legacyData = readJson(LEGACY_DATA_KEY, null);
  const legacyPending = readJson(LEGACY_PENDING_KEY, null);
  const data = normalizeData(legacyData, initialData);
  if (!data.pendingSession && legacyPending) data.pendingSession = legacyPending;
  const primary = {
    id: 'primary',
    name: 'Primary account',
    broker: 'Manual journal',
    type: 'Personal',
    createdAt: new Date().toISOString(),
    data,
  };
  return { version: 1, activeAccountId: primary.id, accounts: [primary] };
}

function normalizeStore(value, initialData) {
  if (!value?.accounts?.length) return createInitialStore(initialData);
  const accounts = value.accounts.slice(0, 50).map(account => ({
    ...account,
    data: normalizeData(account.data, initialData),
  }));
  const activeAccountId = accounts.some(account => account.id === value.activeAccountId)
    ? value.activeAccountId
    : accounts[0].id;
  return { version: 1, activeAccountId, accounts };
}

async function apiJson(path, options) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  let body = {};
  try { body = await response.json(); } catch { /* A non-JSON proxy response is handled below. */ }
  if (!response.ok) {
    const error = new Error(body.error || `Cloud sync returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function saveWorkspace(workspace) {
  return apiJson('/api/workspace', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace }),
  });
}

export function useAccountWorkspace(initialData) {
  const legacyStore = useMemo(() => normalizeStore(readJson(LEGACY_STORE_KEY, null), initialData), [initialData]);
  const hasLegacyWorkspace = useMemo(
    () => Boolean(readJson(LEGACY_STORE_KEY, null) || readJson(LEGACY_DATA_KEY, null)),
    [],
  );
  const [store, setStore] = useState(legacyStore);
  const [identity, setIdentity] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState('loading');
  const [syncError, setSyncError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [needsAccountSetup, setNeedsAccountSetup] = useState(false);
  const identityRef = useRef(null);
  const lastSavedRef = useRef('');
  const saveQueueRef = useRef(Promise.resolve());
  const storeRef = useRef(store);

  useEffect(() => { storeRef.current = store; }, [store]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      setSyncStatus('loading');
      setSyncError('');
      try {
        const result = await apiJson('/api/workspace');
        if (!mounted) return;
        const user = result.user;
        const userCacheKey = `${CACHE_PREFIX}${user.id}`;
        const cachedForUser = readJson(userCacheKey, null);
        let nextStore;

        if (result.workspace) {
          nextStore = normalizeStore(result.workspace, initialData);
        } else if (cachedForUser) {
          nextStore = normalizeStore(cachedForUser, initialData);
          await saveWorkspace(nextStore);
        } else {
          const claimedBy = localStorage.getItem(LEGACY_CLAIM_KEY);
          const isNewWorkspace = !hasLegacyWorkspace || Boolean(claimedBy && claimedBy !== user.id);
          nextStore = !claimedBy || claimedBy === user.id
            ? legacyStore
            : normalizeStore(null, initialData);
          await saveWorkspace(nextStore);
          localStorage.setItem(LEGACY_CLAIM_KEY, user.id);
          setNeedsAccountSetup(isNewWorkspace);
        }

        if (!mounted) return;
        const serialized = JSON.stringify(nextStore);
        identityRef.current = user;
        lastSavedRef.current = serialized;
        setIdentity(user);
        setStore(nextStore);
        localStorage.setItem(userCacheKey, serialized);
        setIsHydrated(true);
        setSyncStatus('synced');
        setLastSyncedAt(result.updatedAt || new Date().toISOString());
      } catch (error) {
        if (!mounted) return;
        setSyncStatus(error.status === 401 ? 'unauthorized' : 'error');
        setSyncError(error.message || 'Could not connect to the cloud workspace.');
      }
    };
    hydrate();
    return () => { mounted = false; };
  }, [hasLegacyWorkspace, initialData, legacyStore]);

  useEffect(() => {
    if (!isHydrated || !identityRef.current) return;
    try {
      localStorage.setItem(`${CACHE_PREFIX}${identityRef.current.id}`, JSON.stringify(store));
      setStorageError('');
    } catch {
      setStorageError('The browser cache is full. EdgeTrader will still attempt to save this change to D1.');
    }

    const serialized = JSON.stringify(store);
    if (serialized === lastSavedRef.current) return;
    setSyncStatus('saving');
    const timer = window.setTimeout(() => {
      const snapshot = store;
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        const result = await saveWorkspace(snapshot);
        lastSavedRef.current = serialized;
        setLastSyncedAt(result.updatedAt || new Date().toISOString());
        if (JSON.stringify(storeRef.current) === serialized) {
          setSyncStatus('synced');
          setSyncError('');
        }
      }).catch(error => {
        setSyncStatus(error.status === 401 ? 'unauthorized' : 'error');
        setSyncError(error.message || 'This change is cached locally but has not reached D1 yet.');
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [isHydrated, store]);

  const activeAccount = useMemo(
    () => store.accounts.find(account => account.id === store.activeAccountId) || store.accounts[0],
    [store],
  );

  const setData = updater => setStore(current => ({
    ...current,
    accounts: current.accounts.map(account => {
      if (account.id !== current.activeAccountId) return account;
      const nextData = typeof updater === 'function' ? updater(account.data) : updater;
      return { ...account, data: nextData };
    }),
  }));

  const switchAccount = id => setStore(current => current.accounts.some(account => account.id === id)
    ? { ...current, activeAccountId: id }
    : current);

  const createAccount = details => {
    const id = crypto.randomUUID();
    const data = normalizeData(null, initialData);
    data.settings = {
      ...data.settings,
      startingBalance: Number(details.startingBalance) || 0,
      maxDailyLoss: 0,
      maxTrades: 0,
      riskPerTrade: 0,
    };
    const account = {
      id,
      name: details.name.trim(),
      broker: details.broker.trim() || 'Manual journal',
      type: details.type || 'Personal',
      createdAt: new Date().toISOString(),
      data,
    };
    setStore(current => {
      const replacePlaceholder = needsAccountSetup
        && current.accounts.length === 1
        && current.accounts[0].id === 'primary';
      return {
        ...current,
        activeAccountId: id,
        accounts: replacePlaceholder ? [account] : [...current.accounts, account],
      };
    });
    setNeedsAccountSetup(false);
    return id;
  };

  const updateAccount = (id, updates) => setStore(current => ({
    ...current,
    accounts: current.accounts.map(account => account.id === id ? { ...account, ...updates } : account),
  }));

  const deleteAccount = id => setStore(current => {
    if (current.accounts.length === 1) return current;
    const accounts = current.accounts.filter(account => account.id !== id);
    return {
      ...current,
      accounts,
      activeAccountId: current.activeAccountId === id ? accounts[0].id : current.activeAccountId,
    };
  });

  const syncNow = async () => {
    const snapshot = storeRef.current;
    const serialized = JSON.stringify(snapshot);
    setSyncStatus('saving');
    setSyncError('');
    try {
      const result = await saveWorkspace(snapshot);
      lastSavedRef.current = serialized;
      setLastSyncedAt(result.updatedAt || new Date().toISOString());
      setSyncStatus('synced');
      return true;
    } catch (error) {
      setSyncStatus(error.status === 401 ? 'unauthorized' : 'error');
      setSyncError(error.message || 'Manual D1 sync failed.');
      return false;
    }
  };

  return {
    accounts: store.accounts,
    activeAccount,
    data: activeAccount.data,
    setData,
    switchAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    identity,
    isHydrated,
    syncStatus,
    lastSyncedAt,
    syncNow,
    syncError,
    storageError,
    needsAccountSetup,
  };
}
