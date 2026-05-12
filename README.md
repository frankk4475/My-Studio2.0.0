# My-Studio Management System v3.8.0

A professional studio management system for photographers, now enhanced with Gemini AI and a modular MongoDB-backed architecture.

## Features
- **Booking Management**: Track and manage photography sessions.
- **Quote & Invoice Workflow**: Automated conversion from quote to invoice with tax/discount calculation.
- **Gemini AI Integration**:
  - **Auto-Quote**: Generate line items and pricing estimates from booking details.
  - **Comms Assistant**: Professional email drafting for quotes/invoices.
  - **Creative Director**: AI-suggested shot lists and lighting setups.
- **Security**: Built-in protection with Helmet, CORS, and JWT authentication.
- **API Documentation**: Interactive Swagger documentation at `/api-docs`.

## Tech Stack
- **Backend**: Node.js, Express
- **Database**: MongoDB (Mongoose)
- **AI**: Google Gemini Pro (via @google/generative-ai)
- **Security**: JWT, Bcrypt, Helmet, Express-Rate-Limit
- **Testing**: Jest, Supertest

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB instance

### Installation
1. Clone the repository.
2. Run `npm install`.
3. Create a `.env` file in the root directory (see Environment Variables below).
4. Run `npm start` to launch the server.

### Environment Variables (.env)
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/studioDB
JWT_SECRET=your_super_secret_key
GEMINI_API_KEY=your_google_gemini_api_key
```

### Running Tests
```bash
npm test
```

## API Documentation
Once the server is running, visit [http://localhost:3000/api-docs](http://localhost:3000/api-docs) to view the interactive API documentation.

## Project Structure
- `models/`: Mongoose schemas and models.
- `routes/`: Modularized API endpoints.
- `services/`: Core logic and third-party integrations (Gemini).
- `public/`: Frontend assets.
- `tests/`: Unit and integration tests.
