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

app.message(async ({ say, message }) => {
  await say("Hi :wave:");
  await replyReaction(message.channel, message.ts);
});

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

app.command('/start', async ({ say, body, ack }) => {
  await say({
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `Hey there!`
        },
        "accessory": {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Click Me"
          },
          "action_id": "button_click"
        }
      }
    ],
    text: `Hey there!`
  });
  // await app.client.chat.postEphemeral({
  //   token: process.env.SLACK_BOT_TOKEN,
  //   channel: body.channel_id,
  //   text: "TEST",
  //   blocks: [
  //     {
  //       "type": "section",
  //       "block_id": "section678",
  //       "text": {
  //         "type": "mrkdwn",
  //         "text": "Pick a project from the dropdown list"
  //       },
  //       "accessory": {
  //         "action_id": "select-1",
  //         "type": "static_select",
  //         "placeholder": {
  //           "type": "plain_text",
  //           "text": "Select an item"
  //         },
  //         "options": [
  //           {
  //             "text": {
  //               "type": "plain_text",
  //               "text": "*Project 1*"
  //             },
  //             "value": "project-1"
  //           },
  //           {
  //             "text": {
  //               "type": "plain_text",
  //               "text": "*Project 2*"
  //             },
  //             "value": "project-2"
  //           },
  //           {
  //             "text": {
  //               "type": "plain_text",
  //               "text": "*Project 3*"
  //             },
  //             "value": "project-3"
  //           }
  //         ]
  //       }
  //     }
  //   ],
  //   user: body.user_id
  // });
});

app.action('button_click', async ({ payload, say, ack, body, logger }) => {
  ack();
  logger.info(payload, body);
  await say("Deploy preview for any merge request is on :fire:");

  console.log((payload as StaticSelectAction).selected_option);
});

app.command('/turn-on-build', async ({ body, ack }) => {

  const currentDate = new Date();
  const scheduledMessageDate = new Date(currentDate.getTime() + 60000);
  const scheduledMessageTimestamp = Math.floor(scheduledMessageDate.getTime() / 1000).toFixed(0);

  ack();

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
      channel: body.channel_id,
      text: "Билд превью включился :fire:",
      blocks: [
        {
          "type": "section",
          "block_id": "section678",
          "text": {
            "type": "mrkdwn",
            "text": "Pick a project from the dropdown list"
          },
          "accessory": {
            "action_id": "select_1",
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

    await app.client.chat.scheduleMessage({
      channel: body.channel_id,
      post_at: scheduledMessageTimestamp,
      text: '/turn-off-build',
      user: body.user_id
    });

    // timerId = setTimeout(async () => {
    //   try {
    //     await fetch("https://app.netlify.com/access-control/bb-api/api/v1/sites/8e9faadc-ba17-49b8-b9e5-b333bd2ba4eb", {
    //       method: "PUT",
    //       headers: {
    //         Authorization: process.env.BEARER_TOKEN,
    //         "content-type": "application/json",
    //       },
    //       body: JSON.stringify(TURN_OFF_BUILD_PAYLOAD),
    //     });
    //     await app.client.chat.postEphemeral({
    //       token: process.env.SLACK_BOT_TOKEN,
    //       channel: body.channel_id,
    //       text: "Билд превью автоматически выключился :new_moon_with_face",
    //       user: body.user_id
    //     });
    //   } catch (error) {
    //     await app.client.chat.postEphemeral({
    //       token: process.env.SLACK_BOT_TOKEN,
    //       channel: body.channel_id,
    //       text: "Запрос на отключение деплоя превью не прошел, попробуйте вручную :face_with_rolling_eyes:",
    //       user: body.user_id
    //     });
    //   }
    // }, 60000);

  } catch (error) {
    await app.client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel_id,
      text: "Запрос не прошел, повторите позже :face_with_rolling_eyes:",
      user: body.user_id
    });
  }
});

export async function handler(event) {
  // TODO проверять заголовки, что это точно слак, уточнить у девопсов
  const payload = parseRequestBody(event.body, event.headers["content-type"]);

  if (payload && payload.type && payload.type === 'url_verification') {
    return {
      statusCode: 200,
      body: payload.challenge
    };
  }

  const slackEvent: ReceiverEvent = {
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

  return {
    statusCode: 200,
    body: ""
  };
}