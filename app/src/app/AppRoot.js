import { useState, useEffect, useRef } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { getProfile } from '../lib/profile.js';
import { HC } from './AndroidBridge.js';
import { ak, dk } from '../_slice_shell.js';
import { mk } from '../_slice_onboarding.js';
import { HomeScreen } from '../screens/Home.js';
import { LifeHubScreen } from '../screens/LifeHub.js';
import { JournalScreen } from '../screens/Journal.js';
import { SettingsScreen } from '../screens/Settings.js';

// React Query client — retry off, no refetch on window focus
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

function AuthenticatedApp({ profile }) {
  return jsxs(ak, {
    children: [
      jsx(HC, {}),
      jsxs(HashRouter, {
        children: [
          jsx(Route, { path: '/', component: () => jsx(HomeScreen, { profile }) }),
          jsx(Route, { path: '/timeline', component: () => jsx(LifeHubScreen, { profile }) }),
          jsx(Route, { path: '/journal', component: () => jsx(JournalScreen, {}) }),
          jsx(Route, { path: '/settings', component: () => jsx(SettingsScreen, {}) })
        ]
      })
    ]
  });
}

export function QC() {
  const [profile, setProfile] = useState(() => getProfile());
  // First render: check if profile exists
  const profileRef = useRef(profile);
  
  useEffect(() => {
    profileRef.current = getProfile();
    setProfile(profileRef.current);
  }, []);

  // No profile → show onboarding
  if (!profile) {
    return jsx(mk, {
      onComplete: (newProfile) => {
        setProfile(newProfile);
      }
    });
  }

  // Has profile → show authenticated app with providers
  return jsx(QueryClientProvider, {
    client: queryClient,
    children: jsxs("div", {
      children: [
        jsx(AuthenticatedApp, { profile })
      ]
    })
  });
}
