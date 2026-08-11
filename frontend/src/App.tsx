import { useState } from 'react';
import api from './services/api'; // Or standard fetch

export default function App() {
  const [status, setStatus] = useState<string>('Not tested');

  const testConnection = async () => {
    try {
      // Using relative URL because vite.config.ts proxies /api to backend
      const response = await api.get('/test'); 
      setStatus(response.data.message);
    } catch (error) {
      console.error('Connection failed:', error);
      setStatus('Connection Failed!');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Frontend-Backend Connection Test</h1>
      <button onClick={testConnection}>Test Backend Connection</button>
      <p><strong>Status:</strong> {status}</p>
    </div>
  );
}