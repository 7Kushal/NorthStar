import { useEffect, useMemo, useRef, useState } from 'react';

const COINBASE_CANDLES = 'https://api.exchange.coinbase.com/products/BTC-USD/candles';
const COINBASE_SOCKET = 'wss://ws-feed.exchange.coinbase.com';
const XAUS_API = 'https://xaus.com/api/v1';

const TIMEFRAMES = {
  M1: { seconds: 60, base: 60 },
  M5: { seconds: 300, base: 300 },
  M15: { seconds: 900, base: 900 },
  M30: { seconds: 1800, base: 300 },
  H1: { seconds: 3600, base: 3600 },
  H4: { seconds: 14400, base: 3600 },
  D1: { seconds: 86400, base: 86400 },
};

function aggregateCandles(candles, seconds) {
  const bucketMs = seconds * 1000;
  const buckets = new Map();
  candles.forEach(candle => {
    const time = Math.floor(candle.time / bucketMs) * bucketMs;
    const current = buckets.get(time);
    if (!current) buckets.set(time, { ...candle, time });
    else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
      current.volume += candle.volume || 0;
    }
  });
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

function ticksToCandles(ticks, seconds) {
  return aggregateCandles(ticks.map(tick => ({
    time: tick.time, open: tick.price, high: tick.price, low: tick.price,
    close: tick.price, volume: 1,
  })), seconds);
}

function freshnessStatus(dataState, maxAgeSeconds = 600) {
  if (dataState?.status === 'unavailable') return 'error';
  if (dataState?.status === 'stale') return 'delayed';
  const asOf = Date.parse(dataState?.as_of);
  if (Number.isFinite(asOf) && (Date.now() - asOf) / 1000 > maxAgeSeconds) return 'delayed';
  return 'live';
}

