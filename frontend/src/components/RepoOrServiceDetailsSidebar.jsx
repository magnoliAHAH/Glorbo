// RepoOrServiceDetailsSidebar.jsx
import React from 'react'
import { SidebarWrapper, SidebarHeader, CloseButton, SidebarContent, DeleteButton } from './SidebarStyles' // если есть отдельные стили
import { renderFileNodeForSidebar, renderServiceInfoForSidebar } from './utils/renderHelpers' // если они у вас отдельно

const RepoOrServiceDetailsSidebar = ({ isOpen, content, onClose, onDeleteNode }) => {
    const isServiceNode = content?.type === 'serviceNode' || content?.type === 'service';

    const handleDeleteClick = () => {
        if (isServiceNode && onDeleteNode && content?.id && typeof content?.projectId === 'number') {
            if (window.confirm(`Вы уверены, что хотите удалить сервис "${content.name || content.id}"?`)) {
                onDeleteNode(content.id, content.projectId);
            }
        } else {
            console.warn('Attempted to delete a node that is not a serviceNode or is missing ID/ProjectID.', content);
        }
    };

    return (
        <SidebarWrapper isOpen={isOpen}>
            <SidebarHeader>
                <h3>{content?.type === 'repo' ? 'Repository Structure' : 'Service Details'}</h3>
                <CloseButton onClick={onClose}>X</CloseButton>
            </SidebarHeader>
            <SidebarContent>
                {content ? (
                    content.type === 'repo' ? (
                        renderFileNodeForSidebar(content)
                    ) : (
                        renderServiceInfoForSidebar(content)
                    )
                ) : (
                    <p>Select a node to view its details.</p>
                )}
                {isServiceNode && (
                    <DeleteButton onClick={handleDeleteClick}>Удалить сервис</DeleteButton>
                )}
            </SidebarContent>
        </SidebarWrapper>
    );
};

export default RepoOrServiceDetailsSidebar;

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