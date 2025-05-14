import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import {
  FiHome,
  FiTool,
  FiLock,
  FiUpload,
  FiBarChart2,
  FiSettings,
  FiCpu,
} from 'react-icons/fi';

const Sidebar = () => {
  return (
    <StyledSidebar>
      <TopSection>
        <Logo>🚀 DevTools</Logo>

        <NavLinks>

          <NavItem to="/dashboard">
            <FiHome />
            Dashboard
          </NavItem>
          <NavItem to="/debug">
            <FiTool />
            AI Debug
          </NavItem>
          <NavItem to="/authentication">
            <FiLock />
            Authentication
          </NavItem>
          <NavItem to="/deploy">
            <FiUpload />
            Deploy
          </NavItem>
          <NavItem to="/analytics">
            <FiBarChart2 />
            AI Analytics
          </NavItem>
          <NavItem to="/cicd">
            <FiSettings />
            CI/CD
          </NavItem>
          <NavItem to="/monitoring">
            <FiBarChart2 />
            Monitoring
          </NavItem>
          <NavItem to="/logs">
            <FiTool />
            Logs & Traces
          </NavItem>
          <NavItem to="/tests">
            <FiCpu />
            Auto Tests
          </NavItem>
          <NavItem to="/docs">
            <FiUpload />
            Docs Generator
          </NavItem>
          <NavItem to="/linter">
            <FiTool />
            Linter & Formatter
          </NavItem>
          <NavItem to="/performance">
            <FiBarChart2 />
            Performance
          </NavItem>
          <NavItem to="/terminal">
            <FiCpu />
            Cloud Terminal
          </NavItem>
          <NavItem to="/secrets">
            <FiLock />
            Secrets Manager
          </NavItem>
          <NavItem to="/webhooks">
            <FiUpload />
            Webhooks
          </NavItem>
          <NavItem to="/editor">
            <FiTool />
            Online Editor
          </NavItem>
          <NavItem to="/notifications">
            <FiSettings />
            Notifications
          </NavItem>
          <NavItem to="/integrations">
            <FiCpu />
            Integrations
          </NavItem>
          <NavItem to="/assistant">
            <FiCpu />
            AI Assistant
          </NavItem>

        </NavLinks>
      </TopSection>

      <BottomSection>
        <NavItem to="/settings">
          <FiSettings />
          Настройки
        </NavItem>
      </BottomSection>
    </StyledSidebar>
  );
};

const StyledSidebar = styled.div`
  width: 240px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1f1f1f 0%, #121212 100%);
  padding: 0px 0px 0px 10px;
`;


const TopSection = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

const BottomSection = styled.div`
  border-top: 1px solid #2c2c2c;
  padding-top: 20px;
`;

const Logo = styled.div`
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: bold;
  margin: 24px 0;
`;

const NavLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow-y: auto;
`;

const NavItem = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 12px;
  color: #cfcfcf;
  text-decoration: none;
  font-size: 1rem;
  padding: 10px 14px;
  border-radius: 8px;
  transition: background 0.2s ease, color 0.2s ease;

  &:hover {
    background-color: #2a2a2a;
    color: #ffffff;
  }

  &.active {
    background-color: #3f51b5;
    color: white;
  }

  svg {
    font-size: 1.2rem;
  }
`;

const BackButton = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #9ca3af;
  font-size: 0.9rem;
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: transparent;
  transition: background 0.2s;

  &:hover {
    background-color: #2c2c2c;
    color: #fff;
  }

  svg {
    font-size: 1rem;
  }
`;

export default Sidebar;
