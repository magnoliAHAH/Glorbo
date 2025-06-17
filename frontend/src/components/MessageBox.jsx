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