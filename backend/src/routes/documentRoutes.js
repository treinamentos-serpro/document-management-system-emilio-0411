const { Router } = require('express');
const controller = require('../controllers/documentController');
const upload = require('../middleware/upload');

const router = Router();

router.post('/upload', controller.requireOwner, upload, controller.upload);
router.get('/documents', controller.requireOwner, controller.list);
router.get('/documents/:id/download', controller.requireOwner, controller.download);

module.exports = router;
