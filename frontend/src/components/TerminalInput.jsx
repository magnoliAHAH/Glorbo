import React from 'react';
import styled from 'styled-components';

const TerminalInput = () => {
  return (
    <StyledWrapper>
      <div className="card">
        <div className="terminal">
          <div className="terminal-header">
            <span className="terminal-title">
              <svg className="terminal-icon" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 17l6-6-6-6M12 19h8" />
              </svg>
              Terminal
            </span>
          </div>
          <div className="terminal-body">
            <div className="command-line">
              <span className="prompt">password:</span>
              <div className="input-wrapper">
                <input type="password" className="input-field" placeholder="Enter password" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .card {
    background-color: rgba(217, 217, 217, 0.18);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    width: 400px;
  }

  .terminal-header {
    background-color: #202425;
    padding: 10px 15px;
    display: flex;
    align-items: center;
  }

  .terminal-title {
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .terminal-icon {
    color: #006adc;
  }

  .terminal-body {
    background-color: #202425;
    color: #ffffff;
    padding: 15px;
    font-family: "Courier New", Courier, monospace;
  }

  .command-line {
    display: flex;
    align-items: center;
  }

  .prompt {
    color: #ffffff;
    margin-right: 10px;
  }

  .input-wrapper {
    position: relative;
    flex-grow: 1;
  }

  .input-field {
    background-color: transparent;
    border: none;
    color: #006adc;
    font-family: inherit;
    font-size: 14px;
    outline: none;
    width: 100%;
    padding-right: 10px;
  }

  .input-field::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .input-wrapper::after {
    content: "";
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 8px;
    height: 15px;
    background-color: #ffffff;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }`;

export default TerminalInput;
