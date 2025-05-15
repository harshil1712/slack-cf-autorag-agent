# Slack Knowledge Base Bot

An AI Agent deployed on Cloudflare that answers questions using your knowledge base (AutoRAG) in a Slack workspace.

## Overview

This project implements a Slack bot that:
- Responds to direct messages and mentions in Slack
- Uses OpenAI's GPT-4o to generate responses
- Searches a knowledge base using Cloudflare's AutoRAG
- Formats responses appropriately for Slack

The bot is built using Cloudflare Agents SDK.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Slack workspace](https://slack.com/) with permission to add apps

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/harshil1712/slack-cf-autorag-agent.git
cd slack-cf-autorag-agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Rename `.dev.vars.example` to `.dev.vars` and fill in the following variables:

```
SLACK_BOT_TOKEN=your_slack_bot_token
OPENAI_API_KEY=your_openai_api_key
```

### 4. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Under "OAuth & Permissions", add the following scopes:
   - `app_mentions:read`
   - `assistant:write`
   - `channels:history`
   - `chat:write`
   - `im:history`
   - `im:write`
3. Under "Event Subscriptions", enable events and set the Request URL to your Cloudflared tunnel URL
4. Subscribe to the following bot events:
   - `app_mention`
   - `assistant_thread_started`
   - `message.channels`
   - `message.im`
5. Install the app to your workspace
6. Copy the Bot User OAuth Token to your `.dev.vars` file

### 5. Set up Cloudflare AutoRAG

1. Create an AutoRAG instance in your Cloudflare dashboard
2. Configure it with your knowledge base documents
3. Note the instance name (used in the code as `autorag-demo`)

## Development

### Local development

Run the application locally with:

```bash
npm run dev
```

This starts a local development server using Wrangler.

### Expose local server

To expose your local server to the internet (for Slack to send events):

```bash
npm run start
```

This uses Cloudflared to create a tunnel to your local server.

### Configure Slack Event Subscriptions

1. In your Slack App settings, go to "Event Subscriptions"
2. Set the Request URL to your Cloudflared tunnel URL

## Deployment

Deploy to Cloudflare Workers with:

```bash
npm run deploy
```

Make sure to set up your environment variables in the Cloudflare dashboard:

1. Go to your Workers service
2. Navigate to "Settings" > "Variables"
3. Add the same variables as in your `.dev.vars` file

Alternatively, you can use the `wrangler` CLI to set the variables:

```bash
npx wrangler secret bulk put .dev.vars
```

## Architecture

- `KnowledgeBaseAgent`: Main agent class that handles Slack events and generates responses
- `KnowledgeBaseTool`: AI tool that searches the knowledge base for answers
- The application uses the Agents framework to route requests and manage state

## License

MIT

