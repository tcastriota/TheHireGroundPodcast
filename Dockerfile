# Stage 1: Build
FROM --platform=linux/amd64 node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

RUN npm run build

# Stage 2: Serve (small Node server: static site + /api/search Gemini proxy)
FROM --platform=linux/amd64 node:20-alpine
WORKDIR /app

# 1. Copy the build artifacts from Stage 1 and the server
COPY --from=build /app/dist ./dist
COPY server.mjs ./

# 2. Expose the port Cloud Run expects
ENV PORT=8080
EXPOSE 8080

# 3. Start the server (reads GEMINI_API_KEY from the Cloud Run environment)
CMD ["node", "server.mjs"]
