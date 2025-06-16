import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import 'reactflow/dist/style.css';

// Импорты API и утилит
// !!! ИЗМЕНЕНИЕ: Добавил getProjectServices
import { createService, updateNodePosition, getRepoTree, createAuthService, getProjectServices } from '../functions/api/api';
import { createReactFlowServiceNode, renderFileNodeForSidebar, renderServiceInfoForSidebar, convertFileNodeToReactFlowElements } from '../functions/utils';

// --- Styled Components --- (без изменений)
const fadeIn = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
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
            case 'auth':
            case 'authentication': return '#e1bee7';
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
            case 'auth':
            case 'authentication': return '#9c27b0';
            case 'nginx': return '#cddc39';
            case 'message-queue': return '#ef5350';
            default: return '#cccccc';
        }
    }};
    color: #333;
    font-size: 0.9em;
`;

// Добавлены стили для узлов файлов и папок
const FileNodeContainer = styled(StyledNode)`
    background-color: #ffffff;
    border-color: #e0e0e0;
    color: #424242;
    font-size: 0.8em;
    padding: 8px 12px;
`;

const FolderNodeContainer = styled(StyledNode)`
    background-color: #f5f5f5;
    border-color: #bdbdbd;
    color: #424242;
    font-size: 0.9em;
    padding: 10px 15px;
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

// New: FileNode and FolderNode for displaying repo structure
const FileNode = ({ data }) => (
    <FileNodeContainer>
        📄 {data.name}
    </FileNodeContainer>
);

const FolderNode = ({ data }) => (
    <FolderNodeContainer>
        📁 {data.name}
    </FolderNodeContainer>
);

