import { useEffect, useMemo, useState } from 'react';

const STORE_KEY = 'northstar-account-workspace-v1';
const LEGACY_DATA_KEY = 'northstar-react-v1';
const LEGACY_PENDING_KEY = 'northstar-pending-elefin-session';

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

export function useAccountWorkspace(initialData) {
  const [storageError, setStorageError] = useState('');
  const [store, setStore] = useState(() => {
    const saved = readJson(STORE_KEY, null);
    if (!saved?.accounts?.length) return createInitialStore(initialData);
    const accounts = saved.accounts.map(account => ({
      ...account,
      data: normalizeData(account.data, initialData),
    }));
    const activeAccountId = accounts.some(account => account.id === saved.activeAccountId)
      ? saved.activeAccountId
      : accounts[0].id;
    return { version: 1, activeAccountId, accounts };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      setStorageError('');
    } catch {
      setStorageError('Remove a few screenshots or old records, then save again. Your latest change is still open but may not survive a reload.');
    }
  }, [store]);

  const activeAccount = useMemo(
    () => store.accounts.find(account => account.id === store.activeAccountId) || store.accounts[0],
    [store],
  );

  const setData = updater => setStore(current => ({
    ...current,
    accounts: current.accounts.map(account => {
      if (account.id !== current.activeAccountId) return account;
      const currentData = account.data;
      const nextData = typeof updater === 'function' ? updater(currentData) : updater;
      return { ...account, data: nextData };
    }),
  }));

  const switchAccount = id => setStore(current => current.accounts.some(account => account.id === id)
    ? { ...current, activeAccountId: id }
    : current);

  const createAccount = details => {
    const id = crypto.randomUUID();
    const data = normalizeData(null, initialData);
    data.settings.startingBalance = Number(details.startingBalance) || 0;
    const account = {
      id,
      name: details.name.trim(),
      broker: details.broker.trim() || 'Manual journal',
      type: details.type || 'Personal',
      createdAt: new Date().toISOString(),
      data,
    };
    setStore(current => ({
      ...current,
      activeAccountId: id,
      accounts: [...current.accounts, account],
    }));
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

  return {
    accounts: store.accounts,
    activeAccount,
    data: activeAccount.data,
    setData,
    switchAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    storageError,
  };
}
