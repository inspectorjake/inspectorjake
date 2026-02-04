/**
 * Jake MCP DevTools Panel - Vue app entry point.
 */
import './styles/tailwind.css';
import { createApp } from 'vue';
import Panel from './Panel.vue';

createApp(Panel).mount('#app');
