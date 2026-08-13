import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MessageSquare, SearchX } from 'lucide-react'
import AtmosphereBackdrop from './components/AtmosphereBackdrop'
import AppShell from './components/layout/AppShell'
import Placeholder from './components/ui/Placeholder'
import { AuthProvider } from './auth/AuthProvider'
import Browse from './pages/Browse'
import Categories from './pages/Categories'
import VentureDetail from './pages/VentureDetail'
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
          <Route
            path="chat"
            element={
              <Placeholder step="Step 4" icon={MessageSquare} title="All Chat">
                One shared room for feedback about the site. Ships with the delete button, not
                after it.
              </Placeholder>
            }
          />
          <Route path="design" element={<DesignDemo />} />
          <Route
            path="*"
            element={
              <Placeholder step="404" icon={SearchX} title="No such page">
                That link does not point anywhere on VentureAdda.
              </Placeholder>
            }
          />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
