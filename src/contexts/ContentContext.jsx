import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const ContentContext = createContext();

export function ContentProvider({ children }) {
  const [content, setContent] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    try {
      const response = await api.get('/content/public');
      const contentMap = {};
      response.data.forEach(block => {
        contentMap[block.key] = block.value;
      });
      setContent(contentMap);
    } catch (error) {
      console.error('Failed to load content:', error);
      // Continue with empty content rather than blocking the app
    } finally {
      setLoading(false);
    }
  }

  function get(key, fallback = '') {
    return content[key] || fallback;
  }

  return (
    <ContentContext.Provider value={{ content, loading, get, reload: loadContent }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent(key, fallback = '') {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within ContentProvider');
  }
  return context.get(key, fallback);
}

export function useContentContext() {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContentContext must be used within ContentProvider');
  }
  return context;
}
