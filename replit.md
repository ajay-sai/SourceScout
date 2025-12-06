# SourceScout

## Overview

SourceScout is an AI-powered intelligent sourcing platform that helps users discover alternative suppliers by analyzing product specifications and searching for matches. The application uses multi-agent AI technology to extract product details from various sources (URLs, images, documents), configure search constraints, and find supplier alternatives with detailed comparisons.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query (v5) for server state management
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system

**Design System:**
The application follows a hybrid design approach drawing from Linear (modern productivity), Material Design (data density), and Notion (clarity). The design prioritizes:
- Clarity over decoration with functional elements only
- Progressive disclosure for complex features
- Generous whitespace around dense data clusters
- Consistent information architecture across workflows

**Component Structure:**
- Custom components for domain-specific UI: `DropZone`, `ProductDnaDisplay`, `ConstraintBuilder`, `AgentActivityPanel`, `SupplierMatchCard`, `ComparisonMatrix`, `StepProgress`
- Reusable UI primitives from Shadcn/ui in `client/src/components/ui/`
- Theme system supporting light/dark modes with custom HSL color variables

**Workflow Architecture:**
The application follows a step-based workflow:
1. **Upload**: Product input via URL, image, or document
2. **Analyze**: AI extraction of product specifications (ProductDNA)
3. **Configure**: Set search constraints and priorities
4. **Search**: Multi-agent supplier discovery
5. **Results**: Comparison views (cards and matrix)

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Build**: ESBuild for production bundling
- **AI Integration**: Google Gemini AI API (@google/genai) for product analysis

**Server Structure:**
- `server/index.ts`: Main Express application with middleware setup
- `server/routes.ts`: API route handlers for product analysis, search, and file operations
- `server/gemini.ts`: AI service integration for product analysis from multiple input types
- `server/storage.ts`: Data persistence layer with in-memory storage implementation
- `server/static.ts`: Static file serving for production builds
- `server/vite.ts`: Development server integration with Vite HMR

**API Design:**
RESTful endpoints for:
- `/api/objects/upload`: File upload handling with Multer
- `/public-objects/:filePath(*)`: Public file access
- Product analysis endpoints supporting URL, image, and document inputs

**Storage Strategy:**
- In-memory storage implementation (`MemStorage` class) for sessions and users
- Prepared for database integration via `IStorage` interface
- Session-based workflow state management

### Data Models

**Core Entities:**
- **User**: Basic authentication model (id, username, password)
- **SourcingSession**: Workflow state container tracking the entire sourcing process
- **ProductDNA**: Extracted product specifications with categories (dimensions, material, electrical, certification)
- **ProductSpec**: Individual specification with name, value, unit, category, and priority
- **SearchConstraints**: User-defined search parameters (price, MOQ, lead time, spec priorities)
- **SupplierMatch**: Search results with matching scores and comparison data
- **AgentLogEntry**: Real-time activity tracking for the multi-agent system

**Type System:**
- Shared schema definitions in `shared/schema.ts` using Drizzle ORM and Zod
- Type-safe data validation with `drizzle-zod` schema generation
- Enums for workflow steps, constraint priorities, agent statuses, and input types

### External Dependencies

**AI Services:**
- **Google Gemini AI**: Primary AI service for product analysis
  - Configured via `AI_INTEGRATIONS_GEMINI_API_KEY` and `AI_INTEGRATIONS_GEMINI_BASE_URL`
  - Used for extracting structured product data from URLs, images, and documents
  - Structured output generation for ProductDNA creation

**Object Storage:**
- **Google Cloud Storage**: File storage integration via `@google-cloud/storage`
  - Replit Sidecar authentication endpoint (`http://127.0.0.1:1106`)
  - External account credentials with automatic token refresh
  - ACL-based access control system for files
  - Public object search paths configurable via `PUBLIC_OBJECT_SEARCH_PATHS`

**Database:**
- **PostgreSQL**: Configured via Drizzle ORM
  - Connection via `DATABASE_URL` environment variable
  - Schema migrations in `migrations/` directory
  - Database dialect set to "postgresql" in `drizzle.config.ts`
  - Note: Currently using in-memory storage; PostgreSQL integration prepared but not active

**Development Tools:**
- **Replit Plugins**: Development banner, runtime error overlay, and cartographer for enhanced DX
- **Vite HMR**: Hot module replacement during development

**File Processing:**
- **Multer**: Multipart form data handling for file uploads
  - In-memory storage strategy
  - 10MB file size limit

**Session Management:**
- Prepared for `connect-pg-simple` and `express-session` integration
- Currently using in-memory session storage