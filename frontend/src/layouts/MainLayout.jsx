// src/layouts/MainLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';
import Sidebar from '../components/Sidebar';

const MainLayout = () => {
  return (
    <Wrapper>
      <Sidebar />
      <Main>
        <Outlet />
      </Main>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  display: flex;
  height: 100vh;
`;

const Main = styled.main`
  flex: 1;
  padding: 20px;
  background-color: #f4f4f4;
`;

export default MainLayout;
