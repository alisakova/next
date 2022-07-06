import * as dotenv from 'dotenv';
import { App, ExpressReceiver } from '@slack/bolt';

dotenv.config();

const expressReceiver = new ExpressReceiver({
  signingSecret: `${process.env.SLACK_SIGNING_SECRET}`,
  processBeforeResponse: true
});

const app = new App({
  signingSecret: `${process.env.SLACK_SIGNING_SECRET}`,
  token: `${process.env.SLACK_BOT_TOKEN}`,
  receiver: expressReceiver
});

const parseRequestBody = (stringBody) => {
  try {
    return JSON.parse(stringBody ?? "");
  } catch {
    return undefined;
  }
}

app.message(async ({ say }) => {
  await say("Hi :wave:");
});

exports.handler = async function(event, context) {
  const payload = parseRequestBody(event.body);

  if (payload && payload.type && payload.type === 'url_verification') {
    return {
      statusCode: 200,
      body: payload.challenge
    };
  }

  const slackEvent = {
    body: payload,
    ack: async (response) => {
      return new Promise((resolve, reject) => {
        resolve();
        return {
          statusCode: 200,
          body: response ?? ""
        };
      });
    },
  };

  await app.processEvent(slackEvent);
}