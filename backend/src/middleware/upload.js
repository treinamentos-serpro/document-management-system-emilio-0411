const multer = require('multer');
const { randomUUID } = require('node:crypto');
const fileRepository = require('../repositories/fileRepository');
const AppError = require('../errors/AppError');
const { maxFileSize } = require('../config');

const storage = multer.diskStorage({
  destination(req, file, callback) {
    fileRepository.ensureStorage().then(
      (directory) => callback(null, directory),
      (error) => callback(error),
    );
  },
  filename(req, file, callback) {
    callback(null, randomUUID());
  },
});

// O Multer rejeita ao atingir o limite; um byte extra torna o máximo inclusivo.
const receiveFile = multer({ storage, limits: { fileSize: maxFileSize + 1 } }).single('file');

module.exports = function upload(req, res, next) {
  receiveFile(req, res, (error) => {
    if (error && /^(Multipart: Boundary not found|Unexpected end of (form|file)|Malformed part header)$/.test(error.message)) {
      return next(new AppError(400, 'INVALID_MULTIPART', 'Formulário multipart inválido.'));
    }
    next(error);
  });
};
