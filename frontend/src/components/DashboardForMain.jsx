import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Panel,
} from 'reactflow';
import 'reactflow/dist/style.css'; // Обязательно импортируйте стили React Flow

// Импортируем функции API и утилиты
import { createService, updateNodePosition, createAuthService } from '../functions/api/api';
import { createReactFlowServiceNode, renderFileNodeForSidebar, renderServiceInfoForSidebar, convertFileNodeToReactFlowElements } from '../functions/utils';

// --- Styled Components ---

const fadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

const Page = styled.div`
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: 'Arial', sans-serif;
    background-color: #f0f2f5;
    overflow: hidden; /* Предотвращает прокрутку всей страницы */
`;

const Header = styled.header`
    background-color: #282c34;
    color: white;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 1000;
`;

const Title = styled.h1`
    margin: 0;
    font-size: 1.8em;
    color: #61dafb;
`;

const SwitchButton = styled.button`
    background-color: #61dafb;
    color: #282c34;
    border: none;
    padding: 10px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1em;
    font-weight: bold;
    transition: background-color 0.3s ease;

    &:hover {
        background-color: #21a1f1;
    }
`;

const Content = styled.main`
    flex-grow: 1;
    display: flex;
    position: relative; /* Для позиционирования GraphWrapper */
`;

const GraphWrapper = styled.div`
    flex-grow: 1;
    height: 100%;
    position: relative; /* Чтобы ReactFlow занимал всю доступную высоту */
`;

const Spinner = styled.div`
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #61dafb;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

const Message = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: ${props => props.error ? 'red' : 'green'};
    font-size: 1.2em;
`;

const ContextMenuWrapper = styled.div`
    position: absolute;
    background: white;
    border: 1px solid #ddd;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    padding: 5px 0;
    animation: ${fadeIn} 0.1s ease-out;
`;

const ContextMenuItem = styled.div`
    padding: 8px 15px;
    cursor: pointer;
    &:hover {
        background-color: #f0f0f0;
    }
`;

// --- Custom Nodes for React Flow ---

const StyledNode = styled.div`
    padding: 10px 15px;
    border-radius: 5px;
    font-weight: bold;
    text-align: center;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    border: 1px solid;
    cursor: grab;
`;

const RepoNodeContainer = styled(StyledNode)`
    background-color: #e0f7fa;
    border-color: #00bcd4;
    color: #006064;
    width: auto;
    min-width: 150px;
    display: inline-block;
    white-space: nowrap;
    padding: 15px 25px;
    font-size: 1.1em;
`;

const ServiceNodeContainer = styled(StyledNode)`
    background-color: ${props => {
        switch (props.serviceType) {
            case 'backend': return '#ffe0b2';
            case 'frontend': return '#c8e6c9';
            case 'database': return '#bbdefb';
            case 'redis': return '#ffccbc';
            case 'auth': return '#e1bee7'; // Общий тип "auth"
            case 'authentication': return '#d1c4e9'; // Специфический тип "authentication"
            case 'nginx': return '#f5f5dc';
            case 'message-queue': return '#ffcdd2';
            default: return '#f5f5f5';
        }
    }};
    border-color: ${props => {
        switch (props.serviceType) {
            case 'backend': return '#ff9800';
            case 'frontend': return '#4caf50';
            case 'database': return '#2196f3';
            case 'redis': return '#ff5722';
            case 'auth': return '#9c27b0';
            case 'authentication': return '#673ab7';
            case 'nginx': return '#cddc39';
            case 'message-queue': return '#ef5350';
            default: return '#cccccc';
        }
    }};
    color: #333;
    font-size: 0.9em;
`;

const RepoNode = ({ data }) => (
    <RepoNodeContainer>
        📦 {data.name || 'Repository'}
    </RepoNodeContainer>
);

const ServiceNode = ({ data }) => (
    <ServiceNodeContainer serviceType={data.serviceType}>
        ⚙️ {data.name || 'Service'} ({data.serviceType})
    </ServiceNodeContainer>
);

const nodeTypes = {
    repoNode: RepoNode,
    serviceNode: ServiceNode,
};

// --- Sidebar Components ---

const SidebarWrapper = styled.div`
    width: ${props => (props.isOpen ? '350px' : '0')};
    background-color: #fff;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    transition: width 0.3s ease-in-out;
    display: flex;
    flex-direction: column;
    z-index: 999;
`;

const SidebarHeader = styled.div`
    padding: 15px 20px;
    background-color: #f8f9fa;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
    h3 {
        margin: 0;
        color: #333;
    }
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
    color: #666;
    &:hover {
        color: #333;
    }
`;

