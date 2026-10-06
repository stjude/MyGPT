FROM node:22.23.2-alpine3.23
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY package.json package-lock.json /app/
RUN npm ci --silent
COPY . /app
EXPOSE 3000
CMD ["npm", "start"]
