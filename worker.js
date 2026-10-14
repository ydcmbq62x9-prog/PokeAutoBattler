/* PokéArena Duels relay (Cloudflare Worker, 6.16.0)
   Serves the game files and, at /relay/<CODE>, a tiny room that passes messages between two phones.
   One room per 4-letter code (a Durable Object). The host opens it, the first friend to join takes the
   seat, anyone after that is turned away. The relay never reads the messages, it only forwards them,
   and it keeps nothing once both have left.
   Messages from the relay itself are JSON with a "_" key; everything else is the other phone's message. */
import { DurableObject } from 'cloudflare:workers';

const say = (ws, what) => { try{ ws.send(JSON.stringify({ _:what })); }catch(e){} };
const shut = ws => { try{ ws.close(1000, 'bye'); }catch(e){} };

export class Room extends DurableObject {
  constructor(ctx, env){
    super(ctx, env);
    // phones send "ping" every few seconds; answering without waking the room keeps it cheap
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async fetch(req){
    const role = new URL(req.url).searchParams.get('role') === 'host' ? 'host' : 'join';
    const pair = new WebSocketPair(), me = pair[1];
    const hosts = this.ctx.getWebSockets('host'), joins = this.ctx.getWebSockets('join');
    // a refused phone is told why, then closed (a browser can't read the status of a refused upgrade);
    // it is tagged 'out' so its leaving never ends the pair that is already playing
    const no = role === 'host' ? (hosts.length && 'taken') : (!hosts.length ? 'nobody' : joins.length ? 'full' : '');
    this.ctx.acceptWebSocket(me, [no ? 'out' : role]);
    if(no){ say(me, no); shut(me); }
    else if(role === 'host') say(me, 'wait');
    else { say(me, 'peer'); say(hosts[0], 'peer'); }
    return new Response(null, { status:101, webSocket:pair[0] });
  }
  webSocketMessage(ws, msg){
    if(typeof msg !== 'string' || msg.length > 8000) return;
    const [role] = this.ctx.getTags(ws); if(role === 'out') return;
    const other = this.ctx.getWebSockets(role === 'host' ? 'join' : 'host')[0];
    if(other) try{ other.send(msg); }catch(e){}
  }
  webSocketClose(ws){ this.gone(ws); }
  webSocketError(ws){ this.gone(ws); }
  gone(ws){
    if(this.ctx.getTags(ws)[0] === 'out') return;
    // either phone leaving ends the link for both; the room is empty again and the code is free
    for(const o of this.ctx.getWebSockets()) if(o !== ws){ say(o, 'left'); shut(o); }
  }
}

export default {
  async fetch(req, env){
    const m = new URL(req.url).pathname.match(/^\/relay\/([A-Za-z0-9]{4})$/);
    if(!m) return env.ASSETS.fetch(req);
    if(req.headers.get('Upgrade') !== 'websocket') return new Response('The Duels relay only talks to the game.', { status:426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase())).fetch(req);
  },
};
