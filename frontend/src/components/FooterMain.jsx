import React from 'react';
import styled from 'styled-components';

export const FooterMain = () => (
  <FooterContainer>
    © {new Date().getFullYear()} Glorbo
  </FooterContainer>
);

const FooterContainer = styled.footer`
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 50px;
  background: #1a1a1a;
  color: #aaa;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  border-top: 1px solid #2c2c2c;
`;
