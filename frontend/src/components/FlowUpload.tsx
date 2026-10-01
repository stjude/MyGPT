import { useState, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Controls,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    // Handle,
    // Position,
    NodeChange,
    EdgeChange,
    Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { UploadNode, ChunkingNode, EmbeddingModelNode, BM25Node, RerankerNode, UploadButtonNode } from './Flow/StageOne';
// import DottedEdge from './Flow/DottedEdge';
import { ReactNode } from 'react';

type FlowNode = Node<{ title: string | ReactNode; libraryName?: string; languageOfDocument?: string; currentSettings?: any; user?: any }, string>;

/* ---------- Node Types ---------- */
const nodeTypes = {
    uploadNode: UploadNode,
    chunkingNode: ChunkingNode,
    embeddingModelNode: EmbeddingModelNode,
    bm25Node: BM25Node,
    rerankerNode: RerankerNode,
    uploadButtonNode: UploadButtonNode
};

// const edgeTypes = {
//     dottededge: DottedEdge,
// };

const dashedEdgeStyle: React.CSSProperties = {
    stroke: '#888',
    strokeWidth: 1,
    strokeDasharray: '5 5',
};

const defaultEdgeStyle: React.CSSProperties = {
    stroke: '#333',
    strokeWidth: 1.5,
    strokeDasharray: undefined,
};


/* ---------- Initial Data ---------- */
// const initialNodesOld: FlowNode[] = [
//     {
//         id: 'upload',
//         type: 'uploadNode',
//         position: { x: 0, y: 0 },
//         data: {
//             title: 'Upload Details',
//             libraryName: '',
//             languageOfDocument: '',
//         },
//     },
//     {
//         id: 'chunking',
//         type: 'chunkingNode',
//         position: { x: 350, y: 0 },
//         data: {
//             title: 'Chunking',
//         },
//     },
//     {
//         id: 'embeddingModel',
//         type: 'embeddingModelNode',
//         position: { x: 720, y: 0 },
//         data: {
//             title: 'Embedding Model',
//         },
//     },
//     {
//         id: 'bm25',
//         type: 'bm25Node',
//         position: { x: 720, y: 150 },
//         data: {
//             title: <span>BM25 <span style={{ 'fontSize': '10px' }}>(Optional)</span></span>,
//         },
//     },
//     {
//         id: 'reranker',
//         type: 'rerankerNode',
//         position: { x: 350, y: 250 },
//         data: {
//             title: <span>Reranker <span style={{ 'fontSize': '10px' }}>(Optional)</span></span>,
//         },
//     },
//     {
//         id: 'distanceFn',
//         type: 'distanceFnNode',
//         position: { x: 350, y: 400 },
//         data: {
//             title: <span>Distance Function <span style={{ 'fontSize': '10px' }}>(Optional)</span></span>,
//         },
//     },
//     {
//         id: 'uploadButton',
//         type: 'uploadButtonNode',
//         position: { x: 415, y: 520 },

//         data: {
//             title: 'Upload documents',
//         },
//     },
// ];


// const initialEdgesOld = [
//     {
//         id: 'upload-to-chunking',
//         source: 'upload',
//         target: 'chunking',
//         type: 'default',
//         animated: false,
//         markerEnd: {
//             type: 'arrowclosed',
//             color: '#333',
//         },
//         style: { stroke: '#333', strokeWidth: 1 }
//     },
//     {
//         id: 'chunking-to-embedding',
//         source: 'chunking',
//         target: 'embeddingModel',
//         type: 'default',
//         animated: false,
//         markerEnd: {
//             type: 'arrowclosed',
//             color: '#333',
//         },
//         style: { stroke: '#333', strokeWidth: 1 }

//     },
//     {
//         id: 'embedding-to-bm25',
//         source: 'embeddingModel',
//         target: 'bm25',
//         type: 'default',
//         animated: false,
//         markerEnd: {
//             type: 'arrowclosed',
//             color: '#333',
//         },
//         style: { stroke: '#333', strokeWidth: 1 }
//     },
//     {
//         id: 'bm25-to-reranker',
//         source: 'bm25',
//         target: 'reranker',
//         type: 'default',
//         animated: false,
//         markerEnd: {
//             type: 'arrowclosed',
//             color: '#333',
//         },
//         style: { stroke: '#333', strokeWidth: 1 }
//     },
//     {
//         id: 'reranker-to-distanceFn',
//         source: 'reranker',
//         target: 'distanceFn',
//         type: 'default',
//         animated: false,
//         markerEnd: {
//             type: 'arrowclosed',
//             color: '#333',
//         },
//         style: { stroke: '#333', strokeWidth: 1 }
//     },
//     {
//         id: 'distanceFn-to-uploadButton',
//         source: 'distanceFn',
//         target: 'uploadButton',
//         type: 'default',
//         animated: false,
//         markerEnd: {
//             type: 'arrowclosed',
//             color: '#333',
//         },
//         style: { stroke: '#333', strokeWidth: 1 }
//     }
// ];

const initialNodes: FlowNode[] = [
    {
        id: 'upload',
        type: 'uploadNode',
        position: { x: 12, y: 10 },
        data: {
            title: 'Upload Details',
            libraryName: '',
            languageOfDocument: '',
        },
    },
    {
        id: 'chunking',
        type: 'chunkingNode',
        position: { x: 0, y: 250 },
        data: {
            title: 'Chunking',
        },
    },
    {
        id: 'embeddingModel',
        type: 'embeddingModelNode',
        position: { x: 425, y: 10 },
        data: {
            title: 'Embedding Model',
        },
    },
    {
        id: 'bm25',
        type: 'bm25Node',
        position: { x: 525, y: 250 },
        data: {
            title: <span>BM25 <span style={{ 'fontSize': '10px' }}>(Optional)</span></span>,
        },
    },
    {
        id: 'reranker',
        type: 'rerankerNode',
        position: { x: 880, y: 110 },
        data: {
            title: <span>Reranker <span style={{ 'fontSize': '10px' }}>(Optional)</span></span>,
        },
    },
    {
        id: 'uploadButton',
        type: 'uploadButtonNode',
        position: { x: 945, y: 273 },

        data: {
            title: 'Upload documents',
        },
    },
];


const initialEdges = [
    {
        id: 'upload-to-chunking',
        source: 'upload',
        sourceHandle: 'upload-source-bottom',
        target: 'chunking',
        targetHandle: 'chunking-target-top',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: 'arrowclosed',
            color: '#333',
        },
        style: defaultEdgeStyle
    },
    {
        id: 'chunking-to-embedding',
        source: 'chunking',
        target: 'embeddingModel',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: 'arrowclosed',
            color: '#333',
        },
        style: defaultEdgeStyle

    },
    {
        id: 'chunking-to-bm25',
        source: 'chunking',
        target: 'bm25',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: 'arrowclosed',
            color: '#333',
        },
        style: defaultEdgeStyle
    },
    {
        id: 'embedding-to-reranker',
        source: 'embeddingModel',
        sourceHandle: 'embeddingModel-source-right',
        target: 'reranker',
        targetHandle: 'reranker-target-top',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: 'arrowclosed',
            color: '#333',
        },
        style: defaultEdgeStyle
    },
    {
        id: 'bm25-to-reranker',
        source: 'bm25',
        target: 'reranker',
        targetHandle: 'reranker-target-bottom',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: 'arrowclosed',
            color: '#333',
        },
        style: defaultEdgeStyle
    },
    {
        id: 'reranker-to-uploadButton',
        source: 'reranker',
        target: 'uploadButton',
        targetHandle: 'upload-button-target-top-center',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: 'arrowclosed',
            color: '#333',
        },
        style: defaultEdgeStyle
    }
];

