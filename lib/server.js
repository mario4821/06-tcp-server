'use strict';

const net = require('net');
const logger = require('./logger');
const faker = require('faker');

const app = net.createServer();
let clients = [];

const server = module.exports = {};

server.start = () => {
  if (!process.env.PORT) {
    logger.log(logger.ERROR, 'missing PORT');
    throw new Error('missing PORT');
  }
  logger.log(logger.INFO, `Server is up on PORT ${process.env.PORT}`);
  return app.listen({ port: process.env.PORT }, () => {});
};

server.stop = () => {
  logger.log(logger.INFO, 'Server is offline');
  return app.close(() => {});
};

const removeClient = socket => () => {
  clients = clients.filter(client => client !== socket);
  logger.log(logger.INFO, `Removing ${socket.name}`);
};

const parseCommand = (message, socket) => {
  if (!message.startsWith('@')) {
    return false;
  }

  const parsedMessage = message.split(' ');
  const command = parsedMessage[0];
  logger.log(logger.INFO, `Parsing a command ${command}`);

  switch (command) {
    case '@list': {
      const clientNames = clients.map(client => client.name).join('\n');
      socket.write(`${clientNames}\n`);
      break;
    }
    case '@quit': {
      removeClient(socket)();
      break;
    }
    case '@nickname': {
      const newName = parsedMessage[1];
      const prevName = socket.nickname;
      socket.nickname = newName;
      logger.log(logger.INFO, `${prevName} has  changed their name  to ${newName}`);
      socket.write(`New name is ${socket.nickname}\n`);
      break;
    }
    case '@dm': {
      const receiver = parsedMessage[1];
      const dm = parsedMessage.slice(2).join('');
      logger.log(logger.INFO, `${socket.nickname} sent a dm to ${receiver} ${dm}`);
      clients.forEach((client) => {
        if (client.nickname === receiver) {
          client.write(`DM from ${socket.nickname}: ${dm}\n`);
        }
      });
      break;
    }
    default:
      socket.write('INVALID COMMAND');
      break;
  }
  return true;
};

app.on('connection', (socket) => {
  logger.log(logger.INFO, 'new socket');
  clients.push(socket);
  socket.write('Welcome to chat!\n');
  socket.name = faker.internet.userName();
  socket.write(`Your name is ${socket.name}\n`);

  socket.on('data', (data) => {
    const message = data.toString().trim();
    logger.log(logger.INFO, `${socket.nickname} sending a message: ${message}`);
    if (parseCommand(message, socket)) {
      return;
    }
    clients.forEach((client) => {
      if (client !== socket) {
        client.write(`${socket.name}: ${message}\n`);
      }
    });
  });
  socket.on('close', removeClient(socket));
  socket.on('error', () => {
    logger.log(logger.ERROR, socket.name);
    removeClient(socket)();
  });
});
