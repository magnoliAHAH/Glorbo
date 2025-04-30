import React from 'react';
import styled from 'styled-components';

const Header = () => (
  <HeaderContainer>
    <span>🔥 project </span>
  </HeaderContainer>
);

export default Header;

const HeaderContainer = styled.header`
  height: 60px;
  background-color: #1a1a1a;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  position: fixed;
  left: 240px;
  right: 0;
  top: 0;
  z-index: 99;
  border-bottom: 1px solid #2c2c2c;
`;
