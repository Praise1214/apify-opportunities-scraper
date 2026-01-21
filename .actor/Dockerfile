# Use the official Apify Node.js image with Playwright support
FROM apify/actor-node-playwright-chrome:20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev --omit=optional

# Copy source code
COPY . ./

# Run the actor
CMD ["node", "src/main.js"]