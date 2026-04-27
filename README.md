## Run in prod using pm2
```
pm2 start npm --name tax-llm-dev -- run dev
pm2 restart tax-llm-dev
pm2 save
pm2 startup
```




# Tax LLM API

A REST API for analyzing receipts using Large Language Models (LLMs). Upload receipt images and get structured transaction data extracted using AI.

## Features

- User registration and JWT authentication
- Receipt image upload and storage
- AI-powered receipt analysis with configurable LLM providers
- Structured data extraction (merchant, items, taxes, totals, etc.)
- PostgreSQL database for data persistence
- Docker support for easy deployment

## Prerequisites

- Node.js 20+ (for local development)
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 15+ (if running without Docker)
- An API key for your chosen LLM provider (OpenAI, Anthropic, or Ollama)

## Quick Start with Docker

1. Clone the repository and navigate to the project directory:
   ```bash
   cd tax-llm
   ```

2. Copy the environment file and configure it:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your LLM provider API key:
   ```
   OPENAI_API_KEY=your-api-key-here
   JWT_SECRET=your-secure-jwt-secret-here
   ```

4. Start the application with Docker Compose:
   ```bash
   docker-compose up -d
   ```

5. Run database migrations:
   ```bash
   docker-compose exec app npm run db:migrate
   ```

The API will be available at `http://localhost:3000`

## Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up PostgreSQL database and update `.env` with connection string

3. Run database migrations:
   ```bash
   npm run db:migrate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

#### Register a new user
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Receipt Analysis

#### Upload and analyze receipt
```bash
POST /api/receipts/analyze
Authorization: Bearer <token>
Content-Type: multipart/form-data

image: <receipt-image-file>
```

Response:
```json
{
  "receipt": {
    "id": 1,
    "filename": "receipt.jpg",
    "uploadedAt": "2024-01-01T00:00:00Z"
  },
  "analysis": {
    "id": 1,
    "name": "Grocery Shopping",
    "merchant": "SuperMart",
    "description": "Weekly groceries",
    "type": "expense",
    "issued_at": "2024-01-01",
    "category": "Groceries",
    "location": "123 Main St",
    "note": null,
    "contact": "555-1234",
    "transactions": [
      {"name": "Milk", "amount": 3.99},
      {"name": "Bread", "amount": 2.49}
    ],
    "tax": 0.65,
    "vat": null,
    "other_charges": null,
    "total": 7.13
  }
}
```

#### Get receipt analysis
```bash
GET /api/receipts/:id/analysis
Authorization: Bearer <token>
```

#### List user receipts
```bash
GET /api/receipts?limit=50&offset=0
Authorization: Bearer <token>
```

## Configuration

### Environment Variables

- **Server Configuration**
  - `PORT`: Server port (default: 3000)
  - `NODE_ENV`: Environment (development/production)

- **Database**
  - `DATABASE_URL`: PostgreSQL connection string

- **Authentication**
  - `JWT_SECRET`: Secret key for JWT tokens (min 32 chars)
  - `JWT_EXPIRES_IN`: Token expiration time (e.g., "7d")

- **LLM Provider**
  - `LLM_PROVIDER`: Choose between "openai", "anthropic", or "ollama"
  
- **OpenAI** (if using)
  - `OPENAI_API_KEY`: Your OpenAI API key
  - `OPENAI_MODEL`: Model to use (default: gpt-4-vision-preview)
  - `OPENAI_MAX_TOKENS`: Max tokens for response
  - `OPENAI_TEMPERATURE`: Temperature for creativity

- **File Upload**
  - `MAX_FILE_SIZE`: Maximum file size in bytes
  - `ALLOWED_FILE_TYPES`: Comma-separated list of allowed MIME types

## Project Structure

```
tax-llm/
├── src/
│   ├── db/            # Database configuration and migrations
│   ├── middleware/    # Express middleware
│   ├── routes/        # API routes
│   ├── services/      # Business logic
│   ├── types/         # TypeScript types
│   ├── utils/         # Utility functions
│   └── index.ts       # Application entry point
├── uploads/           # Uploaded receipt images
├── .env.example       # Example environment file
├── docker-compose.yml # Docker Compose configuration
├── Dockerfile         # Docker image definition
└── package.json       # Node.js dependencies
```

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Database Migrations
```bash
npm run db:migrate
```

## Security Considerations

- Always use HTTPS in production
- Keep your JWT secret secure and rotate it regularly
- Set appropriate CORS policies for your frontend
- Validate and sanitize all user inputs
- Store sensitive data encrypted
- Use rate limiting to prevent abuse

## License

MIT