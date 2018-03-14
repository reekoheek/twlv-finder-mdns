const { Node } = require('@twlv/core');
const { TcpListener } = require('@twlv/core/transports/tcp');
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

      node1.addListener(new TcpListener());
      node2.addListener(new TcpListener());

      node1.addFinder(new MDNSFinder());
      node2.addFinder(new MDNSFinder());

      try {
        await node1.start();
        await node2.start();

        let peer = await node1.find(node2.identity.address);
        assert.equal(peer.address, node2.advertisement.address);
        assert.equal(peer.pubKey, node2.advertisement.pubKey);
        assert.equal(peer.urls[0], node2.advertisement.urls[0]);
      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });
});
