FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Source is volume-mounted at runtime; this COPY makes the image self-contained
# for non-dev builds where no volume is attached
COPY . .

EXPOSE 5173

# --host exposes Vite to the Docker network (required for docker-compose proxy)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
