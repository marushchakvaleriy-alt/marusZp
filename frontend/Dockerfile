# Build Stage
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the app (make sure .env is handled or env vars passed at runtime?)
# Vite replaces env vars at BUILD time usually.
# We will pass VITE_API_URL via generic argument/environment in docker-compose.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production Stage
FROM nginx:alpine

# Copy built assets from previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Helper to handle React Router (SPA) - redirect 404 to index.html
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
