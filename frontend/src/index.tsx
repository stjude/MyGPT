import React from 'react';
import { createRoot } from 'react-dom/client';
// import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { initializeRuntimeConfig } from './utils/runtimeConfig';

const renderApp = async () => {
	await initializeRuntimeConfig()
	const domNode:any = document.getElementById('root');
	const root = createRoot(domNode);
	root.render(<App />);
}

renderApp()