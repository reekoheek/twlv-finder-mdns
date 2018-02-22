const { Node } = require('node-twlv');
const TCPListener = require('node-twlv/listeners/tcp');
const MDNSFinder = require('../');
const assert = require('assert');

describe('MDNSFinder', () => {
  before(() => {
    process.on('unhandledRejection', err => console.error(err));
  });

  after(() => {
    process.removeAllListeners('unhandledRejection');
  });

  describe('cases', () => {
    it('can find each other node', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new TCPListener());
      node2.addListener(new TCPListener());

      node1.addFinder(new MDNSFinder(node1));
      node2.addFinder(new MDNSFinder(node2));

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
