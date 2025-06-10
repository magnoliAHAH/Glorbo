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
import 'reactflow/dist/style.css';

// Импорты API и утилит
import { createService, updateNodePosition, getRepoTree, createAuthService } from '../functions/api/api';
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

// --- Custom Nodes for React Flow --- (без изменений)
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
    /* !!! ИЗМЕНЕНИЕ: Позиционирование сайдбара */
    position: absolute; /* Делаем его абсолютно позиционированным */
    right: 0;           /* Прикрепляем к правой стороне */
    top: 0;             /* Прикрепляем к верху */
    bottom: 0;          /* Растягиваем на всю высоту */
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
                        // !!! ИЗМЕНЕНИЕ: Убедимся, что renderFileNodeForSidebar правильно обрабатывает URL
                        // content уже содержит URL, переданный из DashboardForMain.jsx
                        renderFileNodeForSidebar(content)
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


// --- Context Menu Component --- (без изменений)
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


// --- Main Dashboard Component ---

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

    const location = useLocation();
    const navigate = useNavigate();
    const currentRepoUrl = localStorage.getItem('repo');

    // !!! ИЗМЕНЕНИЕ 1: useEffect для чтения projectId из localStorage
    // Убедимся, что projectId установлен перед загрузкой repoTree
    useEffect(() => {
        const storedProjectId = localStorage.getItem('projectId');
        if (storedProjectId) {
            setCurrentProjectId(Number(storedProjectId));
        } else {
            console.warn('Project ID not found in localStorage! Redirecting to projects.');
            navigate('/projects');
        }
    }, [navigate]);

    // !!! ИЗМЕНЕНИЕ 2: Загрузка структуры репозитория зависит от currentProjectId
    useEffect(() => {
        if (!currentRepoUrl) {
            navigate('/projects');
            return;
        }
        // Ждем, пока currentProjectId будет установлен
        if (currentProjectId === null) {
            return;
        }

        setLoading(true);
        setError(null);

        getRepoTree(currentRepoUrl)
            .then(fetchedStructure => {
                console.log('Fetched structure:', fetchedStructure);
                setStructure(fetchedStructure);

                const repoNodeId = fetchedStructure.id;
                const repoNodeName = fetchedStructure.name || currentRepoUrl.split('/').pop();

                const initialNodes = [{
                    id: repoNodeId,
                    position: { x: 50, y: 50 },
                    type: 'repoNode',
                    data: {
                        id: repoNodeId,
                        name: repoNodeName,
                        type: 'repo',
                        URL: currentRepoUrl, // Сохраняем URL с большой буквы U
                        projectId: currentProjectId, // Используем projectId из состояния
                    },
                    draggable: true,
                }];

                const { nodes: serviceNodes } = convertFileNodeToReactFlowElements(fetchedStructure);
                const existingServiceNodes = serviceNodes.filter(n => n.type === 'serviceNode');

                setNodes([...initialNodes, ...existingServiceNodes]);
                setEdges([]);
            })
            .catch(err => {
                console.error('Error fetching structure:', err);
                setError(err.message);
                setNodes([]);
            })
            .finally(() => setLoading(false));
    }, [currentRepoUrl, navigate, currentProjectId]); // Добавили currentProjectId в зависимости

    // Обработчик перетаскивания узлов
    const onNodeDragStop = useCallback(async (event, node) => {
        if ((node.type === 'repoNode' || node.type === 'serviceNode') && currentProjectId) {
            try {
                await updateNodePosition(node.id, node.position, currentProjectId);
                console.log(`Updated position for node ${node.id}`);
            } catch (error) {
                console.error(`Failed to update position for node ${node.id}:`, error.message);
            }
        }
    }, [currentProjectId]);

    // Обработчик клика по узлу (ЛКМ)
    const onNodeClick = useCallback((event, node) => {
        setIsSidebarOpen(true);

        if (node.type === 'repoNode' && structure) {
            // Передаем весь объект structure, который уже содержит URL и другие данные
            // ProjectId также передаем для отображения в сайдбаре
            setSidebarContent({ type: 'repo', ...structure, projectId: currentProjectId, URL: node.data.URL });
        } else if (node.type === 'serviceNode') {
            setSidebarContent({ type: 'serviceNode', ...node.data });
        } else {
            setSidebarContent(null);
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
                    `auth-${result.authServiceId}`,
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
                    result.serviceId,
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
const fade = keyframes`
  0% { opacity: 0.2; }
  50% { opacity: 0.6; }
  100% { opacity: 0.2; }
`;

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