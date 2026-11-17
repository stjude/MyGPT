import { useState, useCallback, useEffect, useRef } from 'react';
import {
    ReactFlow,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    // Handle,
    // Position,
    NodeChange,
    EdgeChange,
    Node,
    MarkerType, 
    Controls
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
// import { UploadNode, ChunkingNode, EmbeddingModelNode, BM25Node, RerankerNode } from './Flow/StageOne';
import { InputNode, OutputNode, LLMNode, PromptNode, RelevanceScoreNode, SaveNode } from './Flow/StageTwo';
import { ReactNode } from 'react';
import { updateDatasetRequest, getDatasetDetailsRequest } from '../utils/SettingsAPI';
import defaultSettings from '../utils/DefaultState';

type FlowNode = Node<{ title: string | ReactNode; libraryName?: string; languageOfDocument?: string }, string>;

/* ---------- Node Types ---------- */
const nodeTypes = {
    inputNode: InputNode,
    outputNode: OutputNode,
    llmNode: LLMNode,
    promptNode: PromptNode,
    relevanceScoreNode: RelevanceScoreNode,
    saveNode: SaveNode,
    resetNode: SaveNode,
};

/* ---------- Initial Data ---------- */
const initialNodes: FlowNode[] = [
    {
        id: 'inputNode',
        type: 'inputNode',
        position: { x: 0, y: 30 },
        data: {
            title: 'User query',
        },
    },
    {
        id: 'llmNode',
        type: 'llmNode',
        position: { x: 170, y: 0 },
        data: {
            title: 'LLM',
        },
    },
    {
        id: 'promptNode',
        type: 'promptNode',
        position: { x: 600, y: 0 },
        data: {
            title: 'Prompt, creativity & chunk settings',
        },
    },
    {
        id: 'relevanceScoreNode',
        type: 'relevanceScoreNode',
        position: { x: 50, y: 150 },
        data: {
            title: 'Relevance Score',
        },
    },
    {
        id: 'outputNode',
        type: 'outputNode',
        position: { x: 600, y: 600 },
        data: {
            title: 'LLM Response',
        },
    },
    {
        id: 'saveNode',
        type: 'saveNode',
        position: { x: 440, y: 760 },
        data: {
            title: 'Save Settings',
        },
    },
    {
        id: 'resetNode',
        type: 'resetNode',
        position: { x: 660, y: 760 },
        data: {
            title: 'Reset Settings',
        },
    }
];



const initialEdges = [
    {
        id: 'input-to-llm',
        source: 'inputNode',
        target: 'llmNode',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#333',
            width: 20,
            height: 20,
        },
        style: { stroke: '#333', strokeWidth: 1.5 }
    },
    {
        id: 'llm-to-prompt',
        source: 'llmNode',
        target: 'promptNode',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#333',
            width: 20,
            height: 20,
        },
        style: { stroke: '#333', strokeWidth: 1.5 }
    },
    {
        id: 'prompt-to-relevance',
        source: 'promptNode',
        target: 'relevanceScoreNode',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#333',
            width: 20,
            height: 20,
        },
        style: { stroke: '#333', strokeWidth: 1.5 }
    },
    {
        id: 'relevance-to-output',
        source: 'relevanceScoreNode',
        target: 'outputNode',
        type: 'smoothstep',
        animated: false,
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#333',
            width: 20,
            height: 20,
        },
        style: { stroke: '#333', strokeWidth: 1.5 }
    },
    
];


