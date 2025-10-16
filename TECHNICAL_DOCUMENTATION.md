# AdStrategist - Technical Documentation

## Overview

AdStrategist is an AI-powered Google Ads management platform that provides automated campaign optimization, expert insights, and data-driven recommendations. The system leverages multiple AI providers (OpenAI GPT-4o, Anthropic Claude, Perplexity) to generate consensus-based insights specifically tailored for the Indian market.

## Architecture Overview

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for development and build tooling
- TanStack Query for server state management
- Wouter for lightweight client-side routing
- Shadcn/UI + Radix UI for accessible components
- Tailwind CSS for styling

**Backend:**
- Node.js + Express with TypeScript
- Drizzle ORM with PostgreSQL (Neon)
- Google Ads API integration
- Multi-AI provider integration (OpenAI, Anthropic, Perplexity)
- Session-based authentication

**Database:**
- PostgreSQL (hosted on Neon)
- Drizzle ORM for type-safe database operations

## Project Structure

```
AdStrategist/
├── client/                    # React frontend application
│   └── src/
│       ├── components/        # Reusable UI components
│       ├── pages/            # Route-based page components
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # Utility libraries
│       └── utils/            # Helper functions
├── server/                   # Node.js backend application
│   ├── services/            # Business logic services
│   ├── prompts/             # AI prompt templates
│   └── utils/               # Server utilities
├── shared/                  # Shared TypeScript schemas
└── attached_assets/         # Static assets and documentation
```

## Database Schema

### Core Tables

**users** - User management with role-based access
- Supports admin and sub_account roles
- Includes profile information and authentication data
- Tracks creation hierarchy (admins can create sub-accounts)

**googleAdsAccounts** - Google Ads account connections
- Stores OAuth tokens and account metadata
- Supports Manager Account (MCC) structure
- Only admins can connect Google Ads accounts

**campaigns** - Campaign data and metrics
- Stores both local campaign settings and Google Ads data
- Includes 7-day performance metrics
- Supports goal tracking (CPA, ROAS, custom descriptions)

**recommendations** - AI-generated recommendations
- Categorized as actionable, monitor, or clarification
- Includes confidence scores and potential savings
- Tracks application status and outcomes

**auditLogs** - Complete activity tracking
- Records all user actions and AI recommendations
- Provides transparency and accountability

**userSettings** - User preferences and configurations
- AI frequency settings and confidence thresholds
- Account selection preferences
- Notification settings

## Backend Services

### Core Services

**MultiAIService** (`multiAIService.ts`)
- Orchestrates multiple AI providers for consensus-based recommendations
- Handles provider availability and fallback logic
- Supports both structured recommendations and chat interactions
- Calculates agreement levels and confidence scores

**GoogleAdsService** (`googleAdsService.ts`)
- Manages Google Ads API integration
- Handles OAuth authentication and token refresh
- Supports both individual accounts and Manager Account (MCC) structures
- Provides campaign data fetching with date range support

**AIRecommendationService** (`aiRecommendationService.ts`)
- Generates AI recommendations for campaigns
- Manages recommendation lifecycle (creation, application, dismissal)
- Provides dashboard summaries and performance insights
- Handles audit logging for AI actions

**CampaignService** (`campaignService.ts`)
- Manages campaign CRUD operations
- Syncs data between local database and Google Ads
- Handles campaign goal setting and tracking

**DailySyncService** (`dailySyncService.ts`)
- Automated daily synchronization of campaign data
- Updates performance metrics from Google Ads API
- Triggers AI recommendation generation

**SchedulerService** (`schedulerService.ts`)
- Manages scheduled tasks and background jobs
- Handles daily sync scheduling
- Provides task management and monitoring

### AI Integration

**Core Prompt System** (`corePrompt.ts`)
The system uses a sophisticated prompt template specifically designed for the Indian market:

