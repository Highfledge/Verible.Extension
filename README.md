# Verible - Trust Analysis for Marketplace Sellers

**Verible** is a browser extension that helps you make safer purchasing decisions by providing real-time seller trust scores and risk analysis on popular marketplace platforms.

[![Version](https://img.shields.io/badge/version-1.0.4-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-Private-red.svg)](LICENSE)

## 🎯 Features

### Core Functionality
- **Real-time Trust Scores**: Get instant trust scores (0-100) for sellers on marketplace platforms
- **Risk Analysis**: Receive risk level assessments (Trusted, Uncertain, Avoid) with detailed explanations
- **Multi-Platform Support**: Works on Facebook Marketplace, Jiji, Craigslist, OfferUp, eBay, Etsy, Jumia, Konga, Kijiji, and more
- **Badge Notifications**: Visual badge indicator showing trust scores directly in your browser toolbar
- **Seller Profile Analysis**: Comprehensive analysis including account age, ratings, reviews, verification status, and more

### User Features
- **Secure Authentication**: Sign up, sign in, email verification, and password recovery
- **Dashboard**: View your analysis history, recent sellers, and account information
- **Seller Lookup**: Search and analyze sellers by name, platform, and location
- **Feedback System**: Flag or endorse sellers to help the community
- **Activity Tracking**: Track your recent extractions, flags, and endorsements

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Chrome** or **Firefox** browser
- Git (for cloning the repository)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd highfledge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   ```env
   VITE_API_BASE_URL=https://verible-backend-gamma.vercel.app
   VITE_APP_NAME=Verible
   VITE_APP_VERSION=1.1.7
   ```

4. **Generate TypeScript types from API**
   ```bash
   npm run generate-types
   ```

## 🛠️ Development

### Development Mode

Run the extension in development mode:

**Chrome:**
```bash
npm run dev
```

**Firefox:**
```bash
npm run dev:firefox
```

This will:
- Start the WXT development server
- Watch for file changes
- Generate TypeScript types automatically
- Provide hot-reload functionality

### Loading the Extension

1. Open your browser's extension management page:
   - **Chrome**: `chrome://extensions/`
   - **Firefox**: `about:debugging#/runtime/this-firefox`

2. Enable "Developer mode"

3. Click "Load unpacked" (Chrome) or "Load Temporary Add-on" (Firefox)

4. Select the `.output/chrome-mv3` (Chrome) or `.output/firefox-mv2` (Firefox) directory

### Building for Production

**Chrome:**
```bash
npm run build
```

**Firefox:**
```bash
npm run build:firefox
```

### Creating Distribution Packages

**Chrome:**
```bash
npm run zip
```

**Firefox:**
```bash
npm run zip:firefox
```

The ZIP files will be created in the `.output` directory.

### Type Checking

```bash
npm run compile
```

## 📁 Project Structure

```
highfledge/
├── entrypoints/
│   ├── background.ts          # Background script (badge updates, API calls)
│   ├── content.ts             # Content script (marketplace page detection)
│   └── popup/
│       ├── App.tsx            # Main app component
│       ├── components/
│       │   ├── auth/          # Authentication components
│       │   │   ├── SignIn.tsx
│       │   │   ├── SignUp.tsx
│       │   │   ├── EmailVerification.tsx
│       │   │   └── ForgotPassword.tsx
│       │   ├── Dashboard.tsx  # Main dashboard
│       │   └── Logo.tsx       # Logo component
│       ├── services/
│       │   ├── api.ts         # API service client
│       │   └── authService.ts # Authentication service
│       └── types/             # TypeScript type definitions
├── public/
│   ├── icon/                  # Extension icons
│   └── logo/                  # Logo assets
├── scripts/
│   ├── generate-types.ts      # Type generation from OpenAPI spec
│   └── verible-api-openapi.json
├── docs/                      # Documentation
├── wxt.config.ts              # WXT framework configuration
└── package.json
```

## 🏗️ Technology Stack

- **Framework**: [WXT](https://wxt.dev/) - Modern web extension framework
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Build Tool**: WXT (Vite-based)
- **API Client**: Fetch API with TypeScript types
- **Storage**: Browser Storage API with encryption

## 🔌 API Integration

The extension connects to the Verible backend API at `https://verible-backend-gamma.vercel.app`.

### Key Endpoints

- **Authentication**: `/api/auth/*` (login, register, verify, password reset)
- **Seller Analysis**: `/api/analysis/seller` (analyze seller)
- **Seller Profiles**: `/api/sellers/*` (extract, lookup, search)
- **User Data**: `/api/users/*` (profile, feedback, activity)
- **Health Check**: `/api/health`

### Type Generation

TypeScript types are automatically generated from the OpenAPI specification:

```bash
npm run generate-types
```

This reads `scripts/verible-api-openapi.json` and generates types in `entrypoints/popup/types/api.ts`.

## 🔐 Authentication

The extension includes a secure authentication system:

- **Token Encryption**: Tokens are encrypted before storage
- **Persistent Sessions**: Users stay logged in across browser sessions
- **Automatic Validation**: Tokens are validated on app startup
- **Secure Storage**: Uses browser's secure storage API

See [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for detailed documentation.

## 🎨 Supported Marketplaces

The extension automatically detects and analyzes sellers on:

- Facebook Marketplace
- Jiji.ng
- Craigslist
- OfferUp
- eBay
- Etsy
- Jumia
- Konga
- Kijiji

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Chrome) |
| `npm run dev:firefox` | Start development server (Firefox) |
| `npm run build` | Build for production (Chrome) |
| `npm run build:firefox` | Build for production (Firefox) |
| `npm run zip` | Create distribution ZIP (Chrome) |
| `npm run zip:firefox` | Create distribution ZIP (Firefox) |
| `npm run compile` | Type check without emitting files |
| `npm run generate-types` | Generate TypeScript types from API spec |

## 🧪 Testing

Currently, the project uses manual testing. For development:

1. Load the extension in development mode
2. Navigate to a supported marketplace
3. Check the browser console for logs
4. Verify badge updates and popup functionality

## 📚 Documentation

Additional documentation is available in the `docs/` directory:

- [Authentication System](docs/AUTHENTICATION.md)
- [Development Roadmap](docs/DEVELOPMENT_ROADMAP.md)
- [Environment Configuration](docs/ENVIRONMENT.md)
- [Logo Setup](docs/LOGO_SETUP.md)
- [Publishing Guide](docs/PUBLISHING.md)
- [Privacy Policy Template](docs/PRIVACY_POLICY_TEMPLATE.md)

## 🔧 Configuration

### Environment Variables

See `.env.example` for available environment variables. Key variables:

- `VITE_API_BASE_URL`: Backend API URL
- `VITE_APP_NAME`: Application name
- `VITE_APP_VERSION`: Application version

### WXT Configuration

Extension configuration is in `wxt.config.ts`. Currently configured with:

- React module support
- Storage permission
- Manifest V3 (Chrome) / Manifest V2 (Firefox)

## 🐛 Troubleshooting

### Extension Not Loading

- Ensure all dependencies are installed: `npm install`
- Check browser console for errors
- Verify Node.js version is 18+

### Badge Not Updating

- Check background script console for errors
- Verify API connectivity
- Check if seller page is detected correctly

### Authentication Issues

- Clear browser storage and try again
- Check network connectivity
- Verify API endpoint is accessible

### Type Generation Errors

- Ensure `scripts/verible-api-openapi.json` exists
- Check API specification format
- Run `npm run generate-types` manually

## 🤝 Contributing

This is a private project. For internal contributors:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

This project is private and proprietary.

## 🔗 Links

- **Backend API**: https://verible-backend-gamma.vercel.app
- **API Documentation**: https://documenter.getpostman.com/view/36179911/2sB3QMK8Z5
- **WXT Framework**: https://wxt.dev/

## 📊 Version History

- **1.1.7** - Current version
  - Authentication system
  - Dashboard implementation
  - Badge notifications
  - Multi-platform support

---

**Made with ❤️ for safer online shopping**
