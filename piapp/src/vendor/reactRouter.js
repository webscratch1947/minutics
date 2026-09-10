/**
 * vendor/reactRouter.js — Re-export React Router from node_modules
 * 
 * Replaces mangled exports: Hb (useLocation), Cy (Link), yb (RouterProvider),
 *   Yb (Router/RouterProvider), Po (Route), ky (Routes)
 */
export { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
