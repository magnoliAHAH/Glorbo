import React from 'react';
import { deleteService } from '../functions/api/api';

const DeleteServiceButton = ({ serviceId, projectId, onDeleted }) => {
    const handleDelete = async () => {
        const confirmDelete = window.confirm('Вы уверены, что хотите удалить этот сервис?');
        if (!confirmDelete) return;

        try {
            await deleteService(serviceId, projectId);
            alert('Сервис успешно удалён.');

            if (onDeleted) {
                onDeleted(serviceId);
            }
        } catch (error) {
            alert('Ошибка при удалении сервиса.');
            console.error(error);
        }
    };

    return (
        <button
            onClick={handleDelete}
            style={{
                padding: '8px 16px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#c0392b')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#e74c3c')}
        >
            Удалить
        </button>
    );
};

export default DeleteServiceButton;
