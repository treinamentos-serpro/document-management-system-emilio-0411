const { randomUUID } = require('node:crypto');
const documentRepository = require('../repositories/documentRepository');
const fileRepository = require('../repositories/fileRepository');
const AppError = require('../errors/AppError');

function toPublicDocument({ id, originalName, size, uploadedAt, owner }) {
  return { id, originalName, size, uploadedAt, owner };
}

async function create(file, owner) {
  const document = {
    id: randomUUID(),
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    storageName: file.filename,
    mimeType: file.mimetype,
  };

  try {
    return toPublicDocument(await documentRepository.create(document));
  } catch (error) {
    try {
      await fileRepository.remove(file.filename);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Falha ao registrar o documento e remover o arquivo gravado.',
      );
    }
    throw error;
  }
}

function list(owner) {
  return documentRepository.findByOwner(owner).map(toPublicDocument);
}

function getDownload(id, owner) {
  const document = documentRepository.findById(id);
  if (!document || document.owner !== owner) {
    throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }

  return {
    path: fileRepository.getPath(document.storageName),
    originalName: document.originalName,
    mimeType: document.mimeType,
  };
}

module.exports = { create, list, getDownload };
