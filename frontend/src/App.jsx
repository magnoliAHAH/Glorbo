import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import About from './pages/About'
import ProjectsList from './pages/ProjectsList'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import MainLayout from './layouts/MainLayout'

import Debug from './pages/Debug'
import Authentication from './pages/Authentication'
import Deploy from './pages/Deploy'
import Analitics from './pages/Analitics'
import Assistant from './pages/Assistant'
import Cicd from './pages/Cicd'


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/projects" element={<ProjectsList />} />
        <Route path="/login" element={<Login/>}/>

        <Route element={<MainLayout/>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/authentication" element={<Authentication />} />
          <Route path="/debug" element={<Debug/>} />
          <Route path="/deploy" element={<Deploy/>} />
          <Route path="/analitics" element={<Analitics/>} />
          <Route path="/assistant" element={<Assistant/>} />
          <Route path="/cicd" element={<Cicd/>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