const SidebarContent = styled.div`
    flex-grow: 1;
    padding: 20px;
    overflow-y: auto;
    font-size: 0.9em;
    color: #555;

    pre {
        background-color: #f4f4f4;
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
    }

    ul {
        list-style: none;
        padding: 0;
    }

    li {
        margin-bottom: 5px;
    }
`;

const RepoOrServiceDetailsSidebar = ({ isOpen, content, onClose }) => {
    return (
        <SidebarWrapper isOpen={isOpen}>
            <SidebarHeader>
                <h3>{content?.type === 'repo' ? 'Repository Structure' : 'Service Details'}</h3>
                <CloseButton onClick={onClose}>X</CloseButton>
            </SidebarHeader>
            <SidebarContent>
                {content ? (
                    content.type === 'repo' ? (
                        <>
                            {renderFileNodeForSidebar(content)}
                        </>
                    ) : (
                        renderServiceInfoForSidebar(content)
                    )
                ) : (
                    <p>Select a node to view its details.</p>
                )}
            </SidebarContent>
        </SidebarWrapper>
    );
};


// --- Context Menu Component ---

const ContextMenu = ({ x, y, onCreateService, onClose }) => {
    const serviceTypes = ['backend', 'frontend', 'database', 'redis', 'auth', 'nginx', 'message-queue'];

    return (
        <ContextMenuWrapper style={{ left: x, top: y }} onMouseLeave={onClose}>
            {serviceTypes.map(type => (
                <ContextMenuItem key={type} onClick={() => { onCreateService(type); onClose(); }}>
                    Create {type}
                </ContextMenuItem>
            ))}
        </ContextMenuWrapper>
    );
};


// --- Main Dashboard Component ---

