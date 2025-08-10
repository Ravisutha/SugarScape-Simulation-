git clone https://github.com/Ravisutha/SugarScape-Simulation-.git
## Sugarscape (minimal implementation)

Small, browser-based recreation of the classic Sugarscape agent-based model.

### Run locally

Prereq: Node 18+.

```bash
git clone https://github.com/Ravisutha/SugarScape-Simulation-.git
cd SugarScape-Simulation-
npm install
npm run dev
```
Open http://localhost:3000

Build / static export (optional):
```bash
npm run build        # production build
npm run export       # static export -> out/
```

### Credits & reading

1. Joshua M. Epstein & Robert Axtell, "Growing Artificial Societies" (1996).  
2. Wikipedia overview: https://en.wikipedia.org/wiki/Sugarscape  
3. Book that got me interested: Eric D. Beinhocker, "The Origin of Wealth" (2006).  

Those works explain the ideas; this code is just an educational, simplified take.

### License

MIT. See LICENSE.

---

Feel free to open issues or tweaks; keeping scope intentionally small.
