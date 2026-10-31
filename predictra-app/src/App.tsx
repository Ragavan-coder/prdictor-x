import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import CinematicIntro from './components/CinematicIntro';
import VideoPlayer from './components/VideoPlayer';
import PortalPage from './components/PortalPage';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import { initKeycloak, getKeycloakUserProfile, logoutKeycloak } from './services/keycloak';
import './index.css';

export type AppStage = 'intro' | 'video' | 'portal' | 'auth' | 'dashboard';

export interface User {
  id?: string;
  name: string;
  email: string;
  roles?: string[];
  mfaVerified?: boolean;
}

function App() {
  const [stage, setStage] = useState<AppStage>('intro');
  const muted = false; // Unmuted by default for full audio experience
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);

  // Check for Keycloak OIDC PKCE redirect callback or existing SSO session
  useEffect(() => {
    const isOidcCallback =
      window.location.search.includes('code=') ||
      window.location.hash.includes('code=') ||
      window.location.search.includes('state=');

    initKeycloak().then((authenticated) => {
      if (authenticated) {
        const profile = getKeycloakUserProfile();
        if (profile) {
          setAuthenticatedUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            roles: profile.roles,
            mfaVerified: true,
          });
          setStage('dashboard');
        }
      } else if (isOidcCallback) {
        setStage('auth');
      }
    });
  }, []);

  const handleIntroComplete = useCallback(() => {
    setStage('video');
  }, []);

  const handleVideoComplete = useCallback(() => {
    setStage('portal');
  }, []);

  const handlePortalEnter = useCallback(() => {
    setStage('auth');
  }, []);

  const handleReplayVideo = useCallback(() => {
    setStage('video');
  }, []);

  const handleBackToPortal = useCallback(() => {
    setStage('portal');
  }, []);

  const handleAuthSuccess = useCallback((user: User) => {
    setAuthenticatedUser(user);
    setStage('dashboard');
  }, []);

  const handleLogout = useCallback(async () => {
    setAuthenticatedUser(null);
    await logoutKeycloak(window.location.origin);
    setStage('portal');
  }, []);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        background: '#ECEDEA',
      }}
    >
      <AnimatePresence mode="wait">
        {stage === 'intro' && (
          <CinematicIntro key="intro" onComplete={handleIntroComplete} />
        )}

        {stage === 'video' && (
          <VideoPlayer
            key="video"
            src="/Trust.mp4"
            muted={muted}
            onComplete={handleVideoComplete}
          />
        )}

        {stage === 'portal' && (
          <PortalPage
            key="portal"
            onEnter={handlePortalEnter}
            onReplayVideo={handleReplayVideo}
          />
        )}

        {stage === 'auth' && (
          <AuthPage
            key="auth"
            onAuthSuccess={handleAuthSuccess}
            onBackToPortal={handleBackToPortal}
          />
        )}

        {stage === 'dashboard' && authenticatedUser && (
          <Dashboard
            key="dashboard"
            user={authenticatedUser}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
