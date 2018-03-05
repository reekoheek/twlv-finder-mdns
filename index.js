const multicastdns = require('multicast-dns');
const { EventEmitter } = require('events');

const SERVICE_TYPE = '_twlv._tcp.local';
const PTR_TTL = 4500;
// const SRV_TTL = 120;
const QUERY_INTERVAL = 3000;
const FIND_TIMEOUT = 1000;

class MDNSFinder extends EventEmitter {
  constructor () {
    super();

    this.name = 'mdns';
    this.peers = [];
  }

  find (address) {
    let peer = this.peers.find(peer => peer.address === address);
    if (peer) {
      return peer;
    }

    return new Promise(resolve => {
      let t = setTimeout(resolve, FIND_TIMEOUT);

      this.on('peer', peer => {
        if (peer.address !== address) {
          return;
        }

        clearTimeout(t);
        resolve(peer);
      });
    });
  }

  async up (node) {
    this.node = node;

    this.mdns = multicastdns();
    this.mdns.on('query', this._onQuery.bind(this));
    this.mdns.on('response', this._onResponse.bind(this));

    this._queryInterval = setInterval(this._query.bind(this), QUERY_INTERVAL);
    this._query();

    await sleep();
  }

  async down () {
    clearInterval(this._queryInterval);

    this._respond(true);

    await sleep();

    this.mdns.removeAllListeners('query');
    this.mdns.removeAllListeners('response');
    this.mdns.destroy();
    this.mdns = undefined;

    this.node = undefined;

    this.peers = [];
  }

  _query () {
    this.mdns.query({
      questions: [{ name: SERVICE_TYPE, type: 'PTR' }],
    });
  }

  _respond (removed = false) {
    let { address, pubKey, urls } = this.node.advertisement;
    let nodeAddress = `${address}.${SERVICE_TYPE}`;
    let urlResponses = urls.map((url, i) => {
      return {
        name: `${i}.url.${nodeAddress}`,
        type: 'PTR',
        ttl: removed ? 0 : PTR_TTL,
        data: url,
      };
    });

    this.mdns.response([
      {
        name: '_services._dns-sd._udp.local',
        type: 'PTR',
        ttl: removed ? 0 : PTR_TTL,
        class: 'IN',
        data: SERVICE_TYPE,
      },
      {
        name: SERVICE_TYPE,
        type: 'PTR',
        ttl: removed ? 0 : PTR_TTL,
        data: nodeAddress,
      },
      // {
      //   name: nodeAddress,
      //   type: 'SRV',
      //   ttl: removed ? 0 : SRV_TTL,
      //   data: {
      //     priority: 0,
      //     weight: 0,
      //     port: 0,
      //     target: address,
      //   },
      // },
      {
        name: nodeAddress,
        type: 'TXT',
        ttl: removed ? 0 : PTR_TTL,
        data: Buffer.from(pubKey).toString('base64'),
      },
      ...urlResponses,
    ]);
  }

  _onQuery (query) {
    try {
      query.questions.find(question => {
        if (question.type === 'PTR' && question.name === SERVICE_TYPE) {
          this._respond();
          return true;
        }
      });
    } catch (err) {
      console.warn('_onQuery caught error', err);
    }
  }

  _onResponse (resp) {
    try {
      let updatedPeers = [];

      resp.answers.forEach(answer => {
        if (!answer.name.endsWith(`.${SERVICE_TYPE}`)) {
          return;
        }

        let segments = answer.name.replace(`.${SERVICE_TYPE}`, '').split('.');
        let address = segments.pop();

        if (address === this.node.identity.address) {
          return;
        }

        let peer = this.peers.find(peer => peer.address === address);
        if (!peer) {
          peer = { address, pubKey: '', urls: [] };
          this.peers.push(peer);
        }

        if (segments.length === 0) {
          if (answer.type === 'TXT') {
            let pubKey = Buffer.from(answer.data.toString(), 'base64').toString('utf8');
            peer.pubKey = pubKey;
          }
        } else {
          let field = segments.pop();
          if (field === 'url') {
            if (peer.urls.indexOf(answer.data) === -1) {
              peer.urls.push(answer.data);
            }
          }
        }

        if (answer.ttl === 0) {
          peer.removed = true;
        }
        peer.timestamp = new Date();
        updatedPeers.push(peer);
      });

      updatedPeers.forEach(peer => {
        debounce(peer.address, () => {
          if (peer.removed) {
            let index = this.peers.indexOf(peer);
            if (index !== -1) {
              this.peers.splice(index, 1);
            }
          }
          this.emit('peer', peer);
        });
      });
    } catch (err) {
      console.warn('_onResponse caught error', err);
    }
  }
}

let debounces = [];
function debounce (address, callback, t = 0) {
  if (debounces[address]) {
    clearTimeout(debounces[address]);
  }
  debounces[address] = setTimeout(callback, t);
}

function sleep (t = 0) {
  return new Promise(resolve => setTimeout(resolve, t));
}

module.exports = MDNSFinder;
