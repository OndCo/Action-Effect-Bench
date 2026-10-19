import { createRequire } from 'node:module';
import { scalarString } from '../../action-effect-spec/implementations/javascript/strict-json.mjs';
import { assertPublicValue } from './artifacts.mjs';

const require = createRequire(new URL('../runtime-pilot/package.json', import.meta.url));
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const DEFAULT_FACTORY = parameters => new StdioClientTransport(parameters);

class FaultTransportError extends Error {
  constructor(code) { super(code); this.name = 'FaultTransportError'; this.code = code; }
}
function check(condition, code) { if (!condition) throw new FaultTransportError(code); }
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function jsonData(value, depth = 0) {
  check(depth <= 64, 'fault_reply_invalid');
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
  if (typeof value === 'string') { check(scalarString(value), 'fault_reply_invalid'); return; }
  check(value && typeof value === 'object', 'fault_reply_invalid');
  const array = Array.isArray(value);
  check(array || [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'fault_reply_invalid');
  const names = Reflect.ownKeys(value);
  if (array) check(names.length === value.length + 1, 'fault_reply_invalid');
  for (const key of names) {
    if (array && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(typeof key === 'string' && descriptor.enumerable && Object.hasOwn(descriptor, 'value')
      && (!array || (/^(?:0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length)), 'fault_reply_invalid');
    jsonData(descriptor.value, depth + 1);
  }
}
const validId = id => typeof id === 'string' || Number.isSafeInteger(id);

/**
 * Controlled MCP response loss over stdio, not an internet or HTTP wire-count claim.
 * record must durably append before resolving. Await close() to surface journal/cleanup failure.
 */
export function disconnectAfterMutationReply(options) {
  check(options && [Object.prototype, null].includes(Object.getPrototypeOf(options))
    && Reflect.ownKeys(options).every(key => ['transportFactory', 'record'].includes(key)
      && Object.hasOwn(Object.getOwnPropertyDescriptor(options, key), 'value')),
  'fault_transport_configuration');
  const { transportFactory = DEFAULT_FACTORY, record } = options;
  check(typeof transportFactory === 'function' && typeof record === 'function', 'fault_transport_configuration');
  return parameters => {
    const actual = transportFactory(parameters);
    check(actual && ['start', 'send', 'close'].every(name => typeof actual[name] === 'function'), 'fault_transport_configuration');
    const startActual = actual.start.bind(actual), sendActual = actual.send.bind(actual), closeActual = actual.close.bind(actual);
    const protocolHook = actual.setProtocolVersion?.bind(actual);
    const callbacks = { onmessage: actual.onmessage, onerror: actual.onerror, onclose: actual.onclose };
    let attempted = false, tracked = false, mutationId, discarded = false, closed = false, notified = false;
    let recording, recorded = false, closing, fatal, reported = false;

    function fail(code) { fatal ??= new FaultTransportError(code); return fatal; }
    function report() {
      if (reported || !fatal) return;
      reported = true;
      // Diagnostic callbacks cannot prevent physical cleanup or leak an unhandled rejection.
      try { Promise.resolve(callbacks.onerror?.(fatal)).catch(() => {}); } catch { /* Cleanup still runs. */ }
    }
    function notifyClose() {
      if (notified) return;
      notified = true;
      try {
        Promise.resolve(callbacks.onclose?.()).catch(() => { fail('fault_callback_failure'); report(); });
      } catch { fail('fault_callback_failure'); report(); }
    }
    function cleanup() {
      for (const [name, handler] of Object.entries(handlers)) {
        try { if (actual[name] === handler) actual[name] = undefined; }
        catch { fail('fault_close_failure'); report(); }
      }
    }
    function close() {
      if (!closing) {
        closed = true;
        closing = Promise.resolve().then(async () => {
          if (recording) await recording;
          let closeFailed = false;
          try { await closeActual(); }
          catch { closeFailed = true; }
          // A caller may already be closing when the pending reply finally arrives.
          if (recording) await recording;
          if (closeFailed) { fail('fault_close_failure'); report(); }
          cleanup();
          notifyClose();
          if (fatal) throw fatal;
        });
      }
      return closing;
    }
    function open() {
      if (fatal) throw fatal;
      check(!closed, 'fault_transport_closed');
    }
    const handlers = {
      onmessage(message, extra) {
        const matches = tracked && message?.jsonrpc === '2.0' && Object.hasOwn(message, 'id')
          && message.id === mutationId && !Object.hasOwn(message, 'method')
          && Object.hasOwn(message, 'result') !== Object.hasOwn(message, 'error');
        if (!matches) { callbacks.onmessage?.(message, extra); return; }
        if (discarded) return;
        discarded = true;
        let event;
        try {
          jsonData(message);
          assertPublicValue(message);
          const text = JSON.stringify(message);
          check(Buffer.byteLength(text) <= 2 * 1024 * 1024, 'fault_reply_invalid');
          const response = JSON.parse(text);
          event = freeze({ type: 'fault_mcp_reply_discarded', id: mutationId, response });
        } catch { fail('fault_reply_invalid'); }
        // Snapshot at arrival, then await the caller's durable append before closing.
        recording = Promise.resolve().then(async () => {
          if (!fatal) {
            try { await record(event); }
            catch { fail('fault_journal_failure'); }
          }
          recorded = true;
          report();
        });
        // Transport callbacks return void. Keep failures available from close(),
        // and report them out of band without an unhandled background rejection.
        void close().catch(() => {});
      },
      onerror(error) { callbacks.onerror?.(error); },
      onclose() {
        closed = true;
        if (!recording || recorded) {
          notifyClose();
          if (!closing) cleanup();
        }
      },
    };
    for (const [name, handler] of Object.entries(handlers)) actual[name] = handler;
    const transport = {
      async start() { open(); return startActual(); },
      async send(message, options) {
        open();
        if (message?.method === 'tools/call' && message.params?.name === 'add_issue_comment') {
          check(!attempted, 'fault_mutation_already_attempted');
          attempted = true;
          check(message.jsonrpc === '2.0' && Object.hasOwn(message, 'id') && validId(message.id), 'fault_mutation_request');
          mutationId = message.id;
          tracked = true;
        }
        return sendActual(message, options);
      },
      close,
      get sessionId() { return actual.sessionId; },
      get pid() { return actual.pid; },
      get stderr() { return actual.stderr; },
      ...(protocolHook ? { setProtocolVersion: version => protocolHook(version) } : {}),
    };
    // Client.connect reads old callbacks before assigning its own. Never expose
    // the internal interceptor through these getters or it will be chained twice.
    for (const name of Object.keys(callbacks)) Object.defineProperty(transport, name, {
      enumerable: true, configurable: true,
      get() { return callbacks[name]; }, set(value) { callbacks[name] = value; },
    });
    return transport;
  };
}
