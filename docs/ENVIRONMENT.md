# Environment Configuration

This document explains how to configure your Verible extension using environment variables.

## Environment Files

### `.env` (Default)
Contains the default configuration for all environments.

### `.env.development`
Development-specific configuration that overrides `.env`.

### `.env.example`
Template file showing all available environment variables. Copy this to `.env` and customize.

## Available Variables

| Variable | Description | Default Value |
|----------|-------------|----------------|
| `VITE_API_BASE_URL` | Your API base URL | `https://verible-backend-gamma.vercel.app` |
| `VITE_API_DOCS_URL` | Postman documentation URL | `https://documenter.getpostman.com/view/36179911/2sB3QMK8Z5` |
| `VITE_APP_NAME` | Application name | `Verible` |
| `VITE_APP_VERSION` | Application version | `1.0.0` |

## Usage in Code

```typescript
import { config } from '../config/env';

// Access configuration
console.log(config.apiBaseUrl);     // https://verible-backend-gamma.vercel.app
console.log(config.appName);        // Verible
console.log(config.isDevelopment);  // true in dev mode
```

## Environment-Specific Configuration

### Development
```bash
# .env.development
VITE_API_BASE_URL=https://verible-backend-gamma.vercel.app
VITE_API_DOCS_URL=https://documenter.getpostman.com/view/36179911/2sB3QMK8Z5
VITE_APP_NAME=Verible
VITE_APP_VERSION=1.0.0
```

### Production
```bash
# .env.production
VITE_API_BASE_URL=https://verible-backend-gamma.vercel.app
VITE_API_DOCS_URL=https://documenter.getpostman.com/view/36179911/2sB3QMK8Z5
VITE_APP_NAME=Verible
VITE_APP_VERSION=1.0.0
```

## Type Generation

The type generation script automatically uses your environment variables:

```bash
# Uses VITE_API_BASE_URL from .env
npm run generate-types
```

## Security

- `.env` files are automatically ignored by git
- Never commit sensitive data to version control
- Use `.env.example` as a template for team members

## Benefits

✅ **Centralized configuration** - All settings in one place  
✅ **Environment-specific** - Different configs for dev/prod  
✅ **Type-safe** - Full TypeScript support  
✅ **Auto-completion** - IDE support for all variables  
✅ **Secure** - Sensitive data not committed to git  
