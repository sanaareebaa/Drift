import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login/Login'
import Home from './pages/Home/Home'
import EnterIdea from './pages/EnterIdea/EnterIdea'
import Workspace from './pages/Workspace/Workspace'
import IdeaDetail from './pages/IdeaDetail/IdeaDetail'

// Routes only. Pages never import each other.
const guard = (page) => <ProtectedRoute>{page}</ProtectedRoute>

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/home" element={guard(<Home />)} />
      <Route path="/enter" element={guard(<EnterIdea />)} />
      <Route path="/workspace" element={guard(<Workspace />)} />
      <Route path="/workspace/:id" element={guard(<IdeaDetail />)} />
    </Routes>
  )
}
