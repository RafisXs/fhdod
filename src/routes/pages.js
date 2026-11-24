const path = require('node:path');
const express = require('express');
const frontend = path.resolve(__dirname, '../../frontend');

module.exports = app => {
  app.get('/', (req, res) => res.sendFile(path.join(frontend, 'index.html')));
  for (const page of ['admin', 'qr', 'tv', 'privacidade']) {
    app.get(['/' + page, '/' + page + '.html'], (req, res) => res.sendFile(path.join(frontend, 'src/pages', page + '.html')));
  }
  app.get('/index.html', (req, res) => res.sendFile(path.join(frontend, 'index.html')));
  app.use('/src', express.static(path.join(frontend, 'src'), { index: false, dotfiles: 'deny' }));
  app.use(express.static(path.join(frontend, 'public'), { index: false, dotfiles: 'deny' }));
};
