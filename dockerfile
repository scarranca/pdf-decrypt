# Dockerfile
FROM node:20-alpine

# Install qpdf
RUN apk add --no-cache qpdf

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]