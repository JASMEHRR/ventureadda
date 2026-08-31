import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import AtmosphereBackdrop from './components/AtmosphereBackdrop'
import AppShell from './components/layout/AppShell'
import Button from './components/ui/Button'
import EmptyState from './components/ui/EmptyState'
import LoadingLine from './components/ui/LoadingLine'
import { AuthProvider } from './auth/AuthProvider'
import MaintenanceGate from './components/MaintenanceGate'
import { recordVisit } from './data/traffic'
import Landing from './pages/Landing'
import ErrorBoundary from './components/ErrorBoundary'
import Browse from './pages/Browse'

/**
 * Route-level code splitting.
 *
 * Everything here is phone-first on campus wifi, and one 1MB bundle meant a
 * visitor opening a WhatsApp link waited for the moderator queue, the venture
 * form, the photo uploader and the whole design system before seeing a word of
 * the landing page.
 *
 * Landing and Browse are NOT lazy. They are the two pages a stranger actually
 * arrives on, and splitting them would only add a second round trip in front
 * of the thing they came for.
 *
 * Everything else is loaded when its route is first visited. The heavy ones
 * are worth naming: DesignDemo is a development reference no visitor will ever
 * open, and AddVenture and EditVenture drag in the form, the Cloudinary
 * uploader and the menu scanner.
 */
const Products = lazy(() => import('./pages/Products'))
const VentureDetail = lazy(() => import('./pages/VentureDetail'))
const EditVenture = lazy(() => import('./pages/EditVenture'))
const AddVenture = lazy(() => import('./pages/AddVenture'))
const Chat = lazy(() => import('./pages/Chat'))
const Moderator = lazy(() => import('./pages/Moderator'))
const SignIn = lazy(() => import('./pages/SignIn'))
const Profile = lazy(() => import('./pages/Profile'))
const Orders = lazy(() => import('./pages/Orders'))
const MyOrders = lazy(() => import('./pages/MyOrders'))
const Cart = lazy(() => import('./pages/Cart'))
const Settings = lazy(() => import('./pages/Settings'))
const MyVentures = lazy(() => import('./pages/MyVentures'))
const DesignDemo = lazy(() => import('./pages/DesignDemo'))

export default function App() {
  // Counted once per tab, from the root, so it happens whichever page the
  // visitor landed on — most arrive on a venture from a shared link rather
  // than at the front door. See data/traffic for why it is a day counter
  // rather than a row per visit.
  useEffect(() => {
    void recordVisit()
  }, [])

  return (
    <AuthProvider>
      {/* Inside the provider because it needs to know whether you are a
          moderator, and outside the router because a closed site is closed on
          every route — there is no page worth serving from behind the sign. */}
      <MaintenanceGate>
      <BrowserRouter>
        <AtmosphereBackdrop />
        {/* One boundary around the routed content, inside the shell, so the
            sidebar and top bar stay on screen while a chunk arrives. A
            boundary outside the shell would blank the whole page. */}
        <Routes>
          {/* Outside AppShell on purpose. The shell is the tool — sidebar,
              filters, account — and none of it means anything to someone who
              does not yet know what the site is. */}
          {/* Its own boundary, because this one is outside the shell and
              therefore outside the shell's. The front page crashing showed a
              black screen to every arriving visitor with nothing to catch it —
              which is the worst page on the site to have no net under. */}
          <Route
            index
            element={
              <ErrorBoundary resetKey="landing">
                <Landing />
              </ErrorBoundary>
            }
          />
          {/* The introduction, on demand. `/` sends anybody who has been
              inside straight to the app, so this is the way back to the
              explanation — and the link to send someone who asks what this
              is. */}
          <Route
            path="welcome"
            element={
              <ErrorBoundary resetKey="welcome">
                <Landing always />
              </ErrorBoundary>
            }
          />

          <Route element={<AppShell />}>
            <Route path="browse" element={<Browse />} />
            <Route
              path="*"
              element={
                <Suspense fallback={<LoadingLine label="Loading…" />}>
                  <Routes>
                    <Route path="products" element={<Products />} />
                    <Route path="venture/:ventureId" element={<VentureDetail />} />
                    <Route path="venture/:ventureId/edit" element={<EditVenture />} />
                    <Route path="signin" element={<SignIn />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="my-orders" element={<MyOrders />} />
                    <Route path="cart" element={<Cart />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="my-ventures" element={<MyVentures />} />
                    <Route path="add" element={<AddVenture />} />
                    <Route path="moderator" element={<Moderator />} />
                    <Route path="chat" element={<Chat />} />
                    <Route path="design" element={<DesignDemo />} />
                    <Route
                      path="*"
                      element={
                        <EmptyState
                          icon={SearchX}
                          eyebrow="404"
                          title="No such page"
                          action={
                            <Button variant="secondary" to="/browse">
                              Back to browse
                            </Button>
                          }
                        >
                          That link does not point anywhere on VentureAdda.
                        </EmptyState>
                      }
                    />
                  </Routes>
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
      </MaintenanceGate>
    </AuthProvider>
  )
}
