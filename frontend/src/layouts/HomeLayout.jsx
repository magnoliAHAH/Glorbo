import React from 'react';
import styled from 'styled-components';
import { HeaderMain } from '../components/HeaderMain';
import { FooterMain } from '../components/FooterMain';

export const HomeLayout = ({ children }) => (
  <Container>
    <HeaderMain />
    <Main>{children}</Main>
    <FooterMain />
  </Container>
);

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const Main = styled.main`
  flex: 1;
  padding-top: 60px;   /* компенсируем высоту хедера */
  padding-bottom: 50px;/* высоту футера */
  background: #121212;
`;
