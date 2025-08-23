# AI-Powered Google Ads Expert Platform

An intelligent virtual Google Ads strategist that provides automated campaign optimization, expert insights, and data-driven recommendations powered by multiple advanced AI models working in consensus.

## Overview

This platform acts as your personal Google Ads expert, analyzing campaign performance daily, understanding your goals and context, and providing intelligent recommendations. The system uses multiple AI providers to generate consensus-based insights, deciding whether to apply changes automatically, explain why no change is needed, ask for clarification, or suggest new strategic directions.

## Features

### 🤖 Multi-AI Powered Analysis
- **Multi-Model Consensus**: Leverages OpenAI GPT-4o, Anthropic Claude, and Perplexity for robust recommendations
- **Smart Campaign Evaluation**: Analyzes performance against goals, campaign type, stage, and historical context
- **Intelligent Decision Engine**: Categorizes recommendations as actionable changes, monitoring alerts, or clarification requests
- **Confidence Scoring**: Provides confidence levels and agreement scores across multiple AI models
- **Goal Intelligence**: Supports CPA, ROAS, and custom goal descriptions with natural language processing
- **Provider Flexibility**: Automatically uses available AI providers based on configured API keys

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
- **Multi-AI Integration**:
  - **OpenAI GPT-4o** for advanced campaign analysis
  - **Anthropic Claude Sonnet 4** for strategic insights
  - **Perplexity Llama 3.1 Sonar** for real-time market intelligence
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
- At least one AI provider API key:
  - OpenAI API key (recommended)
  - Anthropic Claude API key (optional)
  - Perplexity API key (optional)

### Environment Variables
Create a `.env` file in the root directory:

```env
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_oauth_client_secret

# AI Providers (at least one required)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key

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

The AI system categorizes suggestions into three types, with consensus scoring:

- **🎯 Actionable Changes**: Ready-to-implement optimizations with high AI consensus
- **👁️ Monitor**: Areas requiring attention but no immediate action needed
- **❓ Clarification**: Requests for additional context or decisions

**AI Consensus Features**:
- **Agreement Level**: Shows how much AI models agree (0-100%)
- **Multi-Model Insights**: Combines analysis from multiple AI providers
- **Provider Attribution**: Shows which AI models contributed to each recommendation
- **Confidence Scoring**: Weighted confidence based on model agreement

### Account Management

Use the account selector to:
- Filter campaigns by specific Google Ads accounts
- View performance across multiple manager accounts
- Maintain consistent filtering across all platform sections

### AI Provider Configuration

The platform automatically detects and uses available AI providers:

**Single Provider Mode**:
- Uses one AI model for recommendations
- Faster response times
- Lower API costs

**Multi-Provider Consensus Mode**:
- Combines insights from all available AI models
- Higher confidence and accuracy
- Cross-validates recommendations
- Shows agreement levels between models

**Provider Auto-Detection**:
- Automatically activates providers with configured API keys
- Gracefully handles missing providers
- Shows active providers in recommendations

## Advanced AI Features

### Multi-AI Consensus Engine

The platform's core strength lies in its ability to leverage multiple AI models simultaneously:

**How Consensus Works**:
1. **Parallel Analysis**: Each available AI provider analyzes the same campaign data independently
2. **Response Aggregation**: All AI responses are collected and compared
3. **Confidence Weighting**: Responses are weighted based on individual model confidence scores
4. **Agreement Calculation**: System calculates how much the models agree (0-100%)
5. **Best Response Selection**: Chooses the most confident response or creates a consensus view
6. **Final Recommendation**: Delivers a single, well-reasoned recommendation with transparency

**Benefits of Multi-AI Approach**:
- **Reduced Bias**: No single AI model's limitations dominate decisions
- **Higher Accuracy**: Cross-validation improves recommendation quality
- **Increased Confidence**: Multiple models agreeing provides higher certainty
- **Fallback Protection**: If one provider fails, others continue working
- **Cost Optimization**: Can use faster/cheaper models for simple tasks, complex models for difficult analysis

### AI Provider Capabilities

**OpenAI GPT-4o**:
- **Strengths**: Advanced reasoning, complex campaign analysis, strategic planning
- **Use Cases**: Multi-step optimizations, budget reallocation strategies, audience insights
- **Output Format**: Structured JSON with detailed reasoning

**Anthropic Claude Sonnet 4**:
- **Strengths**: Ethical considerations, long-term planning, risk assessment
- **Use Cases**: Brand safety analysis, compliance checks, sustainable growth strategies
- **Output Format**: Thoughtful analysis with ethical considerations

**Perplexity Llama 3.1 Sonar**:
- **Strengths**: Real-time market data, current trends, competitive intelligence
- **Use Cases**: Market trend analysis, seasonal adjustments, competitive positioning
- **Output Format**: Data-driven insights with current market context

### Intelligent Recommendation Categories

The AI system automatically categorizes each recommendation:

**🎯 Actionable Changes (High Priority)**:
- Confidence score > 80%
- Clear implementation steps
- Quantifiable expected impact
- Low risk of negative consequences
- Examples: Bid adjustments, keyword additions, audience expansions

**👁️ Monitor (Medium Priority)**:
- Confidence score 60-80%
- Requires observation over time
- Performance trends to watch
- Potential issues to track
- Examples: Performance degradation alerts, budget pacing warnings

**❓ Clarification (Requires Input)**:
- Confidence score < 60%
- Needs additional context
- Business-specific decisions required
- Strategic direction choices
- Examples: Budget allocation between campaigns, target audience preferences

### Smart Campaign Analysis

**Performance Context Understanding**:
- **Campaign Lifecycle**: Recognizes new vs. mature vs. declining campaigns
- **Seasonal Patterns**: Adjusts recommendations based on time of year
- **Industry Benchmarks**: Compares performance against sector standards
- **Historical Trends**: Analyzes past performance to predict future outcomes
- **Goal Alignment**: Ensures recommendations support defined objectives (CPA, ROAS, etc.)

**Advanced Metrics Analysis**:
- **Cohort Analysis**: Tracks user behavior over time
- **Attribution Modeling**: Understands multi-touch conversion paths  
- **Competitive Intelligence**: Monitors market share and competitor activity
- **Quality Score Optimization**: Improves ad relevance and landing page experience
- **Automated Bidding Strategy**: Recommends optimal bidding approaches

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
POST /api/ai/generate - Generate AI recommendations with provider selection
  Body: { query, campaignId?, provider?, campaigns? }
  Providers: 'openai', 'anthropic', 'perplexity', or 'consensus'
```

