import { auth } from './firebase'

/**
 * Asks the server to push "you have an order" to the seller.
 *
 * FIRE AND FORGET, DELIBERATELY. The order is already written by the time this
 * runs; the push is an accelerant. Every failure path here is swallowed,
 * because the buyer must never see an error about a notification they did not
 * ask for and cannot fix, on a screen that is telling them their order
 * succeeded.
 *
 * `keepalive` matters more than it looks. A buyer who places an order and
 * immediately closes the tab is the common case on a phone, and without it the
 * browser cancels the in-flight request during teardown — exactly the orders
 * most worth pinging about.
 *
 * Only the id is sent. The endpoint reads every word of the notification out
 * of the order document itself, so nothing here can choose who gets pushed or
 * what it says. See api/notify-order.ts.
 */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) return

    await fetch('/api/notify-order', {
      method: 'POST',
      keepalive: true,
      headers: {
        authorization: `Bearer ${await user.getIdToken()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    })
  } catch {
    // Offline, blocked, or the endpoint is not deployed. The seller still has
    // the order on their dashboard, which is what the checkout copy promises.
  }
}
