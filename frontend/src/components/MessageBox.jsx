// src/components/MessageBox.jsx
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

const slideIn = keyframes`
    from { transform: translateY(-50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
`;

const MessageBoxOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000; /* Выше, чем все остальные модальные окна */
    animation: ${fadeIn} 0.15s ease-out;
`;

const MessageBoxContent = styled.div`
    background: white;
    padding: 25px 35px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    width: 380px;
    max-width: 90%;
    text-align: center;
    animation: ${slideIn} 0.2s ease-out;
`;

const Title = styled.h3`
    margin-top: 0;
    color: #333;
    font-size: 1.6em;
    margin-bottom: 15px;
`;

const Message = styled.p`
    color: #555;
    font-size: 1em;
    line-height: 1.5;
    margin-bottom: ${props => props.$hasInput ? '10px' : '25px'};
`;

const Input = styled.input`
    width: calc(100% - 20px);
    padding: 10px;
    margin-bottom: 20px;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-size: 1em;
    box-sizing: border-box; /* Для корректного расчета ширины */
`;

const ButtonContainer = styled.div`
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 15px;
`;

const Button = styled.button`
    padding: 10px 22px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95em;
    font-weight: bold;
    transition: background-color 0.2s ease, transform 0.1s ease;

    &.primary {
        background-color: #3070f0;
        color: white;
        &:hover {
            background-color: #2554c7;
            transform: translateY(-1px);
        }
    }

    &.secondary {
        background-color: #e0e0e0;
        color: #555;
        &:hover {
            background-color: #d0d0d0;
            transform: translateY(-1px);
        }
    }

    &.danger {
        background-color: #ef4444;
        color: white;
        &:hover {
            background-color: #dc2626;
            transform: translateY(-1px);
        }
    }
`;

/**
 * Универсальный компонент для вывода сообщений (alert, confirm, prompt).
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Открыто ли модальное окно.
 * @param {string} props.type - Тип сообщения: 'alert', 'confirm', 'prompt'.
 * @param {string} props.title - Заголовок сообщения.
 * @param {string} props.message - Основной текст сообщения.
 * @param {string} [props.placeholder] - Плейсхолдер для поля ввода (только для type='prompt').
 * @param {function} [props.onConfirm] - Колбэк при подтверждении (для 'confirm', 'prompt'). Принимает введенное значение для 'prompt'.
 * @param {function} [props.onCancel] - Колбэк при отмене (для 'confirm', 'prompt').
 * @param {function} [props.onClose] - Колбэк при закрытии (для 'alert').
 */
const MessageBox = ({ isOpen, type, title, message, placeholder, onConfirm, onCancel, onClose }) => {
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (isOpen && type === 'prompt') {
            setInputValue(''); // Сбрасываем значение при открытии для prompt
        }
    }, [isOpen, type]);

    if (!isOpen) {
        return null;
    }

    const handleConfirm = () => {
        if (type === 'prompt') {
            onConfirm && onConfirm(inputValue);
        } else {
            onConfirm && onConfirm();
        }
        onCloseInternal();
    };

    const handleCancel = () => {
        onCancel && onCancel();
        onCloseInternal();
    };

    const onCloseInternal = () => {
        onClose && onClose(); // Для alert
        onCancel && onCancel(); // Для confirm/prompt при клике на оверлей
    }

    const hasInput = type === 'prompt';

    return (
        <MessageBoxOverlay onClick={type === 'alert' ? onCloseInternal : handleCancel}>
            <MessageBoxContent onClick={e => e.stopPropagation()}>
                <Title>{title}</Title>
                <Message $hasInput={hasInput}>{message}</Message>
                {hasInput && (
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        autoFocus // Фокус на поле ввода
                    />
                )}
                <ButtonContainer>
                    {type === 'confirm' && (
                        <Button className="secondary" onClick={handleCancel}>
                            Отмена
                        </Button>
                    )}
                    {type === 'prompt' && (
                        <Button className="secondary" onClick={handleCancel}>
                            Отмена
                        </Button>
                    )}
                    <Button className={type === 'confirm' ? 'danger' : 'primary'} onClick={handleConfirm}>
                        {type === 'alert' ? 'ОК' : (type === 'confirm' ? 'Подтвердить' : 'Создать')}
                    </Button>
                </ButtonContainer>
            </MessageBoxContent>
        </MessageBoxOverlay>
    );
};

export default MessageBox;