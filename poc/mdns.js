let MDNS = require('multicast-dns');

let mdns = MDNS();
mdns.on('response', response => {
  response.answers.forEach(answer => console.info('r', answer));
});

mdns.on('query', query => {
  query.questions.forEach(questions => console.info('q', questions));
});
