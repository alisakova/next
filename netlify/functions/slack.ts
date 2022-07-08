import * as dotenv from 'dotenv';
import fetch from "node-fetch";
import { App, StaticSelectAction, ExpressReceiver, ReceiverEvent } from '@slack/bolt';

dotenv.config();

const expressReceiver = new ExpressReceiver({
  signingSecret: `${process.env.SLACK_SIGNING_SECRET}`,
  processBeforeResponse: true
});

const app = new App({
  signingSecret: `${process.env.SLACK_SIGNING_SECRET}`,
  token: `${process.env.SLACK_BOT_TOKEN}`,
  receiver: expressReceiver,
  ignoreSelf: false,
});

const parseRequestBody = (stringBody: string | null, contentType: string | undefined): any | undefined => {
  try {
    if (!stringBody) {
      return "";
    }

    let result: any = {};

    if (contentType && contentType === "application/json") {
      return JSON.parse(stringBody);
    }

    let keyValuePairs: string[] = stringBody.split("&");
    keyValuePairs.forEach(function (pair: string): void {
      let individualKeyValuePair: string[] = pair.split("=");
      result[individualKeyValuePair[0]] = decodeURIComponent(individualKeyValuePair[1] || "");
    });
    return JSON.parse(JSON.stringify(result));

  } catch {
    return "";
  }
}

const replyReaction = async (channelId, messageThreadTs) => {
  try {
    await app.client.reactions.add({
      token: process.env.SLACK_BOT_TOKEN,
      name: 'heart',
      channel: channelId,
      timestamp: messageThreadTs,
    });
  } catch (error) {
    console.error(error);
  }
}

const TURN_ON_BUILD_PAYLOAD = {
  build_settings: {
    skip_prs: null,
  },
  cdp_enabled: false
};

const TURN_OFF_BUILD_PAYLOAD = {
  build_settings: {
    skip_prs: true,
  },
  cdp_enabled: false
};

app.command('/start', async ({ body, ack }) => {
  await ack();
  await app.client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    channel: body.channel_id,
    text: "TEST",
    blocks: [
      {
        "type": "section",
        "block_id": "section678",
        "text": {
          "type": "mrkdwn",
          "text": "Pick a project from the dropdown list"
        },
        "accessory": {
          "action_id": "select-1",
          "type": "static_select",
          "placeholder": {
            "type": "plain_text",
            "text": "Select an item"
          },
          "options": [
            {
              "text": {
                "type": "plain_text",
                "text": "*Project 1*"
              },
              "value": "project-1"
            },
            {
              "text": {
                "type": "plain_text",
                "text": "*Project 2*"
              },
              "value": "project-2"
            },
            {
              "text": {
                "type": "plain_text",
                "text": "*Project 3*"
              },
              "value": "project-3"
            }
          ]
        }
      }
    ],
    user: body.user_id
  });
});

app.message(/is turning off/, async ({ ack, payload, body, event }) => {
  console.log("message", event, body);
  try {
    await fetch("https://app.netlify.com/access-control/bb-api/api/v1/sites/8e9faadc-ba17-49b8-b9e5-b333bd2ba4eb", {
      method: "PUT",
      headers: {
        Authorization: process.env.BEARER_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify(TURN_OFF_BUILD_PAYLOAD),
    });
    await app.client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.event.channel,
      text: "Deploy preview for any merge request is off :sparkles:",
      user: body.user.id
    });
  } catch (error) {
    await app.client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.event.channel,
      text: "Error, try later :face_with_rolling_eyes:",
      user: body.user.id
    });
  }
});

app.action('select-1', async ({ payload, say, ack, body, logger }) => {
  ack();
  const selectedOption = (payload as StaticSelectAction).selected_option;
  const { value, text: { text } } = selectedOption;

  const currentDate = new Date();
  const scheduledMessageDate = new Date(currentDate.getTime() + 30000);
  const scheduledMessageTimestamp = Math.floor(scheduledMessageDate.getTime() / 1000).toFixed(0);

  if (value === "project-1") {
    await app.client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel.id,
      text: `Nothing happened for ${text} :cry:`,
      user: body.user.id
    });
  }

  if (value === "project-2") {
    try {
      await fetch("https://app.netlify.com/access-control/bb-api/api/v1/sites/8e9faadc-ba17-49b8-b9e5-b333bd2ba4eb", {
        method: "PUT",
        headers: {
          Authorization: process.env.BEARER_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify(TURN_ON_BUILD_PAYLOAD),
      });
      await app.client.chat.postEphemeral({
        token: process.env.SLACK_BOT_TOKEN,
        channel: body.channel.id,
        text: `Deploy preview for any merge request for ${text} is on :fire:`,
        user: body.user.id
      });
      // Delete schedule message if new action is triggered? 
      await app.client.chat.scheduleMessage({
        channel: body.channel.id,
        post_at: scheduledMessageTimestamp,
        text: `Deploy preview for any merge request for ${text} is turning off :dancer:`, // add wait emoji
        user: body.user.id,
      });
    } catch (error) {
      await app.client.chat.postEphemeral({
        token: process.env.SLACK_BOT_TOKEN,
        channel: body.channel.id,
        text: "Error, try later :face_with_rolling_eyes:",
        user: body.user.id
      });
    }
  }
});

export async function handler(event) {
  // почитать https://api.slack.com/authentication/verifying-requests-from-slack
  // TODO проверять заголовки, что это точно слак ('user-agent': 'Slackbot 1.0 (+https://api.slack.com/robots)'), уточнить у девопсов
  const payload = parseRequestBody(event.body, event.headers["content-type"]);
  const result = payload.payload ? JSON.parse(payload.payload) : payload;

  if (payload && payload.type && payload.type === 'url_verification') {
    return {
      statusCode: 200,
      body: payload.challenge
    };
  }

  console.log(result);

  const slackEvent: ReceiverEvent = {
    body: result,
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

  return {
    statusCode: 200,
    body: ""
  };
}