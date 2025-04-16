let nodeId = 0

function createNode(id, label, type, x, y, children = []) {
  return {
    id,
    type: type === 'folder' ? 'folderNode' : 'default',
    position: { x, y },
    data: {
      label,
      ...(type === 'folder' && { children: children.filter(c => c.type === 'file') })
    },
    sourcePosition: 'right',
    targetPosition: 'left'
  }
}

function createEdge(from, to) {
  return {
    id: `${from}-${to}`,
    source: from,
    target: to,
    type: 'default'
  }
}

export function buildGraphFromTree(tree, startX = 0, startY = 0, parentId = null, nodes = [], edges = []) {
  const currentId = `node-${nodeId++}`
  const label = tree.name

  nodes.push(createNode(currentId, label, tree.type, startX, startY, tree.children))

  if (parentId) {
    edges.push(createEdge(parentId, currentId))
  }

  if (tree.children && tree.children.length > 0) {
    let childY = startY + 150
    for (const child of tree.children) {
      if (child.type === 'folder') {
        buildGraphFromTree(child, startX + 250, childY, currentId, nodes, edges)
        childY += 180
      }
    }
  }

  return { nodes, edges }
}
