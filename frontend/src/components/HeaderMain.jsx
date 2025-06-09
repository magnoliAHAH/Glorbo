import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

export const HeaderMain = () => (
  <HeaderContainer>
    <Logo>🔥 Glorbo</Logo>
    <Nav>
      <StyledLink to="/">Home</StyledLink>
      <StyledLink to="#features">Features</StyledLink>
      <StyledLink to="/login">Log In</StyledLink>
    </Nav>
  </HeaderContainer>
);

const HeaderContainer = styled.header`
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 60px;
  background: #1a1a1a;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  z-index: 1000;
  border-bottom: 1px solid #2c2c2c;
`;

const Logo = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
`;

const Nav = styled.nav`
  margin-left: auto;
  display: flex;
  gap: 20px;
`;

const StyledLink = styled(Link)`
  color: white;
  text-decoration: none;
  padding: 8px;
  border-radius: 4px;
  &:hover {
    background: #2c2c2c;
  }
`;
