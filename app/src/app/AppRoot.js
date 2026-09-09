/*
  AppRoot.jsx — Recreated readable source
  
  ORIGINAL COMPILED NAMES (from shared.js):
    $w = QueryClient, w = React, c = JSX runtime
    kf = QueryClientProvider, Af = ReactQueryDevTools
    Po = Route component, Yb = Router component
    Ny = getProfile, ky = router config
    yb = RouterProvider
  
  ROUTES:
    /          → HomeScreen (Timer + Activity tab)
    /timeline  → LifeHubScreen  
    /journal   → JournalScreen
    /settings  → SettingsScreen
*/
import { $w, kf, Af, Ny, Po, Yb, yb, ky } from '../shared.js';
import { HC } from './AndroidBridge.js';
import { ak, dk } from '../_slice_shell.js';
import { mk } from '../_slice_onboarding.js';
import { HomeScreen } from '../screens/Home.js';
import { LifeHubScreen } from '../screens/LifeHub.js';
import { JournalScreen } from '../screens/Journal.js';
import { SettingsScreen } from '../screens/Settings.js';

// React Query client — retry off, no refetch on window focus
const queryClient = new $w({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

function AuthenticatedApp({ profile }) {
  return c.jsxs(ak, {
    children: [
      c.jsx(HC, {}),
      c.jsxs(Yb, {
        children: [
          c.jsx(Po, { path: '/', component: () => c.jsx(HomeScreen, { profile }) }),
          c.jsx(Po, { path: '/timeline', component: () => c.jsx(LifeHubScreen, { profile }) }),
          c.jsx(Po, { path: '/journal', component: () => c.jsx(JournalScreen, {}) }),
          c.jsx(Po, { path: '/settings', component: () => c.jsx(SettingsScreen, {}) })
        ]
      })
    ]
  });
}

export function QC() {
  const [profile, setProfile] = c.jsx ? w.useState(() => Ny()) : [null, () => {}];
  // First render: check if profile exists
  const profileRef = w.useRef(profile);
  
  w.useEffect(() => {
    profileRef.current = Ny();
    setProfile(profileRef.current);
  }, []);

  // No profile → show onboarding
  if (!profile) {
    return c.jsx(mk, {
      onComplete: (newProfile) => {
        setProfile(newProfile);
      }
    });
  }

  // Has profile → show authenticated app with providers
  return c.jsx(kf, {
    client: queryClient,
    children: c.jsxs("div", {
      children: [
        c.jsx(AuthenticatedApp, { profile }),
        c.jsx(Af, {})
      ]
    })
  });
}
