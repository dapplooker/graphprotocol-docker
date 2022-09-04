FROM node:16

RUN apt-get update && apt-get -y upgrade
RUN apt-get -y install vim wget nginx npm

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . /app

CMD [ "node", "cronJob.js" ]