- **Market Focus**: All recommendations are tailored for Indian market conditions with INR currency
- **Solution-Oriented**: Provides actionable implementation steps, not just problem identification
- **Context-Aware**: Considers campaign type, stage, goals, and historical performance
- **Best Practices**: Incorporates proven optimization techniques for Indian market
- **Structured Output**: Supports both JSON (for backend) and formatted text (for UI)

**Multi-AI Consensus**
- Queries multiple AI providers simultaneously
- Calculates agreement levels between different models
- Provides confidence scores based on consensus
- Falls back gracefully when providers are unavailable

## Frontend Architecture

### Component Structure

**Pages:**
- `Dashboard.tsx` - Main overview with metrics and recommendations
- `Campaigns.tsx` - Campaign management and goal setting
- `Recommendations.tsx` - AI recommendation review and application
- `Performance.tsx` - Detailed performance analytics
- `Settings.tsx` - User preferences and account management

**Key Components:**
- `AccountSelector.tsx` - Multi-account selection with MCC support
- `CampaignCard.tsx` - Campaign overview with key metrics
- `RecommendationCard.tsx` - AI recommendation display and actions
- `ChatInterface.tsx` - AI chat assistant integration
- `MetricsCard.tsx` - Performance metric visualization

### State Management

**TanStack Query** for server state:
- Automatic caching and background updates
- Optimistic updates for better UX
- Error handling and retry logic
- Query invalidation for data consistency

**React Hooks** for local state:
- `useAuth.ts` - Authentication state management
- Custom hooks for component-specific state

### Authentication Flow

1. **Login Process**: Username/password authentication with session management
2. **Role-Based Access**: Admin vs sub-account permissions
3. **Google Ads OAuth**: Separate OAuth flow for Google Ads API access
4. **Session Management**: Secure session handling with automatic cleanup

## Key Features

### Multi-Account Management
- **Manager Account (MCC) Support**: Handle multiple client accounts under a single MCC
- **Account Filtering**: Consistent account selection across all platform sections
- **Role-Based Access**: Admins manage accounts, sub-accounts have limited access
- **Flexible Selection**: Temporary view filters vs permanent active account configuration

### AI-Powered Recommendations
- **Multi-Model Consensus**: Leverages OpenAI, Anthropic, and Perplexity for robust insights
- **Indian Market Specialization**: All recommendations tailored for Indian market conditions
- **Confidence Scoring**: Provides confidence levels based on data quality and model agreement
- **Action Categories**: Actionable changes, monitoring alerts, or clarification requests
- **Implementation Guidance**: Step-by-step instructions for applying recommendations

### Campaign Optimization
- **Goal Intelligence**: Supports CPA, ROAS, and custom goal descriptions
- **Performance Tracking**: Real-time metrics with 7-day performance windows
- **Automated Sync**: Daily synchronization with Google Ads API
- **Audit Trail**: Complete history of changes and AI recommendations

### Dashboard & Analytics
- **Performance Overview**: Key metrics and trends across selected accounts
- **Campaign Insights**: Detailed analysis for individual campaigns
- **Recommendation History**: Track AI suggestions and their outcomes
- **Real-time Updates**: Live data from Google Ads API

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/user` - Get current user info
- `POST /api/auth/logout` - User logout

### Google Ads Integration
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Handle OAuth callback
- `GET /api/google-ads/accounts` - List connected accounts
- `POST /api/google-ads/sync` - Manual data sync

### Campaigns
- `GET /api/campaigns` - List user campaigns
- `POST /api/campaigns` - Create new campaign
- `PATCH /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Recommendations
- `GET /api/recommendations` - Get user recommendations
- `POST /api/recommendations/generate` - Generate new recommendations
- `PATCH /api/recommendations/:id/apply` - Apply recommendation
- `PATCH /api/recommendations/:id/dismiss` - Dismiss recommendation

### Analytics
- `GET /api/dashboard/summary` - Dashboard overview data
- `GET /api/performance/summary` - Performance analytics
- `GET /api/audit-logs` - Activity audit trail

## Environment Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Google Ads API
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DEVELOPER_TOKEN=your_developer_token

# AI Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
PERPLEXITY_API_KEY=your_perplexity_key

