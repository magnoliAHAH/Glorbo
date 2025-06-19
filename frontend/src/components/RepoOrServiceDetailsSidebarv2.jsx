import React, { useState, useEffect } from 'react';
import ServiceLogs from './ServiceLogs'; // Убедитесь, что пути правильные
import DeployLogs from './DeployLogs';
import ServiceUpdates from './ServiceUpdates';

// Предполагаемые стилизованные компоненты
// import { SidebarWrapper, SidebarHeader, CloseButton, SidebarContent, Button } from './YourStyledComponents';
// Или если вы используете Tailwind CSS:
// const SidebarWrapper = ({ isOpen, children }) => (
//     <div className={`fixed inset-y-0 right-0 w-80 bg-gray-800 text-white shadow-lg transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out z-50 rounded-l-lg p-4`}>
//         {children}
//     </div>
// );
// const SidebarHeader = ({ children }) => <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">{children}</div>;
// const CloseButton = ({ onClick, children }) => <button onClick={onClick} className="text-gray-400 hover:text-white transition-colors duration-200"> {children} </button>;
// const SidebarContent = ({ children }) => <div className="space-y-4 text-sm overflow-y-auto h-[calc(100%-8rem)]">{children}</div>; // Увеличено пространство для контента
// const Button = ({ onClick, children, className = "" }) => <button onClick={onClick} className={`px-4 py-2 rounded-md transition-colors duration-200 ${className}`}>{children}</button>;
// const TabButton = ({ isActive, onClick, children }) => (
//     <button
//         onClick={onClick}
//         className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
//             isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
//         }`}
//     >
//         {children}
//     </button>
// );


// --- ЗАГЛУШКИ: Замените на ваши реальные компоненты/функции ---
// Если вы используете Tailwind, то вам понадобятся похожие компоненты для стилизации.
// Для демонстрации я включаю базовые стилизованные компоненты, если у вас их нет.
const SidebarWrapper = ({ isOpen, children }) => (
    <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '320px', // w-80
        height: '100%',
        backgroundColor: '#1f2937', // bg-gray-800
        color: '#f9fafb', // text-white
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', // shadow-lg
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        zIndex: 50,
        borderLeft: '1px solid #374151', // border-gray-700
        padding: '1rem', // p-4
        borderRadius: '0.5rem 0 0 0.5rem', // rounded-l-lg
        display: 'flex',
        flexDirection: 'column'
    }}>
        {children}
    </div>
);

const SidebarHeader = ({ children }) => (
    <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem', // mb-4
        paddingBottom: '0.5rem', // pb-2
        borderBottom: '1px solid #4b5563', // border-gray-700
    }}>
        {children}
    </div>
);

