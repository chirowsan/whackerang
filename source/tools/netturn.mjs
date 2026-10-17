import { createRequire } from 'module'; const require = createRequire('/tmp/pj/'); const Turn = require('/tmp/pj/node_modules/node-turn');
const s = new Turn({ authMech: 'long-term', credentials: { u: 'p' }, listeningIps: ['127.0.0.1'], relayIps: ['127.0.0.1'], listeningPort: 3478, minPort: 49160, maxPort: 49300, debugLevel: 'WARN' }); s.start(); console.log('turn up');
