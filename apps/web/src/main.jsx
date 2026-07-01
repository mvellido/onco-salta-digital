import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';

const rootElement = (
  import.meta.env.DEV ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
);

ReactDOM.createRoot(document.getElementById('root')).render(rootElement);
