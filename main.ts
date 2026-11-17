// Dip-buy + hold: a BTC trading bot for make.fun btc-race-24h-20261117-0603.
//
// Idea (from grading every baseline and a sweep of trend/mean-reversion systems on the
// frozen dev window): 1-minute cbBTC is dominated by noise (6.4 bps/min) while a full-size
// round trip costs ~25-37 bps (4 bps fee + 2 bps slippage + pool price impact each way).
// Every active system we tested lost $20-106 on the dev window to churn; the only winners
// bought once and held (buy-and-hold +$1.07, momentum baseline +$2.45 — it trades once).
// So this bot trades exactly once: it buys the first half-percent dip below the first
// close (or at bar 240 at the latest), all-in, and holds to the end. No stops, no
// re-entries, no sells: with prizes paid to the top 10 whatever the sign, capping the
// upside to protect the downside is the wrong trade — the entry is a free lottery ticket
// on the day's drift, and the dev gate (net PnL > $0) is passed with margin.
//
//   - Entry: first close <= first close x (10000 - 50)/10000, else buy at bar 240.
//   - All-in: the whole cash balance, one order, max slippage 100 bps (1%). If the
//     market refuses the order (gap past the slippage cap), the next bar retries it:
//     the position map is the only state, so a rejected buy is simply sent again.
//   - Deterministic: pure function of the closes seen so far and the batch seq.
//     No clock, no environment, no randomness. BigInt arithmetic throughout, so the
//     same bars always give the same orders, run after run.

import { runBars } from './vendor/makefun-bars.ts';

/** Buy the first dip of this many bps below the first close. */
const DIP_BPS = 50;
/** Buy at the latest on this batch (0-based) if no dip has shown up. */
const FALLBACK_BAR = 240;
/** An order the market would fill more than this past the latest close is refused. */
const MAX_SLIPPAGE_BPS = 100;

const SYMBOL = 'CBBTC';

/** The first close seen, the reference the dip is measured from. */
let open0: bigint | null = null;

await runBars({
  onBatch(state, batch) {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    if (open0 === null) open0 = close;
    // Already holding: nothing to do until the harness flattens at the end.
    if (state.positions.has(SYMBOL)) return [];
    // Exact-integer dip test: close <= open0 * (10000 - DIP_BPS) / 10000.
    const dipped = close * 10000n <= open0 * (10000n - BigInt(DIP_BPS));
    if (dipped || batch.seq >= FALLBACK_BAR) {
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
