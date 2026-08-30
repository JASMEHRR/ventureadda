/**
 * Self-check for the staleness wording.
 *
 * Run with: node --experimental-strip-types src/data/freshness.test.ts
 */
import assert from 'node:assert/strict'
import { STALE_DAYS, ago, daysSince, isStale } from './freshness.ts'

const now = new Date('2026-08-30T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

// --- counting ---------------------------------------------------------------
assert.equal(daysSince(daysAgo(0), now), 0)
assert.equal(daysSince(daysAgo(1), now), 1)
assert.equal(daysSince(daysAgo(90), now), 90)
// A device clock running behind the server reads as today, never as negative.
assert.equal(daysSince(new Date(now.getTime() + 86_400_000), now), 0)

// --- wording ----------------------------------------------------------------
assert.equal(ago(0), 'today')
assert.equal(ago(1), 'yesterday')
assert.equal(ago(6), '6 days ago')
// Singulars, because "1 weeks ago" is the bug this file exists to catch.
assert.equal(ago(14), '2 weeks ago')
assert.equal(ago(45), '6 weeks ago')
assert.equal(ago(60), '2 months ago')
assert.equal(ago(90), '3 months ago')
assert.equal(ago(30), '4 weeks ago')

// --- the threshold ----------------------------------------------------------
assert.equal(isStale(daysAgo(STALE_DAYS - 1), now), false)
assert.equal(isStale(daysAgo(STALE_DAYS), now), true)
// A listing saved this morning is never stale.
assert.equal(isStale(now, now), false)

console.log('freshness: ok')
