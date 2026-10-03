const { ServiceBusClient } = require("@azure/service-bus");
require("dotenv").config();

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING
const queueName = process.env.SERVICE_BUS_QUEUE_NAME

const serviceBusClient = new ServiceBusClient(connectionString);

const sender = serviceBusClient.createSender(queueName);

module.exports = {
  serviceBusClient,
  sender,
};

