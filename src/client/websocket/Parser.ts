import * as Payloads from './Payloads.js';
import * as Heartbeater from './Heartbeater.js';

import type WebSocket from 'ws';
import type { Client } from '../Client';

function message(client: Client, data: WebSocket.RawData) {
	const parsedData = JSON.parse(data as unknown as string);

	const opcode: number = parsedData.op;
	const eventData: any = parsedData.d;
	const sequence: number | null = parsedData.s;

	// If the client is reconnecting/resuming, we don't want to override the last sequence number
	if (!client.api.should_resume) client.api.sequence = sequence ?? null;

	switch (opcode) {
	// General Gateway Events (GUILD_CREATE, GUILD_DELETE etc)
	case 0: {
		const eventName: string = parsedData.t;
		client.actions.loaded[eventName]?.handle(client, eventData);
		break;
	}

	// Invalid session (we should reconnect and resume)
	case 9:
		if (client.api.should_resume) break;
		client.ws.connection?.close(4000);
		Heartbeater.stop(client);
		client.reconnect();
		break;


		// Gateway HELLO event
	case 10:
		// Here we should resume the session if we have a pending resume request
		if (client.api.should_resume) {
			Payloads.sendResume(client);
			client.api.should_resume = false;
			client.api.heartbeat_interval = eventData.heartbeat_interval;
			client.emit('debug', `[DEBUG] Defined Heartbeater to ${eventData.heartbeat_interval}ms. Starting to Heartbeat.`);

			// Because we're starting to Heartbeater, we need to say that the last Heartbeater was acked.
			client.api.heartbeat_acked = true;
			client.ready = true;
			Heartbeater.start(client);
			Heartbeater.sendImmediately(client);
			break;
		}

		client.api.heartbeat_interval = eventData.heartbeat_interval;
		client.emit('debug', `[DEBUG] Defined Heartbeater to ${eventData.heartbeat_interval}ms. Starting to Heartbeat.`);

		// Because we're starting to Heartbeater, we need to say that the last Heartbeater was acked.
		client.api.heartbeat_acked = true;

		Heartbeater.start(client);
		Payloads.sendIdentify(client);
		break;

		// Gateway Heartbeater ACK
	case 11:
		client.emit('debug', '[DEBUG] Received Heartbeat ACK.');
		client.api.last_heartbeat_ack = Date.now();

		// Mark that we've received the Heartbeater ACK so we can send more heartbeats.
		client.api.heartbeat_acked = true;
		client.ping = client.api.last_heartbeat_ack - client.api.last_heartbeat;
		break;
	}
}


export default { message };