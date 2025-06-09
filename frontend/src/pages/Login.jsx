import React, { useState } from 'react';
import ModernButton from '../components/ModernButton';
import RegistrationComponent from '../components/RegistrationComponent';
import LoginForm from '../components/LoginComponent';
import styled from 'styled-components';
import { HeaderMain } from '../components/HeaderMain';
import { FooterMain } from '../components/FooterMain';

const Login = () => {
  const [showLogin, setShowLogin] = useState(true);

  return (
    <>
      <HeaderMain />
      <MainContent>
        <PageTitle>{showLogin ? 'Вход' : 'Регистрация'}</PageTitle>

        {showLogin ? <LoginForm /> : <RegistrationComponent />}

        <ToggleText>
          {showLogin ? (
            <>
              Нет аккаунта?{' '}
              <ToggleLink onClick={() => setShowLogin(false)}>
                Зарегистрироваться
              </ToggleLink>
            </>
          ) : (
            <>
              Уже есть аккаунт?{' '}
              <ToggleLink onClick={() => setShowLogin(true)}>
                Войти
              </ToggleLink>
            </>
          )}
        </ToggleText>

        <ModernButton link="/projects" name="Проекты" />
      </MainContent>
      <FooterMain />
    </>
  );
};

export default Login;

const MainContent = styled.main`
  padding-top: 60px;   /* чтобы не перекрывало header */
  padding-bottom: 50px; /* чтобы не перекрывало footer */
  min-height: calc(100vh - 110px);
  background: #121212;
  color: #eee;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const PageTitle = styled.h1`
  margin-top: 20px;
  font-size: 2rem;
`;

const ToggleText = styled.div`
  margin-top: 1rem;
  font-size: 1rem;
  color: #bbb;
`;

const ToggleLink = styled.span`
  color: #3070f0;
  cursor: pointer;
  text-decoration: underline;
  &:hover {
    color: #2554c7;
  }
`;
