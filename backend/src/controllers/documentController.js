const multer = require('multer');
const documentService = require('../services/documentService');
const AppError = require('../errors/AppError');
const { maxFileSize } = require('../config');

function requireOwner(req, res, next) {
  const owner = req.get('X-User-Id')?.trim();
  if (!owner) {
    return next(new AppError(
      400, 'INVALID_USER', 'Informe o cabeçalho X-User-Id com um valor não vazio.',
    ));
  }
  res.locals.owner = owner;
  next();
}

async function upload(req, res) {
  if (!req.file) {
    throw new AppError(400, 'FILE_REQUIRED', 'Envie um arquivo no campo file.');
  }
  const document = await documentService.create(req.file, res.locals.owner);
  res.status(201).json(document);
}

function list(req, res) {
  res.json({ documents: documentService.list(res.locals.owner) });
}

function download(req, res, next) {
  const { id } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AppError(400, 'INVALID_DOCUMENT_ID', 'Identificador de documento inválido.');
  }

  const document = documentService.getDownload(id, res.locals.owner);
  res.download(document.path, document.originalName, {
    headers: { 'Content-Type': document.mimeType || 'application/octet-stream' },
  }, (error) => {
    if (!error) return;
    if (error.code === 'ENOENT' || error.status === 404) {
      return next(new AppError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.'));
    }
    next(error);
  });
}

function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.storageErrors?.length) {
    console.error('Falha ao remover arquivos de um upload rejeitado:', error.storageErrors);
  }

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: {
        code: error.code,
        message: tooLarge
          ? `O arquivo excede o limite de ${maxFileSize} bytes.`
          : 'Upload inválido. Envie exatamente um arquivo no campo file.',
      },
    });
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' },
    });
  }

  console.error('Falha inesperada ao processar a requisição:', error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível processar a requisição.' },
  });
}

module.exports = { requireOwner, upload, list, download, handleError };