/* ---------- Main Component ---------- */
const FlowUpload = (props: {
    currentSettings: any,
    settingsCallback: any,
    user?: any,
    djangoLogin?: any
}) => {
    const [showSuccess, setShowSuccess] = useState(false)
    const [showError, setShowError] = useState(false)
    const [showErrorMessage, setShowErrorMessage] = useState('')
    const [addLibrary, setAddLibrary] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadStage, setUploadStage] = useState('')
    const [uploadProgressMessage, setUploadProgressMessage] = useState('')
    const [formValidation, setFormValidation] = useState(false)

    const [nodes, setNodes] = useState<FlowNode[]>(() =>
        initialNodes.map((node) => ({
            ...node,
            data: { ...node.data, currentSettings: props.currentSettings, settingsCallback: props.settingsCallback, user: props.user, formValidation: formValidation },
        }))
    );
    const [edges, setEdges] = useState(initialEdges);
    const currentSettings = JSON.stringify(props.currentSettings ?? {});

    const onNodesChange = useCallback(
        (changes: NodeChange<FlowNode>[]) =>
            setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange<any>[]) =>
            setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    const onConnect = useCallback(
        (params: any) =>
            setEdges((eds) => addEdge(params, eds)),
        []
    );

    /* Pass currentSetting to all nodes as data */
    useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => ({ ...node, data: { ...node.data, currentSettings: props.currentSettings, user: props.user, formValidation: formValidation } }))
        );

        const isDisabled = props.currentSettings.useBM25 === false;
        const nextStyle = isDisabled ? dashedEdgeStyle : defaultEdgeStyle;

        const embeddingBm25TargetNode = props.currentSettings.reranker === 'none' ? 'uploadButton' : 'reranker';

        if (props.currentSettings.reranker === 'none') {
            // then the edge from embedding model will go directly to upload button, also the edge from bm25 will go direclty to upload button

            // need to add opacity 0.5 to reranker node to indicate it's disabled, also need to change the edges from embedding model and bm25 to go directly to upload button and remove the edge to reranker
            setNodes((nds) =>
                nds.map((node) => {
                    if (node.id === 'reranker') {
                        return {
                            ...node,
                            style: {
                                ...(node.style ?? {}),
                                opacity: 0.5,
                            },
                        }
                    }
                    return node;
                })
            );


            setEdges((eds) =>
                eds.map((e) => {
                    if (e.source === 'embeddingModel') {
                        return {
                            ...e,
                            target: embeddingBm25TargetNode,
                            style: {
                                ...(e.style ?? {}),
                                ...defaultEdgeStyle,
                            },
                        }
                    } else 
                        
                        if (e.source === 'bm25') {
                        return {
                            ...e,
                            target: embeddingBm25TargetNode,
                            style: {
                                ...(e.style ?? {}),
                                ...nextStyle,
                            },
                        }
                    }

                    // remove the edge with id reranker-to-uploadButton
                    setEdges((eds) => eds.filter((edge) => edge.id !== 'reranker-to-uploadButton'));

                    setEdges((prevEds) => {
                        const newEdges = [...prevEds];
                        if (!prevEds.find((edge) => edge.id === 'embeddingModel-to-uploadButton')) {
                            newEdges.push({
                                id: 'embeddingModel-to-uploadButton',
                                source: 'embeddingModel',
                                target: 'uploadButton',
                                targetHandle: 'upload-button-target-top-left',
                                type: 'smoothstep',
                                animated: false,
                                markerEnd: {
                                    type: 'arrowclosed',
                                    color: '#333',
                                },
                                style: defaultEdgeStyle,
                            });
                        }
                        if (!prevEds.find((edge) => edge.id === 'bm25-to-uploadButton')) {
                            newEdges.push({
                                id: 'bm25-to-uploadButton',
                                source: 'bm25',
                                target: 'uploadButton',
                                targetHandle: 'upload-button-target-left',
                                type: 'smoothstep',
                                animated: false,
                                markerEnd: {
                                    type: 'arrowclosed',
                                    color: '#333',
                                },
                                style: nextStyle,
                            });
                        }
                        return newEdges;
                    })

                    return e;
                }).filter((e) => e !== null)

                // now the edge has to go directly from embedding model and bm25 to upload button

            );
        } else {
            // need to set the opacity to 1 after reenabling the reranker
            setNodes((nds) =>
                nds.map((node) => {
                    if (node.id === 'reranker') {
                        return {
                            ...node,
                            style: {
                                ...(node.style ?? {}),
                                opacity: 1,
                            },
                        }
                    }
                    return node;
                })
            );
            // otherwise normal flow where embedding model and bm25 both connect to reranker and then reranker connects to upload button
            setEdges((eds) => eds.map((e) => {
                if (e.source === 'embeddingModel') {
                    return {
                        ...e,
                        target: 'reranker',
                        style: {
                            ...(e.style ?? {}),
                            ...defaultEdgeStyle,
                        },
                    }
                } else if (e.source === 'bm25') {
                    return {
                        ...e,
                        target: 'reranker',
                        style: {
                            ...(e.style ?? {}),
                            ...nextStyle,
                        },
                    }
                } else if (!eds.find((edge) => edge.id === 'reranker-to-uploadButton')) {
                    setEdges((prevEds) => [
                        ...prevEds,
                        {
                            id: 'reranker-to-uploadButton',
                            source: 'reranker',
                            target: 'uploadButton',
                            targetHandle: 'upload-button-target-top-center',
                            type: 'smoothstep',
                            animated: false,
                            markerEnd: {
                                type: 'arrowclosed',
                                color: '#333',
                            },
                            style: nextStyle,
                        }
                    ]);
                }
                return e;
            }));
        }

        setEdges((eds) =>
            eds.map((e) =>
                e.source === 'bm25' || e.target === 'bm25'
                    ? {
                        ...e,
                        style: {
                            ...(e.style ?? {}),
                            ...nextStyle,
                        },
                    }
                    : e
            )
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSettings, props.user, formValidation]);

    const onNodeClick = (event: React.MouseEvent, node: FlowNode) => {
        if (node.type === 'uploadButtonNode') {
            if (props.currentSettings.libraryName) {
                setFormValidation(true)
                uploadLibrary()
            } else {
                setFormValidation(true)
                console.error('Some fields are unknown.')
            }
        }
    };

    const uploadLibrary = () => {
        setAddLibrary(true)
        setUploadProgress(0)
        setUploadStage('uploading')
        setUploadProgressMessage('Starting upload...')
        
        const formData = new FormData()

        formData.append('dataset_name', props.currentSettings.libraryName)
        formData.append('embedding_model', props.currentSettings.selectedEmbeddingModel || 'nomic-embed-text:latest')
        formData.append('user', props.user ? props.user.user.replace(', ', '_') : '-')
        formData.append('user_email', props.user ? props.user.user_email : '-')
        formData.append('user_group', props.user && props.user.isAdmin ? 'admin' : 'user')
        formData.append('chunking_method', props.currentSettings.chunkingMethod || 'fixed_chunk_size')
        formData.append('use_overlap', props.currentSettings.useOverlap || 'Yes')
        formData.append('chunk_size', props.currentSettings.chunkSize || 1000)
        formData.append('use_bm25', props.currentSettings.useBM25 || 'Yes')
        formData.append('reranker', props.currentSettings.reranker || 'qnli-electra-base (default)')
        formData.append('distance_function', props.currentSettings.distanceFn || 'l2')
        formData.append('documents_language', props.currentSettings.languageOfDocs || 'English')
        formData.append('stream_progress', 'true')

        props.currentSettings.docs.filter((d: { file: null; title: string; }) => d.file !== null && d.title !== '').forEach((doc: any) => {
            if (doc.title && doc.file) {
                formData.append('paper_title', doc.title)
                formData.append('paper_attachment', doc.file)
            }
        })

        const requestOptions = {
            method: 'POST',
            headers: {
                'Authorization': `${props.user && props.djangoLogin ?
                    'Bearer ' + localStorage.getItem('access') :
                    import.meta.env.PROD ?
                        import.meta.env.VITE_AUTH_TOKEN_PROD
                        : import.meta.env.VITE_AUTH_TOKEN_DEV}`
            },
            body: formData
        }
        
        fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/upload_documents/`, requestOptions)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Upload failed')
                }
                
                const reader = response.body?.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                const processStream = async () => {
                    try {
                        while (reader) {
                            const { done, value } = await reader.read()
                            if (done) break

                            buffer += decoder.decode(value, { stream: true })
                            const lines = buffer.split('\n')
                            buffer = lines.pop() || ''

                            for (const line of lines) {
                                if (line.trim()) {
                                    try {
                                        const update = JSON.parse(line)

                                        if (update.type === 'progress') {
                                            setUploadProgress(update.progress)
                                            setUploadStage(update.stage)
                                            setUploadProgressMessage(update.message)
                                        } else if (update.type === 'done') {
                                            setUploadProgress(100)
                                            setUploadStage('completed')
                                            // Clear localStorage and form data
                                            localStorage.removeItem('upUploadNodeState')
                                            const emptyDocs = Array.from(Array(40).keys()).map(() => ({ title: '', file: null }))
                                            props.settingsCallback({ ...props.currentSettings, libraryName: '', docs: emptyDocs, fetchDatasets: true, datasetsUpdated: true })
                                            setAddLibrary(false)
                                            setShowSuccess(true)
                                        } else if (update.type === 'error') {
                                            setShowError(true)
                                            setShowErrorMessage(update.error_message || 'Error uploading documents')
                                            setAddLibrary(false)
                                        }
                                    } catch (parseError) {
                                        console.error('Failed to parse update:', parseError)
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Stream processing error:', error)
                        setShowError(true)
                        setShowErrorMessage('Error processing upload')
                        setAddLibrary(false)
                    }
                }

                if (reader) {
                    processStream()
                }
            })
            .catch(error => {
                console.error('Upload error:', error)
                setShowError(true)
                setShowErrorMessage('Error uploading documents')
                setAddLibrary(false)
            })
    }

    return (
        <div className="px-4 py-4" style={{ width: '100%', height: '88%' }}>
            {showSuccess ?
                <div className='flex justify-start'>
                    <div className='text-nav dark:text-nav-dark p-1 text-sm bg-green-200 rounded-md'>Library uploaded successfully</div>
                </div> :
                addLibrary && !showSuccess ?
                    <div className='flex flex-col justify-start gap-2'>
                        <div className='text-nav dark:text-nav-dark p-1 text-sm bg-orange-200 rounded-md'>Uploading Documents</div>
                        <div className='flex flex-col gap-1'>
                            <div className='flex justify-between text-xs text-nav dark:text-nav-dark'>
                                <span>{uploadStage.charAt(0).toUpperCase() + uploadStage.slice(1).replace(/_/g, ' ')}</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div className='w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2 overflow-hidden'>
                                <div 
                                    className='bg-blue-500 h-2 transition-all duration-300'
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            {uploadProgressMessage && (
                                <div className='text-xs text-nav dark:text-nav-dark mt-1'>{uploadProgressMessage}</div>
                            )}
                        </div>
                    </div> :
                    <></>
            }
            {showError ?
                <div className='flex justify-start'>
                    <div className='text-nav dark:text-nav-dark p-1 text-sm bg-red-200 rounded-md'>
                        {showErrorMessage || 'Error uploading documents'}
                    </div>
                </div> : <></>
            }
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
            >
                <Controls showFitView={false} showInteractive={false} position='top-right' />
            </ReactFlow>
        </div>
    );
}

export default FlowUpload;
