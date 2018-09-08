const { Node } = require('@twlv/core');
const { TcpReceiver } = require('@twlv/core/transports/tcp');
const { MDNSFinder } = require('../');
const assert = require('assert');

describe('MDNSFinder', () => {
  before(() => {
    process.on('unhandledRejection', err => console.error('Unhandled', err));
  });

  after(() => {
    process.removeAllListeners('unhandledRejection');
  });

  describe('cases', () => {
    it('can find each other node', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addReceiver(new TcpReceiver());
      node2.addReceiver(new TcpReceiver());

      node1.addFinder(new MDNSFinder());
      node2.addFinder(new MDNSFinder());

      try {
        await node1.start();
        await node2.start();

        let peer = await node1.find(node2.identity.address);
        assert.strictEqual(peer.address, node2.advertisement.address);
        assert.strictEqual(peer.pubKey, node2.advertisement.pubKey);
        assert.strictEqual(peer.urls[0], node2.advertisement.urls[0]);
      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });
});