# Session Management
SESSION_SECRET=your_session_secret

# Server Configuration
PORT=5000
NODE_ENV=production
```

## Deployment

### Build Process
1. **Frontend Build**: `vite build` - Creates optimized production bundle
2. **Backend Build**: `esbuild` - Bundles server code with external packages
3. **Database Migration**: `drizzle-kit push` - Applies schema changes

### Production Setup
- **Single Port Deployment**: Both API and frontend served on PORT (default 5000)
- **Static File Serving**: Production builds serve static files directly
- **Session Storage**: PostgreSQL-based session management
- **Background Jobs**: Scheduler service for automated tasks

## Security Considerations

### Authentication & Authorization
- **Session-based Authentication**: Secure session management with PostgreSQL storage
- **Role-based Access Control**: Admin vs sub-account permissions
- **OAuth Security**: Secure Google OAuth implementation with token refresh
- **API Protection**: Middleware-based route protection

### Data Security
- **Environment Variables**: Sensitive data stored in environment variables
- **Token Management**: Secure storage and refresh of OAuth tokens
- **Input Validation**: Zod schemas for request validation
- **SQL Injection Prevention**: Drizzle ORM provides query parameterization

## Performance Optimizations

### Frontend
- **Code Splitting**: Vite-based optimization with dynamic imports
- **Query Caching**: TanStack Query for efficient data fetching
- **Component Optimization**: React.memo and useMemo for expensive operations
- **Bundle Optimization**: Tree shaking and minification

### Backend
- **Database Indexing**: Optimized queries with proper indexing
- **Connection Pooling**: Efficient database connection management
- **Caching Strategy**: Query result caching where appropriate
- **Background Processing**: Scheduled tasks for heavy operations

## Monitoring & Logging

### Application Logging
- **Request Logging**: Detailed API request/response logging
- **Error Tracking**: Comprehensive error logging with stack traces
- **Performance Monitoring**: Request duration and response size tracking
- **Audit Trail**: Complete user action logging

### Health Checks
- **Database Connectivity**: Connection health monitoring
- **Google Ads API**: API availability and quota monitoring
- **AI Provider Status**: Multi-provider availability tracking

## Development Workflow

### Local Development
1. **Environment Setup**: Configure environment variables
2. **Database Setup**: Run migrations with `npm run db:push`
3. **Development Server**: `npm run dev` for hot-reload development
4. **Type Checking**: `npm run check` for TypeScript validation

### Code Quality
- **TypeScript**: Full type safety across frontend and backend
- **Shared Schemas**: Type-safe API contracts with shared schemas
- **ESLint/Prettier**: Code formatting and linting
- **Git Hooks**: Pre-commit validation

## Future Enhancements

### Planned Features
- **Advanced Analytics**: More detailed performance insights and forecasting
- **Automated Bidding**: AI-powered bid optimization
- **A/B Testing**: Campaign variation testing and analysis
- **Mobile App**: React Native mobile application
- **White-label Solution**: Multi-tenant architecture for agencies

### Technical Improvements
- **Real-time Updates**: WebSocket integration for live data
- **Advanced Caching**: Redis integration for improved performance
- **Microservices**: Service decomposition for better scalability
- **GraphQL API**: More efficient data fetching
- **Container Deployment**: Docker containerization for easier deployment

## Troubleshooting

### Common Issues
1. **Google Ads API Quota**: Monitor and handle API rate limits
2. **Token Expiration**: Implement robust token refresh logic
3. **Database Connections**: Handle connection pool exhaustion
4. **AI Provider Outages**: Graceful fallback to available providers

### Debug Tools
- **Logging**: Comprehensive logging for issue diagnosis
- **Query Debugging**: Database query logging and analysis
- **API Testing**: Built-in API testing and validation
- **Performance Profiling**: Request timing and resource usage monitoring

---

This documentation provides a comprehensive overview of the AdStrategist platform architecture, features, and implementation details. For specific implementation questions or feature requests, refer to the codebase or contact the development team.