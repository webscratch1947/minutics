/**
 * vendor/index.js — Central vendor re-exports
 * 
 * Single import point for all vendor dependencies.
 * Replaces the need to import from shared.js for vendor code.
 */

// React
export { useState, useEffect, useRef, useMemo, useCallback, Fragment, React } from './react.js';
export { jsx, jsxs } from 'react/jsx-runtime';

// React Query
export { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from './reactQuery.js';

// React Router
export { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from './reactRouter.js';

// Icons
export {
  Timer, CalendarClock, Clock, Play, Trash2, Square, Plus, Pencil,
  CircleCheckBig, BookOpen, LayoutGrid, Settings
} from './icons.js';
