import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ChatInterface from './components/ChatInterface';
import NotesManager from './components/NotesManager';
import UserProfile from './components/UserProfile';
import { getUser, clearAuth, getToken } from './utils/auth';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('chat'); // 'chat' | 'notes' | 'profile'

  // Check for existing auth on mount
  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      setCurrentUser(user);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    clearAuth();
    setCurrentUser(null);
    setCurrentView('chat');
  };

  const handleOpenNotes = () => {
    setCurrentView('notes');
  };

  const handleOpenProfile = () => {
    setCurrentView('profile');
  };

  const handleBackToChat = () => {
    setCurrentView('chat');
  };

  const handleUserUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#1a1a1a', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#888'
      }}>
        加载中...
      </div>
    );
  }

  // If logged in
  if (currentUser) {
    if (currentView === 'notes') {
      return <NotesManager user={currentUser} onBack={handleBackToChat} onOpenProfile={handleOpenProfile} />;
    }
    if (currentView === 'profile') {
      return (
        <UserProfile 
          user={currentUser} 
          onBack={handleBackToChat}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
        />
      );
    }
    return (
      <ChatInterface 
        user={currentUser} 
        onLogout={handleLogout} 
        onOpenNotes={handleOpenNotes}
        onOpenProfile={handleOpenProfile}
      />
    );
  }

  // Otherwise show login form
  return <LoginForm onLoginSuccess={handleLoginSuccess} />;
}
