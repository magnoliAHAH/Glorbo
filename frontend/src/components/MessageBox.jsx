import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

// --- Styled Components (остаются такими же, как вы предоставили) ---
const fadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

const MessageBoxOverlay = styled.div`
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: ${fadeIn} 0.15s ease-out;
`;

const MessageBoxContent = styled.div`
    background: white;
    padding: 25px 35px; /* Увеличен padding для лучшего вида */
    border-radius: 10px; /* Более закругленные углы */
    width: 450px; /* Увеличена ширина для формы */
    max-width: 90%;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    animation: ${fadeIn} 0.2s ease-out; /* Более плавная анимация */
    display: flex; /* Для компоновки содержимого */
    flex-direction: column;
    gap: 15px; /* Промежутки между элементами формы */
`;

const Title = styled.h2`
    margin-top: 0;
    font-size: 1.8em; /* Увеличен размер заголовка */
    color: #333;
    text-align: center; /* Центрирование заголовка */
    margin-bottom: 15px; /* Отступ снизу */
`;

const Message = styled.p`
    margin: 10px 0;
    color: #555;
    font-size: 1em;
    line-height: 1.5;
    text-align: center; /* Центрирование сообщения */
`;

const InputGroup = styled.div`
    display: flex;
    flex-direction: column;
    margin-bottom: 10px;
`;

const Label = styled.label`
    font-size: 0.9em;
    color: #333;
    margin-bottom: 5px;
    font-weight: bold;
    text-align: left; /* Выравнивание лейбла по левому краю */
`;

const Input = styled.input`
    width: calc(100% - 20px); /* Учитываем padding */
    padding: 10px; /* Увеличен padding */
    border-radius: 5px; /* Более закругленные углы */
    border: 1px solid #ddd; /* Более светлая граница */
    font-size: 1em;
    box-sizing: border-box; /* Для корректного расчета ширины */
    &:focus {
        outline: none;
        border-color: #007bff; /* Цвет при фокусе */
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25); /* Тень при фокусе */
    }
`;

const ButtonContainer = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px; /* Отступ сверху для кнопок */
`;

const Button = styled.button`
    padding: 10px 22px; /* Увеличен padding */
    border: none;
    border-radius: 6px; /* Более закругленные углы */
    cursor: pointer;
    font-size: 0.95em; /* Немного уменьшен размер шрифта */
    font-weight: bold;
    transition: background-color 0.2s ease, transform 0.1s ease;

    &.primary {
        background-color: #007bff;
        color: white;
        &:hover {
            background-color: #0056b3;
            transform: translateY(-1px);
        }
    }

    &.secondary {
        background-color: #e0e0e0; /* Более светлый серый */
        color: #555; /* Темнее текст */
        &:hover {
            background-color: #d0d0d0;
            transform: translateY(-1px);
        }
    }

    &.danger {
        background-color: #dc3545;
        color: white;
        &:hover {
            background-color: #c82333;
            transform: translateY(-1px);
        }
    }
`;

/**
 * Универсальный компонент для вывода сообщений (alert, confirm, prompt, form).
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Открыто ли модальное окно.
 * @param {string} props.type - Тип сообщения: 'alert', 'confirm', 'prompt', 'form'.
 * @param {string} props.title - Заголовок сообщения.
 * @param {string} props.message - Основной текст сообщения.
 * @param {string} [props.placeholder] - Плейсхолдер для поля ввода (только для type='prompt').
 * @param {Array<Object>} [props.fields] - Массив определений полей для ввода (только для type='form').
 * Каждый объект поля: { name: string, label: string, type: string (e.g., 'text', 'number'), defaultValue: any, placeholder: string }
 * @param {function} [props.onConfirm] - Колбэк при подтверждении. Для 'prompt' передает введенное значение. Для 'form' передает объект со всеми введенными данными.
 * @param {function} [props.onCancel] - Колбэк при отмене.
 * @param {function} [props.onClose] - Колбэк при закрытии (для 'alert'), также вызывается после onConfirm/onCancel.
 */
const MessageBox = ({ isOpen, type, title, message, placeholder, fields, onConfirm, onCancel, onClose }) => {
    // Состояние для одиночного ввода (prompt)
    const [inputValue, setInputValue] = useState('');
    // Состояние для множественного ввода (form)
    const [formValues, setFormValues] = useState({});

    useEffect(() => {
        if (isOpen) {
            if (type === 'prompt') {
                setInputValue('');
            } else if (type === 'form' && fields) {
                // Инициализируем formValues из defaultValue полей
                const initialValues = {};
                fields.forEach(field => {
                    initialValues[field.name] = field.defaultValue !== undefined ? field.defaultValue : '';
                });
                setFormValues(initialValues);
            }
        }
    }, [isOpen, type, fields]);

    if (!isOpen) return null;

    const hasInput = type === 'prompt';
    const isForm = type === 'form';

    const handleConfirm = () => {
        if (isForm) {
            onConfirm && onConfirm(formValues);
        } else if (hasInput) {
            onConfirm && onConfirm(inputValue);
        } else {
            onConfirm && onConfirm();
        }
        onClose && onClose();
    };

    const handleCancel = () => {
        onCancel && onCancel();
        onClose && onClose();
    };

    const handleOverlayClick = () => {
        if (type === 'alert') {
            onClose && onClose();
        } else {
            handleCancel();
        }
    };

    const handleFormInputChange = (e) => {
        const { name, value, type: inputType, checked } = e.target;
        setFormValues(prevValues => ({
            ...prevValues,
            [name]: inputType === 'checkbox' ? checked : value
        }));
    };

    return (
        <MessageBoxOverlay onClick={handleOverlayClick}>
            <MessageBoxContent onClick={e => e.stopPropagation()}>
                <Title>{title}</Title>
                <Message>{message}</Message> {/* $hasInput удален, так как Message может быть и для форм */}

                {hasInput && ( // Рендерим одиночное поле ввода для 'prompt'
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        autoFocus
                    />
                )}

                {isForm && fields && ( // Рендерим несколько полей ввода для 'form'
                    <div>
                        {fields.map(field => (
                            <InputGroup key={field.name}>
                                <Label htmlFor={field.name}>{field.label}</Label>
                                <Input
                                    id={field.name}
                                    name={field.name}
                                    type={field.type || 'text'}
                                    placeholder={field.placeholder || ''}
                                    value={formValues[field.name] || ''}
                                    onChange={handleFormInputChange}
                                    {...(field.type === 'number' && { inputMode: 'numeric', pattern: '[0-9]*' })} // Для числовых полей
                                    {...(field.autoFocus && { autoFocus: true })} // Автофокус для первого поля
                                />
                            </InputGroup>
                        ))}
                    </div>
                )}

                <ButtonContainer>
                    {(type === 'confirm' || type === 'prompt' || type === 'form') && (
                        <Button className="secondary" onClick={handleCancel}>
                            Отмена
                        </Button>
                    )}
                    <Button
                        className={type === 'confirm' ? 'danger' : 'primary'}
                        onClick={handleConfirm}
                    >
                        {type === 'alert' ? 'OK'
                        : type === 'confirm' ? 'Подтвердить'
                        : 'Создать'} {/* Для 'prompt' и 'form' */}
                    </Button>
                </ButtonContainer>
            </MessageBoxContent>
        </MessageBoxOverlay>
    );
};

export default MessageBox;
