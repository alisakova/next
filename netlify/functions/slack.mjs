import * as dotenv from 'dotenv';
import fetch from "node-fetch";
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

const parseRequestBody = (stringBody, contentType) => {
  try {
    let inputStringBody = stringBody ?? "";
    let result = {};

    if (contentType && contentType === 'application/x-www-form-urlencoded') {
      const keyValuePairs = inputStringBody.split('&');
      keyValuePairs.forEach((pair) => {
        let individualKeyValuePair = pair.split('=');
        result[individualKeyValuePair[0]] = decodeURIComponent(individualKeyValuePair[1] || '');
      });
      return JSON.parse(JSON.stringify(result));
    } else {
      return JSON.parse(inputStringBody);
    }
  } catch {
    return undefined;
  }
}

app.message(async ({ say }) => {
  await say("Hi :wave:");
});

const TURN_ON_BUILD_PAYLOAD = {
  build_settings: {
    skip_prs: null,
  },
  cdp_enabled: false
};

app.command('/turn-on-build', async({body, ack}) => {
  ack();
  try  {
    await fetch("https://app.netlify.com/access-control/bb-api/api/v1/sites/8e9faadc-ba17-49b8-b9e5-b333bd2ba4eb", {
      method: "PUT",
      headers: {
        Authorization: process.env.BEARER_TOKEN,
      },
      body: JSON.stringify(TURN_ON_BUILD_PAYLOAD),
    }).then(async () => {
      await app.client.chat.postEphemeral({
        token: process.env.SLACK_BOT_TOKEN,
        channel: body.channel_id,
        text: "Билд превью включился" ,
        user: body.user_id
      });
    });
  } catch (error) {
    await app.client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel_id,
      text: "Запрос не прошел, повторите позже" ,
      user: body.user_id
    });
  }
});

export async function handler(event, context) {
  const payload = parseRequestBody(event.body, event.headers["content-type"]);

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