const CloseButton = ({ onClick, children }) => (
    <button
        onClick={onClick}
        style={{
            color: '#9ca3af', // text-gray-400
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'color 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.color = '#fff'} // hover:text-white
        onMouseOut={(e) => e.currentTarget.style.color = '#9ca3af'}
    >
        {children}
    </button>
);

const SidebarContent = ({ children }) => (
    <div style={{
        flexGrow: 1, // To make it take available space
        overflowY: 'auto', // overflow-y-auto
        paddingRight: '0.5rem', // For scrollbar
        marginBottom: '1rem', // Space before buttons
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem', // space-y-4
        fontSize: '0.875rem', // text-sm
    }}>
        {children}
    </div>
);

const Button = ({ onClick, children, className = "" }) => (
    <button
        onClick={onClick}
        className={className} // Allows custom classes from Tailwind if used
        style={{
            padding: '0.5rem 1rem', // px-4 py-2
            borderRadius: '0.375rem', // rounded-md
            transition: 'background-color 0.2s',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: '#3b82f6', // Example blue
            color: 'white',
            fontWeight: '600'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
    >
        {children}
    </button>
);

const TabButton = ({ isActive, onClick, children }) => (
    <button
        onClick={onClick}
        style={{
            padding: '0.5rem 1rem', // px-4 py-2
            fontSize: '0.875rem', // text-sm
            fontWeight: '500', // font-medium
            borderRadius: '0.375rem', // rounded-md
            transition: 'background-color 0.2s, color 0.2s, box-shadow 0.2s',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: isActive ? '#2563eb' : '#374151', // bg-blue-600 vs bg-gray-700
            color: isActive ? 'white' : '#d1d5db', // text-white vs text-gray-300
            boxShadow: isActive ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none', // shadow-md
        }}
        onMouseOver={(e) => {
            if (!isActive) e.currentTarget.style.backgroundColor = '#4b5563'; // hover:bg-gray-600
        }}
        onMouseOut={(e) => {
            if (!isActive) e.currentTarget.style.backgroundColor = '#374151';
        }}
    >
        {children}
    </button>
);


// --- Конец ЗАГЛУШЕК ---


// Заглушки для функций рендеринга информации о репозитории и сервисе
const renderFileNodeForSidebar = (content) => {
    if (!content) return <p>No repository content available.</p>;
    return (
        <div className="space-y-2">
            <h4 className="font-semibold">Repository: {content.name}</h4>
            <p><strong>URL:</strong> <a href={content.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{content.url}</a></p>
            {/* Добавьте больше деталей о репозитории здесь */}
        </div>
    );
};

const renderServiceInfoForSidebar = (content) => {
    if (!content) return <p>No service details available.</p>;
    return (
        <div className="space-y-2">
            <h4 className="font-semibold">Service Name: {content.label || content.name}</h4>
            <p><strong>ID:</strong> {content.id}</p>
            <p><strong>Project ID:</strong> {content.projectId}</p>
            <p><strong>Type:</strong> {content.serviceType}</p>
            <p><strong>Status:</strong> {content.status}</p>
            {content.nodePort && <p><strong>NodePort:</strong> {content.nodePort}</p>}
            {content.namespace && <p><strong>Namespace:</strong> {content.namespace}</p>}
            {content.image && <p><strong>Image:</strong> {content.image}</p>}
            {content.replicas && <p><strong>Replicas:</strong> {content.replicas}</p>}
            {content.volume && <p><strong>Volume:</strong> {content.volume}</p>}
            {content.version && <p><strong>Version:</strong> {content.version}</p>}
            {content.path && <p><strong>Path:</strong> {content.path}</p>}
            {content.k8sDeploymentName && <p><strong>K8s Deployment:</strong> {content.k8sDeploymentName}</p>}
            {content.k8sServiceName && <p><strong>K8s Service:</strong> {content.k8sServiceName}</p>}
            {/* Добавьте больше деталей, если они есть в content */}
        </div>
    );
};


const RepoOrServiceDetailsSidebarv2 = ({ isOpen, content, onClose, onDeleteNode }) => {
    // Определяем начальную активную вкладку. По умолчанию 'details'.
    const [activeView, setActiveView] = useState('details');

    // Если content меняется (т.е. выбран другой узел), сбрасываем активную вкладку на 'details'
    useEffect(() => {
        if (isOpen) {
            setActiveView('details');
        }
    }, [content, isOpen]);


    const isServiceNode = content?.type === 'serviceNode' || content?.type === 'service';

    const handleDeleteClick = () => {
        // Убедимся, что это serviceNode и что есть onDeleteNode проп и необходимые данные
        if (isServiceNode && onDeleteNode && content?.id && typeof content?.projectId === 'number') {
            // Предполагаем, что setShowMessageBox доступен из родительского компонента
            setShowMessageBox({
                isOpen: true,
                type: 'confirm',
                title: 'Подтверждение удаления',
                message: `Вы уверены, что хотите удалить сервис "${content.label || content.name || content.id}"? Это действие необратимо.`,
                onConfirm: () => {
                    onDeleteNode(content.id, content.projectId);
                    setShowMessageBox(null); // Закрываем MessageBox
                    onClose(); // Закрываем сайдбар после удаления
                },
                onCancel: () => setShowMessageBox(null) // Закрываем MessageBox при отмене
            });
        } else {
            console.warn('Attempted to delete a node that is not a serviceNode or is missing ID/ProjectID.', content);
            setShowMessageBox({
                isOpen: true,
                type: 'alert',
                title: 'Ошибка',
                message: 'Невозможно удалить: это не сервис или отсутствуют необходимые данные (ID/ProjectID).',
                onClose: () => setShowMessageBox(null)
            });
        }
    };

    // Определяем, какой контент рендерить в зависимости от activeView
    const renderContent = () => {
        if (!content) {
            return <p>Выберите узел для просмотра его деталей.</p>;
        }

        if (content.type === 'repo') {
            return renderFileNodeForSidebar(content);
        }

        // Если это serviceNode, отображаем контент в соответствии с выбранной вкладкой
        switch (activeView) {
            case 'details':
                return renderServiceInfoForSidebar(content);
            case 'logs':
                return <ServiceLogs serviceId={content.id} />; // Используем новый компонент
            case 'deploy-logs':
                return <DeployLogs serviceId={content.id} />; // Используем новый компонент
            case 'updates':
                return <ServiceUpdates serviceId={content.id} />; // Используем новый компонент
            default:
                return renderServiceInfoForSidebar(content);
        }
    };

    return (
        <SidebarWrapper isOpen={isOpen}>
            <SidebarHeader>
                <h3>{content?.type === 'repo' ? 'Структура репозитория' : 'Детали сервиса'}</h3>
                <CloseButton onClick={onClose}>X</CloseButton>
            </SidebarHeader>

            {/* Кнопки вкладок только для serviceNode */}
            {isServiceNode && (
                <div className="flex justify-around mb-4 space-x-2">
                    <TabButton isActive={activeView === 'details'} onClick={() => setActiveView('details')}>
                        Детали
                    </TabButton>
                    <TabButton isActive={activeView === 'logs'} onClick={() => setActiveView('logs')}>
                        Логи
                    </TabButton>
                    <TabButton isActive={activeView === 'deploy-logs'} onClick={() => setActiveView('deploy-logs')}>
                        Логи деплоя
                    </TabButton>
                    <TabButton isActive={activeView === 'updates'} onClick={() => setActiveView('updates')}>
                        Обновления
                    </TabButton>
                </div>
            )}

            <SidebarContent>
                {renderContent()}
            </SidebarContent>

            {/* Кнопка удаления только для serviceNode */}
            {isServiceNode && (
                <div className="mt-auto pt-4 border-t border-gray-700"> {/* Отступ сверху, чтобы не прилипало */}
                    <DeleteButton onClick={handleDeleteClick} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md">
                        Удалить сервис
                    </DeleteButton>
                </div>
            )}
        </SidebarWrapper>
    );
};

// Заглушка для кнопки "Удалить сервис", если вы используете свои стилизованные компоненты
const DeleteButton = ({ onClick, children, className = "" }) => (
    <button
        onClick={onClick}
        className={className}
        style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            transition: 'background-color 0.2s',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: '#dc2626', // bg-red-600
            color: 'white',
            fontWeight: 'bold',
            width: '100%',
            marginTop: '1rem', // mt-auto pt-4 if it's placed after content for bottom alignment
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'} // hover:bg-red-700
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
    >
        {children}
    </button>
);


export default RepoOrServiceDetailsSidebarv2;