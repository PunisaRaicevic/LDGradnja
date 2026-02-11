# Stage 1: Build React frontend
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV VITE_SUPABASE_URL=https://jcrqwldljyiyaiogjspt.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcnF3bGRsanlpeWFpb2dqc3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjcxMjAsImV4cCI6MjA4NjM0MzEyMH0.st50bMyt78cV144cBzf_-0pZ-FWtnL23YWLyF2TBQ5k

RUN npm run build

# Stage 2: Python backend + serve built frontend
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir matplotlib==3.9.0 && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /app/dist ./static

EXPOSE 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
