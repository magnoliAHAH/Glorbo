import React from 'react'
import ModernButton from '../components/ModernButton'
import TerminalInput from '../components/TerminalInput'
import RegistrationComponent from '../components/RegistrationComponent'
import LoginForm from '../components/LoginComponent'

const Login = () => {
  return (
    <div>
      Login
      <RegistrationComponent/>
      <LoginForm/>
      <ModernButton />
    </div>
  )
}

export default Login
