# Base image
FROM node:20.11.1

# Create app directory
WORKDIR /app
COPY node_modules /app/node_modules
COPY .next /app/.next
COPY next.config.ts /app/next.config.ts
# Bundle app source
#RUN npm install
#RUN npx nest build
#ENV NODE_ENV $NODE_ENV
#ENV VM_IP $VM_IP
#ENV COMMIT_HASH $COMMIT_HASH
# Expose app port
EXPOSE 3000

# Start the NestJS app
CMD ["npx", "next", "start"]
