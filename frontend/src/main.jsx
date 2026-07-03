import './license.js'; // lisans denetimi + terminal header fetch patch'i (App'ten ÖNCE kurulmalı)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { FeedbackProvider } from './shared/feedback';
import './styles.css';
import './api.js'; // window.PROMETA_API setup

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </React.StrictMode>,
);
