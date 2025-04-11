import React from 'react';
import styled from 'styled-components';

const StartButton = () => {
  return (
    <StyledWrapper>
      <button className="button">
        <span className="shadow" />
        <span className="edge" />
        <div className="front">
          <span>Start</span>
          <svg fill="currentColor" viewBox="0 0 20 20" className="arrow">
            <path clipRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" fillRule="evenodd" />
          </svg>
        </div>
      </button>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .button {
    position: relative;
    border: none;
    background: transparent;
    padding: 0;
    outline: none;
    cursor: pointer;
    font-family: monospace;
    font-weight: 300;
    text-transform: uppercase;
    font-size: 1.25rem;
  }

  .button .shadow {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 0.5rem;
    transform: translateY(0.125rem);
    transition: transform 600ms cubic-bezier(0.3, 0.7, 0.4, 1);
  }

  .button .edge {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 0.5rem;
    background: linear-gradient(
      to left,
      hsl(217, 33%, 16%) 0%,
      hsl(217, 33%, 32%) 8%,
      hsl(217, 33%, 32%) 92%,
      hsl(217, 33%, 16%) 100%
    );
  }

  .button .front {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    color: white;
    background: linear-gradient(to right, #f27121, #e94057, #8a2387);
    border-radius: 0.5rem;
    transform: translateY(-0.25rem);
    gap: 0.75rem;
    transition: transform 600ms cubic-bezier(0.3, 0.7, 0.4, 1);
  }

  .button .front .arrow {
    margin-left: 0.5rem;
    display: inline-block;
    width: 1.25rem;
    height: 1.25rem;
    transition: transform 250ms cubic-bezier(0.3, 0.7, 0.4, 1.5);
    fill: currentColor;
  }

  .button:hover .shadow {
    transform: translateY(0.25rem);
    transition: transform 250ms cubic-bezier(0.3, 0.7, 0.4, 1.5);
  }

  .button:hover .front {
    transform: translateY(-0.375rem);
    transition: transform 250ms cubic-bezier(0.3, 0.7, 0.4, 1.5);
    filter: brightness(115%);
  }

  .button:hover .front .arrow {
    transform: translateX(0.25rem);
  }

  .button:active .shadow {
    transform: translateY(0.0625rem);
    transition: transform 34ms;
  }

  .button:active .front {
    transform: translateY(-0.125rem);
    transition: transform 34ms;
  }

  .button .front span {
    user-select: none;
  }`;

export default StartButton;
