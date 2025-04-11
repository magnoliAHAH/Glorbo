let nodeId = 0
function createNode(id, label, type, x, y) {
  return {
    id,
    type: 'default',
    position: { x, y },
    data: { label }
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
  nodes.push(createNode(currentId, label, tree.type, startX, startY))

  if (parentId) {
    edges.push(createEdge(parentId, currentId))
  }

  if (tree.children && tree.children.length > 0) {
    let childY = startY + 100
    for (const child of tree.children) {
      buildGraphFromTree(child, startX + 200, childY, currentId, nodes, edges)
      childY += 100
    }
  }

  return { nodes, edges }
}
