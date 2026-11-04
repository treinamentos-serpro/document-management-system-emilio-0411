const { mkdir, unlink } = require('node:fs/promises');
const path = require('node:path');
const { storageDir } = require('../config');

async function ensureStorage() {
  await mkdir(storageDir, { recursive: true });
  return storageDir;
}

function getPath(storageName) {
  return path.join(storageDir, storageName);
}

async function remove(storageName) {
  await unlink(getPath(storageName));
}

module.exports = { ensureStorage, getPath, remove };