### Account Management

```
GET /api/google-ads-accounts - Get connected accounts
POST /api/account-selection - Update selected accounts
```

## Database Schema

### Core Tables

- **users**: User authentication and profile information
- **campaigns**: Google Ads campaign data and performance metrics with unique constraints
- **recommendations**: AI-generated suggestions with confidence scores and provider attribution
- **audit_logs**: Activity tracking for transparency and compliance
- **google_ads_accounts**: Connected Google Ads account information
- **account_selections**: User-specific account filtering preferences

### Database Features

- **Unique Constraints**: Prevents duplicate campaigns and ensures data integrity
- **Automated Cleanup**: Removes orphaned data and maintains consistency
- **Goal Persistence**: Reliable storage and retrieval of campaign objectives
- **Session Storage**: PostgreSQL-backed user sessions

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
│   │   ├── campaignService.ts      # Campaign management
│   │   ├── multiAiService.ts       # Multi-AI coordination
│   │   └── googleAdsService.ts     # Google Ads integration
│   ├── routes.ts          # API route definitions
│   └── openai.ts          # Legacy OpenAI integration
├── shared/                # Shared types and schemas
└── drizzle/              # Database migrations
```

### Key Services

- **CampaignService**: Manages campaign data and Google Ads integration
- **MultiAIService**: Coordinates multiple AI providers for consensus-based analysis
- **Individual AI Providers**:
  - **OpenAIProvider**: GPT-4o for advanced campaign analysis
  - **ClaudeProvider**: Anthropic Claude for strategic insights
  - **PerplexityProvider**: Real-time market intelligence
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

### AI Provider Management
- **API Rate Limits**: Monitor usage across all providers to avoid throttling
- **Cost Optimization**: Balance accuracy needs with API costs
- **Provider Redundancy**: Configure multiple providers for high availability
- **Response Caching**: Cache similar analyses to reduce API calls

### Performance Optimization  
- **Database Indexing**: Optimize queries for large campaign datasets
- **Session Management**: Configure Redis or PostgreSQL for session storage
- **Error Handling**: Implement comprehensive error tracking and recovery
- **Monitoring**: Set up alerts for AI provider failures and performance issues

### Security & Compliance
- **API Key Management**: Secure storage of all provider API keys
- **Data Privacy**: Ensure campaign data handling complies with privacy regulations
- **Access Control**: Implement proper user authentication and authorization
- **Audit Logging**: Track all AI recommendations and user actions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

**Code Standards**:
- Follow TypeScript best practices with strict type checking
- Write comprehensive tests for new AI integrations
- Maintain consistent code style with existing patterns
- Update documentation for API changes

**AI Integration Guidelines**:
- Always handle provider failures gracefully
- Implement proper retry logic for API calls
- Cache AI responses when appropriate to reduce costs
- Test consensus algorithms with different provider combinations
- Validate AI response formats and handle parsing errors

**Database Guidelines**:
- Use transactions for multi-table operations
- Implement proper indexes for query performance
- Handle unique constraint violations gracefully
- Maintain referential integrity across tables

**Testing Strategy**:
- Unit tests for individual AI providers
- Integration tests for consensus algorithms
- End-to-end tests for complete recommendation flows
- Mock AI providers for consistent testing

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Check the [Issues](../../issues) page for common problems
- Create a new issue for bug reports or feature requests
- Review the API documentation for integration questions

---

**Built with ❤️ using React, Node.js, and Multi-AI Intelligence (OpenAI, Anthropic, Perplexity)**