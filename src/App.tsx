import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import AtmosphereBackdrop from './components/AtmosphereBackdrop'
import AppShell from './components/layout/AppShell'
import Button from './components/ui/Button'
import EmptyState from './components/ui/EmptyState'
import { AuthProvider } from './auth/AuthProvider'
import Browse from './pages/Browse'
import Categories from './pages/Categories'
import VentureDetail from './pages/VentureDetail'
import Chat from './pages/Chat'
import AddVenture from './pages/AddVenture'
import EditVenture from './pages/EditVenture'
import Moderator from './pages/Moderator'
import SignIn from './pages/SignIn'
import Profile from './pages/Profile'
import DesignDemo from './pages/DesignDemo'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AtmosphereBackdrop />
        <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Browse />} />
          <Route path="categories" element={<Categories />} />
          <Route path="venture/:ventureId" element={<VentureDetail />} />
          <Route path="venture/:ventureId/edit" element={<EditVenture />} />
          <Route path="signin" element={<SignIn />} />
          <Route path="profile" element={<Profile />} />
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
                  <Button variant="secondary" to="/">
                    Back to browse
                  </Button>
                }
              >
                That link does not point anywhere on VentureAdda.
              </EmptyState>
            }
          />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
