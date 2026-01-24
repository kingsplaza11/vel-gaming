// src/contexts/LoadingContext.jsx
import React, { createContext, useState, useContext } from 'react';
import LoadingAnimation from '../components/LoadingAnimation';

// Create the context
const LoadingContext = createContext();

// Custom hook to use the loading context
export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};

export const LoadingProvider = ({ children }) => {
  const [loadingGame, setLoadingGame] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const startGameLoading = (game) => {
    setLoadingGame(game);
    setLoadingProgress(0);
    
    // Simulate loading progress
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10; // Increase by 10% every 500ms
      });
    }, 500);
    
    // Auto-clear after 5 seconds
    setTimeout(() => {
      clearInterval(interval);
      setLoadingProgress(100);
    }, 5000);
  };

  const stopLoading = () => {
    setLoadingGame(null);
    setLoadingProgress(0);
  };

  return (
    <LoadingContext.Provider value={{ 
      loadingGame, 
      loadingProgress, 
      startGameLoading, 
      stopLoading 
    }}>
      {children}
      
      {/* Global Loading Animation Overlay */}
      {loadingGame && (
        <LoadingAnimation 
          game={loadingGame}
          progress={loadingProgress}
          onComplete={stopLoading}
        />
      )}
    </LoadingContext.Provider>
  );
};