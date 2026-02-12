# SourceScout

An AI-powered intelligent sourcing platform that helps you discover alternative suppliers by analyzing product specifications and finding the best matches.

## 🚀 Overview

SourceScout is a modern web application that leverages multi-agent AI technology to streamline supplier discovery and comparison. Simply upload a product URL, image, or document, and let SourceScout's AI agents extract specifications, configure search constraints, and find alternative suppliers with detailed comparisons.

## ✨ Key Features

- **🔍 Multi-Source Product Analysis**: Extract product specifications from URLs, images, or documents
- **🤖 AI-Powered Extraction**: Automatic product DNA extraction using Google Gemini AI
- **⚙️ Flexible Search Configuration**: Customize search constraints including price, MOQ, and lead time
- **📊 Intelligent Comparison**: Side-by-side supplier comparison with match scoring
- **🎯 Real-Time Agent Activity**: Track AI agent progress during supplier discovery
- **🎨 Modern UI**: Clean, professional interface with light/dark mode support
- **📱 Responsive Design**: Optimized for desktop and mobile devices

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Wouter** for client-side routing
- **TanStack React Query** for server state management
- **Shadcn/ui** components built on Radix UI
- **Tailwind CSS** for styling

### Backend
- **Node.js** with TypeScript
- **Express.js** web framework
- **Google Gemini AI** for product analysis
- **Google Cloud Storage** for file management
- **Drizzle ORM** for database operations
- **PostgreSQL** for data persistence (configurable)

## 📋 Prerequisites

- Node.js 20.x or higher
- npm or pnpm
- Google Gemini API key
- (Optional) PostgreSQL database
- (Optional) Google Cloud Storage credentials

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ajay-sai/SourceScout.git
   cd SourceScout
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # AI Configuration
   AI_INTEGRATIONS_GEMINI_API_KEY=your_gemini_api_key
   AI_INTEGRATIONS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com
   
   # Database (optional)
   DATABASE_URL=postgresql://user:password@localhost:5432/sourcescout
   
   # Storage (optional)
   PUBLIC_OBJECT_SEARCH_PATHS=/uploads
   ```

4. **Initialize the database** (if using PostgreSQL)
   ```bash
   npm run db:push
   ```

## 🚀 Usage

### Development Mode

Start the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:5000` (or the configured port).

### Production Build

Build and start the production server:

```bash
npm run build
npm start
```

### Type Checking

Run TypeScript type checking:

```bash
npm run check
```

## 📁 Project Structure

```
SourceScout/
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utility libraries
│   │   └── pages/       # Page components
│   └── public/          # Static assets
├── server/              # Backend Express application
│   ├── index.ts         # Main server entry point
│   ├── routes.ts        # API route handlers
│   ├── gemini.ts        # AI service integration
│   ├── storage.ts       # Data persistence layer
│   └── objectStorage.ts # File storage handling
├── shared/              # Shared types and schemas
│   └── schema.ts        # Data models and validation
├── script/              # Build scripts
└── migrations/          # Database migrations
```

## 🔄 Workflow

1. **Upload**: Provide product information via URL, image, or document
2. **Analyze**: AI extracts structured product specifications (ProductDNA)
3. **Configure**: Set search constraints and priorities
4. **Search**: Multi-agent system discovers supplier alternatives
5. **Results**: View and compare matches in card or matrix format

## 🎨 Design Philosophy

SourceScout follows a hybrid design approach inspired by:
- **Linear**: Modern productivity and clean interfaces
- **Material Design**: Information density and clarity
- **Notion**: Simplicity and progressive disclosure

Core principles:
- Clarity over decoration
- Progressive disclosure of complex features
- Generous whitespace around dense data
- Consistent information architecture

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Design guidelines inspired by Linear, Material Design, and Notion
- Built with modern web technologies and best practices
- Powered by Google Gemini AI

## 📧 Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

Made with ❤️ by the SourceScout team
