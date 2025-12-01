# Frontend Quick Start Guide

## Installation

1. **Navigate to frontend directory:**
   ```bash
   cd "d:\Eye care ERP\frontend"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   copy .env.example .env
   ```
   
   Or create `.env` manually with:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_APP_NAME=Eye Care ERP
   VITE_APP_VERSION=1.0.0
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open browser:**
   Navigate to http://localhost:3000

## Available Scripts

- `npm run dev` - Start development server (port 3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code

## Login

Use these credentials to login:
- **Admin**: admin@eyecare.com / admin123
- **Doctor**: doctor@eyecare.com / doctor123
- **Receptionist**: receptionist@eyecare.com / reception123

## Troubleshooting

### Port Already in Use
If port 3000 is busy, the dev server will automatically try port 3001, 3002, etc.

### Cannot Connect to Backend
Make sure:
1. Backend server is running at http://localhost:8000
2. MongoDB is running
3. `.env` file has correct `VITE_API_BASE_URL`

### Module Not Found Errors
Run:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Project Structure

