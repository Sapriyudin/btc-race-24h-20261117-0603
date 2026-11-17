// Dip-buy + hold, in two tranches: a BTC trading bot for make.fun btc-race-24h-20261117-0603.
//
// Idea (from grading every baseline and a sweep of trend/mean-reversion systems on the
// frozen dev window): 1-minute cbBTC is dominated by noise (6.4 bps/min) while a full-size
// round trip costs ~25-37 bps (4 bps fee + 2 bps slippage + pool price impact each way).
// Every active system we tested lost $20-106 on the dev window to churn; the only winners
// bought once and held (buy-and-hold +$1.07, momentum baseline +$2.45 — it trades once).
// So this bot buys and holds: no stops, no re-entries, no sells. With prizes paid to the
// top 10 whatever the sign, capping the upside to protect the downside is the wrong trade —
// the entry is a free lottery ticket on the day's drift, and the dev gate (net PnL > $0)
// is passed with margin.
//
// Revision (v2): the single all-in buy is split into two equal tranches, for two reasons
// that hold on any day, not just the dev window:
//   1. Pool price impact is quadratic in size. The kit's market model charges a buy the
//      factor 1 + a/D1 (+ a/D2), so impact in bps grows with the order and the dollars lost
//      grow with the square of the size. Two $500 buys pay roughly half the total impact
//      dollars of one $1,000 buy (on the dev window the single buy lost ~$2.80 to impact
//      on top of its $0.80 fees).
//   2. Entry-timing diversification. One all-in order bets everything on a single minute's
//      print; two tranches average two entry points, so a one-minute wick or a fast
//      recovery can only hurt half the capital.
//   - Tranche 1: half the cash on the first close >= 50 bps below the first close,
//     or at bar 240 at the latest.
//   - Tranche 2: the rest of the cash on the first close >= 100 bps below the first
//     close (twice the first dip — a genuinely dislocated price), or at bar 480 at the
//     latest (twice the patience — still two-thirds of the day left invested).
//   - A rejected order is retried on the next bar: the sent flags clear on rejection,
//     so a refused buy is simply sent again. Deterministic: pure function of the closes
//     seen so far, the fills reported by the harness, and the batch seq. No clock, no
//     environment, no randomness. BigInt arithmetic throughout.

import { runBars } from './vendor/makefun-bars.ts';

/** First tranche buys on a dip of this many bps below the first close. */
const DIP_BPS = 50;
/** Second tranche buys on a dip of this many bps below the first close. */
const DEEP_DIP_BPS = 100;
/** Buy the first tranche at the latest on this batch (0-based) if no dip shows up. */
const FALLBACK_BAR = 240;
/** Buy the second tranche at the latest on this batch if no deep dip shows up. */
const SECOND_FALLBACK_BAR = 480;
/** An order the market would fill more than this past the latest close is refused. */
const MAX_SLIPPAGE_BPS = 100;

const SYMBOL = 'CBBTC';

/** The first close seen, the reference the dips are measured from. */
let open0: bigint | null = null;
/** Tranche 1: sent (awaiting its fill) / filled. The sent flag clears on rejection. */
let firstSent = false;
let firstFilled = false;
/** Tranche 2: same. */
let secondSent = false;
let secondFilled = false;

await runBars({
  onBatch(state, batch) {
    // Fold in the fills for orders decided on earlier bars.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.side !== 'buy') continue;
      if (fill.client_id === 't1') {
        firstSent = false;
        if (fill.status === 'filled') firstFilled = true;
      } else if (fill.client_id === 't2') {
        secondSent = false;
        if (fill.status === 'filled') secondFilled = true;
      }
    }
    const close = state.close(SYMBOL);
    if (close === null) return [];
    if (open0 === null) open0 = close;
    // Exact-integer dip tests: close <= open0 * (10000 - BPS) / 10000.
    const dipped = close * 10000n <= open0 * (10000n - BigInt(DIP_BPS));
    const deepDipped = close * 10000n <= open0 * (10000n - BigInt(DEEP_DIP_BPS));
    // Tranche 1: half the cash on the first half-percent dip, else at bar 240.
    if (!firstFilled && !firstSent && (dipped || batch.seq >= FALLBACK_BAR)) {
      firstSent = true;
      return [{ side: 'buy', symbol: SYMBOL, client_id: 't1', notional_quote_units: state.cash / 2n, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    // Tranche 2: the rest on a deeper dip, else at bar 480. Only once tranche 1 is in.
    if (firstFilled && !secondFilled && !secondSent && (deepDipped || batch.seq >= SECOND_FALLBACK_BAR)) {
      secondSent = true;
      return [{ side: 'buy', symbol: SYMBOL, client_id: 't2', notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
