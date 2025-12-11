<div align="center">

# Chemical PFD Builder - Web Frontend


> React-based Process Flow Diagram editor for chemical engineering workflows

[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0+-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>


##  Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Development](#development)
- [Testing](#testing)
- [API Integration](#api-integration)
- [Deployment](#deployment)
- [Contributing](#contributing)

##  Overview

Chemical PFD Builder Web Frontend is a modern React application built with TypeScript and Vite for creating and managing Process Flow Diagrams. The application provides an interactive canvas interface for chemical engineers to design, edit, and export engineering diagrams with drag-and-drop functionality.

**Status:** Active Development  
**Backend:** Django REST API Integration  
**Platform:** Web Browser

##  Features

### Canvas Editor
- Interactive diagram creation with drag-and-drop components
- Chemical engineering symbol library
- Connector tools for piping and flow lines
- Zoom and pan navigation
- Real-time collaboration support

### Project Management
- Cloud-based project storage
- Version control and history
- Export to multiple formats (PDF, PNG, JPG)
- Template system for common workflows

### Integration
- REST API integration with Django backend
- JWT-based authentication
- Real-time updates via WebSocket
- Third-party tool integrations

##  Project Structure

```
web-frontend/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── icons.tsx      # SVG icon components
│   │   ├── navbar.tsx     # Navigation bar
│   │   ├── primitives.ts  # Basic UI primitives
│   │   └── theme-switch.tsx
│   ├── layouts/           # Page layout components
│   │   └── default.tsx    # Default page layout
│   ├── pages/             # Route-based page components
│   │   ├── index.tsx      # Home page
│   │   ├── about.tsx      # About page
│   │   ├── blog.tsx       # Blog page
│   │   ├── docs.tsx       # Documentation
│   │   └── pricing.tsx    # Pricing page
│   ├── config/            # Application configuration
│   │   └── site.ts        # Site-wide settings
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts       # Main type exports
│   ├── styles/            # Global styles
│   │   └── globals.css    # Tailwind CSS imports
│   ├── App.tsx            # Root application component
│   ├── main.tsx           # Application entry point
│   ├── provider.tsx       # Context providers
│   └── vite-env.d.ts      # Vite type definitions
├── tests/                 # Test files
│   ├── App.test.js        # Main application tests
│   └── components/        # Component tests
│       └── Canvas.test.js # Canvas component tests
├── public/                # Static assets
│   └── vite.svg           # Vite logo
├── dist/                  # Production build (generated)
├── .env                   # Environment variables
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
├── eslint.config.mjs      # ESLint configuration
└── README.md              # This file
```

##  Installation

### Prerequisites
- Node.js 18.0 or higher
- npm 9.0 or higher
- Backend API running (Django REST Framework)

### Setup
1. Clone the repository
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Copy environment variables: `cp .env.example .env`
5. Configure API endpoint in `.env`
6. Start development server: `npm run dev`

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

##  Development

### Tech Stack
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint
- **Formatting:** Prettier

### Development Guidelines
1. Use functional components with TypeScript
2. Follow component composition patterns
3. Implement proper error boundaries
4. Write comprehensive component documentation
5. Maintain responsive design principles

##  Testing

### Test Structure
- Unit tests for utilities and hooks
- Component tests with React Testing Library
- Integration tests for complex interactions
- End-to-end tests for critical workflows

### Running Tests
```
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
```

## API Integration

### Authentication
- JWT token management
- Protected route implementation
- Session persistence
- Role-based access control

### Backend Communication
- REST API endpoints for data operations
- WebSocket for real-time updates
- File upload/download handling
- Error response parsing

### Key API Modules
- User authentication and management
- Project CRUD operations
- Diagram data persistence
- Component library management
- Export generation

##  Deployment

### Build Configuration
- Production-optimized Vite build
- Code splitting and lazy loading
- Asset optimization and compression
- Environment-specific configurations

### Deployment Options
- **Vercel:** Automatic deployments from Git
- **Netlify:** Static site hosting
- **Docker:** Containerized deployment
- **Traditional:** Nginx/Apache web servers

### Production Checklist
- [ ] Environment variables configured
- [ ] API endpoints updated
- [ ] SSL certificates installed
- [ ] Monitoring and logging setup
- [ ] Backup strategy implemented

##  Contributing

### Workflow
1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Update documentation
5. Submit pull request

### Code Standards
- Follow existing code style
- Write meaningful commit messages
- Include test coverage for new features
- Update TypeScript definitions
- Verify browser compatibility

##  License

MIT License - see [LICENSE](LICENSE) file for details.

 
---
 