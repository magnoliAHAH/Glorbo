import React from 'react'
import ModernButton from '../components/ModernButton'
import RegistrationComponent from '../components/RegistrationComponent'
import LoginForm from '../components/LoginComponent'

const Login = () => {
  return (
    <div>
      Login
      <RegistrationComponent/>
      <LoginForm/>
      <ModernButton link='/projects' name="Проекты"/>
    </div>
  )
}

export default Login
