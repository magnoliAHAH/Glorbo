import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';

const Sidebar = () => {
  return (
    <StyledSidebar>
      <NavLink to="/dashboard">Dashboard</NavLink>
      <NavLink to="/debug">AI Debug</NavLink>
      <NavLink to="/authentication">Authentication</NavLink>
      <NavLink to="/deploy">Deploy</NavLink>
      <NavLink to="/analitics">AI Analitics</NavLink>
      <NavLink to="/cicd">CI/CD</NavLink>
      <NavLink to="/assistant">AI Assistant</NavLink>
      
    </StyledSidebar>
  );
};

const StyledSidebar = styled.div`
  width: 200px;
  background-color: #1f1f1f;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  a {
    color: white;
    text-decoration: none;
    padding: 8px;
    border-radius: 4px;
  }

  a.active {
    background-color: #333;
  }
`;

export default Sidebar;
