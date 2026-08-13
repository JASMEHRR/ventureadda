import { BrowserRouter, Route, Routes } from 'react-router-dom'
import {
  Compass,
  LayoutGrid,
  MessageSquare,
  Plus,
  SearchX,
  Shield,
  Store,
  UserRound,
} from 'lucide-react'
import AtmosphereBackdrop from './components/AtmosphereBackdrop'
import AppShell from './components/layout/AppShell'
import Placeholder from './components/ui/Placeholder'
import DesignDemo from './pages/DesignDemo'

export default function App() {
  return (
    <BrowserRouter>
      <AtmosphereBackdrop />
      <Routes>
        {/* isModerator is hardcoded until Step 2 lands accounts and the flag. */}
        <Route element={<AppShell isModerator />}>
          <Route
            index
            element={
              <Placeholder step="Step 1" icon={Store} title="Browse ventures">
                Ventures grouped by category with search, read live from Firestore. Needs the
                Firebase project first.
              </Placeholder>
            }
          />
          <Route
            path="categories"
            element={
              <Placeholder step="Step 1" icon={LayoutGrid} title="Categories">
                The six launch categories, each opening onto the ventures filed under it.
              </Placeholder>
            }
          />
          <Route
            path="venture/:ventureId"
            element={
              <Placeholder step="Step 1" icon={Compass} title="Venture detail">
                Photos, opening hours and the menu, where tapping an item opens WhatsApp with a
                message already written.
              </Placeholder>
            }
          />
          <Route
            path="signin"
            element={
              <Placeholder step="Step 2" icon={UserRound} title="Sign in">
                Firebase email-link sign-in, restricted to Thapar addresses. Blocked until the
                Firebase project exists and the exact student domain is confirmed.
              </Placeholder>
            }
          />
          <Route
            path="profile"
            element={
              <Placeholder step="Step 2" icon={UserRound} title="Your profile">
                Display username, your listed ventures, and sign out.
              </Placeholder>
            }
          />
          <Route
            path="add"
            element={
              <Placeholder step="Step 3" icon={Plus} title="List a venture">
                Name, category, hours, photos and a menu builder, submitted to the approval queue.
              </Placeholder>
            }
          />
          <Route
            path="moderator"
            element={
              <Placeholder step="Step 3" icon={Shield} title="Review queue">
                Approve or reject submissions, edit live listings, moderate chat, manage
                categories.
              </Placeholder>
            }
          />
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
  )
}
