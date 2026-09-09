/**
 * vendor/react.js — Re-export React from node_modules
 * 
 * Replaces mangled exports: w, zh, b (all React aliases)
 */
export { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
export { default as React } from 'react';
export { jsx, jsxs } from 'react/jsx-runtime';
