// src/utils.js
// Вспомогательные функции для преобразования данных и рендеринга сайдбара

/**
 * Рекурсивно преобразует древовидную структуру FileNode в узлы и рёбра React Flow.
 * Важно: эта функция создает узлы для ВСЕЙ структуры.
 * Если на холсте должен быть только узел репозитория,
 * то вы будете использовать ее только для sidebar, а для ReactFlow
 * создадите только корневой repoNode.
 */
export function convertFileNodeToReactFlowElements(fileNode, parentId = null, depth = 0, siblingIndex = 0) {
    const nodes = [];
    const edges = [];

    const initialX = depth * 250;
    const initialY = siblingIndex * 100 + depth * 50;

    let position = { x: initialX, y: initialY };
    let nodeType = 'default';

    if (fileNode.type === 'service') {
        if (fileNode.position && fileNode.position.x != null && fileNode.position.y != null) {
            position = { x: fileNode.position.x, y: fileNode.position.y };
        }
        nodeType = 'serviceNode'; // Кастомный тип узла
    } else if (fileNode.type === 'repo') {
        nodeType = 'repoNode';
        position = { x: 50, y: 50 }; // Фиксированная позиция для узла репозитория
    } else if (fileNode.type === 'folder') {
        nodeType = 'folderNode';
    } else if (fileNode.type === 'file') {
        nodeType = 'fileNode';
    }

    nodes.push({
        id: fileNode.id,
        position: position,
        type: nodeType,
        data: {
            name: fileNode.name,
            type: fileNode.type,
            ...fileNode, // Копируем все свойства FileNode в data
            projectId: fileNode.projectId?.Int64,
        },
        draggable: fileNode.type === 'service' || fileNode.type === 'repo',
    });

    if (parentId) {
        edges.push({
            id: `edge-${parentId}-${fileNode.id}`,
            source: parentId,
            target: fileNode.id,
            type: 'smoothstep',
            animated: fileNode.type === 'service',
        });
    }

    fileNode.children?.forEach((child, idx) => {
        const { nodes: childNodes, edges: childEdges } = convertFileNodeToReactFlowElements(child, fileNode.id, depth + 1, idx);
        nodes.push(...childNodes);
        edges.push(...childEdges);
    });

    return { nodes, edges };
}

export function createReactFlowServiceNode(id, serviceType, position) {
    return {
        id: id,
        position: position,
        type: 'serviceNode',
        data: {
            id: id, // Добавляем ID в data для удобства
            name: `${serviceType}-service`,
            type: 'service',
            serviceType: serviceType,
            status: 'pending',
            volume: '',
            version: '',
            // Добавьте другие поля, которые ожидаются бэкендом
        },
        draggable: true,
    };
}

export function renderFileNodeForSidebar(node, depth = 0) {
    if (!node) return null; // Защита от пустого узла

    const indent = depth * 20;

    const nodeStyle = {
        marginLeft: `${indent}px`,
        padding: '5px',
        borderLeft: depth > 0 ? '1px solid #ccc' : 'none',
        marginBottom: '2px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '3px'
    };

    let icon = '📄';
    let typeText = node.type;
    let details = [];

    if (node.type === 'folder') {
        icon = '📁';
        typeText = 'Folder';
    } else if (node.type === 'service') {
        icon = '🚀';
        typeText = `Service`;
        details.push(<div key="s-type">**Type:** {node.serviceType || 'N/A'}</div>);
        if (node.status) details.push(<div key="s-status">**Status:** {node.status}</div>);
        if (node.position) details.push(<div key="s-pos">**Position:** ({node.position.x?.toFixed(0)}, {node.position.y?.toFixed(0)})</div>);
        if (node.version) details.push(<div key="s-version">**Version:** {node.version}</div>);
        if (node.volume) details.push(<div key="s-volume">**Volume:** {node.volume}</div>);

    } else if (node.type === 'repo') {
        icon = '📦';
        typeText = 'Repository';
        details.push(<div key="r-url">**URL:** {node.URL || 'N/A'}</div>);
        if (node.projectId) details.push(<div key="r-proj">**Project ID:** {node.projectId.Int64 || 'N/A'}</div>);
    } else if (node.type === 'file') {
        typeText = 'File';
        if (node.size) details.push(<div key="f-size">**Size:** {node.size}</div>);
    }


    return (
        <div key={node.id} style={nodeStyle}>
            <span style={{ fontWeight: 'bold' }}>{icon} {node.name}</span>
            <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '5px' }}>[{typeText}]</span>
            {details.length > 0 && (
                <div style={{ fontSize: '0.85em', color: '#555', marginTop: '5px' }}>
                    {details}
                </div>
            )}
            {node.children && node.children.length > 0 && (
                <div style={{ paddingLeft: '10px' }}>
                    {node.children.map(child => renderFileNodeForSidebar(child, depth + 1))}
                </div>
            )}
        </div>
    );
}

/**
 * Вспомогательная функция для плоского отображения информации о сервисе (для сайдбара).
 */
export function renderServiceInfoForSidebar(serviceData) {
    if (!serviceData) return <p>No service selected.</p>;

    return (
        <div>
            <h4>Service Details:</h4>
            <p><strong>ID:</strong> {serviceData.id || 'N/A'}</p>
            <p><strong>Name:</strong> {serviceData.name || 'N/A'}</p>
            <p><strong>Type:</strong> {serviceData.serviceType || 'N/A'}</p>
            <p><strong>Status:</strong> {serviceData.status || 'N/A'}</p>
            {serviceData.position && (
                <p><strong>Position:</strong> X: {serviceData.position.x?.toFixed(0)}, Y: {serviceData.position.y?.toFixed(0)}</p>
            )}
            {serviceData.version && <p><strong>Version:</strong> {serviceData.version}</p>}
            {serviceData.volume && <p><strong>Volume:</strong> {serviceData.volume}</p>}
            {/* Добавьте больше полей по необходимости */}
        </div>
    );
}