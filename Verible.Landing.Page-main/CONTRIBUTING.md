# Highfledge / Verible – Contribution & Documentation Standards

Welcome! 👋  
Before contributing code, please make sure to follow these simple rules.

## 1. Code Location
All code must be pushed to GitHub under your assigned repo.  
No local-only work — if it’s not in GitHub, it doesn’t exist.

## 2. Documentation Required
Every repo must include:
- `README.md` – overview & how to run the project  
- `CHANGELOG.md` – list of updates per release  
- `docs/architecture.md` – overview of the system and integrations  
- `docs/api.md` – list of endpoints and sample requests  
- `docs/env.md` – environment variables (no secrets)  
- `docs/adr/` – major technical decisions (one file per decision)

## 3. Pull Request Rules
- No direct pushes to `main`.  
- Open a Pull Request for every change.  
- Fill out the PR template completely.  
- At least **one reviewer** must approve before merging.

## 4. Branch Naming
Use clear branch names:
