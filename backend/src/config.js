const path = require('node:path');

const maxFileSize = Number(process.env.MAX_FILE_SIZE || 10485760);

if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
  throw new Error('MAX_FILE_SIZE deve ser um inteiro positivo em bytes.');
}

module.exports = {
  storageDir: path.resolve(__dirname, '..', process.env.STORAGE_DIR || 'storage'),
  maxFileSize,
};
