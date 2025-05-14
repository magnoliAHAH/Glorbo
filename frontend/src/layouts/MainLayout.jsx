// src/layouts/MainLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

const MainLayout = () => {
  return (
    <Wrapper>
      <Sidebar />
      <Header/>
      <Main>
        <Outlet />
      </Main>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden; /* Блокируем скролл всей страницы */
`;

const Main = styled.main`
  flex: 1;
  padding: 20px;
  background-color: #f4f4f4;
  overflow-y: scroll; /* Форсированный скролл */
`;

export default MainLayout;
