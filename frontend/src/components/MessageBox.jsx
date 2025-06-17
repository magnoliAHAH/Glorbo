import React, { useState, useEffect } from 'react'


const MessageBox = ({ isOpen, type, title, message, placeholder, onConfirm, onCancel, onClose }) => {
    const [inputValue, setInputValue] = useState('')
  
    useEffect(() => {
      if (isOpen && type === 'prompt') {
        setInputValue('')
      }
    }, [isOpen, type])
  
    if (!isOpen) return null
  
    const hasInput = type === 'prompt'
  
    const handleConfirm = () => {
      if (hasInput) {
        onConfirm && onConfirm(inputValue)
      } else {
        onConfirm && onConfirm()
      }
      onClose && onClose()
    }
  
    const handleCancel = () => {
      onCancel && onCancel()
      onClose  && onClose()
    }
  
    // Нажатие на overlay для prompt/confirms тоже отменяет
    const handleOverlayClick = () => {
      if (type === 'alert') {
        onClose && onClose()
      } else {
        handleCancel()
      }
    }
  
    return (
      <MessageBoxOverlay onClick={handleOverlayClick}>
        <MessageBoxContent onClick={e => e.stopPropagation()}>
          <Title>{title}</Title>
          <Message $hasInput={hasInput}>{message}</Message>
          {hasInput && (
            <Input
              type="text"
              placeholder={placeholder}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              autoFocus
            />
          )}
          <ButtonContainer>
            {(type === 'confirm' || type === 'prompt') && (
              <Button className="secondary" onClick={handleCancel}>
                Отмена
              </Button>
            )}
            <Button
              className={type === 'confirm' ? 'danger' : 'primary'}
              onClick={handleConfirm}
            >
              {type === 'alert'   ? 'OK'
             : type === 'confirm' ? 'Подтвердить'
             :                      'Создать'}
            </Button>
          </ButtonContainer>
        </MessageBoxContent>
      </MessageBoxOverlay>
    )
  }
  
  export default MessageBox

  import styled from 'styled-components'

const MessageBoxOverlay = styled.div`
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`

const MessageBoxContent = styled.div`
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
`

const Title = styled.h2`
  margin-top: 0;
`

const Message = styled.p`
  margin: 10px 0;
`

const Input = styled.input`
  width: 100%;
  padding: 8px;
  margin: 10px 0;
  border-radius: 4px;
  border: 1px solid #ccc;
`

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`

const Button = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &.primary {
    background-color: #007bff;
    color: white;
  }

  &.secondary {
    background-color: #6c757d;
    color: white;
  }

  &.danger {
    background-color: #dc3545;
    color: white;
  }
`