const nodeTypes = {
    repoNode: RepoNode,
    serviceNode: ServiceNode,
    fileNode: FileNode,   // Add new node types
    folderNode: FolderNode, // Add new node types
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
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
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
                <h3>
                    {content?.type === 'repo' ? 'Repository Structure' :
                     content?.type === 'serviceNode' ? 'Service Details' :
                     (content?.type === 'fileNode' || content?.type === 'folderNode') ? 'Node Details' :
                     'Details'}
                </h3>
                <CloseButton onClick={onClose}>X</CloseButton>
            </SidebarHeader>
            <SidebarContent>
                {content ? (
                    content.type === 'repo' ? (
                        renderFileNodeForSidebar(content)
                    ) : content.type === 'serviceNode' ? (
                        renderServiceInfoForSidebar(content)
                    ) : (
                        // For file/folder nodes, simply display their name and type
                        <div>
                            <h4>Name: {content.name}</h4>
                            <p>Type: {content.type}</p>
                            {content.path && <p>Path: {content.path}</p>}
                        </div>
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
    const serviceTypes = ['backend', 'frontend', 'database', 'redis', 'authentication', 'nginx', 'message-queue'];

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



const DashboardForMain = () => {
    const [structure, setStructure] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentProjectId, setCurrentProjectId] = useState(null);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarContent, setSidebarContent] = useState(null);

    const [contextMenu, setContextMenu] = useState(null);

    const navigate = useNavigate();
    const currentRepoUrl = localStorage.getItem('repo');

    // useEffect для чтения projectId из localStorage
    useEffect(() => {
        const storedProjectId = localStorage.getItem('projectId');
        if (storedProjectId) {
            const parsedProjectId = Number(storedProjectId);
            if (!isNaN(parsedProjectId) && parsedProjectId > 0) {
                setCurrentProjectId(parsedProjectId);
            } else {
                console.warn('Invalid Project ID found in localStorage:', storedProjectId, '. Redirecting to projects.');
                navigate('/projects');
            }
        } else {
            console.warn('Project ID not found in localStorage! Redirecting to projects.');
            navigate('/projects');
        }
    }, [navigate]);

    // Загрузка структуры репозитория и сервисов
    useEffect(() => {
        if (!currentRepoUrl) {
            navigate('/projects');
            return;
        }
        if (typeof currentProjectId !== 'number' || currentProjectId <= 0) {
            console.log('Waiting for valid currentProjectId to load data. Current:', currentProjectId);
            return;
        }

        setLoading(true);
        setError(null);

        Promise.all([
            getRepoTree(currentRepoUrl),
            getProjectServices(currentProjectId) // !!! Загружаем сервисы проекта
        ])
        .then(([fetchedStructure, fetchedServices]) => {
            console.log('Fetched structure:', fetchedStructure);
            console.log('Fetched services:', fetchedServices);
            setStructure(fetchedStructure);

            const initialNodes = [];
            const initialEdges = [];

            // 1. Добавляем корневой узел репозитория (БЕЗ ИЗМЕНЕНИЙ В ЭТОЙ ЧАСТИ)
            const repoNodeId = fetchedStructure.id;
            const repoNodeName = fetchedStructure.name || currentRepoUrl.split('/').pop();
            const initialRepoNode = {
                id: repoNodeId,
                position: { x: 50, y: 50 }, // Фиксированная начальная позиция для репозитория
                type: 'repoNode',
                data: {
                    id: repoNodeId,
                    name: repoNodeName,
                    type: 'repo',
                    URL: currentRepoUrl,
                    projectId: currentProjectId,
                },
                draggable: true,
            };
            initialNodes.push(initialRepoNode);

            // 2. Добавляем узлы файлов/папок из структуры репозитория (БЕЗ ИЗМЕНЕНИЙ В ЭТОЙ ЧАСТИ)
            const fileFolderOffset = { x: 300, y: 0 }; // Смещение для узлов файлов/папок
            const { nodes: convertedFileNodes, edges: convertedFileEdges } =
                convertFileNodeToReactFlowElements(fetchedStructure, null, 0, 0, fileFolderOffset);
            
            // Фильтруем любые дубликаты repoNode, если convertFileNodeToReactFlowElements их генерирует
            const filteredConvertedFileNodes = convertedFileNodes.filter(node => node.id !== repoNodeId);
            initialNodes.push(...filteredConvertedFileNodes);
            initialEdges.push(...convertedFileEdges);


            // 3. Добавляем узлы сервисов из базы данных, ПЕРЕЗАПИСЫВАЯ любые узлы сервисов,
            // которые могли быть сгенерированы из файловой структуры, чтобы использовать сохраненные позиции.
            const finalNodesMap = new Map(initialNodes.map(node => [node.id, node]));

            fetchedServices.forEach(service => {
                const serviceNode = createReactFlowServiceNode(
                    service.id,
                    service.serviceType,
                    service.position || { x: Math.random() * 500 + 100, y: Math.random() * 500 + 100 }, // Используем сохраненную позицию или случайную
                    service.name || `${service.serviceType}-service`,
                    currentProjectId
                );
                // Добавляем или перезаписываем существующие узлы сервисными узлами из базы данных
                finalNodesMap.set(serviceNode.id, serviceNode);
            });

            setNodes(Array.from(finalNodesMap.values())); // Преобразуем Map обратно в массив
            setEdges(initialEdges); // Устанавливаем все ребра, включая те, что могли быть сгенерированы для файлов/папок

        })
        .catch(err => {
            console.error('Error fetching data:', err);
            setError(err.message);
            setNodes([]);
            setEdges([]);
        })
        .finally(() => setLoading(false));
    }, [currentRepoUrl, navigate, currentProjectId, setNodes, setEdges]);

    // Обработчик перетаскивания узлов
    const onNodeDragStop = useCallback(async (event, node) => {
        console.log('onNodeDragStop called for node:', node.id, 'with currentProjectId:', currentProjectId, 'and type:', node.type);
    
        if (typeof currentProjectId !== 'number' || currentProjectId <= 0) {
            console.warn('Cannot update node position: currentProjectId is not valid. Not sending update.');
            return;
        }
    
        // Отправляем только для SERVICE NODES
        if (node.type === 'serviceNode') {
            try {
                console.log(`Attempting to update position for service node ${node.id} to {x: ${node.position.x}, y: ${node.position.y}} in project ${currentProjectId}`);
                await updateNodePosition(node.id, node.position, currentProjectId);
                console.log(`Successfully updated position for service node ${node.id}`);
            } catch (error) {
                console.error(`Failed to update position for service node ${node.id}:`, error.message);
                alert(`Failed to update position for service node ${node.id}: ${error.message}`);
            }
        } else {
            console.log(`Node type ${node.type} is not a service node. Position not saved.`);
        }
    }, [currentProjectId]);

    // Обработчик клика по узлу (ЛКМ)
    const onNodeClick = useCallback((event, node) => {
        setIsSidebarOpen(true);

        if (node.type === 'repoNode' && structure) {
            setSidebarContent({ type: 'repo', ...structure, projectId: currentProjectId, URL: node.data.URL });
        } else if (node.type === 'serviceNode') {
            setSidebarContent({ type: 'serviceNode', ...node.data });
        } else {
            // Для обычных файлов/папок, отображаем их данные
            setSidebarContent(node.data); 
            console.log('Clicked non-special node:', node);
        }
    }, [structure, currentProjectId]);

    // Обработчик правого клика по фону холста (ПКМ)
    const onPaneContextMenu = useCallback((event) => {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
        });
    }, []);

    // Обработчик для создания нового сервиса
    const handleCreateService = useCallback(async (serviceType) => {
        if (typeof currentProjectId !== 'number' || currentProjectId <= 0) {
            alert('Project ID not found or is invalid. Cannot create service.');
            console.error('Project ID is invalid for service creation:', currentProjectId);
            setContextMenu(null);
            return;
        }

        const position = { x: contextMenu.x, y: contextMenu.y };

        try {
            if (serviceType === 'authentication') {
                const appName = prompt('Enter a name for the authentication service (e.g., "Google Auth", "Auth0"):');
                if (!appName) {
                    alert('Authentication service name cannot be empty.');
                    return;
                }
                const result = await createAuthService(currentProjectId, appName);
                alert(`Authentication service "${appName}" created with ID: ${result.authServiceId}`);
                console.log('Created Auth Service:', result);

                const newAuthServiceNode = createReactFlowServiceNode(
                    result.authServiceId, // ID сервиса
                    'authentication',
                    position,
                    appName,
                    currentProjectId
                );
                setNodes((prevNodes) => [...prevNodes, newAuthServiceNode]);

            } else {
                const result = await createService(currentProjectId, serviceType, position);
                alert(`Service created: ${result.serviceId}`);
                console.log('Created Service:', result);

                const newNode = createReactFlowServiceNode(
                    result.serviceId, // ID сервиса
                    serviceType,
                    position,
                    result.name || `${serviceType}-service`,
                    currentProjectId
                );
                setNodes((prevNodes) => [...prevNodes, newNode]);
            }
        } catch (error) {
            console.error('Failed to create service:', error.message);
            alert(`Failed to create service: ${error.message}`);
        } finally {
            setContextMenu(null);
        }
    }, [currentProjectId, contextMenu, setNodes]);

    const handleChangeRepo = () => {
        localStorage.removeItem('repo');
        localStorage.removeItem('projectId');
        localStorage.removeItem('projectName');
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
                                {currentRepoUrl && <div>Current Repo: <strong>{currentRepoUrl.split('/').pop()}</strong></div>}
                                {currentProjectId && <div>Project ID: <strong>{currentProjectId}</strong></div>}
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

// --- STYLES ---

const Page = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  background-color: #f5f7fa;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  z-index: 10;
`;

const Title = styled.h2`
  font-size: 1.8rem;
  color: #333;
  margin: 0;
`;

const SwitchButton = styled.button`
  background: #3070f0;
  color: white;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s ease, transform 0.1s ease;

  &:hover {
    background: #2554c7;
    transform: translateY(-1px);
  }
  &:active {
    transform: translateY(0);
  }
`;

const Content = styled.div`
  flex-grow: 1;
  /* !!! ИЗМЕНЕНИЕ: Content теперь Flex контейнер для GraphWrapper и SidebarWrapper */
  display: flex;
  position: relative; /* Важно для позиционирования SidebarWrapper */
  overflow: hidden; /* Чтобы сайдбар не выходил за границы */
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 4px solid #ddd;
  border-top-color: #3070f0;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  position: absolute;
  z-index: 5;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const Message = styled.p`
  font-size: 1rem;
  color: ${({ error }) => (error ? 'crimson' : '#555')};
  position: absolute;
  z-index: 5;
`;

const GraphWrapper = styled.div`
  flex-grow: 1; /* !!! ИЗМЕНЕНИЕ: Позволяет GraphWrapper занимать оставшееся место */
  height: 100%;
  position: relative;
  background: #fafafa;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
`;