const DashboardForMain = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentRepoUrl, setCurrentRepoUrl] = useState('');
    const [structure, setStructure] = useState(null); // Здесь будет храниться объект FileNode репозитория
    const [contextMenu, setContextMenu] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarContent, setSidebarContent] = useState(null);

    const location = useLocation();
    const navigate = useNavigate();

    // Загрузка структуры репозитория при монтировании
    useEffect(() => {
        const repoFromStorage = localStorage.getItem('repo');
        if (!repoFromStorage) {
            navigate('/projects');
            return;
        }
        setCurrentRepoUrl(repoFromStorage);

        const fetchRepoStructure = async () => {
            setLoading(true);
            setError(null);
            try {
                // ИЗМЕНЕНИЕ 1: Передаем полный URL репозитория в параметре 'repo'
                const response = await fetch(`/api/repo-tree?repo=${encodeURIComponent(repoFromStorage)}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        navigate('/login');
                        return;
                    }
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                const fetchedStructure = await response.json();
                setStructure(fetchedStructure); // Сохраняем полную структуру

                // ИЗМЕНЕНИЕ 2: Убедитесь, что convertFileNodeToReactFlowElements может принять fetchedStructure.projectId
                const { nodes: initialNodes, edges: initialEdges } = convertFileNodeToReactFlowElements(fetchedStructure);
                setNodes(initialNodes);
                setEdges(initialEdges);

            } catch (err) {
                console.error("Failed to fetch repository structure:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRepoStructure();
    }, [navigate]);


    // ОБНОВЛЕННЫЙ ОБРАБОТЧИК: Создание сервиса
    const handleCreateService = useCallback(async (serviceType) => {
        // ИЗМЕНЕНИЕ 3: Получаем numeric projectId из fetchedStructure
        // Предполагается, что `structure` (FileNode root) содержит поле `projectId` (число)
        if (!structure || typeof structure.projectId !== 'number') {
            alert('Project ID not found in loaded structure or is invalid. Cannot create service.');
            console.error('Structure or ProjectID is invalid:', structure);
            return;
        }

        const projectIdToUse = structure.projectId;
        const position = { x: contextMenu.x, y: contextMenu.y };

        try {
            if (serviceType === 'auth') {
                const appName = prompt('Enter a name for the authentication service (e.g., "Google Auth", "Auth0"):');
                if (!appName) {
                    alert('Authentication service name cannot be empty.');
                    return;
                }

                const result = await createAuthService(projectIdToUse, appName); // Используем numeric projectIdToUse
                alert(`Authentication service "${appName}" created with ID: ${result.authServiceId}`);
                console.log('Created Auth Service:', result);

                const newNodeId = `auth-service-${result.authServiceId}`;
                const newAuthServiceNode = {
                    id: newNodeId,
                    position: position,
                    type: 'serviceNode',
                    data: {
                        id: result.authServiceId,
                        name: appName,
                        serviceType: 'authentication',
                        status: 'Active',
                        projectId: projectIdToUse, // Сохраняем numeric projectId в данных узла
                    },
                    draggable: true,
                };
                setNodes((prevNodes) => [...prevNodes, newAuthServiceNode]);

            } else {
                // Для всех остальных типов сервисов
                const result = await createService(projectIdToUse, serviceType, position); // Используем numeric projectIdToUse
                alert(`Service created: ${result.serviceId}`);

                // Передаем numeric projectIdToUse в createReactFlowServiceNode
                const newNode = createReactFlowServiceNode(result.serviceId, serviceType, position, result.name, projectIdToUse);
                setNodes((prevNodes) => [...prevNodes, newNode]);
            }

        } catch (error) {
            console.error('Failed to create service:', error.message);
            alert(`Failed to create service: ${error.message}`);
        } finally {
            setContextMenu(null); // Закрываем контекстное меню после создания
        }
    }, [structure, contextMenu, setNodes]); // structure добавлен как зависимость


    // Обработчик соединения ребер
    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    // Обработчик перетаскивания узлов
    const onNodeDragStop = useCallback(async (event, node) => {
        // Убедитесь, что structure.name корректно представляет имя проекта
        // или получите project ID из узла, если он есть
        const projectNameForUpdate = structure?.name; // Или structure.name, если это имя проекта
        if (!projectNameForUpdate) {
            console.warn('Project name not available for updating node position.');
            return;
        }

        if (node.type === 'repoNode' || node.type === 'serviceNode') {
            try {
                // В вашем бэкенде updateNodePosition, вероятно, ожидает ProjectID, а не ProjectName
                // Вам нужно будет передать ProjectID сюда, если бэкенд это требует.
                // На данный момент updateNodePosition в api.js принимает projectName
                // Если updateNodePosition в Go ожидает project_id, то node.data.projectId
                // должен быть передан сюда.
                // console.log("Updating node position for:", node.id, node.position, projectNameForUpdate);
                await updateNodePosition(node.id, node.position, projectNameForUpdate);
                console.log(`Updated position for node ${node.id}`);
            } catch (error) {
                console.error(`Failed to update position for node ${node.id}:`, error.message);
            }
        }
    }, [structure]); // Добавьте structure в зависимости, если projectNameForUpdate зависит от него

    // Обработчик клика по узлу (для открытия сайдбара)
    const onNodeClick = useCallback((event, node) => {
        setIsSidebarOpen(true);
        // Передаем полную информацию о узле для отображения в сайдбаре
        setSidebarContent({
            id: node.id,
            type: node.type === 'repoNode' ? 'repo' : 'service',
            data: node.data, // node.data уже содержит projectId
            position: node.position,
            ...(node.type === 'repoNode' && structure ? { fileStructure: structure.children || structure.files } : {}) // Используйте structure.children или structure.files
        });
    }, [structure]);


    // Обработчик ПКМ по фону (для открытия контекстного меню)
    const onPaneContextMenu = useCallback((event) => {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
        });
    }, []);

    // Обработчик смены репозитория
    const handleChangeRepo = () => {
        localStorage.removeItem('repo');
        navigate('/projects');
    };

    return (
        <Page>
            <Header>
                <Title>📊 Dashboard проекта</Title>
                <SwitchButton onClick={handleChangeRepo}>Сменить репозиторий</SwitchButton>
            </Header>

            <Content>
                {loading && <Spinner />}
                {error && <Message error>{error}</Message>}
                {!loading && !error && (
                    <GraphWrapper>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeDragStop={onNodeDragStop}
                            onNodeClick={onNodeClick}
                            onPaneContextMenu={onPaneContextMenu}
                            nodeTypes={nodeTypes}
                            fitView
                            attributionPosition="bottom-left"
                        >
                            <MiniMap />
                            <Controls />
                            <Background variant="dots" gap={12} size={1} />
                            <Panel position="top-right">
                                {structure && structure.name && <div>Current Repo: <strong>{structure.name}</strong></div>}
                                {structure && typeof structure.projectId === 'number' && <div>Project ID: <strong>{structure.projectId}</strong></div>}
                            </Panel>
                        </ReactFlow>

                        {contextMenu && (
                            <ContextMenu
                                x={contextMenu.x}
                                y={contextMenu.y}
                                onCreateService={handleCreateService}
                                onClose={() => setContextMenu(null)}
                            />
                        )}
                    </GraphWrapper>
                )}
            </Content>

            <RepoOrServiceDetailsSidebar
                isOpen={isSidebarOpen}
                content={sidebarContent}
                onClose={() => setIsSidebarOpen(false)}
            />
        </Page>
    );
};

export default DashboardForMain;