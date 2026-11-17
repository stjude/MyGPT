import { useState, useEffect } from 'react';
import {
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import defaultSettings from '../../../utils/DefaultState'
import { fetchAndRegisterOllamaModels } from '../../../utils/GPTHomeAPI'

const stateKey = 'seLLMNodeState';
const LLMNode = ({ data }: any) => {
    const [collapsed, setCollapsed] = useState(false);

    const [llmOptions, setLlmOptions] = useState([
        ...new Set([
            ...defaultSettings.llms,
            ...data.currentSettings.llms,
            data.currentSettings.defaultLlm
        ])
    ]);

    useEffect(() => {
        const abortController = new AbortController();
        
        const fetchOllamaLLMs = async () => {
            try {
                const ollamaLlms = await fetchAndRegisterOllamaModels(data.currentSettings, abortController.signal);
                setLlmOptions((prev) => [...new Set([...prev, ...ollamaLlms])]);
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') return;
                console.error('Failed to fetch Ollama models:', error);
            }
        };
        
        fetchOllamaLLMs();
        
        return () => abortController.abort();
    }, [data.currentSettings]);

    const getInitialUploadNodeData = () => {
        try {
            const saved = localStorage.getItem(stateKey)
            if (saved) {
                return JSON.parse(saved)
            }
        } catch (error) {
            console.error('Failed to parse uploadNodeData from localStorage:', error)
        }

        return {
            selectedLlm: data.currentSettings.defaultLlm || defaultSettings.defaultLlm
        }
    }

    const initialData = getInitialUploadNodeData()
    const [selectedLlm, setSelectedLlm] = useState(initialData.selectedLlm)

    useEffect(() => {
        // localStorage.setItem(
        //     stateKey,
        //     JSON.stringify({
        //         selectedLlm: selectedLlm,
        //     })
        // )
        data.setChatSettings((prev: any) => ({
            ...prev,
            llm: selectedLlm,
        }))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLlm])

    const labelStyle: React.CSSProperties = {
        fontSize: 13,
        width: 100,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        color: '#2a4759',
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    };

    const inputStyle: React.CSSProperties = {
        flex: 1,
        padding: '6px 8px',
        fontSize: 13,
        border: '1px solid #ccc',
        borderRadius: 6,
        height: 30,
        boxSizing: 'border-box',
        backgroundColor: '#fff',
    };

    return (
        <div
            style={{
                width: 330,
                border: '1px solid #ccc',
                borderRadius: 10,
                background: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                overflow: 'hidden',
            }}
        >
            {/* HEADER */}
            <div
                style={{
                    padding: '6px 10px',
                    fontWeight: 600,
                    background: 'rgb(103, 127, 139)',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <span>{data.title}</span>

                {/* Collapse Button */}
                <button
                    onClick={() => setCollapsed((prev) => !prev)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: 14,
                        cursor: 'pointer',
                    }}
                >
                    {collapsed ? '➕' : '➖'}
                </button>
            </div>

            {!collapsed && (
                <div style={{ padding: 12 }}>
                    {/* Available LLMs */}
                    <div style={rowStyle}>
                        <div style={labelStyle}>Available LLMs</div>
                        <select style={inputStyle} value={selectedLlm} onChange={(e) => setSelectedLlm(e.target.value)}>
                            {llmOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Chunk Size */}
                    {/* <div style={rowStyle}>
                        <div style={labelStyle}>Chunk Size</div>
                        <select style={inputStyle} defaultValue="100">
                            <option value="100">100</option>
                            <option value="200">200</option>
                            <option value="300">300</option>
                        </select>
                    </div> */}

                </div>
            )}

            <Handle type="target" position={Position.Left} style={{ top: 15, left: -10, transform: 'none', background: 'none', border: 'none' }}  />
            <Handle type="source" position={Position.Right} />
        </div>
    );
};

export default LLMNode;
