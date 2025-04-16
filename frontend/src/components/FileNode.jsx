const FileNode = ({ data }) => {
    return (
      <div style={{
        padding: 8,
        border: '1px solid #aaa',
        borderRadius: 4,
        background: '#fff',
        fontSize: 14,
        minWidth: 80,
        textAlign: 'center'
      }}>
        📄 {data.label}
      </div>
    )
  }
  
  export default FileNode
  