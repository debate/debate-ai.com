# FLOW Research Manager - Next.js Edition

A modern, enhanced version of the FLOW research card management system built with Next.js, React, shadcn/ui, Drizzle ORM, and better-auth.

## Features

### Core Features
- **Smart Citation Management**: Create and manage research cards with automatic MLA-style citation formatting
- **Rich Text Editing**: Highlight and underline important passages in your research
- **Author Management**: Track multiple authors per card with person/organization distinction
- **Collections**: Organize cards into collections for different research topics
- **Privacy Controls**: Mark cards as private or public
- **Shrink Mode**: Filter to show only highlighted/underlined text

### Enhanced Features
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- **Authentication**: Secure email/password authentication with better-auth
- **Database**: SQLite for local development, easily switchable to PostgreSQL for production
- **Type-Safe**: Full TypeScript support throughout
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Drizzle ORM with SQLite (PostgreSQL ready)
- **Authentication**: better-auth
- **Language**: TypeScript

## Getting Started

### Prerequisites
- Node.js 20 or later
- npm or yarn

### Installation

1. Install dependencies
```bash
npm install
```

2. Set up environment variables
```bash
cp .env.local.example .env.local
```

3. Initialize the database
```bash
npm run db:push
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
flow-nextjs/
├── app/
│   ├── api/           # API routes
│   │   ├── auth/      # Authentication endpoints
│   │   └── cards/     # Card CRUD endpoints
│   ├── dashboard/     # Main dashboard page
│   └── page.tsx       # Landing/login page
├── components/
│   ├── auth/          # Authentication components
│   ├── cards/         # Card display components
│   └── ui/            # shadcn/ui components
├── lib/
│   ├── auth/          # Authentication configuration
│   ├── db/            # Database schema and connection
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions (citation formatting, etc.)
└── drizzle/           # Database migrations
```

## Database Schema

The application uses the following main tables:

- **users**: User accounts
- **sessions**: User sessions
- **cards**: Research citation cards
- **authors**: Author information
- **cardAuthors**: Many-to-many relationship between cards and authors
- **collections**: Card collections
- **cardCollections**: Many-to-many relationship between cards and collections

## API Endpoints

### Authentication
- `POST /api/auth/sign-in` - Sign in with email/password
- `POST /api/auth/sign-up` - Create new account
- `POST /api/auth/sign-out` - Sign out

### Cards
- `GET /api/cards` - Get all user's cards
- `POST /api/cards` - Create a new card
- `GET /api/cards/:id` - Get a specific card
- `PATCH /api/cards/:id` - Update a card
- `DELETE /api/cards/:id` - Delete a card

## Development

### Database Management

Generate migrations:
```bash
npm run db:generate
```

Push schema changes:
```bash
npm run db:push
```

Open Drizzle Studio:
```bash
npm run db:studio
```

### Building for Production

```bash
npm run build
npm start
```

## Comparison with Original FLOW

### Original Features Preserved
- Citation card creation and management
- MLA citation formatting
- Paragraph highlighting and underlining
- Author tracking
- Tag/summary system
- Copy to clipboard functionality

### New Enhanced Features
- User authentication and multi-user support
- Database persistence (vs. local storage)
- Collections for organizing cards
- Modern, responsive UI
- Type-safe development
- RESTful API architecture
- Server-side rendering support

### Future Enhancements
- AI-powered auto-cutting of evidence
- Full-text search across cards
- Export to various formats (PDF, Word, etc.)
- Collaboration features (shared collections)
- Browser extension integration
- Mobile app
- Advanced filtering and sorting
- Tags and categories
- Citation style switching (MLA, APA, Chicago, etc.)

## License

MIT License - feel free to use this project for your own research needs.

## Acknowledgments

Based on the original FLOW chrome extension for debate research and evidence management.
