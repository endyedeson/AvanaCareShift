const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const cc = require('../controllers/clientController');

router.get('/', authenticate, cc.listClients);
router.get('/:id', authenticate, cc.getClient);
router.post('/', authenticate, requireRole('admin'), cc.createClient);
router.put('/:id', authenticate, requireRole('admin'), cc.updateClient);
router.delete('/:id', authenticate, requireRole('admin'), cc.deleteClient);

module.exports = router;
