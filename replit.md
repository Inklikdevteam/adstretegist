# Overview

This is an AI-powered Virtual Google Ads Expert application that acts like a seasoned ads strategist. The system provides intelligent campaign recommendations, automated optimizations, and expert insights powered by advanced AI. It analyzes campaign performance daily, understands goals and context, and decides whether to apply changes, explain why no change is needed, ask for clarification, or suggest new directions.

The application features a React frontend with a Node.js Express backend, PostgreSQL database with Drizzle ORM, OpenAI integration for AI analysis, and Replit authentication. Users can view campaign performance metrics, receive AI-powered recommendations categorized as actionable changes, monitoring alerts, or clarification requests, and manage campaign goals through an intuitive dashboard interface.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React with TypeScript**: Modern React application using functional components and hooks
- **Vite**: Fast development server and build tool with hot module replacement
- **TanStack Query**: Server state management for API calls and caching
- **Wouter**: Lightweight client-side routing
- **Shadcn/UI + Radix UI**: Component library built on Radix primitives with Tailwind CSS styling
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens and CSS variables

## Backend Architecture
- **Express.js**: RESTful API server with middleware-based architecture
- **TypeScript**: Full type safety across the backend codebase
- **Session-based Authentication**: Using Replit's OpenID Connect integration with PostgreSQL session storage
- **Service Layer Pattern**: Separate services for AI recommendations and campaign management
- **OpenAI Integration**: GPT-4o model for campaign performance analysis and recommendation generation

## Database Design
- **PostgreSQL**: Primary database with Neon serverless hosting
- **Drizzle ORM**: Type-safe database operations with schema migrations
- **Core Tables**:
  - `users`: User authentication and profile information
  - `campaigns`: Google Ads campaign data and performance metrics
  - `recommendations`: AI-generated suggestions with confidence scores
  - `audit_logs`: Activity tracking for transparency
  - `sessions`: Authentication session storage

## Authentication System
- **Replit Auth**: OpenID Connect integration for seamless authentication
- **Session Management**: PostgreSQL-backed sessions with automatic cleanup
- **Route Protection**: Middleware-based authentication checks on API endpoints
- **User Profile Management**: Automatic user creation and profile updates

## AI Intelligence Engine
- **Campaign Analysis**: Evaluates performance against goals, considers campaign type, stage, and historical context
- **Decision Engine**: Categorizes recommendations as actionable, monitor, or clarification needed
- **Confidence Scoring**: Provides confidence levels for all AI recommendations
- **Goal Intelligence**: Supports CPA, ROAS, and custom goal descriptions with natural language processing
- **Chat Assistant**: ChatGPT-like conversational interface with full account access
  - Dynamic time period detection (7 days, 30 days, yesterday, last week, last month, etc.)
  - Fetches campaign data for requested time periods from Google Ads API
  - Natural language responses without structured formatting
  - Complete access to all campaign metrics and performance data

## API Design
- **RESTful Endpoints**: Consistent API structure with proper HTTP methods
- **Error Handling**: Centralized error handling with appropriate status codes
- **Request Logging**: Detailed logging of API requests with response times
- **Data Validation**: Schema validation using Zod for type safety

# External Dependencies

## Database & Hosting
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Replit**: Development environment and authentication provider

## AI & Machine Learning
- **OpenAI API**: GPT-4o model for campaign analysis and recommendation generation
- **Natural Language Processing**: Goal interpretation and recommendation explanations

## UI & Styling
- **Shadcn/UI**: Pre-built component library with accessibility features
- **Radix UI**: Unstyled, accessible UI primitives
- **Tailwind CSS**: Utility-first styling with custom design system
- **Lucide Icons**: Consistent icon library

## Development & Build Tools
- **Vite**: Frontend development server and build tool
- **TypeScript**: Type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind integration

## State Management & Data Fetching
- **TanStack Query**: Server state management with caching and background updates
- **React Hook Form**: Form state management with validation
- **Hookform Resolvers**: Schema validation integration

## Authentication & Security
- **OpenID Connect**: Industry standard authentication protocol
- **Connect PG Simple**: PostgreSQL session store for Express sessions
- **Passport.js**: Authentication middleware for Node.js

## Utilities & Helpers
- **Date-fns**: Date manipulation and formatting
- **Class Variance Authority**: Utility for managing component variants
- **CLSX**: Conditional className utility
- **Memoizee**: Function memoization for performance optimization