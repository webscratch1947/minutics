import { useState, useEffect, useRef } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { getProfile } from '../lib/profile.js';
import { HC } from './AndroidBridge.js';
import { ak, dk } from '../_slice_shell.js';
import { mk } from '../_slice_onboarding.js';
import { TimerScreen, ActivityScreen } from '../screens/Home.js';
import { LifeHubScreen } from '../screens/LifeHub.js';
import { JournalScreen } from '../screens/Journal.js';
import { SettingsScreen } from '../screens/Settings.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

function AuthenticatedApp({ profile }) {
  return jsx(HashRouter, {
    children: jsxs(ak, {
      children: [
        jsx(HC, {}),
        jsx(Routes, {
          children: [
            jsx(Route, { path: '/', element: jsx(TimerScreen, { profile }) }),
            jsx(Route, { path: '/activity', element: jsx(ActivityScreen, { profile }) }),
            jsx(Route, { path: '/timeline', element: jsx(LifeHubScreen, { profile }) }),
            jsx(Route, { path: '/journal', element: jsx(JournalScreen, {}) }),
            jsx(Route, { path: '/settings', element: jsx(SettingsScreen, {}) }),
            jsx(Route, { path: '*', element: jsx(dk, {}) })
          ]
        })
      ]
    })
  });
}

export function QC() {
  const [profile, setProfile] = useState(() => getProfile());
  // Bumped on account switch so onboarding + the whole app remount fresh
  const [userEpoch, setUserEpoch] = useState(0);
  // First render: check if profile exists
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = getProfile();
    setProfile(profileRef.current);
  }, []);

  // auth.js dispatches this whenever the per-account storage is swapped
  useEffect(() => {
    function onUserChanged() {
      profileRef.current = getProfile();
      setProfile(profileRef.current);
      setUserEpoch(n => n + 1);
      queryClient.clear();
    }
    window.addEventListener("lt-user-changed", onUserChanged);
    return () => window.removeEventListener("lt-user-changed", onUserChanged);
  }, []);

  // Tell auth.js the remount has committed so it can safely drop the gate
  // (prevents a flash of stale UI while React is still swapping accounts).
  useEffect(() => {
    if (userEpoch === 0) return;
    try { window.dispatchEvent(new CustomEvent("lt-user-changed-applied")); } catch (e) {}
  }, [userEpoch]);

  // No profile → show onboarding
  if (!profile) {
    return jsx(mk, {
      key: "ob-" + userEpoch,
      onComplete: (newProfile) => {
        setProfile(newProfile);
      }
    });
  }

  // Has profile → show authenticated app with providers
  return jsx(QueryClientProvider, {
    client: queryClient,
    children: jsxs("div", {
      key: "app-" + userEpoch,
      children: [
        jsx(AuthenticatedApp, { profile })
      ]
    })
  });
}
