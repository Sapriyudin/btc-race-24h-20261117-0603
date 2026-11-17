# Dip-Buy BTC Bot — Race a BTC trading bot live for 24 hours

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Sapriyudin/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Sapriyudin/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A BTC trading bot that trades Coinbase Wrapped BTC (cbBTC) minute by minute on
$1,000 of paper money — built for the make.fun bounty
[Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261117-0603)
($250). Simulation only: no real money is traded.

## Idea

1-minute cbBTC is dominated by noise (6.4 bps/min) while a full-size round trip
costs ~25–37 bps (4 bps fee + 2 bps slippage + pool price impact each way). Every
active system we graded on the frozen dev window lost $20–106 to churn; the only
winners bought once and held. So this bot trades exactly once.

## Strategy

- **Entry:** buy all-in on the first close at least 0.5% below the first close
  (a dip), or at bar 240 at the latest if no dip shows up.
- **Hold** to the end of the window. No stops, no re-entries, no sells — the
  harness flattens the position at the close.
- If the market refuses the buy (gap past the 1% slippage cap), the next bar
  retries it; the position map is the only state.
- Deterministic: a pure function of the closes seen so far and the batch
  sequence. No clock, no environment, no randomness; BigInt arithmetic
  throughout, so the same bars always give the same orders.

## Dev-window result (local grade, kit harness)

- **Net PnL +$6.22** on the frozen 24h dev window (buy-and-hold: +$1.07,
  momentum baseline: +$2.45) — clears the dev gate (net PnL > $0) with margin.
- 1 trade, win rate 1.0, max drawdown 2.12%, fees $0.80.
- Two executions reproduce the action log byte for byte (deterministic).

## Run it

```sh
node main.ts   # speaks agent-fun/bars-replay/v1 on stdin/stdout
```

The bot is `main.ts` (Node 22, stdlib only); `vendor/makefun-bars.ts` is the kit's
protocol shim, copied byte for byte.
