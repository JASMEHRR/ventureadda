import assert from 'node:assert/strict'
import test from 'node:test'
import { usernameFromEmail } from './username.ts'

/**
 * The derived name, which nobody is asked to confirm — so it has to be right
 * without anyone looking at it. Every case here is an address shape that
 * actually turns up on a campus: a dotted name, a roll number, an alias too
 * short to be a username, and one with nothing usable in it at all.
 */
test('a username is derived from every address shape', () => {
  const pattern = /^[a-zA-Z0-9_]{3,20}$/

  assert.equal(usernameFromEmail('jsingh_be22@thapar.edu'), 'jsingh_be22')
  // Dots are not in the allowed set and are dropped rather than replaced.
  assert.equal(usernameFromEmail('arjun.mehta@gmail.com'), 'arjunmehta')
  assert.equal(usernameFromEmail('102103456@thapar.edu'), '102103456')
  // Too short on its own, so it takes the fallback stem rather than failing
  // the rules' 3-character minimum.
  assert.equal(usernameFromEmail('jp@thapar.edu'), 'studentjp')
  assert.equal(usernameFromEmail('अर्जुन@thapar.edu'), 'student')

  // Whatever comes out, the rules have to accept it, and it can never exceed
  // the 20 characters firestore.rules caps a username at.
  for (const email of [
    'jsingh_be22@thapar.edu',
    'arjun.mehta@gmail.com',
    'a_very_long_local_part_indeed@thapar.edu',
    'jp@thapar.edu',
    'अर्जुन@thapar.edu',
  ]) {
    assert.match(usernameFromEmail(email), pattern)
  }
})
