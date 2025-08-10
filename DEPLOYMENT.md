# Sugarscape Simulation - GitHub Pages Deployment

This project is now configured for deployment to GitHub Pages! 🚀

## What This Is

A sophisticated agent-based model simulation (Sugarscape) that runs entirely in the browser. The simulation features:

- Interactive agent-based modeling with canvas visualization
- Real-time performance monitoring
- Wealth distribution analysis with histograms
- Configurable parameters for vision, metabolism, and population dynamics
- No server required - pure client-side React/Next.js application

## GitHub Pages Deployment

### Automatic Deployment (Recommended)

1. **Push to GitHub**: Push your code to a GitHub repository
2. **Enable Pages**: Go to your repository Settings → Pages
3. **Configure Source**: Select "GitHub Actions" as the source
4. **Deploy**: The workflow will automatically trigger on pushes to `main`

Your site will be available at: `https://yourusername.github.io/sugarscape`

### Manual Deployment

If you prefer manual deployment:

```bash
# Build the project
npm run build

# The static files are in the 'out' directory
# Upload the contents of 'out/' to your GitHub Pages repository
```

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Configuration Details

The project is configured with:

- **Static Export**: `output: 'export'` in next.config.ts
- **Image Optimization**: Disabled for static hosting
- **Base Path**: Set to `/sugarscape` for GitHub Pages
- **Build Optimizations**: ESLint/TypeScript errors ignored during build

## Why This Works on GitHub Pages

This simulation is perfect for GitHub Pages because:

✅ **No server-side code** - Everything runs in the browser  
✅ **Static assets only** - HTML, CSS, JS, and images  
✅ **Client-side simulation** - Uses Canvas API and Web Workers  
✅ **No database required** - All data is generated and stored in memory  
✅ **No API calls** - Self-contained application  

The Sugarscape model, complex visualizations, and performance monitoring all happen client-side, making it ideal for static hosting platforms like GitHub Pages.
