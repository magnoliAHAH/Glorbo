// functions/utils.js

import React from 'react';
import styled from 'styled-components';

// --- Styled Components для Sidebar ---
const FileNodeContainer = styled.div`
    margin-left: ${props => props.depth * 15}px;
    padding: 3px 0;
    font-size: 0.9em;
    color: #444;
`;

const FolderName = styled.span`
    font-weight: bold;
    color: #2c3e50;
`;

const FileName = styled.span`
    color: #34495e;
`;

const ServiceInfoContainer = styled.div`
    background-color: #f8f8f8;
    border: 1px solid #eee;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 15px;

    h4 {
        margin-top: 0;
        color: #333;
        font-size: 1.1em;
    }

    p {
        margin: 5px 0;
        color: #555;
    }

    span {
        font-weight: bold;
        color: #000;
    }
`;


// --- Функции утилиты ---

/**
 * Преобразует древовидную структуру FileNode (полученную с бэкенда)
 * в плоский список узлов и ребер React Flow.
 */
export const convertFileNodeToReactFlowElements = (fileNode) => {
    const nodes = [];
    const edges = [];
    const initialPosition = { x: 50, y: 50 }; // Начальная позиция для первого узла
    const spacingX = 250; // Горизонтальный отступ
    const spacingY = 150; // Вертикальный отступ

    let currentX = initialPosition.x;
    let currentY = initialPosition.y;
    let maxNodeHeightInRow = 0; // Максимальная высота узла в текущей строке

    // Создаем корневой узел репозитория
    nodes.push({
        id: fileNode.id,
        type: 'repoNode',
        data: { name: fileNode.name, type: fileNode.type, id: fileNode.id, projectId: fileNode.projectId?.Int64 || null }, // Включаем projectId
        position: fileNode.position ? { x: fileNode.position.X, y: fileNode.position.Y } : initialPosition,
        draggable: true,
    });

    // Обрабатываем дочерние сервисы репозитория (если они есть)
    // Эти сервисы могут быть на первом уровне вложенности под репозиторием
    if (fileNode.children) {
        fileNode.children.forEach((childNode) => {
            if (childNode.type === 'service') {
                const serviceNode = createReactFlowServiceNode(
                    childNode.ID,
                    childNode.ServiceType,
                    childNode.Position ? { x: childNode.Position.X, y: childNode.Position.Y } : { x: currentX + spacingX, y: currentY },
                    childNode.Name,
                    childNode.ProjectID?.Int64 || null // Передаем ProjectID
                );
                nodes.push(serviceNode);
                edges.push({ id: `e-${fileNode.id}-${serviceNode.id}`, source: fileNode.id, target: serviceNode.id, type: 'smoothstep' });

                currentX += spacingX; // Сдвигаем по X для следующего сервиса
                maxNodeHeightInRow = Math.max(maxNodeHeightInRow, 100); // Примерная высота сервиса
            }
        });
    }

    // Если сервисы были добавлены, сдвигаем Y для следующей "строки" (если бы она была)
    // currentY += maxNodeHeightInRow + spacingY;
    // currentX = initialPosition.x; // Сбрасываем X для новой "строки"

    return { nodes, edges };
};


/**
 * Создает узел React Flow для сервиса.
 */
export const createReactFlowServiceNode = (id, serviceType, position, name, projectId) => { // Добавлен projectId
    return {
        id: id,
        position: position,
        type: 'serviceNode',
        data: {
            id: id, // ID сервиса из БД
            name: name, // Имя сервиса (может быть произвольным)
            serviceType: serviceType,
            status: 'Active', // Дефолтный статус
            volume: '',
            version: '',
            projectId: projectId, // Сохраняем ProjectID в данных узла
        },
        draggable: true,
    };
};

/**
 * Рендерит древовидную структуру файлов для сайдбара.
 */
export const renderFileNodeForSidebar = (node, depth = 0) => {
    if (!node) return null;

    return (
        <FileNodeContainer key={node.id} depth={depth}>
            {node.type === 'repo' ? (
                <>
                    <FolderName>📦 {node.name} (Root)</FolderName>
                    <p>Project ID: {node.projectId || 'N/A'}</p> {/* Отображаем projectId */}
                </>
            ) : node.type === 'folder' ? (
                <FolderName>📁 {node.name}</FolderName>
            ) : node.type === 'file' ? (
                <FileName>📄 {node.name}</FileName>
            ) : node.type === 'service' ? (
                <ServiceInfoContainer>
                    <h4>⚙️ {node.name || 'Service'}</h4>
                    <p>ID: <span>{node.id}</span></p>
                    <p>Type: <span>{node.serviceType}</span></p>
                    <p>Status: <span>{node.status}</span></p>
                    {node.volume && <p>Volume: <span>{node.volume}</span></p>}
                    {node.version && <p>Version: <span>{node.version}</span></p>}
                    <p>Project ID: <span>{node.projectId || 'N/A'}</span></p> {/* Отображаем projectId */}
                </ServiceInfoContainer>
            ) : null}

            {node.children && (
                <ul>
                    {node.children.map(child => (
                        <li key={child.id}>
                            {renderFileNodeForSidebar(child, depth + 1)}
                        </li>
                    ))}
                </ul>
            )}
        </FileNodeContainer>
    );
};

/**
 * Рендерит детальную информацию о сервисе для сайдбара.
 */
export const renderServiceInfoForSidebar = (serviceData) => {
    if (!serviceData || serviceData.type !== 'service') return <p>No service selected.</p>;

    const { data } = serviceData; // serviceData.data содержит данные узла React Flow
    return (
        <ServiceInfoContainer>
            <h4>⚙️ {data.name || 'Service'}</h4>
            <p>ID: <span>{data.id}</span></p>
            <p>Type: <span>{data.serviceType}</span></p>
            <p>Status: <span>{data.status}</span></p>
            {data.volume && <p>Volume: <span>{data.volume}</span></p>}
            {data.version && <p>Version: <span>{data.version}</span></p>}
            <p>Project ID: <span>{data.projectId || 'N/A'}</span></p> {/* Отображаем projectId */}
            {/* Добавьте другие поля сервиса по необходимости */}
        </ServiceInfoContainer>
    );
};