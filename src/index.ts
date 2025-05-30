import { Agent, getAgentByName } from 'agents';
import { tool, generateText, type Message, appendResponseMessages } from 'ai';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { createOpenAI } from '@ai-sdk/openai';
import { type GenericMessageEvent, WebClient, type AppMentionEvent } from '@slack/web-api';

const KnowledgeBaseTool = tool({
	description: "Search the knowledge base for an answer to the user's question",
	parameters: z.object({
		question: z.string().describe('The question to search for in the knowledge base'),
	}),
	execute: async ({ question }) => {
		const resp = await env.AI.autorag('autorag-demo').aiSearch({
			query: question,
			stream: false,
		});
		return resp;
	},
});

export class KnowledgeBaseAgent extends Agent<Env, Message[]> {
	async onStart(): Promise<void> {
		// Initialize state as an empty array if it doesn't exist
		if (!this.state) {
			this.setState([]);
		}
	}

	async chat(body: GenericMessageEvent | AppMentionEvent): Promise<Response> {
		// Wait for the postToSlack function to complete
		this.ctx.waitUntil(this.postToSlack(body));

		// Return a 200 response
		return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
	}

	async callAi(userText: string) {
		// Make sure we have text to process
		if (!userText) {
			console.log('No text in message, skipping');
			return "I couldn't understand that message. Could you please rephrase?";
		}

		// Append user message to history
		this.setState([
			...(Array.isArray(this.state) ? this.state : []),
			{
				id: crypto.randomUUID(),
				role: 'user',
				content: userText,
			},
		]);
		const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
		// Generate context-aware response
		const { text, response } = await generateText({
			model: openai('gpt-4o'),
			system: `You are a Slackbot Support Assistant. You help users with their questions and issues. You have access to tools that retrieve information from the knowledge base.
			Keep your responses concise and to the point.
			`,
			messages: Array.isArray(this.state) ? this.state : [],
			tools: {
				KnowledgeBaseTool,
			},
			maxSteps: 2,
		});

		const formattedResponse = text
			? text.replace(/\[(.*?)\]\((.*?)\)/g, '<$2|$1>').replace(/\*\*/g, '*')
			: "I'm sorry, I couldn't generate a response.";

		// Add assistant response to history
		this.setState(
			appendResponseMessages({
				messages: Array.isArray(this.state) ? this.state : [],
				responseMessages: response.messages,
			})
		);

		// Format the response for Slack
		return formattedResponse;
	}

	async postToSlack(body: GenericMessageEvent | AppMentionEvent) {
		const client = new WebClient(env.SLACK_BOT_TOKEN);
		// Skip messages from bots or from this bot itself
		if (body.bot_profile || body.bot_id || body.subtype === 'message_changed') {
			console.log('Skipping bot message');
			return;
		}

		// Only process direct messages or mentions to avoid loops
		if (body.type === 'app_mention' || body.type === 'message') {
			try {
				const userMessage = body.text || '';
				const response = await this.callAi(userMessage);

				// Send response in thread if possible
				await client.chat.postMessage({
					channel: body.channel,
					text: response,
					// Add thread_ts if the message is in a thread to keep conversations organized
					thread_ts: body.thread_ts || body.ts,
					mrkdwn: true,
				});

				return { status: 'responded' };
			} catch (error) {
				console.error('Error processing message:', error);
				return { status: 'error', message: error instanceof Error ? error.message : String(error) };
			}
		}
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const body = (await request.json()) as { type: string; challenge?: string; event: GenericMessageEvent | AppMentionEvent };

		if (body.type === 'url_verification') {
			return new Response(body.challenge, { status: 200 });
		}

		if (request.method !== 'POST') {
			return new Response('Not found', { status: 404 });
		}

		if (body.type !== 'event_callback') {
			return new Response('Not found', { status: 404 });
		}

		let threadId = body.event.thread_ts || body.event.ts;
		let agent = await getAgentByName<Env, KnowledgeBaseAgent>(env.KnowledgeBaseAgent, threadId);
		return await agent.chat(body.event);
	},
} satisfies ExportedHandler<Env>;
