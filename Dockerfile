# Stage 1: Build
FROM --platform=linux/amd64 node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Catch the Firebase key from Cloud Build so Vite can see it
ARG VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY

RUN npm run build

# ... (Keep Stage 2 exactly the same)

# Stage 2: Serve
FROM --platform=linux/amd64 nginx:stable-alpine

# 1. Copy your custom nginx.conf 
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Copy the build artifacts from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# 3. Expose the port Cloud Run expects
EXPOSE 8080

# 4. Start Nginx
CMD ["nginx", "-g", "daemon off;"]