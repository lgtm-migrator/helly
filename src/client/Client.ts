import * as Heartbeater from './websocket/Heartbeater.js';

import EventEmitter from 'node:events';

import { defaultValues, ClientOptions } from './ClientOptions.js';
import { ActionManager } from '../actions/ActionManager.js';
import { ChannelManager } from '../managers/ChannelManager.js';
import { GuildManager } from '../managers/GuildManager.js';
import { UserManager } from '../managers/UserManager.js';
import { WebsocketManager } from './websocket/WebsocketManager.js';

import { Requester } from '../utils/Requester.js';
import { Intents } from '../utils/Intents.js';

/**
 * The main hub for interacting with the Discord API, and the starting point for any bot.
 * @extends {EventEmitter}
 * @param {ClientOptions} options Options to pass to the client
 */

class Client extends EventEmitter {
	api: any;
	user: null;
	ping: number;
	token: string;
	ready: boolean;

	ws: WebsocketManager;
	actions: ActionManager;
	guilds: GuildManager;
	users: UserManager;
	channels: ChannelManager;

	options: ClientOptions;
	requester!: Requester;
	constructor(options?: ClientOptions) {
		super();

		this.options = Object.assign(defaultValues, options);
		this.options.intents = Intents.parse(this.options.intents);
		this.api = {};
		this.ready = false;

		/**
		 * User that the client is logged in as
		 * @type {?ClientUser}
		 **/
		this.user = null;

		/**
		 * The average ping of the {@link Client}
		 * @type {number}
		 * @readonly
		 **/
		this.ping = -1;

		/**
		 * Authorization token for the logged in bot.
		 * @type {string}
		 */
		this.token = '';

		this.parseOptions(this.options);
		this.ws = new WebsocketManager(this);
		this.actions = new ActionManager();

		/**
		 * All of the guilds the client is currently handling, mapped by their ids
		 * @type {GuildManager}
		 */
		this.guilds = new GuildManager(this.options.cache?.guilds as number, this);

		/**
		 * All of the {@link User} objects that have been cached at any point, mapped by their ids
		 * @type {UserManager}
		 */
		this.users = new UserManager(this.options.cache?.users as number);

		/**
		 * All of the {@link Channel} objects that have been cached at any point, mapped by their ids
		 * @type {ChannelManager}
		 */
		this.channels = new ChannelManager(this.options.cache?.channels as number);
	}

	/**
	 * Returns whether the client has logged in, indicative of being able to access properties such as user and application.
	 * @returns {boolean}
	 */
	isReady(): boolean {
		return this.ready;
	}

	/**
	 * Logs the client in, establishing a WebSocket connection to Discord.
	 * @param {string} token Token for logging in
	 */
	login(token: string): void {
		if (!token) throw new Error('No token was provided');

		this.token = token;
		this.requester = new Requester(this.token, this);
		this.ws.connect();
		this.emit('debug', '[DEBUG] Login method was called. Preparing to connect to the Discord Gateway.');
	}

	parseOptions(options: any): void {
		if (typeof options !== 'object') throw new TypeError('Client options must be an object');
	}

	reconnect() {
		// Stop heartbeating (this automatically verifies if there's a timer)
		Heartbeater.stop(this);

		this.cleanUp();
		this.emit('reconnecting');

		// If we don't have a session id, we cannot reconnect
		this.api.should_resume = Boolean(this.api.session_id);
		this.login(this.token);
	}

	cleanUp() {
		this.ping = 1;
		this.ready = false;
	}
}

export { Client };