/* ---------- Main Component ---------- */
const FlowSettings = (props: {
    currentSettings: any,
    defaultSettings?: any,
    settingsCallback: any,
    user?: any,
    djangoLogin?: any
}) => {

    const [formValidation] = useState(false)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [flowRenderKey, setFlowRenderKey] = useState(0)
    const [loadingLibrarySettings, setLoadingLibrarySettings] = useState(false)
    const [selectedLibrary, setSelectedLibrary] = useState(props.currentSettings?.selectedDataset || 'None')
    const [chatSettings, setChatSettings] = useState({
        selectedLlm: props.currentSettings?.selectedLlm || defaultSettings.defaultLlm,
        systemPrompt: props.currentSettings?.system_prompt || '',
        maximum_chunks_count: props.currentSettings?.maximum_chunks_count || '15',
        no_chunk_cutoff: props.currentSettings?.no_chunk_cutoff || false,
        relevance_score_cutoff: props.currentSettings?.relevance_score_cutoff || {}
    })

    const [nodes, setNodes] = useState<FlowNode[]>(() =>
        initialNodes.map((node) => ({
            ...node,
            data: { ...node.data, currentSettings: props.currentSettings, setChatSettings: setChatSettings, user: props.user, formValidation: formValidation },
        }))
    );

    const [edges, setEdges] = useState(initialEdges);
    const currentSettings = JSON.stringify(props.currentSettings ?? {});
    const hasMounted = useRef(false)
    const hydratedDatasetRef = useRef<string | null>(null)

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
            nds.map((node) => ({ ...node, data: { ...node.data, currentSettings: props.currentSettings, user: props.user } }))
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSettings, props.user]);

    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }
        setFlowRenderKey((prev) => prev + 1)
    }, [currentSettings])

    useEffect(() => {
        setSelectedLibrary(props.currentSettings?.selectedDataset || 'None')
    }, [props.currentSettings?.selectedDataset])

    useEffect(() => {
        if (!statusMessage) return
        const timer = window.setTimeout(() => {
            setStatusMessage(null)
        }, 5000)
        return () => window.clearTimeout(timer)
    }, [statusMessage])

    const handleLibraryChange = async (datasetName: string, showStatusMessage: boolean = true) => {
        setSelectedLibrary(datasetName)
        if (!datasetName || datasetName === 'None') {
            return
        }

        setLoadingLibrarySettings(true)
        try {
            const datasetDetails = await getDatasetDetailsRequest(datasetName, props.user, props.djangoLogin)
            if (!datasetDetails) {
                setLoadingLibrarySettings(false)
                return
            }

            const nextRelevanceScoreCutoff = {
                ...props.currentSettings.relevance_score_cutoff,
                Qsem_a: datasetDetails.coefficient_a_Qsem,
                Qkey_b: datasetDetails.coefficient_b_Qkey,
                Qrank_c: datasetDetails.coefficient_c_Qrank,
                Asem_x: datasetDetails.coefficient_x_Asem,
                Akey_y: datasetDetails.coefficient_y_Akey,
                Arank_z: datasetDetails.coefficient_z_Arank,
                QRS_p: datasetDetails.coefficient_p_QRS,
                ARS_q: datasetDetails.coefficient_q_ARS,
                HI_by_equation: datasetDetails.HI_by_equation,
            }

            const nextSettings = {
                ...props.currentSettings,
                selectedDataset: datasetName,
                system_prompt: datasetDetails.dataset_prompt ?? props.currentSettings.system_prompt,
                DatasetLanguage: datasetDetails.documents_language ?? props.currentSettings.DatasetLanguage,
                answerWithoutContext: datasetDetails.direct_chat_without_docs ?? props.currentSettings.answerWithoutContext,
                fetchPapers: !(datasetDetails.direct_chat_without_docs ?? props.currentSettings.answerWithoutContext),
                relevance_score_cutoff: nextRelevanceScoreCutoff,
                use_default_qrs: false,
                use_default_ars: false,
                use_default_hi: false,
            }

            setChatSettings((prev) => ({
                ...prev,
                systemPrompt: nextSettings.system_prompt,
                relevance_score_cutoff: nextRelevanceScoreCutoff,
            }))

            hydratedDatasetRef.current = datasetName
            props.settingsCallback(nextSettings)
            if (showStatusMessage) {
                setStatusMessage('Library settings loaded.')
            }
        } catch (error) {
            console.error('Failed to load library settings:', error)
            if (showStatusMessage) {
                setStatusMessage('Failed to load library settings.')
            }
        } finally {
            setLoadingLibrarySettings(false)
        }
    }

    useEffect(() => {
        const datasetName = props.currentSettings?.selectedDataset
        if (!datasetName || datasetName === 'None') {
            return
        }

        if (hydratedDatasetRef.current === datasetName) {
            return
        }

        handleLibraryChange(datasetName, false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.currentSettings?.selectedDataset])

    const saveSettings = async () => {
        const datasetName = props.currentSettings.selectedDataset !== props.currentSettings.defaultDataset
            ? props.currentSettings.selectedDataset
            : props.currentSettings.defaultDataset

        const relevanceScoreCutoff = chatSettings.relevance_score_cutoff || {}
        const updateBody = {
            dataset: datasetName,
            system_prompt: chatSettings.systemPrompt,
            Qsem_a: relevanceScoreCutoff.Qsem_a,
            Qkey_b: relevanceScoreCutoff.Qkey_b,
            Qrank_c: relevanceScoreCutoff.Qrank_c,
            Asem_x: relevanceScoreCutoff.Asem_x,
            Akey_y: relevanceScoreCutoff.Akey_y,
            Arank_z: relevanceScoreCutoff.Arank_z,
            QRS_p: relevanceScoreCutoff.QRS_p,
            ARS_q: relevanceScoreCutoff.ARS_q,
            HI_by_equation: relevanceScoreCutoff.HI_by_equation,
        }

        try {
            await updateDatasetRequest(updateBody, props.user, props.djangoLogin)

            props.settingsCallback({
                ...props.currentSettings,
                ...chatSettings,
                system_prompt: chatSettings.systemPrompt,
                relevance_score_cutoff: chatSettings.relevance_score_cutoff,
            })
            setStatusMessage('Settings are applied.')
        } catch (error) {
            console.error('Failed to save flow settings:', error)
            setStatusMessage('Failed to save settings.')
        }
    }

    const resetSettings = async () => {
        const fallbackDefaults = props.defaultSettings || props.currentSettings
        const datasetName = props.currentSettings.selectedDataset !== props.currentSettings.defaultDataset
            ? props.currentSettings.selectedDataset
            : props.currentSettings.defaultDataset
        const fallbackRelevanceScoreCutoff = fallbackDefaults?.relevance_score_cutoff || {}
        const updateBody = {
            dataset: datasetName,
            system_prompt: fallbackDefaults?.system_prompt || '',
            Qsem_a: fallbackRelevanceScoreCutoff.Qsem_a,
            Qkey_b: fallbackRelevanceScoreCutoff.Qkey_b,
            Qrank_c: fallbackRelevanceScoreCutoff.Qrank_c,
            Asem_x: fallbackRelevanceScoreCutoff.Asem_x,
            Akey_y: fallbackRelevanceScoreCutoff.Akey_y,
            Arank_z: fallbackRelevanceScoreCutoff.Arank_z,
            QRS_p: fallbackRelevanceScoreCutoff.QRS_p,
            ARS_q: fallbackRelevanceScoreCutoff.ARS_q,
            HI_by_equation: fallbackRelevanceScoreCutoff.HI_by_equation,
        }

        try {
            await updateDatasetRequest(updateBody, props.user, props.djangoLogin)
        } catch (error) {
            console.error('Failed to reset dataset settings:', error)
            setStatusMessage('Failed to reset settings.')
            return
        }

        props.settingsCallback({ ...props.currentSettings, ...fallbackDefaults })
        setChatSettings({
            selectedLlm: fallbackDefaults?.selectedLlm || defaultSettings.defaultLlm,
            systemPrompt: fallbackDefaults?.system_prompt || '',
            maximum_chunks_count: fallbackDefaults?.maximum_chunks_count || '15',
            no_chunk_cutoff: fallbackDefaults?.no_chunk_cutoff || false,
            relevance_score_cutoff: fallbackDefaults?.relevance_score_cutoff || {}
        })
        setNodes((nds) =>
            nds.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    currentSettings: { ...props.currentSettings, ...fallbackDefaults },
                    setChatSettings: setChatSettings,
                    user: props.user,
                    formValidation: formValidation,
                }
            }))
        )
        setFlowRenderKey((prev) => prev + 1)
        setStatusMessage('Setting has been reset.')
    }

    const onNodeClick = (event: React.MouseEvent, node: FlowNode) => {
        if (node.id === 'saveNode') {
            saveSettings()
        } else if (node.id === 'resetNode') {
            resetSettings()
        }
    };

    return (
        <div style={{ width: '100%', height: '95%' }}>
            <div className='flex items-center gap-3 mb-2'>
                <label className='text-nav dark:text-nav-dark text-sm font-semibold'>Library</label>
                <select
                    className='text-sm rounded-md p-1 dark:text-white dark:bg-gray-500'
                    value={selectedLibrary}
                    onChange={(e) => handleLibraryChange(e.target.value)}
                    disabled={loadingLibrarySettings}
                >
                    {(props.currentSettings?.datasets || [])
                        .filter((dataset: string) => dataset && dataset !== 'None')
                        .map((dataset: string) => (
                            <option key={dataset} value={dataset}>{dataset}</option>
                        ))}
                </select>
                {loadingLibrarySettings && <span className='text-nav dark:text-nav-dark text-xs'>Loading...</span>}
            </div>
            {statusMessage &&
                <div className='flex justify-start'>
                    <div className='text-nav dark:text-nav-dark p-1 text-sm bg-green-200 rounded-md flex items-center gap-2'>
                        <span>{statusMessage}</span>
                        <button
                            type='button'
                            className='px-1 text-nav dark:text-nav-dark font-semibold'
                            onClick={() => setStatusMessage(null)}
                        >
                            x
                        </button>
                    </div>
                </div> 
            }
            <ReactFlow
                key={flowRenderKey}
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                // fitView
                defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
            // fitViewOptions={{ padding: 0.2 }}
            >
                <Controls showFitView={false} showInteractive={false} position='bottom-left' />
            </ReactFlow>
        </div>
    );
}

export default FlowSettings