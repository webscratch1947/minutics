# CSS Migration Guide for Minutics

## Current Status
- **JavaScript**: ✅ Fully editable source code
- **CSS**: 🔄 Migration in progress (compiled → editable)

## What We Have Now
1. **Editable CSS**: `app/src/styles/main.css` with Tailwind setup
2. **Component Styles**: `app/src/styles/components.css` with reusable components
3. **Compiled CSS**: `app/assets/index-DMVN_Y1S.css` (fallback during migration)

## Architecture
```
app/src/styles/
├── main.css          # Main entry point with Tailwind directives
├── components.css    # Reusable component styles
└── [future] pages/   # Page-specific styles
```

## Color System
Based on the app's design:
- `brand-dark`: #1a2140 (main dark color)
- `brand-darker`: #0f1529 (darker variant)
- `brand-accent`: #6366f1 (accent color)
- `bg-cream`: #f5f2eb (background)
- `bg-light`: #ffffff (white)

## Component Library
Pre-built components in `components.css`:
- Buttons (primary, secondary)
- Cards (regular, dark)
- Navigation items
- Input fields
- Modals
- Timer components
- Activity components
- Life Hub grid
- Journal components

## Migration Strategy
1. **Phase 1**: Keep both CSS files loaded
2. **Phase 2**: Gradually add Tailwind classes to React components
3. **Phase 3**: Remove compiled CSS dependency
4. **Phase 4**: Pure editable CSS

## For Developers
### Adding New Styles
1. Use Tailwind utility classes where possible
2. Add custom components to `components.css`
3. Follow the existing color system
4. Test against the compiled version

### Example Usage
```jsx
// Before (compiled CSS classes)
<div className="lt-card lt-timer-greeting">Good Morning</div>

// After (Tailwind + custom components)
<div className="timer-greeting">Good Morning</div>
```

## Testing
Always compare with the compiled version to ensure visual consistency.

## Benefits
- ✅ Fully editable CSS
- ✅ Consistent design system
- ✅ Easy to maintain
- ✅ Developer-friendly
- ✅ Production-ready architecture