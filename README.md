# AI-Powered Google Ads Expert Platform

An intelligent virtual Google Ads strategist that provides automated campaign optimization, expert insights, and data-driven recommendations powered by advanced AI.

## Overview

This platform acts as your personal Google Ads expert, analyzing campaign performance daily, understanding your goals and context, and providing intelligent recommendations. The system decides whether to apply changes automatically, explain why no change is needed, ask for clarification, or suggest new strategic directions.

## Features

### 🤖 AI-Powered Analysis
- **Smart Campaign Evaluation**: Analyzes performance against goals, campaign type, stage, and historical context
- **Intelligent Decision Engine**: Categorizes recommendations as actionable changes, monitoring alerts, or clarification requests
- **Confidence Scoring**: Provides confidence levels for all AI recommendations
- **Goal Intelligence**: Supports CPA, ROAS, and custom goal descriptions with natural language processing

### 📊 Campaign Management
- **Real-time Performance Metrics**: Live data from Google Ads API including impressions, clicks, conversions, and costs
- **Multi-Account Support**: Manage campaigns across multiple Google Ads manager accounts
- **Account Filtering**: Consistent account selection across all platform sections
- **Campaign Goal Setting**: Set and track CPA, ROAS, and custom objectives

### 📈 Dashboard & Analytics
- **Performance Overview**: Comprehensive dashboard with key metrics and trends
- **Campaign Insights**: Detailed performance analysis for each campaign
- **Recommendation History**: Track all AI suggestions and their outcomes
- **Audit Trail**: Complete activity logging for transparency

### 🔐 Secure Authentication
- **Google OAuth Integration**: Seamless login with Google accounts
- **Session Management**: Secure session handling with automatic cleanup
- **Account Protection**: Protected routes and middleware-based authentication

## Tech Stack

### Frontend
- **React 18** with TypeScript for modern, type-safe development
- **Vite** for fast development and optimized builds
- **TanStack Query** for server state management and caching
- **Wouter** for lightweight client-side routing
- **Shadcn/UI + Radix** for accessible, customizable components
- **Tailwind CSS** for utility-first styling

### Backend
- **Node.js + Express** for robust API server
- **TypeScript** for full-stack type safety
- **OpenAI GPT-4o** for intelligent campaign analysis
- **Google Ads API** for real-time campaign data
- **Session-based Authentication** with OpenID Connect

### Database
- **PostgreSQL** with Neon serverless hosting
- **Drizzle ORM** for type-safe database operations
- **Automated Migrations** with schema validation

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Google Ads Developer Token
- Google OAuth Client credentials
- OpenAI API key

### Environment Variables
Create a `.env` file in the root directory:

```env
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_oauth_client_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
DATABASE_URL=your_postgresql_connection_string

# Session
SESSION_SECRET=your_session_secret
```

### Installation

1. **Clone and Install**
```bash
git clone <repository-url>
cd ai-google-ads-platform
npm install
```

2. **Database Setup**
```bash
# Push schema to database
npm run db:push
```

3. **Start Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Usage

### Getting Started

1. **Authentication**: Sign in with your Google account that has access to Google Ads
2. **Connect Accounts**: Link your Google Ads manager accounts
3. **Select Accounts**: Choose which accounts to analyze and optimize
4. **Set Goals**: Define CPA, ROAS, or custom objectives for your campaigns
5. **Monitor Recommendations**: Review AI-generated suggestions and apply optimizations

### Setting Campaign Goals

Navigate to the **Settings** page to configure campaign objectives:

- **Target CPA**: Set cost-per-acquisition goals
- **Target ROAS**: Define return on ad spend targets  
- **Custom Descriptions**: Add context-specific goals in natural language

### Understanding Recommendations

The AI categorizes suggestions into three types:

- **🎯 Actionable Changes**: Ready-to-implement optimizations
- **👁️ Monitor**: Areas requiring attention but no immediate action
- **❓ Clarification**: Requests for additional context or decisions

### Account Management

Use the account selector to:
- Filter campaigns by specific Google Ads accounts
- View performance across multiple manager accounts
- Maintain consistent filtering across all platform sections

## API Reference

### Authentication Endpoints

```
GET /api/auth/user - Get current user information
GET /api/auth/google - Initiate Google OAuth flow
GET /api/callback - Handle OAuth callback
POST /api/auth/logout - End user session
```

### Campaign Endpoints

```
GET /api/campaigns - Get user campaigns with filtering
PATCH /api/campaigns/:id/goals - Update campaign goals
GET /api/dashboard/summary - Get dashboard metrics
```

### Recommendations Endpoints

```
GET /api/recommendations - Get AI recommendations
POST /api/recommendations/generate - Generate new recommendations
```

### Account Management

```
GET /api/google-ads-accounts - Get connected accounts
POST /api/account-selection - Update selected accounts
```

## Database Schema

### Core Tables

- **users**: User authentication and profile information
- **campaigns**: Google Ads campaign data and performance metrics
- **recommendations**: AI-generated suggestions with confidence scores
- **audit_logs**: Activity tracking for transparency
- **google_ads_accounts**: Connected Google Ads account information

## Development

### Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   └── lib/           # Utilities and configurations
├── server/                # Express backend
│   ├── services/          # Business logic services
│   └── routes.ts          # API route definitions
├── shared/                # Shared types and schemas
└── drizzle/              # Database migrations
```

### Key Services

- **CampaignService**: Manages campaign data and Google Ads integration
- **AIRecommendationService**: Handles OpenAI analysis and recommendations
- **GoogleAdsService**: Interfaces with Google Ads API

### Database Operations

```bash
# Generate and apply migrations
npm run db:push

# Force push schema changes (use with caution)
npm run db:push --force
```

## Deployment

The application is designed for deployment on Replit with automatic:
- Environment variable management
- Database provisioning
- HTTPS/SSL handling
- Health monitoring

### Production Considerations

- Ensure all environment variables are properly configured
- Set up monitoring for API rate limits
- Configure session storage for production scale
- Implement proper error tracking

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests for new features
- Maintain consistent code style with existing patterns
- Update documentation for API changes

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Check the [Issues](../../issues) page for common problems
- Create a new issue for bug reports or feature requests
- Review the API documentation for integration questions

---

**Built with ❤️ using React, Node.js, and OpenAI**