export function useMarket(symbol, timeframe = 'M5', enabled = true) {
  const config = TIMEFRAMES[timeframe] || TIMEFRAMES.M5;
  const [btcCandles, setBtcCandles] = useState([]);
  const [xauCandles, setXauCandles] = useState([]);
  const [xauSpot, setXauSpot] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [xauSource, setXauSource] = useState('XAUS open data');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || symbol !== 'BTCUSD') return;
    let cancelled = false;
    setStatus('connecting'); setError(''); setBtcCandles([]);
    fetch(`${COINBASE_CANDLES}?granularity=${config.base}`, { headers: { Accept: 'application/json' } })
      .then(response => { if (!response.ok) throw new Error('Coinbase candle feed unavailable'); return response.json(); })
      .then(rows => {
        if (cancelled) return;
        const raw = rows.map(k => ({ time: +k[0] * 1000, low: +k[1], high: +k[2], open: +k[3], close: +k[4], volume: +k[5] })).sort((a, b) => a.time - b.time);
        setBtcCandles(aggregateCandles(raw, config.seconds));
        setStatus('live');
        const socket = new WebSocket(COINBASE_SOCKET); socketRef.current = socket;
        socket.onopen = () => socket.send(JSON.stringify({ type: 'subscribe', product_ids: ['BTC-USD'], channels: ['ticker'] }));
        socket.onmessage = event => {
          const tick = JSON.parse(event.data); if (tick.type !== 'ticker') return;
          const price = +tick.price, tickTime = new Date(tick.time || Date.now()).getTime(), bucketMs = config.seconds * 1000;
          const bucket = Math.floor(tickTime / bucketMs) * bucketMs;
          setBtcCandles(current => {
            if (!current.length || !Number.isFinite(price)) return current;
            const next = current.slice(), last = { ...next.at(-1) };
            if (bucket > last.time) next.push({ time: bucket, open: price, high: price, low: price, close: price, volume: 0 });
            else { last.close = price; last.high = Math.max(last.high, price); last.low = Math.min(last.low, price); next[next.length - 1] = last; }
            return next.slice(-300);
          });
        };
        socket.onerror = () => setStatus('delayed');
      })
      .catch(err => { if (!cancelled) { setStatus('error'); setError(err.message); } });
    return () => { cancelled = true; socketRef.current?.close(); socketRef.current = null; };
  }, [symbol, timeframe, config.base, config.seconds, enabled]);

  useEffect(() => {
    if (!enabled || symbol !== 'XAUUSD') return;
    let cancelled = false;
    let timer;
    setStatus('connecting'); setError(''); setXauCandles([]);

    async function loadHistory() {
      const isDaily = timeframe === 'D1';
      const isHourly = timeframe === 'H1' || timeframe === 'H4';
      const url = isDaily
        ? `${XAUS_API}/chart?symbol=xau&range=1m&interval=1d`
        : isHourly
          ? `${XAUS_API}/chart?symbol=xau&range=5d&interval=1h`
          : `${XAUS_API}/intraday?symbol=xau&hours=48`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Historical XAU feed unavailable');
      const payload = await response.json();
      if (payload.error || !Array.isArray(payload.points) || !payload.points.length) throw new Error(payload.error || 'No verified XAU history returned');
      const raw = isDaily || isHourly
        ? payload.points.map(point => ({ time: +point.t * 1000, open: +point.o, high: +point.h, low: +point.l, close: +point.c, volume: Number.isFinite(+point.v) ? +point.v : 0 }))
        : ticksToCandles(payload.points.map(point => ({ time: +point.t * 1000, price: +point.p })), config.seconds);
      const candles = isDaily ? raw : aggregateCandles(raw, config.seconds);
      if (cancelled) return;
      setXauCandles(candles.slice(-300));
      setStatus(freshnessStatus(payload.data_state, isDaily ? 129600 : 900));
      setXauSource(isDaily ? 'XAUS · historical XAU OHLC' : isHourly ? 'XAUS · gold OHLC' : 'XAUS · recorded spot observations');
    }

    async function refreshSpot() {
      try {
        const response = await fetch(`${XAUS_API}/spot?compact=1&fresh=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Live XAU spot feed unavailable');
        const payload = await response.json(), price = +(payload.spot_usd_oz ?? payload.xau?.price);
        const asOf = Date.parse(payload.data_state?.as_of || payload.price_as_of || payload.updated_at);
        if (!Number.isFinite(price) || !Number.isFinite(asOf) || cancelled) return;
        setXauSpot({ price, asOf });
        setStatus(freshnessStatus(payload.data_state));
        if (timeframe === 'D1') return;
        const bucketMs = config.seconds * 1000, bucket = Math.floor(asOf / bucketMs) * bucketMs;
        setXauCandles(current => {
          if (!current.length) return current;
          const next = current.slice(), last = { ...next.at(-1) };
          if (bucket > last.time) next.push({ time: bucket, open: price, high: price, low: price, close: price, volume: 1 });
          else if (bucket === last.time) { last.close = price; last.high = Math.max(last.high, price); last.low = Math.min(last.low, price); next[next.length - 1] = last; }
          return next.slice(-300);
        });
      } catch (spotError) {
        if (!cancelled && !xauCandles.length) { setStatus('error'); setError(spotError.message); }
      }
    }

    loadHistory()
      .then(() => refreshSpot())
      .catch(historyError => { if (!cancelled) { setStatus('error'); setError(historyError.message); } });
    timer = window.setInterval(refreshSpot, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [symbol, timeframe, config.seconds, enabled]);

  return useMemo(() => {
    const candles = symbol === 'BTCUSD' ? btcCandles : xauCandles;
    const last = candles.at(-1), previous = candles.at(-2), recent = candles.filter(c => c.time > Date.now() - 24 * 60 * 60 * 1000);
    const currentPrice = symbol === 'XAUUSD' ? xauSpot?.price ?? last?.close : last?.close;
    const fallbackRecent = candles.slice(-Math.min(24, candles.length));
    const range = recent.length ? recent : fallbackRecent;
    return {
      kind: 'candles', data: candles, price: currentPrice ?? null,
      change: currentPrice && previous ? (currentPrice - previous.close) / previous.close * 100 : null,
      high: range.length ? Math.max(...range.map(c => c.high)) : null,
      low: range.length ? Math.min(...range.map(c => c.low)) : null,
      status, error, timeframe,
      source: symbol === 'BTCUSD' ? `Coinbase Exchange · ${timeframe}` : `${xauSource} · ${timeframe}`,
      volumeLabel: symbol === 'BTCUSD' ? 'Volume' : timeframe === 'D1' || timeframe === 'H1' || timeframe === 'H4' ? 'Activity' : 'Quote activity',
    };
  }, [symbol, timeframe, btcCandles, xauCandles, xauSpot, status, error, xauSource]);
}
